# 手持物品偏移 / 穿模 — 根因分析与修复记录（2026-09-25）

## 1. 现象与复现

用户截图：Level 0 中手持「手电筒」与「皱折便签」时，物品漂在手部右下方、半出画面，手指没有包住物品，手电筒灯头朝外、桶身只剩一半在画面里。

复现脚本（本目录）：

- `repro.py` — 存档注入 `[flashlight, crumpled-note]`，分别截 1168×885 / 960×540；
- `repro-projection.py` — 运行时把手臂网格顶点经真实矩阵投影到屏幕，量化手与物品的偏差；
- `sweep-items.py` / `measure-held-items.py` — 逐物品截图与「物品世界尺寸 / 屏幕包围盒」实测；
- `final-verify.py` — 最终验收（Level 0 手电筒/便签、丢弃后收回、Level 1 关键光）。

修复前实测（960×540、FOV 72、`arms.position = (-0.024, -0.32, -0.36)`、`ARMS_SCALE = 0.15`、pose = `grip`）：

| 对象 | 相机空间坐标 | 屏幕像素 (960×540) |
| --- | --- | --- |
| 右手掌根骨骼 `handR` | (0.214, -0.488, -0.745) | 约 (536, 448) |
| 右手指尖平均（4 指 end 骨骼） | (0.030, -0.408, -0.883) | 约 (474, 419) |
| **握持中心（掌根↔指尖中点）** | **(0.122, -0.448, -0.814)** | 约 (505, 434) |
| 手电筒物品原点（修复前） | (0.150, -0.580, -0.740) | (555, **561**) 画面下沿外 |
| 默认分支（便签/钥匙等，修复前） | (0.180, -0.500, -0.620) | (588, **570**) 画面下沿外 |

即：所有手持物品都比掌心低 5–13 cm、比掌心近 7–19 cm，物品中心整体落在画面下沿之外，只有上边缘探进视野——同时表现为「偏移」「穿模」「半出屏」。

## 2. 根因

### RC1 物品与手没有任何几何绑定（结构性根因）

`src/scene/common/view-model.js` 的 `positionHeldItem()` 用逐物品硬编码的相机空间常量摆放物品，物品是 `viewModel`（相机子节点）的孩子，而不是手部网格的孩子。烘焙手臂不导出任何握持锚点，所以每次重烘焙手部姿势都会让这些常量悄悄失效。

### RC2 常量本身就是错的

见上表：所有分支都偏低、偏近；便签是 0.48 m × 0.34 m 的整张纸（`world-items.js:305`）再乘 0.78，在 0.62 m 处铺满右下角并被下沿裁掉。

### RC3 手部动画没有同步到物品

持物时右手的逐帧动画（步行摆幅、落地冲击、待机漂移）只作用于网格本身，物品仅在姿态过渡中跟随整组位移，手的旋转完全不传导。

### RC4 用 `setScalar` 写死缩放，压掉了模型自带比例

`createWorldItemModel()` 里钥匙类模型在根节点上带 `KEY_MODEL_SCALE = 0.1875`，而 `positionHeldItem()` 用 `item.scale.setScalar(0.9)` 直接覆盖 → 实测 Level 4 钥匙被放大到 **0.76 m 宽**（应约 0.15 m），5 倍穿模。

### RC5 烘焙/检查/构建链不一致（旁证）

`bake-fps-arms.mjs` 的放松姿势只写 `.bin` 不写 `.b64`，而检查脚本曾要求 `.b64`；放松姿势的 `.bin` 此前也未纳入版本控制，缺失时 `npm run dev` / 构建直接失败。

## 3. 已实施的修复

### 3.1 烘焙导出握持锚点（根治）

`scripts/bake-fps-arms.mjs` 在 `applyFingerPose` 之后用骨架算出「掌根 + 四指尖平均」的中点，按姿势/左右手写入 `src/assets/models/fps-arm-anchors.json`：

```json
"grip": { "right": { "position": [0.974, -0.852, -3.026], "palm": [...], "tips": [...] } }
```

烘焙可复现：重新运行 `npm run bake:arms` 后六个 `.bin` / `.b64` 的 MD5 与运行前完全一致，只有锚点 JSON 是新产物。

### 3.2 物品改挂到右手，位置由锚点导出

- 新增 `first-person-held-item-mount`：挂在右手网格下，位置 = 当前姿势的握持锚点，`scale = 1 / ARMS_SCALE` 抵消手臂组缩放，物品继续用「相机单位」标定尺寸；
- `positionHeldItem()` 的偏移全部改为**相对握持中心**的小幅微调（|偏移| ≤ 0.2 m，由检查脚本强制），不再出现相机空间绝对坐标；
- `setArmPoseGeometry()` 换姿势时同步刷新挂载点；不再需要 `gripPosition ± arms.position` 的过渡补偿（RC3 随之消失：整组位移、逐帧摆动、姿态过渡、相机抖动全部自动继承）；
- 便签/证件/徽章改为「立起、向眼睛倾斜约 65°」的持纸姿势，`note` 缩放 0.5，文字现在可读。

### 3.3 修掉缩放覆盖（RC4）

每个分支改为 `item.scale.multiplyScalar(k)`，保留模型自带比例。实测尺寸回到合理区间（1168×885）：

| 物品 | 世界尺寸 (m) | 屏幕包围盒 (px) |
| --- | --- | --- |
| 手电筒 (0.32) | 0.12 × 0.14 × 0.30 | 129 × 236 |
| 便签 (0.5) | 0.26 × 0.17 × 0.12 | 227 × 186 |
| 杏仁水 (0.3) | 0.15 × 0.28 × 0.15 | 146 × 297 |
| 探测仪 (0.55) | 0.29 × 0.37 × 0.35 | 245 × 341 |
| 指南针 (0.3) | 0.14 × 0.18 × 0.17 | 140 × 222 |
| Level 4 钥匙 (0.9) | 0.14 × 0.10 × 0.08 | 124 × 109 |
| 灭火盐 (0.4) | 0.27 × 0.37 × 0.28 | 282 × 434 |

### 3.4 防回归检查

`scripts/check-first-person-hands.mjs` 新增断言：锚点 JSON 存在且为有限 3 分量、`positionHeldItem()` 不再出现 `item.scale.setScalar`、物品挂在 mount 上（`mount.add(heldItem)`、`mesh.add(mount)`）、不存在 `gripPosition` 旧补偿、每个 `item.position.set(...)` 的模长 ≤ 0.2 m 等。

## 4. 验证结果

- `npm run check`（含新的手持锚点断言）通过；
- `npm run build`（web + standalone）通过，`check-standalone.mjs` 报告 24.72 MiB，两个放松姿势 `.bin` 均已作为 `application/octet-stream` data URL 内联进单文件版，运行时 `fetch` 可用；
- 端到端截图（`final-verify.py`）：Level 0 手电筒握在右手中、便签立起可读、丢弃后双手回到放松姿态且物品消失、Level 1 弱光下手臂与物品同受关键光照亮，均无 pageerror；
- `sweep-items.py` 逐物品截图：手电筒 / 便签 / 杏仁水 / 探测仪 / 指南针 / Level 钥匙 / 灭火盐全部位于掌心附近，不再有半出屏或 5 倍放大。

## 5. 遗留事项（需要人工决定）

- 新增文件需要纳入版本控制：`src/assets/models/fps-arm-anchors.json`、`src/assets/models/fps-arm-para-relaxed-baked.bin`、`src/assets/models/fps-arm-para-right-relaxed-baked.bin`（后两者此前就未被跟踪，而运行时的 `?url` 已依赖它们）；
- 目前不透明手持物品仍是 `depthTest = false`（`setHeldItemMaterialState`），因此手指不会遮挡握住的物品。若希望手指真正“包住”物品（更写实但可能遮挡小件道具），可把不透明物品改为 `depthTest = true` 后单独评估。
- `attachFirstPersonViewModel()` 每次进关都对相机 `camera.add(viewModel)` 且不清理同名旧节点；当前每关重建相机所以不会叠加，但若将来复用相机对象会出现双套手臂与错挂物品，建议加一行按名清理。
