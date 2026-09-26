# 墙角凹口（凸角缺口）根因与修复

日期：2026-09-26

## 根因

所有按"每格一堵墙"生成墙体的层级，都把墙盒放在**格线**上、尺寸为 `CELL_SIZE × WALL_HEIGHT × WALL_THICKNESS`。两堵垂直的墙在凸角处只在**内边缘**相接：

```
        ┌───────────────┐
        │  wall A       │        ← A 沿 x，端面停在格线
   ┌────┴───┐           │
   │ wall B │  ▓▓▓▓▓▓   │        ▓ = 缺失的半个墙厚（每边 thickness/2）
   └────────┘           │
```

于是凸角外侧空掉一个 `thickness²` 的缺口（Level 1 是 0.2 × 0.2 m），沿整面墙高度贯通，靠近地面/踢脚线处最显眼——就是你截图红框里的"凹进去"。

**Level 0 早已修复**：`src/scene/level-zero/world.js` 用 `WALL_CORNER_EXTENSION = WALL_THICKNESS / 2 - 0.001` 把墙端伸出半个墙厚，让两堵墙交叉重叠把缺口填掉（留 1 mm 避免共面 z-fighting）。其他层级没有这段逻辑。

## 修复

把这套逻辑抽成公共工具，然后接给所有按格生成墙体的层级。

**新增 `src/scene/common/wall-corners.js`**

- `WALL_CORNER_EXTENSION = WALL_THICKNESS / 2 - 0.001`；
- `wallSegmentTransform(x, z, axis, extendNegative, extendPositive, { cellSize, height })`：无延伸时返回普通 `Vector3`，有延伸时返回 `{ position, scale }`（位置按正负延伸量平移、只在墙的长轴方向拉伸）；
- `getWallTransformPosition()` 供消费方读取位置。

**判定规则（与 Level 0 一致）**：某个墙端两侧的"越过端点的格子"都开放时，说明墙角插进可走空间、且垂直墙也在该处终止 → 该端需要延伸。端点另一侧仍是实体块（T 形接口）时不延伸，因为那里本来就没有缺口。

**接入的层级**

| 位置 | 覆盖层级 |
|---|---|
| `common/grid-world.js` `collectGridWallTransforms` | Level 8、13、37（共用的收集器，一处修全部） |
| `level-one/props.js` `collectLevelOneTransforms` | Level 1 |
| `level-two/props.js` `collectLevelTransforms`（共用构建器） | Level 2、3 |
| `level-five/props.js` | Level 5（格距用 `S`） |
| `level-six/index.js`、`level-seven/index.js` | Level 6、7 |
| `level-zero/world.js` | 改为复用公共工具（行为不变） |

Level 4 复用 Level 1 的收集器，自动一起修复。

**消费方适配**（延伸后 transform 变成 `{ position, scale }`）

- `level-one/wall-geometry.js`：`collapseWallRuns` 支持两种形状，并把延伸计入 run 的 `width`/`depth` 与中心位置（世界映射 UV 不受影响）；
- `level-one/index.js`：踢脚线取位置时兼容新形状；
- `level-three/index.js`：`wallVariant()` 取位置时兼容（否则被 NaN 过滤掉）；
- `level-thirteen/props.js`：手写的实例化循环改为同时读取 `position` 与 `scale`；
- `common/lighting.js` 的 `addInstancedBoxes` 原本就支持两种形状，无需改动。

## 验证

- 新增测试 `tests/level-one-wall-uv.test.mjs` → "wall runs stretch past convex corners so perpendicular walls overlap"：断言存在被拉伸的墙端、只在长轴拉伸、run 跨度只增不减且增量不超过角数 × 2 × 延伸量；
- 既有测试 "Level 1 wall run merging preserves the span of every original wall group" 更新为允许角部延伸；
- `npm run check`：全部通过（含 `check:scenes` 16 层 × 2 次构建、`check:lights` 16 层行走、prop-collision 等）；
- `npm run build`：在线版 + 独立版 + 内置检查通过；
- `after-level-one-corners.png`：Level 1 若干凸角的正/反两个方向近景与中景，墙端到踢脚线连续、无凹口。

## 第二轮：踢脚线的缺口（玩家复查发现）

第一轮只修了墙体，踢脚线仍按"每格一段"摆放。玩家复查时指出两处红色标记：凸角处踢脚线断成"V"形缺角、墙端处踢脚线比墙短一截。原因就是 `src/scene/level-one/index.js` 里的 `atFloor()`——它把墙体 transform 映射到地面高度时**丢掉了 `scale`**，于是踢脚线盒子始终是模块长度、停在墙的老端点。

修复：`atFloor()` 保留拉伸量，返回 `{ position, scale }`（`addInstancedBoxes` 本来就支持），踢脚线于是与墙同步延伸：凸角处两段互相搭接补掉缺口，墙端处与墙齐平。

验证：`after-skirting-corners.png`（Level 1 凸角的正/反两方向近景与中景）——踢脚线绕过墙端、转角连续，无缺角与短截。`npm run check`（exit 0，9 个检查脚本）与 `npm run build` 通过。

## 边界

- 其余层级没有按格生成的踢脚线（`skirting` 只出现在 Level 1 与 Level 12；Level 12 的踢脚线与每段墙同长，本身没有这个问题）。
- Level 12、Hub 使用手工摆放的墙体（非按格生成），不在本轮范围；若那里也存在同类凹口，需要按各自的构造方式单独特判。
