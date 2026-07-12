# Backrooms 3D

一个 [Backrooms](https://backrooms.fandom.com/wiki/Backrooms_Wiki) 主题的第一人称探索小游戏。

仓库提供**两条平行的产品线**，共享美术与设计：

| 路线 | 渲染 | 入口 | 用途 |
|---|---|---|---|
| **Three.js 独立版** | 真 3D（WebGL + Three.js）| `app.html` / `backrooms.html` | 桌面浏览器、移动端浏览器，独立运行 |
| **TurboWarp 扩展** | Canvas 2D raycaster（沙箱内安全）| `extensions/backrooms3d.js` → `dist/app.sb3` | 在 [TurboWarp](https://turbowarp.org/) 中以 Scratch 项目形式运行 |

---

## 已实现

### 关卡
- **Level 0 — NOCLIP ZONE**（起始/教学）
- **Level 1 — HABITABLE ZONE**（黄墙纸经典迷宫）
- **Level 2 — PIPE DREAMS**（管道机房）
- **Level 3 — ELECTRICAL STATION**（超级细菌危险区）
- **Level 4 — ABANDONED OFFICE**（安全补给办公室 + 黑窗/隔间/楼梯出口）
- **Level 5 — TERROR HOTEL**（1930s 酒店主厅 + Beverly Room + 锅炉房）

### 玩法
- 第一人称移动 + 冲刺 + 跳跃（带体力条）
- Pointer Lock 视角 + 拖拽 fallback
- 移动端摇杆 + 操作按钮
- **道具系统**：手电筒（电量有限、SpotLight 锥光、可堆叠 3 个、电量耗尽自动消耗 1 个并回满）、探测器（5s 扫描 / 60s 冷却、72m 范围）、杏仁水（+50 上限/45s / +30 回血）、超级杏仁水（上限 250 / 恢复×2 / 移速×1.5 / 25s / +80 回血）
- 拾取提示 + 检视信息面板 + 主动使用 + **长按 E 饮水**
- 道具栏：主槽 + 侧槽 + 左右翻页
- **实体检测**（Level 4/5）：屏幕边缘箭头标记 + 探测器标记
- **健康系统**（100/100）：实体接触改为扣血而非直接失败（细菌 −50 / 超级细菌 −60 / Hound −30 并附带短暂减速）、1 秒无敌帧、屏幕红屏反馈；血量归零则视为失联
- 出口触发完成 overlay
- ESC 暂停（冻结音频 + pointerlockchange 兜底）
- 暂停界面**保存进度**按钮（单击立即写盘，绿色主题，1.4s 内显示「已保存」反馈，与 5s 自动保存 / beforeunload flush 互为补充）
- 暂停界面**重置进度**按钮（两步确认：点击进入「再次按下以确认」武装态，3s 内再次按下清空全部存档并回到 L0；超时、恢复、ESC 自动取消）
- 4 页教学弹窗（首次进入）
- 中英双语 UI 切换（`localStorage` 持久化）

### 画面/声音
- ACES 色调映射 + 动态像素比（0.75–1.25，FPS 自适应）
- 程序化纹理（地毯、墙纸、天花板噪点）
- Web Audio 环境低频嗡鸣（受 flicker 调制）+ 脚步声白噪声
- 关卡过渡 1250ms 淡入淡出

---

## 目录结构

```
.
├── src/                          # Three.js 独立版源码
│   ├── main.js                   #   入口、UI 绑定、主循环
│   ├── scene.js                  #   关卡生成、纹理、实体、道具摆放
│   ├── first-person-controls.js  #   移动/碰撞/相机
│   ├── ambient-audio.js          #   Web Audio 环境音
│   └── styles.css                #   HUD / 弹窗 / 道具栏样式
├── app.html                      # Vite 入口（独立 HTML 模板）
├── extensions/
│   └── backrooms3d.js            # TurboWarp 自定义扩展（Canvas 2D raycaster）
├── scripts/
│   ├── generate-sb3.mjs          # sb3 打包（file/local-http/embedded 三种模式）
│   ├── make-standalone.mjs       # 把 Vite 构建产物内联为单 HTML
│   ├── validate-sb3.mjs          # sb3 schema 校验
│   └── verify-sb3.mjs            # sb3 结构检查
└── vite.config.js
```

> `dist/`、`backrooms.html` 由 `npm run build` 生成，已被 `.gitignore` 忽略。

---

## Three.js 独立版

### 开发
```bash
npm install
npm run dev          # Vite, http://127.0.0.1:5173
```

### 构建
```bash
npm run build
# 产出：
#   dist/app.html             — Vite 构建产物
#   backrooms.html (根目录)    — 内联所有资源的单文件版
```

### 部署
- **整站部署**：把 `dist/` 作为静态站点根目录
- **自动更新部署**：上传 `dist/`（其中的 `backrooms-version.json` 会让旧页面自动切换到新版本）
- **单文件部署**：只上传 `backrooms.html` 仍可运行，但无法自动检测后续更新
- 仓库根目录的 `index.html` 会读取版本清单后再跳转到 `backrooms.html`

---

## TurboWarp 扩展版

### 为什么需要单独的扩展版本？
TurboWarp 在线版（turbowarp.org）的扩展运行在 Web Worker 沙箱中，**没有 DOM 访问能力**，所以用 Canvas 2D + 自实现 raycaster 重写了一份：

- 19×19 迷宫（与 Level 1 风格一致）
- 120 条射线的 DDA 墙渲染
- 4 个监视器 block：`distance` / `signal` / `flicker` / `lock`
- Web Audio 低频嗡鸣（沙箱允许）
- 远景统一黄色雾，避免黑色空洞

### 打包 sb3
```bash
node scripts/generate-sb3.mjs   # 默认 file:// 模式
```

三种加载模式（环境变量 `LOAD_MODE`）：

| `LOAD_MODE` | 行为 | 适用 |
|---|---|---|
| `file`（默认）| 引用 `file:///path/to/extensions/backrooms3d.js` | TurboWarp 桌面版 |
| `local-http` | 引用 `http://localhost:PORT/extensions/backrooms3d.js` | 在线版 + 本地 HTTP 服务器 + Chrome 标志 |
| `embedded` | 内联 base64 data URL | 任意环境（仅非沙箱） |

### 加载 sb3

**方式 A：TurboWarp 桌面版**
1. 安装 [TurboWarp Desktop](https://desktop.turbowarp.org/)
2. 把 `dist/app.sb3` 与 `extensions/backrooms3d.js` 放同目录
3. 编辑 `app.sb3` 内的 `project.json`，把扩展 URL 改为你机器的实际路径
4. 打开运行

**方式 B：在线版 + 本地 HTTP**
```bash
npx http-server -p 8080 -c-1     # 项目根目录启动
set LOAD_MODE=local-http
set PORT=8080
node scripts/generate-sb3.mjs
```
Chrome 启动加 `--allow-file-access-from-files --disable-web-security`，访问 `http://localhost:8080/dist/app.sb3`

**方式 C：部署扩展到公网 HTTPS**
```bash
set EXT_FILE_URL=https://your-domain.com/backrooms3d.js
node scripts/generate-sb3.mjs
```
直接用 https://turbowarp.org/editor 打开 `dist/app.sb3`。

### 校验
```bash
node scripts/validate-sb3.mjs    # 输出: VALIDATION OK
```

---

## 控制

### 桌面
| 按键 | 动作 |
|---|---|
| `W` `A` `S` `D` / 方向键 | 移动 |
| `Shift` | 冲刺 |
| `Space` | 跳跃 |
| `E` | 使用道具 / 长按饮水 |
| `F` | 拾取 / 检视 |
| `L` | 切换 Pointer Lock |
| `Esc` | 退出 Pointer Lock / 暂停 |

### 移动端
- 左下摇杆 = 移动
- 右下按钮组 = 跳跃 / 拾取 / 使用 / 手电筒 / 探测器 / 暂停

---

## 调参速查（`src/main.js`）

| 常量 | 值 | 含义 |
|---|---|---|
| `FLASHLIGHT_BATTERY_MAX` | 100 | 手电筒满电 |
| `FLASHLIGHT_DRAIN_RATE` | 4.2/s | 耗电速度 |
| `FLASHLIGHT_MAX_STACK` | 3 | 手电筒堆叠上限 |
| `DETECTOR_SCAN_DURATION` | 5s | 扫描时长 |
| `DETECTOR_COOLDOWN_DURATION` | 60s | 扫描冷却 |
| `DETECTOR_RANGE` | 72m | 扫描半径 |
| `ALMOND_WATER_DURATION` | 45s | 杏仁水 buff 时长 |
| `SUPER_ALMOND_WATER_DURATION` | 25s | 超级杏仁水 buff 时长 |
| `SUPER_ALMOND_WATER_SPEED_MULTIPLIER` | 1.5 | 超级杏仁水 buff 期间角色移速倍率(走/跑) |
| `WATER_LONG_PRESS_MS` | 600ms | 长按 E 触发饮水 |
| `HEALTH_MAX` | 100 | 玩家满血 |
| `BACTERIA_DAMAGE` | 50 | 普通细菌单次扣血 |
| `SUPER_BACTERIA_DAMAGE` | 60 | 超级细菌单次扣血 |
| `HOUND_DAMAGE` | 30 | Hound 单次扣血 |
| `HOUND_SLOW_DURATION` | 3.0s | Hound 受击后减速持续时间 |
| `DAMAGE_COOLDOWN_S` | 1.0s | 受到任意伤害后的无敌帧时长 |
| `ALMOND_WATER_HEAL` | 30 | 杏仁水饮用完成时的回血量 |
| `SUPER_ALMOND_WATER_HEAL` | 80 | 超级杏仁水饮用完成时的回血量 |
| `DAMAGE_FLASH_MS` | 600ms | 屏幕红屏动画时长 |
| `PAUSE_RESET_ARM_TIMEOUT_MS` | 3000ms | 暂停重置按钮武装态超时(超时自动取消确认) |
| `PAUSE_SAVE_FLASH_MS` | 1400ms | 暂停保存按钮「已保存」反馈持续时间 |
| `FPS_LOW/HIGH_THRESHOLD` | 48/58 | 动态像素比阈值 |

---

## 技术栈

- [Three.js](https://threejs.org/) 0.184
- [Vite](https://vitejs.dev/) 8
- [scratch-vm](https://github.com/scratchfoundation/scratch-vm) 5 + [jszip](https://stuk.github.io/jszip/) 3（仅 sb3 生成）
- Canvas 2D（TurboWarp 扩展版 raycaster）
- Web Audio API（环境音）
- Pointer Lock API + Touch Events
