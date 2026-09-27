# Level 3：入口到 HOTEL 出口的距离 + 实体卡在 OFFICE 门

日期：2026-09-27　范围：`src/scene/level-three/`、`src/scene/entities/spawn.js`、`tests/`、`docs/`

## 1. 两个问题的根因

### 1.1 入口与 HOTEL 出口太近

- 入口（所有来路都落在这个壁龛）：格 (3,3) → 世界 (-64, -32)。
- HOTEL 电梯：格 (15,18) → 世界 (-16, 28)，直线 **76.8 m**；而 OFFICE 电梯在 148.5 m 外。
- 也就是说：从管道切出来、走到装配线房间，就能直接跳去 Level 5——比本层的主出口近一半。

### 1.2 实体卡在 OFFICE 门（比看到的更糟）

分三层原因，逐层查出来的：

1. **出口门朝向错了**。路线写的是 `rotation: 0`，而 0 在 Level 3 的约定里表示"面朝 +Z（南）"——但 OFFICE 电梯所在格的南邻居 (36,21) 是墙：门开向 2 m 外的墙，玩家从大厅走过来只看得到轿厢侧面。HOTEL 那扇（`rotation: Math.PI`）恰好是对的，所以问题只在 OFFICE。
2. **实体从出生起就站在门里**。`chooseBacteriaSpawn` 按"离出口最近"给候选打分，而猎犬的候选还要求离两只细菌 ≥28 m——两个条件叠加后候选列表为空，调用方的兜底是 `?? targetPosition`，也就是**出口格中心**。于是猎犬开局就站在 OFFICE 电梯的正中（诊断输出：`t=0.0 hound at (68.00, 36.00) cell 36,20`）。
3. **寻路与碰撞不一致**。实体移动器的 A* 网格只看格子 `isCellOpen`，物理步进看 `isWalkable`（含门框碰撞体）。站在门里的实体既走不出（门框 AABB + 轿厢几何把它卡住），又被网格允许待在那儿，于是永远贴着门。

## 2. 改动

### 2.1 `src/scene/level-three/layout.js`

新增 `LEVEL_THREE_ELEVATOR_CELLS = [{36,20}, {30,18}]` 与 `isLevelThreeElevatorCell()`。HOTEL 电梯搬到 **锅炉房 (30,18)**——官方设定里酒店是通过锅炉/服务电梯与 Level 3 连通的，而且这一格离入口壁龛 **123 m**（原来 76.8 m），到 OFFICE 电梯 25 m，两扇门不再同处一室。

### 2.2 `src/scene/level-three/index.js`

- 两扇电梯改用层级既有的墙面安装约定 `getLevelThreeTargetMount()`：门面朝房间、轿厢嵌进墙里。OFFICE 现在挂在大厅南墙（面朝北），HOTEL 挂在锅炉房西墙（面朝东）。
- 新增 `isExitFreeCell()`（开放格 且 不是电梯格）与 `isEntityWalkable()`（额外拒绝电梯格），并接到**实体与物品**的所有 `isCellOpen` / `isWalkable`：细菌、猎犬、伏击猎犬的寻路网格、步进判定、出生点挑选，以及拾取物候选格、灯光收集。玩家不受影响，照常走进电梯。

### 2.3 `src/scene/entities/spawn.js`

`chooseBacteriaSpawn` 不再可能返回空列表：先按原有约束筛选，空了就放宽"距出口"窗口再筛，再空就只保留"离玩家足够远"，最后按离出口的距离排序。这样调用方那句 `?? targetPosition`（把实体丢在出口格中心）基本不会再触发。

## 3. 验证

新增 `tests/level-three-exits.test.mjs`（已接入 `npm run test:scene`，3 项）：

1. **安装正确**：两扇电梯的实际位置等于 `getLevelThreeTargetMount()` 的结果；场景里已建好的模型 yaw 等于安装角；背后是实心格、门前是开放地面。
2. **距离合理**：入口壁龛 → HOTEL 电梯 > 110 m（实测 123 m）、不是从入口最快能到的出口、两扇门相距 > 12 m（实测 25 m）、锅炉房格 (30,18) 可通行。
3. **实体不入梯**：让玩家站在 OFFICE 电梯上模拟 40 s，四只实体（2 细菌 + 猎犬 + 伏击猎犬）一次都没有进入任一电梯格。
4. **存档兜底**：把猎犬与细菌的存档位置直接写进电梯格中心再开局，两者都会被 `snapEntityStates(..., isEntityWalkable)` 挪出门外。

| 项目 | 结果 |
| --- | --- |
| `npm run check` | 通过 |
| `npm run test:scene` | 20 项通过 |
| `npm run build` | 通过，standalone `a637b808d8f1` |
| 实机截图 | `in-game-office.png` / `in-game-hotel.png`：门面朝房间、门头灯与标识正对玩家（临时把出生点挪到门前拍摄，已还原） |

其它证据：`office-fixed.png`、`hotel-fixed.png`（探针视角）、`office-north2.png` / `hotel-from-corridor.png`（旧机位对照）。

## 4. 边界

- 实机截图用了"临时挪出生点 → 截图 → 还原"的手法（Level 3 的入口与出口相距上百米，盲走无法取景）。改动已还原，`git diff` 里 level-three/index.js 只剩入口上下文/管道口相关的正式改动。
- HOTEL 电梯现在位于锅炉房深处的西墙：房间本身很小（4 × 2 格），玩家从南侧 (30,19) 或北侧 (30,17) 进入才能看到门面；如果希望它更好找，可以在锅炉房门口加一盏灯或一个指示牌，但那会削弱"服务电梯"的隐蔽感，故未做。
- `chooseBacteriaSpawn` 的兜底放宽是通用改动：其它层级若存在"出口离入口很近"的布局，实体不再被丢在出口格中心。
