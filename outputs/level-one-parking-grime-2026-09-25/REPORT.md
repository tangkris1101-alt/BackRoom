# Level 1 HABITABLE ZONE 停车场化纹理修复与截图验证

日期：2026-09-25

## 结论

原先 Level 1 读起来像一间干净的白房子，而不是 MEG 公开照片里的地下停车场，原因有三：

1. **天花板材质没有贴图。** `src/scene/level-one/index.js` 的 `ceilingMaterial` 只有一个纯色 `0xcfd1cc`。`textures.js` 里的 `createLevelOneCeilingTexture` / `createLevelOneCorridorCeilingTexture` / `createLevelOneFloorTexture` / `createLevelOneCorridorFloorTexture` 都是定义了、被 import 了、但从未被调用的死代码。截图中面积最大的纯白就是天花板。
2. **墙面是刻意"维护良好"的近纯白涂料。** 基色 `[202,209,203]`，`painted` 模式把噪点幅度压进 ±10 以内（原注释写明不是受潮或破损的混凝土）。
3. **烘焙光场把浅色面进一步推向过曝。** 墙面 light-field 强度 2.35、天花板 2.1。

修复后，出生点同机位已能读出：发黄的旧涂料墙面、自上而下的水渍流挂与霉斑、墙脚污垢带，以及带水渍的灰色混凝土天花板。地面照片贴图、灯具数量、布局与玩法均未改动。

## 改动

`src/scene/level-one/textures.js`

- `createLevelOneConcreteTexture` 新增 `grime` 通道：低频大块霉斑、垂直水渍流挂（窄/宽两档，按 7 格低频噪声成簇分布，并自上而下衰减）、墙脚污垢带（纹理底部约 13% 渐深）。污渍按通道降权（红 −14 / 绿 −24 / 蓝 −38），因此污渍呈黄褐色。
- 墙面基色 `[202,209,203]` → `[188,181,160]`，走廊墙 `[210,218,214]` → `[199,193,173]`。
- 天花板基色 `[76,80,77]` → `[148,144,131]`，并接入材质；走廊/地面三个未被调用的纹理函数已删除（`CORRIDOR_WALL_SEED` 等被 `scripts/check-content-expansion.mjs` 断言的符号保持不变）。
- 法线与粗糙度细节贴图加入同一道污渍分量，水渍处更光滑（湿痕反光）。

`src/scene/level-one/index.js`

- 天花板材质改为 `map: createLevelOneCeilingTexture()` + 白色 tint。
- 烘焙光场强度：墙 `2.35 → 1.95`、走廊墙 `2.2 → 1.85`、天花板 `2.1 → 1.65`、墙顶盖 `2.15 → 1.85`（地面 3.05 不变）。

## 同机位对照

均为 1280×800、Level 1 出生点、`debugFeatures=false`，没有调试跟随灯。

修复前（修复前的 `backrooms.html` 构建）：

![修复前](before-level-one-spawn.png)

修复后（开发场景 `app.html`）：

![修复后](after-level-one-spawn.png)

修复后（重新构建的正式产物）：

![修复后·正式构建](after-level-one-built.png)

前进约 2.6 秒后的近墙/走廊视角：

![近墙](after-level-one-hall.png)

## 验证

- `npm run check`：通过（含 `check-content-expansion` / `check-material-quality` 对 Level 1 纹理函数与调用形式的断言）。
- `node --test tests/level-one-wall-uv.test.mjs tests/level-two-geometry.test.mjs tests/save-schema.test.mjs tests/stamina-cap.test.mjs`：9 项全部通过。
- `npm run build`：在线版、独立版及其内置检查通过。
- 浏览器实机渲染（1280×800，Level 1 出生点，`debugFeatures=false`）：开发场景与正式构建画面一致，控制台无警告或错误。

## 证据边界

- 每个状态只有一张出生点同机位截图，不能代表所有房间、全部动态光照（灯管闪烁/损坏状态）下的表现。
- 天花板纹理为大面积平铺（10×7 重复），在贴近天花板仰视时仍可能看出重复；本次未做逐块差异化。

## 范围

- 只修改 Level 1 的墙面/天花板纹理与其烘焙光场强度。地面仍使用 `concrete-floor-worn` 照片贴图，未改动。
- 低画质模式走同一套程序化纹理（仅跳过细节贴图与光场），一并受益，未单独调整参数。

## 并发修改提示

本仓库当前有另一会话在同时改造 Level 1（到达电梯 `arrivalElevator` 与 `storage-model.js`）。其当前中间状态存在 TDZ 缺陷：当存在含实体的存档时，`snapEntityStates` 会在 `arrivalElevator` 初始化之前调用 `isWalkable`，导致 Level 1 加载失败（`ReferenceError: Cannot access 'arrivalElevator' before initialization`）。本次截图验证通过清空 `localStorage` 规避该问题；该缺陷不属于本次改动范围，需由对应改动修复。
