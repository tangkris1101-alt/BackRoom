# Level 0 电梯入墙修正（2026-09-25）

上一版电梯放在空旷房间中，外观像独立箱体。现在入口设在 `EXIT_CELL (28, 3)` 东侧墙面，门板正面与原墙面开口齐平；轿厢延伸到墙后的单格电梯井 `(29, 3)`。墙洞上方用同款墙面补齐，保留 Level 1 标识、呼梯按钮与原有高分辨率门板材质。旧落洞继续由完整地板封住。

## 实景截图

- [正面，关门](front-closed-dev.png)
- [侧面，确认门框与墙面齐平](side-embedded-dev.png)
- [正面，开门可见轿厢](front-open-dev.png)
- [构建版 Level 0 正常启动](level-0-spawn-built.png)
- [修正前独立箱体对照](../level-zero-elevator-2026-09-25/closed.jpg)
- [中间方案：仅把箱体背面贴墙，仍显得外置，未采用](side-closed-dev.png)

前三张为 1280×720 的完整 `createLevelZeroScene()` 浏览器验收页截图，在电梯附近设置相机；并非正式游戏中徒步走到出口的截图。构建版截图取自正式 `app.html` 出生点，画质为高档且关闭了 debug 跟随补光。

## 功能验证

- 关门时入口中央及门边均不可走，旧洞地板高度为 0；关门直接模拟进入不会触发换层。
- 开门后入口中央可通行、门边仍受门板阻挡；进入轿厢返回 `nextLevel=1`，随后成功创建 `LEVEL 1 · HABITABLE ZONE`。
- 电梯井虽在地图中开放以供轿厢通行，但随机拾取物不会刷在井内；井内轿厢外侧与背后仍由碰撞阻挡。
- `npm.cmd run check`、`npm.cmd run build`、`npm.cmd run test:build`、`node --test tests/level-zero-elevator-wall-mount.test.mjs` 通过。构建号 `2fbd0fd69412`。验收页与正式构建版 Level 0 的浏览器控制台无 warning/error。

预览服务器尝试连接未启动的可选本地认证服务（127.0.0.1:8787）时记录了 `/api/v1/auth/me` 代理错误；游客模式场景与电梯验收不受影响。

证据边界：程序化验收页验证了完整 Level 0 场景里的门、碰撞与 Level 1 加载；未在正式游戏内从出生点徒步到电梯。构建版已启动验证，但其出生点截图并不展示远处电梯。
