# Level 1 HABITABLE ZONE 停车场化纹理修复与截图验证

日期：2026-09-25/26

## 结论

原先 Level 1 读起来像一间干净的白房子，而不是 MEG 公开照片里的地下停车场，原因有三：

1. **天花板材质没有贴图。** `src/scene/level-one/index.js` 的 `ceilingMaterial` 只有一个纯色 `0xcfd1cc`；`textures.js` 里的 `createLevelOneCeilingTexture` / `createLevelOneCorridorCeilingTexture` / `createLevelOneFloorTexture` / `createLevelOneCorridorFloorTexture` 都是定义了、被 import 了、但从未被调用的死代码。截图中面积最大的纯白就是天花板。
2. **墙面是刻意"维护良好"的近纯白涂料。** 基色 `[202,209,203]`，`painted` 模式把噪点幅度压进 ±10 以内。
3. **烘焙光场把浅色面进一步推向过曝。** 墙面 light-field 强度 2.35、天花板 2.1。

第二轮根据实机反馈修掉了两个新问题：**墙面出现规律的竖直条纹**、**天花板有明显拼接痕迹**（纹理在大平面上平铺后暴露出重复特征）。第三轮按标注图继续追根因，结论如下。

### 第三轮：根因定位与修复

**墙面"钩状"竖纹 — 纹理里残留的单一频率节奏。**
诊断页（`diag-textures.png`：左=单格、中=2×2 平铺、右=对比度增强）里可以复现出一排间距一致、形状相同的污渍块。原因是值噪声（value noise）在规则网格上生成团块：只要某个污渍项只用一种格数（如 5 格 / 6.4 m ≈ 1.28 m），它的特征就会按这个间距重复；第二轮虽然加了扭曲，但"成串程度"仍由 5 格噪声控制，节奏没消掉。现在：
- 霉斑用三个互质八度（5 / 13 / 29）叠加；
- 竖直流挂的"成串程度"改用 13 + 29 双八度混合（不再有 1.28 m 周期）；
- 流挂采样点做二维域扭曲（±46 px 横向、±18 px 纵向）。

**天花板"拼接痕迹" — 三个原因叠在一起，逐一被 A/B 渲染证实。**
1. 旧写法 `tileNoise(x, y * 0.35, …)` 会破坏噪声纵向循环 → 每格接缝。已由 `tileNoiseXY`（两轴独立整数格数）解决；诊断页数值显示天花板现在两个方向的"接缝差 / 相邻差"≈1.0（1.28 vs 1.19、1.17 vs 1.17），即真正无缝。
2. 剩下可见的斜向长条，经 A/B 渲染（`diag-variants.png` 第 2 格把天花板反照率压平）确认来自**天花板纹理自身的粗颗粒斑块被透视拉长**。办法是把天花板的磨损八度调细（`wearOctaves: [11, 27, 6]`）、对比降到 0.55，且不含任何方向性项与墙脚带。
3. 天花板**只**由烘焙光场照亮（A/B：关掉贴图或关掉光场，天花板变全黑），因此光场形状会被直接读成"天花板的明暗结构"。原光场的径向渐变只有 4 个色标，在 0.36/0.78 处留下可见"膝点"，一排排灯具就形成了规则亮带。现在改为按 0.125 步长采样的平滑衰减，并给每盏灯加确定性的半径/强度抖动（0.82–1.19 倍、0.86–1.14 倍），打散灯具网格。

亮度核对：`diag-luma.png` 中同区域平均亮度 天花板 133.2 → 128.2（−3.8%），墙/地基本持平，整体观感不变。


## 改动

`src/scene/common/texture-utils.js`

- 新增 `tileNoiseXY(x, y, size, cellsX, cellsY, seed)`：两轴独立格数的无缝值噪声。旧写法 `tileNoise(x, y * 0.35, …)` 会破坏纵向循环，天花板每格都会留下一道接缝——这是"拼接痕迹"的根因。`tileNoise` 改为调用它，行为不变。

`src/scene/level-one/textures.js`

- `createLevelOneConcreteTexture` 新增 `grime` 通道与权重参数（`wearOctaves` / `blotchOctaves` / `blotchWeight` / `streakWeight` / `footWeight`）：低频霉斑、垂直水渍流挂（窄/宽两档 + 域扭曲 + 双八度成串 + 自上而下衰减）、墙脚污垢带（纹理底部约 13% 渐深）。污渍按通道降权（红 −14 / 绿 −24 / 蓝 −38），因此呈黄褐色。
- 墙面基色 `[202,209,203]` → `[188,181,160]`，走廊墙 `[210,218,214]` → `[199,193,173]`。
- `createLevelOneCeilingTexture`：基色 `[76,80,77]` → `[148,144,131]`，30×22 平铺（约 6 m 一格），改用细颗粒、低对比、各向同性的配方（无流挂、无墙脚带）。
- 法线与粗糙度细节贴图加入同一道污渍分量，水渍处更光滑（湿痕反光）。
- 删除三个未被调用的纹理函数；`CORRIDOR_WALL_SEED` 等被 `scripts/check-content-expansion.mjs` 断言的符号保持不变。

`src/scene/level-one/layout.js` / `index.js`

- 新增 `LEVEL_ONE_WALL_TILE_METERS = 6.4`，世界映射墙面的水平平铺从 3.2 m 放宽到 6.4 m，同一段纹理不再每 3.2 m 重现一次。
- 天花板材质改为 `map: createLevelOneCeilingTexture()` + 白色 tint。
- 烘焙光场：径向渐变改为平滑采样衰减，修掉 0.36/0.78 色标造成的可见"膝点"亮环；每盏灯加确定性半径/强度抖动，打散灯具网格造成的规则亮带（`getFixtureVariation`）。强度：墙 `2.35 → 1.95`、走廊墙 `2.2 → 1.85`、天花板 `2.1 → 1.65`、墙顶盖 `2.15 → 1.85`（地面 3.05 不变）。

`tests/level-one-wall-uv.test.mjs`

- 世界映射 UV 的连续性用例改为按 6.4 m 平铺宽度断言，与关卡实际配置一致。

## 诊断证据（第三轮）

- `diag-textures.png`：三张纹理的单格 / 2×2 平铺 / 增强对比视图，附无缝性数值（wrap 差 vs 相邻步长差）。天花板两项比值均 ≈1.0，即两轴无缝；墙面横向 ≈1.06（纵向不参与平铺，纹理由上到下的渐变是刻意的墙脚/顶部处理）。
- `diag-variants.png`：出生点同机位 2×2 对照 —— ①原样、②天花板反照率压平（条纹消失，证明斜条来自纹理斑块被透视拉长）、③去掉雾、④远视角。
- `diag-ceiling-ab.png`：早期对照 —— 关掉天花板贴图或关掉烘焙光场，天花板都会变全黑，说明其亮度完全来自光场。
- `diag-luma.png`：改动前后同区域平均亮度对比（天花板 −3.8%，墙/地持平）。

## 同机位对照

1280×800、Level 1 出生点、`debugFeatures=false`，没有调试跟随灯。

修复前（修复前的 `backrooms.html` 构建）：

![修复前](before-level-one-spawn.png)

修复后（开发场景 `app.html`）：

![修复后](after-level-one-spawn.png)

修复后（重新构建的正式产物）：

![修复后·正式构建](after-level-one-built.png)

1920×1080 近墙视角（前进约 3 秒），用于检查条纹是否仍显规律：

![近墙 1080p](after-level-one-hall.png)

## 验证

- `npm run check`：通过（含 `check-content-expansion`、`check-material-quality` 对 Level 1 纹理函数与调用形式的断言，以及场景加载检查 16 层 × 2 次构建）。
- `node --test tests/level-one-wall-uv.test.mjs tests/level-two-geometry.test.mjs tests/save-schema.test.mjs tests/stamina-cap.test.mjs`：全部通过。
- `npm run build`：在线版、独立版及其内置检查通过。
- 浏览器实机渲染（出生点与近墙两种机位，`debugFeatures=false`）：开发场景与正式构建画面一致，控制台无警告或错误。天花板与墙面近景另做 1080p/原图裁切检查，未再出现平铺接缝或等距条纹。

## 证据边界

- 每个状态只有出生点、近墙与千帧探针三组截图，不能代表所有房间、全部动态光照（灯管闪烁/损坏状态）下的表现。
- 天花板为细颗粒纹理，掠射角下仍会看到随透视拉长的柔和色带；这是平面材质在大平地上的正常表现，已把特征尺度压到最小，但无法完全消除。
- 实机为无头 Chrome（SwiftShader）渲染，与玩家机型的 GPU 在抗锯齿、各向异性过滤上可能有细微差异；4K 下如仍看到可疑线条，优先确认是否为天花板管道（细圆柱，两个方向各若干条）而非材质接缝。

## 范围

- 只修改 Level 1 的墙面/天花板纹理、其平铺宽度与烘焙光场强度。地面仍使用 `concrete-floor-worn` 照片贴图，未改动。
- 低画质模式走同一套程序化纹理（仅跳过细节贴图与光场），一并受益，未单独调整参数。
- `tileNoiseXY` 为通用工具函数，其他层级现有调用保持原行为。

## 并发修改提示

本仓库当前有另一会话在同时改造 Level 1（到达电梯 `arrivalElevator` 与 `storage-model.js`）。其当前中间状态存在 TDZ 缺陷：当存在含实体的存档时，`snapEntityStates` 会在 `arrivalElevator` 初始化之前调用 `isWalkable`，导致 Level 1 加载失败（`ReferenceError: Cannot access 'arrivalElevator' before initialization`）。本次截图验证通过清空 `localStorage` 规避该问题；该缺陷不属于本次改动范围，需由对应改动修复。
