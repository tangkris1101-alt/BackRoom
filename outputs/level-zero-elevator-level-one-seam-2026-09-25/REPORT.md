# Level 0 电梯与 Level 1 墙面拼缝验收（2026-09-25）

> 本报告中的 Level 0 电梯为第一版独立箱体，已被[东墙入墙修正](../level-zero-elevator-wall-mount-2026-09-25/REPORT.md)替代；Level 1 墙面记录仍适用。

## 交付

- Level 0：原 `EXIT_CELL (27, 3)` 落洞已封平，替换为通往 Level 1 的双扇滑门电梯。按 F 开门，门板滑开后从中央走入轿厢才触发换层。关门及门板边缘有实体碰撞。
- 电梯材质：两片门板各使用独立的 1024×1024 彩色、法线、粗糙度贴图；框架有金属细节，轿厢地面使用 512×512 防滑踏板贴图。细节近景见下方截图。
- Level 1：原墙面由每 4 米独立盒子改为合并连续墙段，墙体 UV 使用世界坐标，避免每段重置；同时移除程序贴图里重复出现的横向“接缝”。维持干燥、有人维护的灰绿墙面风格。

## 截图

- [Level 0 电梯关门（完整 Level 0 场景近出口）](../level-zero-elevator-2026-09-25/closed.jpg)
- [Level 0 电梯开门（完整 Level 0 场景近出口）](../level-zero-elevator-2026-09-25/open.jpg)
- [Level 0 电梯材质近景](../level-zero-elevator-2026-09-25/detail.jpg)
- [Level 0 构建版出生点](level-0-spawn-after-built.png)
- [Level 1 构建版长墙](level-1-after-built.png)
- [Level 1 修复前对照](../weak-level-fixes-2026-09-25/level-1/after-built.jpg)

以上均为 1280×720 浏览器实景。电梯三张近出口截图来自独立验收页直接实例化完整 `createLevelZeroScene()`，而不是正式游戏从出生点徒步到出口；Level 0 构建版出生点和 Level 1 构建版截图来自正式 `app.html`。构建版截图使用高画质，并关闭 debug 跟随补光；Level 1 为聚焦墙面而隐藏 HUD。

## 验证

- 电梯验收页：关门时入口中心与门边不可走，旧出口地面高度为 0；开门后中心可走、门边仍受阻。进入轿厢后 `exitReached=true`、`nextLevel=1`，并成功创建 `LEVEL 1 · HABITABLE ZONE` 场景。
- Level 1 墙体：原 232/163/24/17 个墙模块合并为 43/44/6/5 个连续墙段；门洞仍保留；3 项墙面几何与 UV 回归测试通过。
- `npm.cmd run check`、`npm.cmd run build`、`npm.cmd run test:build`、`node --test tests/level-one-wall-uv.test.mjs`、`git diff --check` 均通过。正式构建版的 Level 0 与 Level 1 都已在浏览器启动，控制台 warning/error 为空。

预览服务器在检查游客会话时记录过 `/api/v1/auth/me` 到未启动的可选本地认证服务（127.0.0.1:8787）连接失败；游客模式及两层场景仍正常启动。这不是电梯或墙面渲染错误。

边界：正式游戏没有实际徒步穿越 Level 0 全地图并在出口处按 F 转场；交互与换层由完整场景验收页在旧出口位置模拟玩家位置验证。Level 1 墙面仍有低对比度的程序纹理明暗变化，但旧图中明显的模块拼缝与横线已消失。
