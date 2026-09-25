# 全部「偏弱」层级材质修复与截图验收

日期：2026-09-25。范围依据 [16 层原始审计](../level-texture-audit-2026-09-19/REPORT.md)：THE HUB、Level 1、Level 3、Level 9，共 4 层。原审计中标为「严重／最严重」的 Level 2、4、12 已在前一轮处理，本报告不重复覆盖；「中等」「受限」也不在本次范围内。

| 层级 | 原主要问题 | 本次处理 | 构建版目视结果 |
| --- | --- | --- | --- |
| THE HUB | 隧道黑位过死，墙、地近乎纯色 | 既有沥青/混凝土 PBR、连续 UV、克制的间接反射和灯具覆盖 | 路面裂纹、步道磨损、侧墙与拱顶纹理可读；仍保持暖暗隧道 |
| Level 1 | 墙面低对比竖条、墙脚和地面层次弱 | 干燥涂层细节、施工缝、墙脚线、增强高画质 PBR；低画质补偿照明 | 高画质墙脚关系更清楚，地面磨损仍可读；低画质不再整体压黑 |
| Level 3 | 砖墙偏暗、灰缝不清、模块重复 | 无缝砖纹与凹凸、三组风化变体、局部照明 | 砖面、灰缝与颗粒清楚，仍为昏暗维护区 |
| Level 9 | 柏油如均匀灰面，树为单锥黑影 | 真实柏油 PBR 连续 UV、分层不规则树冠、微调冷色月光 | 树线不再全黑，近地表有细微石料变化；仍是四层中受夜景限制最大的一层 |

## 构建版实景截图

每层都在 `npm.cmd run build` 后由 Vite preview 的 `app.html?debug=true&level=<id>` 直达，1280×720 出生点、正常游戏照明、高画质；按 `X` 后确认 `#scene[data-debug-features="false"]`，不使用调试跟随灯。四层浏览器 warn/error 日志均为空。下列均为实际构建版截图，不是源码预览或合成图。

### THE HUB

[修前](hub/before.jpg) · [开发版修后](hub/after.jpg) · [层级细报](hub/REPORT.md)

![THE HUB 构建版修后](hub/after-built.jpg)

### Level 1

[修前高画质](level-1/before.jpg) · [开发版修后高画质](level-1/after.jpg) · [修后低画质](level-1/after-low.jpg) · [层级细报](level-1/REPORT.md)

![Level 1 构建版修后](level-1/after-built.jpg)

### Level 3

[修前](level-3/before.jpg) · [开发版修后](level-3/after.jpg) · [层级细报](level-3/REPORT.md)

![Level 3 构建版修后](level-3/after-built.jpg)

### Level 9

[修前](level-9/before.jpg) · [开发版修后](level-9/after.jpg) · [层级细报](level-9/REPORT.md)

![Level 9 构建版修后](level-9/after-built.jpg)

## 验证与边界

- `npm.cmd run check`、`npm.cmd run build`、`npm.cmd run test:build`、`node --test tests/level-two-geometry.test.mjs`、`git diff --check` 均通过。构建有既有的大 chunk 体积警告，不影响本次通过状态。
- 四张 `after-built.jpg` 均检查为 1280×720；构建版游戏中均显示正确层级、高画质和约 60 FPS。
- 截图只覆盖固定出生点，不能证明整张地图每个位置的材质同样理想。Level 3 的视角紧贴墙角；Level 9 夜景下柏油细颗粒仍偏弱、远树仍是低多边形风格。Level 1 旧审计截图偏暗的确切原因无法仅凭现有证据确定；因此本轮另外保留了同一浏览器的高画质修前/修后图以及低画质修后图。
- 本次交付为本地代码、在线构建与单文件 `backrooms.html`，未推送或部署。
