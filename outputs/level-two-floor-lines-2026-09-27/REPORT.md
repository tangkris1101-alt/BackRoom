# Level 2：地面接缝重做 + RETURN 门移除

日期：2026-09-27　范围：`src/scene/level-two/`、`docs/entity-level-exit-reference.md`

## 1. 问题

截图反馈：Level 2 地面上的线（等距直角网格线）让场景看起来很假。

## 2. 定位过程

用探针页 `tests/level-two-floor-probe.html`（临时，四格同机位对照：A 原样 / B 关闭暗区贴花 / C 关闭地板贴图 / D 两者都关）在同一相机下渲染：

| 变体 | 结果 |
| --- | --- |
| A 原样 | 地面上同时存在「沿走廊方向的线」「横跨走廊的线」以及宽窄交替的亮暗带 |
| B 关闭暗区贴花 | **与 A 完全一致** |
| C 关闭地板贴图 | 地面完全平坦，**所有线消失** |
| D 两者都关 | 与 C 一致 |

结论：**线全部来自地板贴图 `createLevelTwoFloorTexture()`**，与贴花层无关。旧纹理的成因有三处：

1. `for (x += 64)` / `for (y += 96)` 用 `rgba(15,14,10,0.46)` 描了 2 px 的**等距直角网格**——纹理重复 11×9 覆盖 200 m × 112 m，换算到世界就是每 ~2.3 m 一条、横平竖直、粗细一致的暗线，视觉上等同于坐标纸；
2. 逐扫描线叠加 `Math.sin(y * 0.08) * 0.018` 的明暗，形成 ~78 px 周期的**宽带条纹**；
3. 由 `#7b4a24` 方块组成的水平「瓷砖条」每个平铺周期原样重复一次。

顺带确认（未改动，仅记录）：`addLevelTwoDarkPockets` 的三个暗区（格 12,8 / 32,16 / 24,21）矩形**全部落在实心墙体格内**，被四周墙面遮挡，对画面没有任何影响——Level 2 的暗区层目前是空转的。

## 3. 改动

### 3.1 `src/scene/level-two/textures.js` — 地板纹理重做

- 删除等距网格、逐扫描线明暗带、瓷砖条。
- 新增 `buildLevelTwoJointProfiles()`：按**接缝**建模，而不是"画线"。每条缝沿长度方向有
  - 小幅摆动（多个整数谐波正弦叠加，±约 4 cm），
  - 时开时闭的**缝隙强度**（5 格噪声，缝隙有的深、有的几乎闭合），
  - **被灰尘填实**的段落（闭合的缝改为一道浅色尘线），
  - **崩边/剥落**段落（细噪声阈值 + 接缝旁的碎屑斑）。
- 接缝间距按世界尺度定为约 **6 m**（x 向 3 条/tile、z 向 2 条/tile），两轴间距不同，避免形成正方形。
- 底材改为大中小三层噪声（3×4 / 9×7 / 26×26 格）+ 颗粒，替换原来的纯色底 + 明暗带。
- 直条油污替换为 8 处**软边椭圆油渍/锈渍**（大而低对比、以暗油渍为主，避免形状像印章一样逐块重复）；新增 4 条**发丝裂缝**（随机游走折线，且刻意避开贴图边界，避免平铺时裂缝在接缝处被截断）。
- 保留可平铺性：噪声用 `tileNoiseXY`，摆动用整数谐波，接缝用环绕距离。

### 3.2 `src/scene/level-two/props.js` — 暖区贴花软边

`addLevelTwoFloorHeat` 原来是硬边矩形 `PlaneGeometry` + 纯色 `MeshBasicMaterial`，边界是一条可见的直线。改为 128 px 径向渐变 **`alphaMap`**（中心 1 → 边缘 0），透明度 0.045 → 0.085 以补偿边缘衰减；暖区只剩一团光晕，没有矩形边界。

### 3.3 `src/scene/level-two/index.js` — 移除 RETURN 门

`routes` 中删除 `{ id: "level-two-door-level-one", … label: "RETURN", position: levelTwoCellCenter(12, 2) }`。Level 2 现存的出口为：Level 3 门、Level 4 办公室门、隐藏的 The Hub 门。格 (12,2) 的支路尽头保留与 A2/A3/B1/B2/C1 同样的封死混凝土门（`addLevelTwoIndustrialDetails` 的门体贴片），不再有出口标识、门头灯与可开启门扇。

`docs/entity-level-exit-reference.md` 的 Level 2 行同步更新。

## 4. 验证

| 项目 | 结果 |
| --- | --- |
| `npm run check` | 通过（含新增的 check:spool；32 场景构建 / 16 层灯光稳定性） |
| `npm run test:scene` | 11 项通过（含 `level-two-geometry.test.mjs`） |
| `npm run build` | 通过，standalone build `1def9a8d645f`，web build 校验通过 |
| `npm run changelog:check` | 快照因新提交 `985f09f` 过期，已 `changelog:sync` 补中文标题，现 current（12 条） |
| 出口表实机核对 | 探针页读取 `scene.userData.exitRoutes` → 只剩 Level 3 / Level 4 / THE HUB 三条 |
| 实机画面 | `app.html?debug=true&level=2` 与构建产物 `backrooms.html?debug=true&level=2` 同机位截图均无网格线 |

证据文件：

- `probe-before.png` — 四格诊断（before，含 B/C 对照）
- `scene-after.png` — 同一相机（col 24, row 6，yaw 90°，pitch −19.5°）修改后
- `floor-before-after.png` / `floor-before-after-close.png` — 同机位上下对照（900×886）
- `texture-after.png` — 512×512 单块纹理 + 2×2 平铺接缝检查
- `app-spawn.png` / `app-walk.png` — 开发服务器实机（Level 2 出生点、前进 4 s）
- `standalone-level2.png` — 构建产物实机，同机位
- `heat-zone-top.png` — 暖区俯视，边缘为软过渡

## 5. 复用探针

- `tests/level-two-floor-visual.html` — Level 2 地面视觉检查，支持 `?col=&row=&yaw=&pitch=&eye=`，`?texture=off` 可关闭地板贴图对照。
- `tests/level-two-texture-probe.html` — 单块纹理 + 2×2 平铺对照，检查接缝与平铺连通性。

两者都会在 `document.body.dataset.ready` 置位，可被无头 Chrome + CDP 截图管线直接抓取。

## 6. 边界与待决

- Level 2 的暗区层（`addLevelTwoDarkPockets`）目前被实心墙遮挡、不产生任何效果。要么删除这些区域，要么把它们移到真正的走廊格上（会改变该层的明暗节奏与猎犬玩法），本次未动。
- 官方现行版把 **Level 1 列在 Level 2 最常用的三个出口门之一**；本次按需求移除了返回门，属于有意的设定偏离，理由与原文出处见 `docs/level-two-exit-research.md`。
- 官方「热区切出」的目标层级是 Level 127（本作未实现）；若要落地热区切成机制，需要另选目标层级。
