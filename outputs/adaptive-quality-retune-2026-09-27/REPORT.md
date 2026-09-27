# 自适应画质：去掉 54–58 FPS 死区

日期：2026-09-27
来源：`outputs/level-one-gpu-load-audit-2026-09-27/REPORT.md` 里的第二条待办——"卡在 55–58 FPS 时自适应不做任何减负，GPU 可以长时间维持 100%"。

---

## 一、问题

旧实现（`src/rendering-pipeline.js` + `src/main.js`）只看两个固定门槛：

```js
if (fps < 54) { …降一档… } else if (fps > 58) { …恢复一档… }   // 54–58 之间什么都不做
```

也就是说：**只要帧率停在 54–58，画质阶梯一格都不会动**——而 4K 下 GPU 满载、帧率刚好落在这一段的机器（正是本次事故那台）就永远维持满载。另外门槛是写死的 60Hz 假设，玩家把帧率上限设成 30 时降档门槛竟然是 24 FPS（`frameRateLimit * 0.8`）。

## 二、新策略

| | 旧 | 新 |
| --- | --- | --- |
| 目标帧率 | 写死 60（保留帧率上限时 `limit*0.8`） | `frameRateLimit`，未设上限则取显示器实测刷新率，**并封顶 60**（不限帧的 144Hz 屏不该为没人要的帧数去砍画质） |
| 降档 | `fps < 54` | `fps < 目标 - 2`（60 目标 → **< 58 就降**，无死区） |
| 恢复 | `fps > 58` | `fps ≥ 目标 - 0.5`，且**连续 12 个采样**（9 秒） |
| 分辨率手柄 | 阶梯全降完后可用 | 不变（仍是最后一道）；**恢复时反过来：先还画质，再还分辨率** |

### 新增：探测与退避（防止"刚恢复就掉帧"来回闪）

`GTAO` 这类开关关掉便宜、开回来贵，而 **vsync 下帧率是饱和信号**——60 FPS 在 GPU 40% 和 99% 时看起来一模一样，控制器无法判断"后来是不是变轻了"。所以：

- 每次恢复都是一次**探测**：恢复后在 24 个采样（18 秒）的观察期内如果又被降下来，说明这一步在当前场景里就是养不起；
- 该步的**下次探测所需的平稳时间翻倍**：9s → 18s → 36s → 72s → 2.4min → 4.8min → 9.6min（上限）；
- 探测通过（观察期内没被降）则退避减一，机器重新被信任；
- **换关卡时整条阶梯复位**（`setWorld` → `resetAdaptiveLadder()`）：新关卡是新的成本画像，上一关养不起的档位在这里重来一次。

这样重载场景的结果是"先降一次，之后稳定"，而不是每 8 秒 GTAO 闪一下。

### 新增：分辨率不再"自激振荡"

- 升分辨率要求：阶梯完整（没有任何档位被降）+ 帧率达标 + 连续 8 个采样；
- 每次分辨率**下降**后有 12 个采样（9 秒）的冷却，冷却期内不允许上升——每一步都会重建整条后处理链（HDR 目标 + GTAO 目标），慢一点收敛好过快节奏抖动。

### 便于排查的新增 dataset

`canvas.dataset.adaptiveTarget`（当前目标帧率）、`canvas.dataset.adaptiveBackoff`（当前退避级数），配合原有的 `gtao` / `bloom` / `shadows` / `shadowScale` / `pixelRatio` 就能在浏览器控制台看清整条阶梯的状态。

## 三、改动文件

| 文件 | 改动 |
| --- | --- |
| `src/rendering-pipeline.js` | 导出 `ADAPTIVE_SHED_MARGIN_FPS = 2` / `ADAPTIVE_RESTORE_MARGIN_FPS = 0.5`；`updateAdaptive(fps, targetFps)` 重写为按目标帧率判定 + 阶梯函数（`shedNextStep` / `restoreNextStep` / `ladderSpent`）+ 探测退避；`setWorld` 复位阶梯；`syncDebugState` 增加两个 dataset |
| `src/main.js` | 删除 `FPS_LOW_THRESHOLD` / `FPS_HIGH_THRESHOLD` / `getAdaptiveFpsThresholds()`；新增 `getAdaptiveTargetFps()`；分辨率手柄改用共享的边界常量 + 升档平稳计数 + 降档冷却 |
| `scripts/check-adaptive-quality.mjs` | 新增行为测试（见下） |
| `package.json` | 新增 `check:adaptive` 并插入 `check` 链（`check:spool` 之后） |

## 四、验证

**新增行为测试** `npm run check:adaptive`（用假 renderer/canvas 直接驱动 `updateAdaptive`，不需要 GPU）：

1. **死区回归测试**：`fps=57, target=60` 连续 3 个采样必须降一档（旧实现这里什么都不做）；
2. 阶梯没降完时 `canReducePixelRatio === false`，降完后为 `true`；
3. 恢复需要连续 12 个采样达标；探测失败（观察期内又掉帧）后，同样的 12 个采样**不足以**再次恢复，再补 12 个才恢复；
4. 探测通过后退避回落，阶梯仍然灵敏；
5. 目标帧率来自玩家设置：30 上限下 29 FPS 不动、27 FPS 降档；
6. 低画质（没有档位可降）从第一个采样起就允许动分辨率（与旧 early-out 一致）；
7. 源码断言：`main.js` 不再出现 54/58 门槛、仍把目标帧率传进 `updateAdaptive`、仍由 `getAdaptiveTargetFps()` 推导目标。

**全链**：`npm run check` 通过（13 项，含新增两项 `wire spool` / `adaptive quality`）、`node --test tests/*.test.mjs` 21 pass / 0 fail、`npm run build` 通过（standalone 24.80 MiB buildId `7687f33674d9`，已同步写入根目录 `backrooms.html`；web 入口 1814.2 KiB / gzip 447.1 KiB）。

## 五、取舍与未验证

- **端到端未复现**：这台机器上没法在浏览器里复现"4K + GPU 满载"的现场，所以本次只做了策略级行为测试 + 接线断言，没有在真实满载机器上看阶梯跳变。想复核的话：进游戏后看暂停界面 FPS，或控制台读 `document.querySelector("canvas").dataset`（`adaptiveTarget` / `gtao` / `bloom` / `shadowScale` / `pixelRatio` / `adaptiveBackoff`）。
- **同关卡内不回探"已判定养不起"的档位**：靠换关卡复位。原因是 vsync 下无法区分"轻了"和"还满载"，硬回探就是让它每隔几十秒闪一下。
- **帧率上限设得比显示器高**（例如 60Hz 屏上设 120）时，目标会被实测刷新率压回 60，不再出现旧实现那种"60 FPS 却按 120 的目标去升分辨率"的抖动。
