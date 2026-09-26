# Level 0 灯具分布过密 — 根因分析与修复（2026-09-26）

## 0. 修复结果速览

| 指标 | 修复前（HEAD） | 修复后 |
| --- | --- | --- |
| 灯具总数 | 156 | **52** |
| 密度 | 1.39 个/100 m² | **0.46 个/100 m²** |
| 平均间距 | 8.5 m | **14.7 m** |
| 最近邻间距 | 全部 8.00 m（刚性点阵） | min 11.3 / 中位 14.4 / p90 17.9 m |
| 亮区覆盖 | 26% 格点灯 | 18 盏 / 152 格（≈135 m²/盏） |
| 普通区覆盖 | 满密点阵 | 30 盏 / 386 格（≈206 m²/盏） |
| 暗区覆盖 | 12% 格点灯 | 4 盏 / 165 格（≈660 m²/盏，更暗） |
| 灯具形体 | 1.42 m 方板 + 0.24 边框 | 1.9–2.5 m × 0.42 m 线型灯管（走廊顺轴向） |
| 光晕 | 3.0 / 3.6 / 4.2 m | 2.2 / 2.5 / 2.8 m |
| 固定机位平均亮度 | 基准 | 偏差 −11% ~ +7%（暗区 −11% 属预期，其余在 ±7% 内） |

同机位画面对比：修复前（`before-*.png`）走廊/展厅能同时看到 4–5 块方板，修复后（`after-*.png`）只剩远端或头顶一盏线型灯；俯视布点见 `fixture-density-map.png`（左：旧规则 22 盏；右：修复后实际布点 52 盏）。

## 1. 结论（一句话）

灯具密度不是"参数没调好"，而是一次重构把**按房间/走廊分区的稀疏长条灯规则**换成了**全图统一的 `col % 2 && row % 2` 方格规则**，同时把最小间距约束从 17 m 降到 7.44 m（低于新格距，等于失效），再叠加后来新增的 3–4.2 m 光晕平面与约 10 m 半径的烘焙光场，最终全图灯具从 **22 个涨到 156 个（7 倍）**，间距从 22.6 m 变成刚性的 8 m。

## 2. 证据（修复前）

用真实模块复算（`fixture-audit.mjs`、`density-compare.mjs`，均直接 import 游戏代码）：

| 指标 | 旧规则（ed387ba 之前） | 现行（HEAD） |
| --- | --- | --- |
| 候选点 | 34 | 157 |
| 实际落点 | 22 | **156** |
| 密度 | 0.20 个/100 m² | **1.39 个/100 m²** |
| 平均间距 | ≈ 22.6 m | **≈ 8.5 m** |
| 最近邻间距分布 | —— | min 8.00 / 中位 8.00 / max 8.94 m |
| 间距 < 8 m 的灯具数 | —— | **0** |

- 地图规模：45 × 39 格、格宽 4 m、开放格 703 个 = 11,248 m²；156 个灯具 = 每个灯具仅占 4.5 个开放格。
- 最近邻全是 8.00 m ⇒ 布点是**严格 8 m × 8 m 刚性点阵**，没有任何分区/疏密变化（俯视图见 `fixture-density-map.png`）。

## 3. 根因链

### 3.1 主因：布点规则被替换（提交 `ed387ba` "Update BackRoom gameplay and UI"）

```diff
-      const roomFixtureGrid = col % 6 === 3 && row % 4 === 1;      // 房间：24 m × 16 m
-      const brightFixtureGrid = col % 5 === 2 && row % 4 === 1;    // 亮区：20 m × 16 m
+      const roomFixtureGrid = col % 2 === 1 && row % 2 === 1;      // 全图：8 m × 8 m
       const corridorCenter = !isSpacious && (horizontalCorridor || verticalCorridor);
-      const corridorGrid = corridorCenter && row % 5 === 2 && col % 6 === 3;  // 走廊：24 m × 20 m
+      const corridorFixtureGrid = horizontalCorridor ? col % 2 === 1 : row % 2 === 1;  // 沿走廊每 2 格 = 8 m
+      const fixtureGrid = isSpacious ? roomFixtureGrid : corridorFixtureGrid;
       const shouldLight =
-        (isBrightZone && brightFixtureGrid) ||
-        (!isDarkZone && isSpacious && roomFixtureGrid) ||
-        (!isDarkZone && corridorGrid) ||
-        (isDarkZone && roomFixtureGrid && (row + col) % 2 === 0);
+        fixtureGrid && ((isDarkZone && …) || (!isDarkZone && (isSpacious || corridorCenter)));
```

- 房间：每个 2×2 格（8 m × 8 m）一盏 → 比旧规则（6×4 格）**密 6 倍**；
- 走廊：沿走廊方向每 2 格（8 m）一盏 → 比旧规则（每 6 格 / 每 5 格）**密约 3 倍**；
- 旧版三套独立网格（房间 `col%6/row%4`、亮区 `col%5/row%4`、走廊 `row%5/col%6`）被合并成一条与区域无关的 `col%2/row%2` 规则：**亮区不再有自己的（更密的）布点**，只剩强度/范围差异；暗区还保留 `floor(col/5)+floor(row/5)` 的块状棋盘，实测暗区 20/165 格点灯（12%）、亮区 40/152 格（26%），而其余大部分普通区域是满密点阵。
- 旧版那份"每个灯具按区域给不同面板宽度（2.08/2.58/2.95 m）"的信息也一起丢掉了（见 3.3）。

代码位置：`src/scene/level-zero/world.js:373-398`。

### 3.2 帮凶：最小间距约束被降到格距以下，等于失效

```js
// 现在（world.js:42）
const LEVEL_ZERO_MIN_FIXTURE_DISTANCE = CELL_SIZE * 1.86;   // 7.44 m
// 旧版（constants.js:MIN_FIXTURE_DISTANCE，ed387ba 前）
export const MIN_FIXTURE_DISTANCE = CELL_SIZE * 4.25;       // 17 m
```

剔除逻辑两版一模一样（`world.js:428-437`，按优先级排序后逐个判断最小距离），但阈值从 17 m 降到 7.44 m，而新格距本身就是 8 m ⇒ 实测 157 个候选只剔掉 1 个，约束形同虚设。

### 3.3 观感放大器一：灯具形体从"细长灯管"变成"方形灯板"

- 旧版：`BoxGeometry(1, 0.035, 0.36)`，按区域 `panelWidth = 2.08 / 2.58 / 2.95 m` —— 细长灯管，间距 22 m 时是"远处几盏灯"。
- 现行：`BoxGeometry(1, 0.035, 1)`，`panelSize = 1.42` + 0.24 边框 = **1.66 m 方板**（`world.js:129-131, 171-178`），8 m 点阵下整块天花板变成格栅。

### 3.4 观感放大器二：3.0–4.2 m 加色光晕（提交 `abe655c` 新增）

`world.js:181-186`：每盏灯叠一张 3.0 / 3.6 / 4.2 m 的加色平面光晕（`opacity 0.3`）。8.5 m 间距下，相邻光晕直径 3.6–4.2 m，视觉上连成一片"到处都是灯"。旧版没有光晕。

### 3.5 观感放大器三：烘焙光场半径≈10 m，池子互相重叠

`src/scene/level-zero/index.js:85-130`：512×512 贴图覆盖 180 × 156 m（1 纹素 ≈ 0.35 m），每盏灯画一个半径 `range/width*512*1.22` 的径向光斑——`range = 8.8 m` 时半径约 30 纹理素 ≈ **10.7 m**，而灯距只有 8.5 m ⇒ 光斑完全重叠，天花板/地面被烘成均匀亮面，进一步强化"灯很多"的观感。

### 3.6 附带发现：动态点光池缩到 8 盏，绝大多数灯只靠发光面 + 烘焙光场

`world.js:41` `ACTIVE_FIXTURE_LIGHTS = 8`（按玩家距离轮换 8 盏 `PointLight`），`constants.js:6` 的 `MAX_POINT_LIGHTS = 12` 已无人引用（死常量）。即 156 盏灯里只有 8 盏真正投光，其余全靠自发光面板和 3.5 节的烘焙光场"假装"照亮——所以"看起来灯多"的观感几乎完全由布点密度、面板尺寸、光晕和光场决定，也意味着**减灯后必须同步加大光场/强度，否则会整体变暗**。

## 4. 已实施的修复

### 4.1 布点改为"净空距离驱动"（`src/scene/level-zero/world.js`）

```js
// world.js:41-48
const ACTIVE_FIXTURE_LIGHTS = 8;
const LEVEL_ZERO_FIXTURE_SPACING = CELL_SIZE * 3.5;        // 14 m
const LEVEL_ZERO_BRIGHT_FIXTURE_SPACING = CELL_SIZE * 2.5;  // 10 m
const LEVEL_ZERO_DARK_FIXTURE_SPACING = CELL_SIZE * 5;      // 20 m
```

- 每个开放格（房间格或走廊中线）都只作**候选**，真正落点由 `world.js:458-470` 的净空判定决定：与已落点的距离 ≥ `max(本候选间距, 已落点间距)`，因此房间大小、走廊长短、区域切换都不会再把灯叠在一起；
- 候选顺序 = 区域优先级（亮区 > 房间 > 走廊）→ 确定性哈希 `((col*73856093) ^ (row*19349663)) & 1023`，避免按扫描顺序落点重新长出刚性网格；
- 暗区候选额外限制在 5×5 块状棋盘上（`world.js:395`），配合 20 m 净空，实测只剩 4 盏、平均 660 m²/盏；
- 出生点/出口两盏灯保留（优先级 8 / 7，排在最前），不会被净空判定剔除；
- 每盏灯新增 `orientation`（竖直走廊顺轴向旋转 90°）与 `panelLength`（亮区 2.5 / 房间 2.2 / 走廊 1.9 / 暗区 2.0 m）。

### 4.2 灯具形体与光晕（`world.js:134-137, 176-196`）

- 方板 → **线型灯管**：`BoxGeometry(1, 0.035, 1)` 实例按 `(panelLength, 1, 0.42)` 缩放，边框 +0.22 m，走廊灯管顺走廊方向；
- 光晕 3.0 / 3.6 / 4.2 m → **2.2 / 2.5 / 2.8 m**；
- 范围（同时驱动烘焙光场半径与动态点光距离）8.8 / 10.8 / 6.8 m → **13.5 / 16.5 / 9.5 m**，出生点与出口 13.6 / 13.2 → 15.5 / 15.2 m，补偿灯数减少带来的照度损失。

### 4.3 未改动的部分

- 动态点光池仍为 8 盏、按玩家距离轮换；烘焙光场的贴图尺寸、强度曲线与材质乘数（`index.js` 的 1.28 / 0.94 / 0.8）未改，因为实测亮度已落在 ±7% 内。

## 5. 验证

| 项目 | 结果 |
| --- | --- |
| 密度复算（`fixture-audit.mjs`） | 52 盏、0.46 个/100 m²、平均间距 14.7 m、最近邻 11.3–24.3 m |
| 覆盖度 | 明区开放格到最近灯具 ≤16 m；>16 m 的 13 格全部落在暗区内（设计如此） |
| 同机位亮度（`capture-light-poses.py`，7 个机位，960×540） | spawn 49.6→48.0、hall-a 65.2→69.7、hall-b 59.1→55.2、bright 56.3→56.1、dark 56.4→50.2、corridor 56.5→56.0、room-left 56.5→56.1 |
| 画面 | `before-*.png` / `after-*.png` 同机位对比：走廊 4–5 块方板 → 远端 1 盏灯管；展厅 2 块方板 → 头顶 1 盏线型灯 |
| `npm run check` | 通过（含 `check-level-scene-load.mjs`：16 关 32 个场景构建） |
| `npm run build` | 通过（web + standalone，24.73 MiB） |

## 6. 复算与取证脚本

| 文件 | 用途 |
| --- | --- |
| `fixture-audit.mjs` | 复算当前布点的灯具数、密度、最近邻间距、覆盖度、ASCII 俯视图 |
| `density-compare.mjs` | 新旧两套布点规则的密度并排对比 |
| `make-density-map.mjs` + `shoot-map.py` | 生成 `fixture-density-map.png`（左：旧规则 22 盏；右：修复后**实际运行时** 52 盏） |
| `capture-light-poses.py` | 7 个固定机位截图 + 平均亮度统计（`python capture-light-poses.py before|after`） |
