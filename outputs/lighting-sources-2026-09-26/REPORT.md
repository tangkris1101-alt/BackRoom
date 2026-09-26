# 问题：没有手电筒，靠近墙壁也有光照（仅调试模式）

日期：2026-09-26

## 结论

**是的，就是调试补光。** `src/debug-mode.js` 在 `attachAreaLight(camera)` 里给相机挂了一盏点光：

```js
this.areaLight = new THREE.PointLight(0xd6f4ff, 0, 126, 1.7);   // 名称 debug-player-area-light
camera.add(this.areaLight);
```

`DebugMode.sync()` 里：

```js
if (this.areaLight) this.areaLight.intensity = active ? 4.6 : 0;
```

它是**相机的子节点**，所以会跟着你走，并用强度 4.6 / 作用半径 126 m 从玩家位置向外照亮——靠近哪面墙，哪面墙就被打亮，与有没有手电筒无关。它只在 `?debug=true` 且调试功能开启时存在（`DEBUG_PLAYER_AREA_LIGHT`/`active`）。

关掉方式：按 `X`（面板提示"X 关闭调试"）→ 补光强度归零、面板同时隐藏；或者干脆不用 `?debug=true`。

## 同机位对照（Level 0 出生点 X -48.0 / Z 40.0，朝向 274°）

| 调试补光开启（X 未按） | 调试补光关闭（按 X 后） |
|---|---|
| ![补光开启](debug-follow-light-on.png) | ![补光关闭](debug-follow-light-off.png) |

同一机位同朝向下，开启时墙面、天花板、近处地面整体被提亮、对比被压平；关闭后回到关卡自身的照明。这正是"靠近墙壁也会有光照"的来源。

## 正常游玩（无 `?debug=true`）时附近的照明来自

1. **灯池点光**：每层把离玩家最近的若干盏灯具变成真实点光（Level 0：`ACTIVE_FIXTURE_LIGHTS = 12`，低画质 8），强度 `pulse × baseIntensity × 3 × poolFade(距离)`；`poolFade` 负责让灯池边界平滑交接，不会突然亮起。
2. **室内阴影主光** `realism-indoor-shadow-key`（`src/rendering-pipeline.js`）：一盏跟随**最近灯具**的聚光（不是跟随玩家），位置取该灯具、目标在其下方约 3.4 m，强度约为灯具的 0.3 倍，作用距离 9–24 m。它给"离你最近的那盏灯"补出可投影的方向光。
3. **半球补光**：每层的 `HemisphereLight` 填充（Level 0 目前 0.58），保证远离灯具的走廊仍可读。
4. **手电筒**：关卡里的拾取道具（Level 0 有 `createFlashlightPickup`），装上后是一个挂在相机上的前向 `SpotLight`，按手电筒按钮或对应的拾取/使用键开合——它的光锥只朝前，不会像调试补光那样照亮身侧的墙。

## 备注

- 调试补光存在的意义：调试模式不保证玩家待在正常照明的房间里（例如直接被传送、或停在暗区），它保证画面可读。
- 若希望调试时也能单独关掉它，可以直接按 `X`（整套调试功能开关）；如果需要一个和其他图层开关并列的独立按钮，可以在 `debugToggles` 里加一项，把 `debugMode.areaLight.intensity` 接进去。
