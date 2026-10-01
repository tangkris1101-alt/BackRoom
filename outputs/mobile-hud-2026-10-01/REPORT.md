# 手机端 HUD 修复：体力/生命对齐、物品面板让位、固定 F 按钮

日期：2026-10-01

## 三个问题

1. **体力与生命未对齐**：移动端媒体查询里只改了 `.stamina-meter` 等仪表的栅格列宽，漏了 `.health-meter`，于是生命条用的是桌面模板的 `auto` 标签列，起点比体力条靠左约 40px。
2. **物品与描述压住屏幕正中**：手机横屏视口只有 ~380px 高，而 `.item-info` 的底距是 `272px`、物品栏是 `152px`，两者都落在屏幕中段，正压在准星与手持物品上。
3. **移动的 F 点不到**：`#pickup-prompt` / `#door-prompt` 跟着目标物体在画面里移动，拇指很难点中；而原本的固定 `#use-button` 在移动端被 `display: none` 关掉了。

## 改动

### 体力 / 生命对齐（`src/styles.css`）

- 两处移动端媒体查询的仪表栅格规则补上 `.health-meter`，移动端所有仪表共用同一列模板（标签列 64–92px、数值列 58px 起），两条血条起点与宽度完全一致（实测横屏 800x380：都是 `[121 .. 179]`，竖屏 390x844 同样）；
- 桌面端顺带修掉同类问题：原来两条都写 `grid-template-columns: auto …`，`auto` 让标签列按各自文字的宽度取宽，而“生命”比“体力”宽一点（英文 STAMINA / HEALTH 差得更多），血条会错开 1px 以上。现在两个仪表共用 `minmax(52px, auto) minmax(92px, 130px)`（1280x720 实测两条都在 left 89）。

### 物品面板让位（`src/styles.css`）

- `.item-info`（物品/交互/实体说明卡）手机端改为**顶部居中**：`top: max(12px, inset)`、宽 `min(58vw, 320px)`，桌面端不变；
- 横屏时物品栏落到底部：`left: max(152px, inset)`（贴着摇杆右侧，不再居中——右侧按钮组比摇杆宽，居中的话会压到 F），`bottom: max(14px, inset)`，`max-width: min(calc(100vw - 500px), 300px)`；竖屏仍保持抬高（`bottom: max(152px)`）以避开摇杆与按键；
- 竖屏追加：说明卡下移到 HUD 之下（`top: max(170px, inset+162px)`），物品栏抬到 `bottom: max(280px, inset+272px)`，避开右侧的固定 F 与暂停键；
- 固定 F 加入按键组的 `z-index: 8`，不会被物品栏盖住。

### 固定 F 按钮（`app.html` 既有节点 + `src/main.js` + `src/styles.css`）

复用已有的 `#use-button`：

- **常驻**：移动端 `display: grid`，横屏落在按键行（`right 232px / bottom 46px`，F·E·Q·跳 一排），竖屏落在暂停键下方（`right 168px / bottom 126px`）；未就绪时 `opacity: 0.34`，可用时 `is-visible` 亮起；
- **亮起条件**：`canUseInReach` —— 触屏布局下，只要**任何**拾取物在拾取半径内（不必对准准星）或地上有可拾取的世界物品就亮；桌面端语义不变（仍是准星聚焦）；
- **一键全拾**：`usePickup({ grabAll: isTouchLayout() })` → `grabEverythingInReach()`，先扫地上的世界物品、再扫关卡拾取物，每次调用消耗一件（掉落物/道具的 `tryPickup` 都是距离判定），背包满或取不到为止（上限 `PICKUP_SWEEP_LIMIT = 8` 次）；一次拿多件时状态栏显示“一键拾取 N 件”（`STATUS_TEXT.pickupSweep`，中英各一条）；
- 门/电梯/阀门仍走原来的聚焦路径（`isDoorInteraction` 在前），键盘 F 行为完全不变；
- 拾取与描述面板的点击（`#pickup-prompt` / `#door-prompt`）在触屏布局下同样走全拾分支。

`usePickup` 顺带把两段“应用拾取结果”的代码抽成 `applyWorldItemPickup()` / `applyLevelPickup()`，聚焦路径与全拾路径共用。

## 验证

- `scripts/check-mobile-hud.mjs`（新增，已接入 `npm run check`）：静态断言
  - 每个触屏仪表规则都必须包含 `.health-meter`（故意去掉后该检查会失败，已实测）；
  - 移动端 `.use-button` 有 `display: grid` 与暗态透明度、横屏位置存在；
  - `.item-info` 改为顶部定位且不再出现 272px 底距；横屏物品栏落到底部条带；
  - F 按钮与两个浮动提示都接到 `usePickup({ grabAll: isTouchLayout() })`，`canUseInReach` 与 `grabEverythingInReach()` 存在，循环有上限；中英状态文案都带 `{count}`。
- `outputs/mobile-hud-2026-10-01/mobile-check.py`（Playwright，真机视口 800x380 横屏 + 390x844 竖屏，触摸输入）：
  - 从自动存档摆出“身前 2.5m 一瓶杏仁水 + 身后 1.4m 一支手电筒”的局面；
  - 断言：体力/生命条 `left` 与宽度一致；F 按钮在屏内、不与摇杆/物品栏重叠；有可拾取物时 F 亮、无则暗；**一次点击后两件都在背包里**；说明卡在屏幕上半、物品栏在下半、互不遮挡；
  - 两种朝向全部通过，截图 `mobile-{landscape,portrait}-{idle,before-tap,after-tap}.png`；
- `outputs/mobile-hud-2026-10-01/desktop-sanity.py`：1280x720 桌面视口确认未被移动端规则波及 —— `pointer: coarse` 为 false、血条对齐（left 89）、`#use-button` 仍 `display: none`，截图 `desktop-layout.png`；
- `npm run check`（含新增的 `check-mobile-hud`）、`npm run test:scene`（25 项）、`npm run build` 全部通过。

## 未改

- 罐子/容器贴图偏暗（用户明确表示不改）；
- 门、电梯这类交互仍需要准星对准（与改动前一致，`available` 判定未变），固定 F 按钮此时执行的是同一套聚焦交互。
