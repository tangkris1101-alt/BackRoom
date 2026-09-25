# 严重纹理层级修复与截图验收

日期：2026-09-25

## 范围与结果

依据 [16 关逐层评估](../level-texture-audit-2026-09-19/REPORT.md)，“严重”及以上共 3 关；已分别由子代理处理，并由主任务在统一正式构建后逐关重新截图。

| 层级 | 原评级与问题 | 本次处理 | 截图复核 |
|---|---|---|---|
| Level 2 · PIPE DREAMS | 严重；近墙几乎全黑，地/顶近乎纯色 | 修正合并几何缺失的 UV、面朝向和法线；调整局部照明、污渍与设备磨损 | 墙面锈蚀、地面分块、顶面接缝可辨；仍保留暗暖工业氛围 |
| Level 4 · ABANDONED OFFICE | 严重；地毯硬方格像地砖 | 移除规则格线，加入低对比色斑/短纤维，接入地毯法线与粗糙度 | 硬方格消失；近处呈柔和织物颗粒，远处受雾效影响仍偏柔 |
| Level 12 · MATRIX | 最严重；高亮、自发光洗平墙地和家具 | 延续上一轮降曝光/自发光、增加木纹与地面细节；本轮补强浅色墙面、接缝与墙脚 | 木纹、地面磨损、墙脚和轻微墙面色差可见；墙面保持刻意素净 |

## 截图证据

截图均为 1280×720、对应层级出生点，按 `X` 后确认 `#scene[data-debug-features="false"]`，关闭调试跟随灯。`after-built` 是统一构建后的在线版在真实浏览器中重新采集；三关正式版浏览器控制台均无 warn/error。

### Level 2

| 修复前 | 正式构建修复后 |
|---|---|
| ![Level 2 修复前](level-2/before.jpg) | ![Level 2 正式版修复后](level-2/after-built.jpg) |

[开发版修后图](level-2/after.jpg) · [详细记录](level-2/REPORT.md)

正式版测试源曾有本地测试背包中的手电筒，故在保持机位不变的情况下用游戏内 `Q` 丢下该测试物品，以免背包信息遮挡墙、地截图；未修改页面 DOM 或样式。

### Level 4

| 修复前 | 正式构建修复后 |
|---|---|
| ![Level 4 修复前](level-4/before.png) | ![Level 4 正式版修复后](level-4/after-built.jpg) |

[开发版修后图](level-4/after.png) · [地毯近景](level-4/after-carpet-crop.png) · [详细记录](level-4/REPORT.md)

### Level 12

| 原评估修复前 | 正式构建修复后 |
|---|---|
| ![Level 12 修复前](../level-12-material-fix-2026-09-25/before-level-12.png) | ![Level 12 正式版修复后](level-12/after-built.jpg) |

[开发版修后图](level-12/level-12-after.png) · [本轮复核记录](level-12/REPORT.md) · [上一轮基础修复记录](../level-12-material-fix-2026-09-25/REPORT.md)

## 检查与交付

- `npm.cmd run check`：通过。
- `node --test tests/level-two-geometry.test.mjs`：通过；覆盖 Level 2 五类合并网格的 UV 数量、有限值与三角形朝向。
- `npm.cmd run build`：通过，已更新在线构建和根目录独立版 `backrooms.html`。
- `npm.cmd run test:build`：通过。
- `git diff --check`：通过；仅有 Git 的 LF/CRLF 提示。
- 此次为本地修复与构建验证，未部署线上，也未提交 Git。

独立版 `backrooms.html` 已生成并通过构建检查；浏览器安全策略阻止直接访问本地 `file://` 页面，因此没有将独立版的实际运行截图冒称为已验证。上方三张 `after-built` 图来自正式在线构建预览。

本地预览未启动可选的账户 API，预览服务器记录过 `/api/v1/auth/me` 的代理连接失败；三关均以游客模式正常渲染，浏览器控制台无 warn/error。此项不等同于账户功能验收。

判定边界：本次确认的是原“严重/最严重”三关在玩家出生点的纹理可读性和正式构建可运行；Level 2 的远处仍有意保持黑暗，Level 4 远景细纤维会受雾/缩小滤波影响，Level 12 墙面仍属简洁的浅色涂层。没有将这些效果描述为彻底拟真化。
