# 空罐头为什么发黑

日期：2026-10-01

## 结论

不是光照没打到它，而是**金属度（metalness）在 PBR 管线上被"吃掉"了，而全场没有环境贴图（envMap）来补偿**。

用 `MeshStandardMaterial` 时，three.js 的物理着色器把漫反射压成 `diffuseContribution = albedo × (1 - metalnessFactor)`（`node_modules/three/src/renderers/shaders/ShaderChunk/lights_physical_fragment.glsl.js`），被扣掉的能量全部转成 F0 高光。F0 高光只有两个来源：直接光源的镜面反射、以及环境反射（`envMap` / `scene.environment`）。本作**从未设置过环境贴图**（`grep -rn "scene.environment\|envMap =\|environment =" src/` 无命中），所以这份能量没有任何东西可采样：罐头外壳 `metalness: 0.56` 意味着只剩 44% 的漫反射，其余 56% 直接丢失。暗处自然就是全黑。

对比同一盏灯下的杏仁水瓶（机身 `metalness: 0`～0.12）：它几乎不损失漫反射，所以照得亮。物品金属度一览：

| 物品 | metalness | 同一场景下的观感 |
| --- | --- | --- |
| 空罐头外壳 `src/scene/items/empty-can.js:228` | **0.56** | 几乎全黑 |
| 空罐头内壁 `empty-can.js:245` | 0.34 | 本来就该黑（内壁基色 0x2b322c） |
| 手电筒机身 `src/scene/items/flashlight.js:30` | 0.42 | 很黑，只有镜圈反光 |
| 线轴铜线 `src/scene/items/wire-spool.js:410` | **0.86** | 只会更黑 |
| 探测仪 `src/scene/items/detector.js:30` | 0.28 | 偏暗但能看清 |
| 杏仁水瓶 `src/scene/items/almond-water.js:35` | 0 | 明亮 |

## 证据

把空罐头、杏仁水瓶、手电筒摆在 Level 1 同一块地板上，同一个机位、同一套关卡灯光，只切换画质档（高 = MeshStandardMaterial / 低 = MeshLambertMaterial，后者**忽略 metalness**）：

| 采样区域（960×540 截图内平均亮度） | 高画质 PBR | 低画质 Lambert |
| --- | --- | --- |
| 空罐头罐身 | **17.2** | 42.1 |
| 杏仁水瓶 | 40.4 | 48.7 |
| 手电筒机身 | 6.4 | 9.3 |
| 两者之间的地板 | 32.6 | 38.2 |

- 换到 Lambert 后，同一条罐子亮了 **2.45 倍**（42.1 / 17.2），而水瓶只变 1.2 倍——差异正好落在 metalness 上；
- 高画质下罐头（17.2）比它脚下的地板（32.6）还暗一半，说明不是"灯没照到"，是材质把光吃掉了；
- 对照图 `compare-can-quality.png`（上=高画质，下=低画质），低画质里标签、卷边、掀开的盖子和拉环都清清楚楚。

## 加重它的两个因素（不是根因）

1. **摆位在暗区**：Level 1 把空罐头放在格子 (10,20)（`level-one/index.js:751`），而该处正落在关卡自己的暗区 `{col:9,row:19,width:8,height:4}` 里，绝对照度本来就低；
2. **视角**：罐头是从上方看的，最显眼的是近黑的内壁（基色 `0x2b322c`、emissive `0x0c0f0d`），罐身上部又正好是外壳金属度最高的地方。

## 已采用的修法：降金属度（2026-10-01 应用）

| 文件 | 材质 | 原值 | 现值 |
| --- | --- | --- | --- |
| `src/scene/items/empty-can.js` | 罐身外壳 | 0.56 | **0.22** |
| `src/scene/items/empty-can.js` | 罐内壁 | 0.34 | 0.18 |
| `src/scene/items/flashlight.js` | 手电筒机身 | 0.42 | 0.2 |
| `src/scene/items/wire-spool.js` | 线轴铜线 | 0.86 | **0.42** |

三处都留了注释说明"本工程没有 envMap，所以金属度基本只在扣光"，免得以后被"修"回去。关卡里 20 多处道具金属（电梯门框、仓储架、手推车等）这次没动。

### 效果（实测）

**隔离对照**（`can-metalness-ab.py`：同一个模型在 `tests/empty-can-visual.html` 的固定摄影棚灯光下，只改金属度）：

| 采样区 | 0.56 | 0.22 | 0.00 |
| --- | --- | --- | --- |
| 罐身外壳（锈蚀带） | 94.3 | **117.7** | 129.4 |
| 罐身上部 | 99.0 | **123.6** | 136.0 |
| 标签带（对照，metalness 0.02） | 117.4 | 122.2 | 124.6 |

外壳亮了 **+25%**（0.56→0.22），再降到 0 只多 +10%——说明留一点金属度是划算的。对照图 `compare-can-metalness-ab.png`。

线轴铜线这次没有单独出对照图：按同一算式它的漫反射占比从 14%（1-0.86）提到 58%（1-0.42），即在有光处亮约 4 倍，是四个材质里收益最大的一个。

**Level 1 现场**（罐头仍在暗区 (10,20)，同机位同灯光）：

| 采样区 | 改前（高画质） | 改后（高画质） |
| --- | --- | --- |
| 空罐头罐身 | 17.2 | 17.8（+4%） |
| 手电筒机身 | 6.4 | 7.1（+11%） |
| 瓶中水 | 40.4 | 40.7 |
| 地板 | 32.6 | 32.6 |

### 结论与遗留

降金属度确实把"被吃掉的光"还回来了一部分（外壳 +25%），但**罐子在 Level 1 那个暗区看起来仍偏黑**，原因已经不在金属度上：

1. **反照率**：锡皮底色 `#9aa39c`（sRGB）换算到线性约 0.33，而杏仁水瓶是近白塑料（线性约 0.75）——同一盏灯下罐身本来就只有瓶子的 ~44% 亮度；
2. **摆位**：Level 1 把它放在暗区 `{col:9,row:19,width:8,height:4}` 内，脚下地板只有 33/255；
3. **视角**：俯视时看到的主要是近黑的内壁（基色 `0x2b322c`，线性 0.026）；
4. **后期**：AO 会压暗罐口卷边与底部的阴影。

若还想让它在那块地面上读得清，可选的下一步是把锡皮底色提到 `#b7bdb4` 一带、或把 Level 1 这个生成点挪出暗区（`level-one/index.js:751`）。

## 复现

```
cd outputs/empty-can-darkness-2026-10-01
python can-darkness.py            # 现场：Level 1 罐头(+水瓶/手电) 与 Level 2 线轴，高/低画质各一组
compare-can-quality.png           # 改前高/低画质上下对照（before-*.png）
compare-can-metalness.png         # 改前/改后同机位对照（before-*/after-*.png）
python can-metalness-ab.py        # 隔离对照：摄影棚灯光下只改金属度（ab-can-*.png）
compare-can-metalness-ab.png      # 0.56 / 0.22 / 0.00 三联
```
