# Level 2 出口改造：走廊门 → 热区切出（Thermal Noclip）

日期：2026-09-27　范围：`src/scene/level-two/`、`src/scene/level-three/`、`src/main.js`、`tests/`、`docs/`

## 1. 问题

`level-two-door-level-three` 是 Level 2 唯一一扇立在主走廊（隧道 C）里的门。它的两套碰撞体（关闭时的门框 AABB 2.74 m × 0.22 m、开启后扫入走廊的门扇 AABB）把 4 m 宽的走廊挤窄，而猎犬的 A* 寻路只看格子连通性（`behavior.js` 的 `createEntityMover` + `isCellOpen` nav grid），物理移动才查碰撞体（`isWalkable`）。两者不一致，猎犬就一直"贴住—侧向蹭—重寻路"，表现为卡在出口。

## 2. 方案

官方 Level 2 唯一写明的切出机制是**反常高温区**，而且温度最高处正是"机器最响、走廊尽头"（见 `docs/level-two-exit-research.md`）。所以出口改为：

- **删除走廊门**（连同它的碰撞体），走廊上不再有任何可阻挡实体；
- **出口改成一池地板**：隧道 C 东端死路（格 39–41 / row 22）的过热管道夹层，站进去约 3 秒 → 切出到 Level 3；
- 出口**不产生任何几何体碰撞**（也没有 threshold 路由对象），因此不可能再卡住任何实体；
- 玩家切出后从 Level 3 入口壁龛北墙的**管道口**出来，和 Level 2 的热管道区形成同一条"管道"上的两端。

## 3. 实现

### 3.1 `src/scene/level-two/layout.js`
新增 `LEVEL_TWO_HEAT_GALLERY`（cells 39–41 / row 22、`triggerRadius` 2.6 m、`noclipSeconds` 3、`coolSeconds` 1.4、`damagePerSecond` 4、`healthFloor` 20）、`LEVEL_TWO_HEAT_GALLERY_CENTER`（在原点常量之后计算，避免 TDZ）、`levelTwoHeatGalleryCell()`、`pointInLevelTwoHeatGallery()`。

### 3.2 `src/scene/level-two/props.js`

- 抽出 `createLevelTwoHeatMask()`（软边径向遮罩，供地面暖区与热区共用）。
- 新增 `addLevelTwoHeatGallery(scene)`：外圈热池 + 核心热斑（软边）、东端墙上的管道口（开口圆筒 + 黑色喉口 + 环箍）、墙脚两条微光热管、立管、仪表盘。**全部不发布碰撞体**，且都贴墙或贴端墙。所有网格带 `level-two-heat-gallery-*` 命名，便于探针/调试定位。
- 蒸汽：新增三个热区喷口，`strength` 1.3–1.7，贴墙布置（不挡走线）；`addLevelTwoSteam` 现在把 `strength` 写进 `userData`。
- `createLayoutLights` 现在把 fixture 的 `x`/`z` 也记录下来（热区灯具闪烁需要）。

### 3.3 `src/scene/level-two/index.js`

- `routes` 只剩 Level 4 办公室门与隐藏 Hub 门（都在死路壁龛里）。
- 新增热度状态与逻辑：站进热区按 3 s 累满、离开按 1.4 s 回落；满刻度即 `heatNoclip`。
- `update()` 返回：`exitReached`/`exitId: "level-two-thermal-noclip"`/`nextLevel: 3`（交给 main 既有过渡流程）、`environmentDamagePerSecond`（仅在区内、未切出时 > 0）、`environmentDamageFloor`、`screenEffects`（vignette/desaturation/static 随热度、切出瞬间 `whiteout: 1`）、`exitDistance` 改为到热区中心距离、状态文本 `PIPE DREAMS → THERMAL SPIKE 43°C（14 m 内）→ CORE TEMP xx% → THERMAL NOCLIP → SERVICE LOCKED`。
- 灯具：热区 16 m 内的灯具 brownout 阈值最多下降 0.34，越近闪得越频繁。
- 猎犬：`isHoundWalkable`（步测 + 2.2 m 站位余量）与 `isHoundOpenCell`（寻路网格排除热区格）；已在区内的实体允许往外走（存档兜底，见测试 3）。

### 3.4 `src/main.js`

新增 `applyEnvironmentDamage(delta, metrics)`：按 `environmentDamagePerSecond` 扣血、受 `environmentDamageFloor` 限制（热本身不会致死）、不占用实体无敌帧、不触发红屏（热度视觉由层级自己做）。调用点紧跟在 `applyEntityContactDamage` 之后。

### 3.5 `src/scene/level-three/`

- `createLevelThreeScene({ initialState, entryContext })`：`entryContext.sourceLevel === 2` 时朝向改为一律朝南（朝层级内部），这样转身就能看到自己出来的管道口。
- `addLevelThreeArrivalManifold(scene)`：入口壁龛北墙上的管道口（开口圆筒 + 黑色喉口 + 环箍）、上下伴随管路、阀门轮、一盏暗灯（带一个固定点光源）和一小股蒸汽；不发布碰撞体。
- 到达后 2.6 s 的"降温余效"：`screenEffects`（vignette/desaturation/static 递减）+ 状态文本 `COOLING DOWN`。

## 4. 验证

新增 `tests/level-two-thermal-exit.test.mjs`（已接入 `npm run test:scene`，DOM/canvas shim 同 `scripts/check-level-scene-load.mjs`）：

1. **切出时序**：Level 3 走廊门消失；站在热池 `noclipSeconds − 0.5` 时 `exitReached === false`、扣血速率 > 0、vignette > 0.2、状态文本含 `CORE TEMP`；再 1 秒后 `exitReached === true`、`nextLevel === 3`、`exitId === "level-two-thermal-noclip"`、`whiteout === 1`、扣血归零；中途离开则热度回落到 0。
2. **猎犬不越界**：玩家站在热池中心 36 秒（含 26 秒预热），猎犬一次都没进入触发圈，且始终没有进入 1.18 m 接触距离。
3. **存档兜底**：把猎犬的位置直接放到热池中心再开局，12 秒内它能自己走出来。

其它：

| 项目 | 结果 |
| --- | --- |
| `npm run check` | 通过（32 场景构建 / 16 层灯光稳定性 / 编码 / 材质 / 碰撞 / 真实感系统） |
| `npm run test:scene` | 14 项通过（含新增 3 项） |
| `npm run build` | 通过，standalone build `2bbce722951f`，web build 校验通过 |
| 实机 e2e | 临时把 Level 2 出生点移到隧道 C（截图后已还原）：真实游戏里走进热区 → 触发切出 → 过渡遮罩（LEVEL 3 / ELECTRICAL STATION）→ 落在 Level 3 入口壁龛，HUD 显示 `LEVEL 3` |

### 过程中发现并修掉的问题

- **站热区会被猎犬咬死**：第一次 e2e 直接打出"失联 / 被猎犬实体捕获"。原因是站位余量只有 0.6 m，玩家在池边时离猎犬不到 1.18 m（接触半径）。余量提到 2.2 m 后，池内任何位置都在猎犬触及范围之外（测试 2 现在直接断言这一点）。
- 热管道初版 emissive 1.15、半径 0.2，在走廊里渲染成两条过曝红条；改为半径 0.13/0.10、emissive 0.55 并压到墙脚。
- 蒸汽初版强度 2.8 且位于走线中央，渲染成两个大白球；改为贴墙、强度 ≤1.7、透明度上限 0.16。

### 证据文件（`outputs/level-two-thermal-exit-2026-09-27/`）

- `l2-heat-gallery.png` — 隧道 C 东端：热池、管道口、热管、仪表（探针 `tests/level-two-floor-visual.html?col=38&row=22&yaw=-90&pitch=-6`）
- `l2-heat-gallery-above.png` — 俯视构造
- `l3-arrival-spawn.png` / `l3-arrival-manifold.png` — Level 3 管道到达的两个朝向（探针 `tests/level-three-arrival-visual.html?from=2&view=spawn|manifold`）
- `e2e-noclip.png` — 实机：切出后落在 Level 3（HUD `LEVEL 3` + `SERVICE LOCKED`）
- `e2e-arrival.png` — 实机：Level 3 到达后（HUD `LEVEL 3 ELECTRICAL STATION`，血量已被热区扣掉一截）
- `e2e-heat-ramp.png` — 实机：切出瞬间的过渡遮罩
- `diag-*.png` — 排查过程中用于定位画面元素的对照图（`?hide=gallery` / `?hide=transparent`）

## 5. 边界与待决

- 官方"热区切出"的目标层级是 **Level 127**（本作未实现），本作接到 Level 3（电工站），主题上说得通但不是同一层级。
- 热区目前只有视觉 + 扣血 + 蒸汽，没有专属音效（可复用 `ambient-audio` 的嗡鸣叠一层低频）。
- Level 2 的暗区层（`addLevelTwoDarkPockets`）仍然全部落在实心墙格内、不产生效果，未在本次改动中处理。
- 探针页 `tests/level-two-floor-visual.html` 现在支持 `?hide=gallery` 与 `?hide=transparent`，用于排查画面元素归属。
