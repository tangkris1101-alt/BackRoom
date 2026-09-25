# Level 0 电梯出口验收（2026-09-25）

> 此文及截图记录第一版独立箱体电梯，已被[东墙入墙修正](../level-zero-elevator-wall-mount-2026-09-25/REPORT.md)替代；以下位置与画面不代表当前构建版。

Level 0 原位于 `EXIT_CELL (27, 3)` 的落洞已改为可交互双扇滑门电梯，目标 Level 1。原落洞下方不再有地板开孔，旧位置 `getFloorHeight` 返回 0。马尼拉房文档、桌子、拾取物及其它 Level 0 内容未改动。

## 画面

以下截图由 `tests/level-zero-elevator-visual.html` 在浏览器中直接创建完整的 `createLevelZeroScene()`，于旧出口附近拍摄；是实际 Level 0 场景几何/材质，不是离线渲染或示意图。均为 1280×720。该独立验收页不含主游戏 HUD，因此不把截图冒充为在正式游戏中徒步抵达出口后的画面。

- [关门](closed.jpg)：金属双扇门、轿厢外框、滑门收纳侧箱、呼梯钮与 Level 1 标识。
- [开门](open.jpg)：门板缩入侧箱，能看见轿厢金属内壁、踏板地面和内部灯具。
- [材质近景](detail.jpg)：1024px 单叶门板彩色/法线/粗糙度贴图、细擦痕、框架铆钉与表面接缝。

两片门板分别使用不同的 1024px 彩色、法线和粗糙度贴图，框架复用同分辨率 PBR 纹理；单张贴图只覆盖一片门板的正面，避免门面可见重复与 UV 拉伸。地板为 512px 防滑菱形踏板彩色/凹凸贴图。滑门收纳箱遮住打开后的门叶，金属与原 Level 0 黄墙、地毯色调分离。

## 功能与检查

- 关门：`focusInteraction` 为 `level-zero-elevator-level-one` 且可交互；入口中心/靠门边均不可走；“步入”不会触发换层；旧洞地面高度为 0。
- 开门：按 F 等价交互后门板滑开；入口中心可走、门边 x≈0.7m 仍被门板阻挡；步入轿厢返回 `exitReached=true`、`nextLevel=1`，随后加载并确认 Level 1 场景 `LEVEL 1 · HABITABLE ZONE`。
- 正式 `app.html?debug=true&level=0` 在浏览器中已成功进入 Level 0，控制台无 warning/error；独立验收页的最终新标签页也无 warning/error。
- `node --check`、`npm.cmd run check`、`git diff --check` 通过。未在子任务内运行统一构建或修改产物文件；待主任务统一构建复验。

限制：独立验收页以程序化位置模拟 F 与步入，未在正式游戏内徒步穿越全地图抵达出口；因此主程序转场的画面仍需主任务构建后复核。
