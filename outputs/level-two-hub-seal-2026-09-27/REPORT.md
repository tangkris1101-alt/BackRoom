# Level 2：枢纽密门（The Hub）改造 —— 科乐美走廊

日期：2026-09-27　范围：`src/scene/level-two/`、`src/scene/common/exit-network.js`、`docs/`、`tests/`

## 1. 目标

原实现是"一扇深色的隐藏门"：位置在 B1 支路尽头（格 31,9），用 `hidden: true` 把门框、门扇压暗并去掉标识。问题是——

- **不隐蔽**：走廊尽头站着一眼就能看见的黑色门板（门框 + 门扇都在），玩家一走近就会想"这门怎么开"；
- **没有特色**：和 A2/A3/B1/B2/C1 尽头那些封死的混凝土门长得几乎一样；
- **其实还歪了**：`addLevelTwoIndustrialDetails` 在同一格还会贴一扇装饰门板，正好挡在隐藏门前面；而隐藏门自身的 `rotation: Math.PI / 2` 让它的门扇沿走廊方向躺着（`rotatedFootprintAabb(1.37, 0.11, π/2)` → x 半宽 0.11、z 半宽 1.37），既挡不住走廊、也没人真正看到过它。

## 2. 官方依据

Wikidot 现行版写枢纽入口"其位置多数主要团体并不官方掌握，基本只存在于成员间的传闻中"，脚注 24 直接点名：**"即跟随一串按科乐美秘籍码（Konami Code）排列的走廊。"**（见 `docs/level-two-exit-research.md` 第 1.3 节。）所以本次把这条脚注做成了实际玩法，而不是再画一扇门。

## 3. 实现

### 3.1 走廊序列（`src/scene/level-two/layout.js`）

`LEVEL_TWO_HUB_TRAIL`：起点 (31,12)，10 步 = `↑↑↓↓←→←→` 八个方向步 + 地面两块踏板 **B**、**A**：

```
(31,12) → ↑(31,11) ↑(31,10) ↓(31,11) ↓(31,12) ←(30,12) →(31,12) ←(30,12) →(31,12) → B(31,11) → A(31,10)
```

判定规则（`index.js`）：每一步只有在"从上一格的格子里走进下一格"时才计数，走错**不清零、只是不前进**（迷路回来继续走即可）。进度用状态栏短暂提示 `NEXUS TRAIL n/10`，全部走完提示 `NEXUS TRAIL COMPLETE`。

### 3.2 密门本体（`props.js: createLevelTwoHubSeal`）

- 唤醒前：B1 支路尽头是**一堵填满走廊截面的混凝土墙**（4 m × 3.66 m × 0.24 m，程序化混凝土贴图），墙上只有一圈**发丝细缝**（2.36 × 2.44 m 的暗色细线）暗示门的存在。该格的装饰门板被移除（`addLevelTwoIndustrialDetails` 跳过该格），所以走廊就是"到头了"。
- 唤醒时：细缝先亮起暖色，墙板在 1.2 s 内沉入地面，细缝淡出；`wakeProgress ≥ 0.5` 时真正的门显形，门前留一盏暖光点光源（平时 intensity = 0，只改亮度不改灯光数量，避免着色器重编译）。
- 唤醒后：门上带**专属刻印**（`symbolSeed: 24` → 圆环 + 三个marker 的暖金色符号），交互文案改为"枢纽门径 / NEXUS DOORWAY"。

### 3.3 门禁（`src/scene/common/exit-network.js`）

新增两处小扩展：

- `route.gate`：返回 false 时，`inspect()` 与 `interact()` 都直接跳过该路由——**密封状态下既没有提示也无法交互**，密室才是真的"不存在"。
- `route.i18n`：允许层级自带文案（枢纽门径的中英文），替代 `createRouteText` 的通用隐藏门文案。

另修正了隐藏门的朝向：`rotation: Math.PI / 2 → 0`，使门扇横跨走廊（x 向 2.74 m）、门面朝南正对来路——与 Level 2 另一扇死路门（办公室门，`rotation: Math.PI`）的取向规则一致。

### 3.4 线索（`props.js: addLevelTwoHubTrailMarkers` + `createLevelTwoHubHintTexture`）

- 地面两块 1.5 m 踏板 **B**、**A**（磨损的深色金属板 + 大字）。
- 西墙上的一块**刻痕**：八个箭头 + 两个圆圈字母，程序化绘制后按像素侵蚀（`destination-out` 随机斑块，且偏向边缘），所以没有干净矩形边界——远看只是旧涂鸦，用手电筒照才认得出是秘籍码。

### 3.5 存档

`getSnapshot` 走的是既有 `exitNetwork.getState()`：`interactions["level-two-hidden-hub-door"].unlocked/count` 一旦为真（走过走廊或从枢纽返回过），重载时直接唤醒门（墙板与细缝隐藏、门可见），避免"存档后又被封回去"。

## 4. 验证

新增/扩展 `tests/level-two-thermal-exit.test.mjs`（已接入 `npm run test:scene`，现共 5 项）：

1. 密封态：`world.interact()` 打不开；场景里可见的是 `level-two-hub-seal-plug`，而 `exit-network-level-two-hidden-hub-door` 不可见。
2. 走错格不推进（状态栏不出现 `NEXUS TRAIL`）。
3. 按顺序走完 10 步 → 状态栏 `NEXUS TRAIL COMPLETE`；1.6 s 后墙板与细缝隐藏、门可见；相机对准门后 `focusInteraction.id === "level-two-hidden-hub-door"`；`interact()` 返回 `exitRoute: true`、`targetLevel === HUB_LEVEL`、文案 `NEXUS DOORWAY`。
4. 存档恢复：`initialState.interactions["level-two-hidden-hub-door"] = { count: 1, unlocked: true }` 时门口直接可用、且不会重新封上。

| 项目 | 结果 |
| --- | --- |
| `npm run check` | 通过 |
| `npm run test:scene` | 16 项通过（含新增 2 项） |
| `npm run build` | 通过，standalone `d35af4c369be`，web build 校验通过；产物实机截图 `standalone-level2.png` 正常 |

截图证据（`outputs/level-two-hub-seal-2026-09-27/`，探针 `tests/level-two-floor-visual.html`）：

- `hub-sealed-far.png`（格 31,11）/ `hub-sealed-near.png`（格 31,10）——唤醒前：走廊到头是一堵带发丝细缝的混凝土墙
- `hub-plates.png`——地面 B / A 踏板
- `hub-hint.png`——西墙上的刻痕（箭头 + B A）
- `hub-awake.png`（`?hub=awake` 预览）——唤醒后：门与门头符号、地面 A 踏板

## 5. 边界与待决

- 唤醒动画没有音效（层级拿不到音频句柄）：目前靠细缝亮起 + 墙板下沉 + 门头符号表达。若要做"低鸣/石块摩擦声"，需要在 `ambient-audio` 或 main 侧开一个层级可触发的音效通道。
- 走廊序列刻意做成"走错不清零"，因此一个把 B1 支路来回走几遍的玩家有可能误打误撞完成；这是有意为之（藏在死路里的 10 步舞蹈，惩罚性重置只会让人放弃）。
- 刻痕目前只在 B1 支路那一面墙上；如果希望更"可传述"，可以再在隧道 A/B 的墙面上散布半句涂鸦，但会削弱隐蔽性。
