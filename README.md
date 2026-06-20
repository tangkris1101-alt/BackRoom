# Backrooms 3D — TurboWarp 项目

这是把同目录下 `Three.js Backrooms 项目`（`app.html` / `src/`）复刻为可在 TurboWarp 中运行的项目。

## 重要提示：加载方式限制

由于 **TurboWarp 在线版（turbowarp.org）的扩展运行在 Web Worker 沙箱中，没有 DOM 访问能力**，自定义扩展无法直接做 raycaster、pointer lock、Web Audio 等操作。

**`dist/app.sb3` 使用 `file://` 协议引用本地扩展，必须按以下方式之一加载**：

---

## 加载方式

### 方式 A：TurboWarp 桌面版（最简单）

1. 下载 [TurboWarp Desktop](https://desktop.turbowarp.org/)
2. 把 `dist/app.sb3` 和 `extensions/backrooms3d.js` 放在同一目录
3. 用 TurboWarp 桌面版打开 `app.sb3`
4. **编辑 `app.sb3` 中的扩展 URL** 指向你本地的 `backrooms3d.js` 路径：
   - 用文本编辑器打开 `app.sb3`（它实际是 zip）
   - 编辑 `project.json`，找到 `tw:custom-extensions[file:///C:/Users/.../backrooms3d.js]`
   - 改为你的实际路径
5. 点击绿旗运行

### 方式 B：本地 HTTP 服务器 + Chrome 标志（在线版）

1. 在项目根目录启动一个简单的 HTTP 服务器：

   ```bash
   npx http-server -p 8080 -c-1
   ```

2. 重新生成 sb3 引用本地 HTTP URL：

   ```bash
   set LOAD_MODE=local-http
   set PORT=8080
   node scripts/generate-sb3.mjs
   ```

3. 启动 Chrome 时加 `--allow-file-access-from-files` 和 `--disable-web-security` 标志
4. 访问 `http://localhost:8080/dist/app.sb3`

### 方式 C：把扩展部署到公网 HTTPS URL

1. 把 `extensions/backrooms3d.js` 部署到 GitHub Pages、jsDelivr 或你自己的服务器
2. 重新生成 sb3 引用 HTTPS URL：

   ```bash
   set EXT_FILE_URL=https://your-domain.com/backrooms3d.js
   node scripts/generate-sb3.mjs
   ```

3. 在 https://turbowarp.org/editor 打开 `dist/app.sb3` 即可

---

## 控制

| 按键 | 动作 |
|------|------|
| `W` / `↑` | 前进 |
| `S` / `↓` | 后退 |
| `A` / `←` | 左移 |
| `D` / `→` | 右移 |
| `Shift` | 冲刺 |
| `L` | 切换指针锁定（Pointer Lock） |
| `Esc` | 退出 Pointer Lock（浏览器自动） |
| 鼠标拖拽 | 自由模式（未 lock 时）转向 |

---

## 已实现功能

- ✅ 19×19 Backrooms 迷宫（与 Three.js 原项目完全相同）
- ✅ 2.5D raycaster（Canvas 2D，120 条射线）
- ✅ 完整移动与 9 点采样碰撞检测
- ✅ 灯光闪烁效果（驱动雾密度）
- ✅ 出口 EXIT 标志（接近时显示）
- ✅ 距离 HUD（4 个监视器：distance, signal, flicker, lock）
- ✅ 鼠标双模式控制（非 lock 拖拽 + Pointer Lock 切换）
- ✅ Web Audio 环境低频嗡鸣（受 flicker 调制）
- ✅ 视野抖动、雾化、暗角

## 与 Three.js 原项目差异

- ❌ 真实 WebGL 纹理贴图（用纯色 + 暗角模拟）
- ❌ 真 3D 管道/装饰物（省略以保证帧率）
- ❌ 完整物理光照（用亮度因子近似）

## 文件结构

```
.
├── extensions/
│   └── backrooms3d.js       # 自定义 TurboWarp 扩展
├── scripts/
│   ├── generate-sb3.mjs     # sb3 生成器
│   ├── validate-sb3.mjs     # schema 验证
│   └── verify-sb3.mjs       # 结构检查
└── dist/
    └── app.sb3              # 最终 sb3（引用 extensions/backrooms3d.js）
```

## 重新生成

```bash
# 默认（file:// 模式，路径为当前机器）
node scripts/generate-sb3.mjs

# 指定不同路径
node scripts/generate-sb3.mjs  # 或在 Windows 上：
set EXT_FILE_URL=file:///D:/projects/backrooms3d.js
node scripts/generate-sb3.mjs
```

## 验证

```bash
node scripts/validate-sb3.mjs
# 输出: VALIDATION OK
```
