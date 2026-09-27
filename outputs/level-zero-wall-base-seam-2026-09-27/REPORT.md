# Level 0 墙脚「虚线」修复（2026-09-27）

## 现象

Level 0 里每一面墙与地面的交界处都有一条**像缝线一样的虚线**：一串规则的小暗块，随视角移动而闪烁。截图见 [修复前](before-overlay-14mm.jpg)。

## 排查

用浏览器探针（真实 `createLevelZeroScene()` + 真实渲染管线）在墙脚前一米多处复现，逐个关掉可疑对象：

| 关掉什么 | 虚线 |
| --- | --- |
| 阴影（`world.shadowRig.light.castShadow = false`，drawCalls 94 → 62） | **仍在** |
| 地面覆层（`carpetMacroOverlay`） | **消失** |
| 墙体 / 地板 | 无关 |

所以既不是阴影贴图锯齿，也不是几何缺失，而是那块贴地覆层平面。

## 原因

`src/scene/level-zero/index.js` 的 `carpetMacroOverlay`：一张覆盖整张地图的**半透明** `PlaneGeometry`，铺在 `y = 0.014`，用大尺度污渍/人行走廊贴图压住 3m 重复的地毯花纹。

墙体是 `RoundedBoxGeometry(..., 2, WALL_EDGE_RADIUS = 0.028)`——底边有 **2.8cm 圆角**。覆层平面（1.4cm）正好切在这段圆弧的**中间**：平面与圆弧在那个高度几乎相切，两个面的深度值相差不到一个深度精度，于是深度测试沿交界线**逐像素来回翻转**，形成规则虚线。俯视看下去就是一条缝线。

## 修法

把覆层抬到圆角**之上**（`y = 0.014` → `0.034`）。这样平面交的是墙的**竖直面**，是接近垂直的横切，深度差稳定；覆层伸进墙内的部分照旧被墙挡住，不会把地毯污渍糊到墙上。

- [修复前](before-overlay-14mm.jpg)：虚线贯穿整个墙脚。
- [修复后](after-overlay-34mm.jpg)：交界干净，覆层仍在（污渍、走廊压痕都在）。

## 验证

- `npm run check` 全链通过；`node --test tests/*.test.mjs` 21/21；`npm run build` 通过（standalone 24.77 MiB，web 入口 gzip 444.5 KiB）。
- 探针页临时创建、验证后已删除；改动只在 `src/scene/level-zero/index.js` 一行（含说明注释）。

## 顺带确认范围

其它关卡没有同类贴地覆层：`grep` 全仓库只有 Level 10 的 `road.position.y = 0.018`（不透明路面，下方是地面，不存在与圆弧相切的情况），未做改动。
