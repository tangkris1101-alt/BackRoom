# 绝缘线圈（电线卷 wire-spool）道具高精度化

日期：2026-09-27
触发：用户反馈"绝缘线圈道具模型精度太低"，要求换成更高精度的模型。

---

## 一、改前状态

`src/scene/common/world-items.js` 里 `shape === "spool"` 分支只有一个占位几何：

```js
const spool = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.25, 16), material);
spool.rotation.z = Math.PI / 2;
```

单个 16 段圆柱（**1 网格 / 96 三角形**）+ 纯色材质：没有法兰、没有中心孔、没有线圈，也没有引线。同期已经做完的高精度道具（空罐头 `empty-can.js`）走的是"独立模块 + 程序化贴图"的路子，本次照做。

## 二、新模型

新文件 **`src/scene/items/wire-spool.js`**，导出 `createWireSpoolModel()`；`world-items.js` 的 spool 分支改为 `group.add(createWireSpoolModel())`（与 can 分支同样带说明注释）。

| 部件 | 做法 |
| --- | --- |
| 法兰 + 卷筒 + 中心孔 | 一条 15 点闭合母线 `LatheGeometry(48)`：两个带倒角的法兰盘、卷筒、贯穿的中心孔（真的能透过孔看到对面） |
| 加强筋 | 打印面（-X）4 条凸起筋，`mergeGeometries` 合成一体 |
| 线圈主体 | `TubeGeometry` 沿自定义 `WindingCurve` 密绕 **13 圈**，圈距 0.0162 m、线径 0.019 m（紧贴成层） |
| 上层未绕完的线圈 | 同一曲线加大半径再绕 4 圈，接引线 |
| 引线（绝缘段） | `CatmullRomCurve3` 从线圈顶部绕过法兰垂到地面，96 段管 |
| 剥皮端 | 裸铜芯 + 3 根散开的铜绞线（脆化绝缘层的叙事对应物） |
| 标签 | 打印面圆形贴纸 `CircleGeometry`，画布上写 M.E.G. / SUPPLY LINE / INSULATED CABLE / 2.5 mm² · 100 m |

贴图（全部程序化 canvas，带 `canCreateCanvasTexture()` 守卫，Node 下退化为纯色）：

- **本体** 512²：模具拉丝痕 + 拖拽灰痕 + 崩边，颜色 `#8d5231`，bump 提供微观起伏；
- **绝缘层** 1024×128：整张贴图覆盖整段绕线，按圈数画出"圈与圈相压处的暗带"（这是密绕线圈能读出层次的关键），再叠裂纹、粉化的浅斑、粉尘；
- **贴纸** 512²：浅色纸 + 深绿印刷 + 磨损/折痕/水渍。
  （第一版贴纸是深绿底，渲染出来和阴影里的法兰糊在一起，已改为浅底深字。）

规模与外观：**6 网格 / 11,276 三角形 / 0.44×0.51×0.50 m**，凸包中心仍在原点、轴线沿 X、轮缘半径 0.25 m —— 与旧占位件的外廓一致，因此出生偏移、`getFloorOffset("spool") = 0.26` 与瞄准框都不需要改。材质仍走 `createGameMaterial`（低画质自动降为 Lambert 并丢掉 bump），每件道具独立创建材质实例（手持副本会改写 `depthTest/depthWrite`，不能共享）。整件道具 `castShadow/receiveShadow = false`，与其它装饰物一致。

## 三、顺带修掉的贴地问题

Level 2 / Level 3 的出生数据把线圈放在 **y = 0.2**，而它的轮缘半径是 0.25 m —— 也就是**沉进地面约 5 cm**（叠加 `tiltZ` 0.16/0.18 的倾斜后最深约 7.7 cm）。同一份数据里 `getFloorOffset("spool")` 写的就是 0.26，可见 0.26 才是本来意图的落地高度。

| 文件 | 改动 |
| --- | --- |
| `src/scene/level-two/index.js` | `y: 0.2 → 0.26`，`tiltZ: 0.16 → 0.05` |
| `src/scene/level-three/index.js` | `y: 0.2 → 0.26`，`tiltZ: 0.18 → 0.05` |

倾角一并收敛的原因：横躺的线轴绕 Z 轴倾斜时，法兰边缘会绕支点抬起/下沉 `0.17·sin(tilt)`；10° 的倾斜会让一侧陷进地面约 3 cm，同时另一侧翘起 6 cm —— 读起来像悬空。改成 ~2.9° 后最深处只剩毫米级，看上去是"躺在地上"。

## 四、验证

- 新增 **`scripts/check-wire-spool.mjs`**（`npm run check:spool`，已插入 `check` 链 `check:body` 之后），断言：
  网格数 ≥ 5 且三角形 ≥ 6000（防止退回占位件）、凸包中心不偏离原点、外廓不超过瞄准框且仍填满 0.25 m 轮缘、最低点落在 `0.26` 落地高度对应区间、两次构建之间不共享材质实例、所有网格不投影不接收阴影、无 canvas 环境仍能构建、以及 Level 2/3 的出生 `y ≥ 0.25`。
  输出：`wire spool checks passed (6 meshes, 11276 triangles, 0.44x0.51x0.50m, lowest -0.257)`。
- **`npm run check`** 全链通过（含 16 关场景构建 32 次、16 关光源稳定性、玩家人体、第一人称手部等）。
- **`node --test tests/*.test.mjs`** → 21 pass / 0 fail。
- **`npm run build`** 通过：standalone 24.79 MiB（buildId `c5368f24d72c`，已同步写入根目录 `backrooms.html`，可直接用 `file://` 打开复测）、web 入口 1813.2 KiB / gzip 446.7 KiB（比改前 +7.2 KiB，即新模块体积）。

验收页：**`tests/wire-spool-visual.html`**（真实 `createWorldItemModel`，含出生摆位/丢弃件/手持件三份、旧模型对照按钮、图标尺寸带、`?view=` 与 `?capture=1` 参数）。

| 截图 | 内容 |
| --- | --- |
| `model-three-quarter.jpg` | 三分之四视角：法兰/中心孔/密绕线圈/上层线圈/引线/裸铜端 |
| `model-label.jpg` | 标签面：M.E.G. SUPPLY LINE 贴纸 |
| `model-lead-stripped.jpg` | 剥皮引线端特写：绝缘层断口、裸铜芯、散开的绞线 |
| `model-level-two-spawn.jpg` | Level 2 出生摆位（y=0.26、tiltZ=0.05）+ 丢弃件 + 手持件 |
| `legacy-single-cylinder.jpg` | 改前的那颗 16 段圆柱（1 网格 / 96 三角形） |

## 五、未做的部分（如需再提）

- **背包图标未改**：`src/main.js` 里 `"wire-spool"` 的 SVG 图标保留原样（验收页底部按 32/56/96/160 px 四种尺寸并排显示，可对比观感）。用户本次只提到模型。
- **装饰物仍然不投影**：所有 `world-pickup-item-*` 都是 `castShadow = false`（既有约定，空罐头/便签/档案也一样），所以验收页里没有接触阴影、远看略"浮"。要加接触阴影的话应该统一给所有装饰物做，属于另一件事。
- 引线在出生倾角下最深仍可能压入地面约 2.5 mm（引线半径 9.5 mm，落地段按地面线 +2.5 mm 作者化），肉眼不可见，未再收敛。
