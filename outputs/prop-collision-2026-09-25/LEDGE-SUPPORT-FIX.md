# 站在桌子边缘会向下穿模并滑落 —— 根因与碰撞优化

日期：2026-09-26
相关文件：`src/scene/common/platform-collision.js`、`scripts/check-platform-collision.mjs`、`scripts/check-prop-collision.mjs`、`tests/prop-collision-probe.html`

## 一、根因

`getPlatformFloorHeight` 判定「玩家是否被平台托住」用的是**整个胶囊**：

```js
const fullyOnTop =
  x - radius >= collider.minX && x + radius <= collider.maxX &&   // radius = 0.36
  z - radius >= collider.minZ && z + radius <= collider.maxZ;
const canLandOnPlatform = feetY >= collider.topY - LANDING_TOLERANCE;
if (fullyOnTop && canLandOnPlatform) floorHeight = Math.max(floorHeight, collider.topY);
```

于是：

1. 玩家在桌面上向边缘走，**只要胶囊的前缘越过桌沿**（身体中心距桌沿 0.36m），`fullyOnTop` 立刻变 false → 支撑高度从 `topY`（0.88）直接掉到地面（0）→ 玩家开始下落；
2. 下落过程中 `feetY` 很快低于 `topY - LANDING_TOLERANCE`（0.88−0.18），于是同一张桌子**也不再是落地候选**——身体就这样从桌面（0.13m 厚）里穿下去（第一人称下就是"陷进桌子"）；
3. 桌面碰撞体的侧面阻挡被 `sideClearance = 0.42` 提前放开（这是为了让玩家能跳上桌），所以在 `feetY ∈ (0.46, 0.88)` 期间没有任何阻挡；一旦脚降到 0.46 以下，`resolvePlatformOverlap` 又开始把玩家往桌外推（每帧上限 = 移动速度 × delta）——这就是"滑落到地面"。

**一句话根因**：支撑判定要求"整个胶囊都在平台顶面内"，而侧面阻挡是分高度放开的；两者叠加导致**胶囊刚碰到桌沿就被判成"悬空"，而桌子又没有侧面可以托住身体**，于是只能从桌面里掉下去。

### 复现（真实模块，Node）

| 阶段 | 旧规则（`supportInset = 0.36`） | 新规则（`supportInset = 0.05`） |
| --- | --- | --- |
| 失去支撑时身体中心离桌沿 | 仍在桌面内 **0.278 m** | **0.000 m**（中心越过桌沿才失撑） |
| "脚已低于桌面、身体仍在桌面上方"的帧数 | **3 帧**（其中 3 帧整帧卡在 0.13m 厚的桌面里） | **0 帧** |
| 落地 | 落入桌内 → 被每帧 ≤0.05m 地推出（滑落 1.2m+） | 直接落在桌外地面 |

## 二、修复

`src/scene/common/platform-collision.js`：

```js
export const LEDGE_SUPPORT_INSET = 0.05;

export function getPlatformFloorHeight({ colliders = [], x, z, feetY = Infinity,
  supportInset = LEDGE_SUPPORT_INSET, baseFloorHeight = 0 }) {
  let floorHeight = baseFloorHeight;
  for (const collider of colliders) {
    if (collider?.active === false || !Number.isFinite(collider?.topY)) continue;
    if (collider.topY <= floorHeight) continue;              // 抬不高地面的平台直接跳过（微优化）
    const bodyOnTop =
      x - supportInset >= collider.minX && x + supportInset <= collider.maxX &&
      z - supportInset >= collider.minZ && z + supportInset <= collider.maxZ;
    const canLandOnPlatform = feetY >= collider.topY - LANDING_TOLERANCE;
    if (bodyOnTop && canLandOnPlatform) floorHeight = collider.topY;
  }
  return floorHeight;
}
```

- **支撑改为"身体中心在平台顶面内"**，只留 0.05m 内缩作为边缘容差（避免身体擦边时在"支撑/失撑"之间抖动）。要走出桌子，身体中心必须真的越过桌沿 → 下落点落在桌外，不会再穿桌面。
- `radius` 参数改为 `supportInset`（全仓库调用点都只传 `colliders/x/z/feetY`，无需改动调用方）。
- 副作用（都是更符合直觉的）：**矮道具也能站**了——椅子座面（0.78×0.72）、汽油桶、干草卷等从"永远站不上"变成可站立；贴地 8cm 木板（`topY 0.17`）现在会像台阶一样把玩家抬上去，而不是让脚陷进板里。
- 未改动的语义：落地容差 `LANDING_TOLERANCE = 0.18`（仍必须从足够高的地方落下/跳上）、侧面阻挡 `colliderBlocksAtFeetHeight`、嵌入推出 `resolvePlatformOverlap`。

## 三、验证

1. **真机复现脚本（真实模块 + 真实 `FirstPersonControls`）**：桌沿下穿从 3 帧变 0 帧，失撑点从"桌内 0.278m"变"刚过桌沿"。
2. **跳上桌子不回归**：从地面起跳，顶点脚高 1.110m，落回桌面 `feet = 0.880`（= 桌面高度）✓。
3. **`tests/prop-collision-probe.html`（浏览器、真实关卡）新增 3 项边缘用例，全部通过（共 500 项）**：
   - 走到桌面边缘不提前失去支撑（实测失撑时中心已在桌面外 0.051m）；
   - 落到桌面以下且仍在桌面上方的帧数 = 0（不再穿模）；
   - 走出边缘后正常落地并离开桌面。
4. **`npm run check` 通过**，其中：
   - `check-platform-collision.mjs` 新增/改写断言：贴边（`x = maxX - 0.10`）仍被支撑、越过桌沿（`x = maxX + 0.20`）不再支撑、`x = 0.78`（胶囊刚好悬空）仍被支撑；
   - `check-prop-collision.mjs`：椅子座面现在是合法站立面（`0.625`），并新增"翻版"用例——马尼拉桌沿内 0.1m 仍支撑、桌沿外 0.2m 不支撑。
5. **`npm run build` 通过。**

## 四、碰撞性能（顺带核对，不需要再优化）

在**最重的关卡**（Level 12，382 个碰撞体）上按引擎真实调用形态测：

| 查询 | 单次耗时 |
| --- | --- |
| `isWalkable`（9 点格采样 + 1 次碰撞体扫描） | 7.38 µs |
| `getFloorHeight` | 4.83 µs |
| `resolvePosition`（每帧上限推出） | 5.57 µs |

每帧最多约 6 次查询（`resolveMove` ≤4 次 + `canStandAt` + 地面/推出）≈ **33 µs/帧**，只占 60fps 帧预算的 0.2%，无需再做空间索引；本次只加了 "`topY` 抬不高就跳过" 的短路。
