# Level 0 地面纹理在少光区的"砖块/条纹" — 修复记录（2026-09-26）

## 1. 本次实施的 1+2+4

| # | 改动 | 文件 / 位置 |
| --- | --- | --- |
| 1 | `bumpScale 0.08 → 0.02`；bump 图高频 `fine ±44 → ±14`；绒行幅度 `2 / 1.6 → 0.7 / 0.5` | `src/scene/level-zero/index.js`（材质）、`src/scene/level-zero/textures.js:343-377` |
| 2 | roughness 图高频 `fine ±10 → ±5`（不再复刻绒行噪声） | `textures.js:379-402` |
| 4 | 地面宏观污渍层 `carpetMacroOverlay` 由 `MeshBasicMaterial`（不受光）改为 **`MeshStandardMaterial`**（roughness 1 / metalness 0 / transparent），并注入与地板相同的光场，使其随照度一起变暗 | `index.js:342-356` |

未做（3/6）：绒行间距去规律、打破 3 m 重复的 albedo 结构。

## 2. 验证

同机位（1280×720 @ dsf2 = 2560×1440，高画质）对比 `floor-before-*` / `floor-after-*`：

| 指标 | 位置 | 前 → 后 |
| --- | --- | --- |
| 像素差（暗处贴地视角） | `floor-graze-dark` | mean\|Δ\| = 1.29，19.2% 像素变化 >2，max 36 |
| 像素差（亮处同视角） | `floor-down-hall` | mean\|Δ\| = 0.49，仅 0.2% 像素变化 >2（亮处宏观层接近等效） |
| 中尺度局部对比（50 px） | 暗处 | 1.45 → **1.39** |
| 中尺度局部对比（25 px） | 暗处 | 1.22 → **1.15** |
| 面板平均亮度 | 4 个机位 | 变化 &lt; 1.5（无亮度代价） |

视觉确认：`floor-zoom-dark.png`（上＝改动前，下＝改动后，亮度 ×2.2 便于观察暗部）——改动前地面上明显的分段"砖块状"条纹大幅减弱；`floor-zoom-hall.png`（同一放大对比，亮区）几乎无差异，未破坏亮处质感。

`npm run check` 与 `npm run build`（web + standalone 24.74 MiB）通过。

## 3. 结论与残留

- 形成"砖块"的两大来源里，**细节法线的瓦楞（bump 振幅过大、波长只有 2.9 cm）** 已经消除，**暗处恒定叠加的不受光宏观层** 也已改成随光变化；
- 仍然残留的是**低频"贴图节奏"**：地毯色图里有 6 个 per-tile 软斑（rx 0.12–0.32 ≈ 0.36–0.96 m，alpha 0.015–0.03）与 `broad` 噪声，每 3 m 完全复制一次——非常暗的区域里它仍是地面唯一的低频结构。要处理它就是原清单的 3（绒行去规律）与 6（用世界噪声调制 albedo / 6–9 m 一贴 + 随机镜像）。

## 4. 复现命令

```bash
python outputs/level-zero-light-density-2026-09-26/diag-floor-pattern.py   # 出 diag-floor-*-high/low.png
python outputs/level-zero-light-density-2026-09-26/shoot-carpet-textures.py # 出 carpet-textures.png（纹理摊开）
```
