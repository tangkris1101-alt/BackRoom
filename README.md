# Backrooms 3D

一个 [Backrooms](https://backrooms.fandom.com/wiki/Backrooms_Wiki) 主题的第一人称探索小游戏。

项目使用 Three.js + WebGL 实现，入口为 `app.html`，并可构建为直接打开的独立版 `backrooms.html`。

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
- **可选账户与云存档**：邮箱注册、验证、登录、找回密码、跨设备存档、版本冲突选择；不登录时继续使用原有游客本地存档
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
├── scripts/
│   └── make-standalone.mjs       # 把 Vite 构建产物内联为单 HTML
└── vite.config.js
```

> `dist/`、`backrooms.html` 由 `npm run build` 生成，已被 `.gitignore` 忽略。

---

## Three.js 独立版

### 开发
```bash
npm install
npm run api:dev      # 账户 API（内存模式）, http://127.0.0.1:8787
npm run dev          # 另一个终端启动 Vite, http://127.0.0.1:5173
npm run test:accounts
```

账户后端的架构、配置、数据迁移和上线前检查见 [`docs/account-system.md`](docs/account-system.md)。独立版 `backrooms.html` 继续支持游客本地存档，但不会连接账户 API。

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
| `BACTERIA_DAMAGE` | 50 | 细菌单次扣血 |
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
- Web Audio API（环境音）
- Pointer Lock API + Touch Events
