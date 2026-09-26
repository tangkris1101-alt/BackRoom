# 调试面板：坐标/朝向 + 图层开关

日期：2026-09-26

## 用途

排查"地面出现直线分界"这类问题时，需要知道**站在哪、朝哪**，并且能**逐层关掉**可能画线的图层。之前只能靠截图猜，这个面板把这两件事直接放进游戏。

## 用法

- 用 `?debug=true` 打开游戏（例如 `app.html?debug=true&level=0`），右上角出现面板；
- 面板显示：
  - `X -48.0 · Z 40.0` —— 世界坐标（米），与关卡布局/`cellCenter` 同一坐标系；
  - `H 274° · 西` —— 朝向（度）。约定 **0° = 世界 -Z（北）**，顺时针递增，因此 90° = +X（东）、180° = +Z（南）、270° = -X（西）；
- 图层开关：点按钮，或按对应数字键（`1`~`4`）。按钮高亮 = 图层开启；
- `X` 键仍然关闭/打开整套调试功能（面板随之隐藏）。

## 当前提供的图层（Level 0）

| 键 | 图层 | 关掉后会发生什么 |
|---:|---|---|
| 1 | 光场分区 | 把烘焙光场换成**不含明暗分区**的版本（首次切换时生成第二张 512² 贴图） |
| 2 | 烘焙光场 | 把 `levelZeroLightIntensity` 置 0：地面只剩灯池点光与自发光的贡献 |
| 3 | 阴影 | 关闭 `renderer.shadowMap`（强制重建材质程序），所有投影消失 |

> 2026-09-26 更新：`分区贴花` 开关已随贴花层一起移除（玩家确认它才是地面分界线的来源，见 `outputs/level-zero-floor-line-2026-09-26/REPORT.md`）。因此按键从 1~4 变为 1~3。

Level 1 提供同样的 `烘焙光场` 开关（`levelOneLightFieldIntensity`）。其他层级暂时只显示坐标与朝向。

## 实现

- `app.html`：新增 `#debug-panel` 结构（读数 + 开关容器 + 提示）。
- `src/styles.css`：`.debug-panel` 系列样式（右上角、等宽字体、`z-index: 6`）。
- `src/main.js`：
  - 面板读数在帧循环里以 10 Hz 刷新（`updateDebugPanel`），朝向取 `world.camera.rotation.y`；
  - 开关列表由 `world.debugToggles`（关卡提供）+ 内置的 `shadows` 组合而成，数字键 `Digit1`~`Digit9` 与之对应；
  - `setShadowsEnabled` 切换 `renderer.shadowMap.enabled` 后把场景内材质的 `needsUpdate` 置真（阴影支持是编译进着色器程序的）。
- `src/scene/level-zero/index.js`：`applyFixtureLightField` 把 `shader.uniforms` 存到材质上（`levelZeroLightFieldUniforms`），并新增 `createFixtureLightField({ includeZones })`；`world.debugToggles` 暴露三个开关。
- `src/scene/level-zero/world.js`：`addMoodZones` 返回贴花网格列表（供开关切换 `visible`）。
- `src/scene/level-one/index.js`：同样把 `levelOneLightFieldUniforms` 存到材质上，暴露 `烘焙光场` 开关。

## 验证

- `npm run check`、`npm run build`（在线版 + 独立版 + 内置检查）通过。
- 实机（`?debug=true&level=0`，1280×800）：
  - `panel-level-zero.png`：面板显示 `X -48.0 · Z 40.0`、`H 274° · 西`，四个开关均为开启态；
  - `panel-lightfield-off.png`：按 `3` 后场景明显变暗，`烘焙光场` 按钮转为关闭态；
  - `panel-zones-off.png`：按 `2` 后 `光场分区` 关闭，场景亮度基本不变（说明只去掉了分区盖章）；
  - `panel-decals-off.png`：按 `1` 后 `分区贴花` 关闭；
  - `panel-shadows-off.png`：按 `4` 后面板读数为 `shadows → aria-pressed=false`（DOM 校验）。

## 注意

- 面板在 `?debug=true` 且调试功能开启时才显示；正式游玩（无 debug 查询参数）不受影响。
- 数字键 1~4 只在 debug 查询参数存在时才被拦截，正常游戏里没有占用。
