# 账户与云存档实施说明

## 当前范围

本轮已在代码层完成账户与云存档，不包含生产部署：

- 游客不登录时沿用原有浏览器本地存档键；账户存档使用按账户 ID 隔离的本地键。
- 邮箱注册、邮箱验证、登录、退出、忘记密码、重置密码和当前会话查询。
- 云存档读取、带版本号写入、删除以及显式冲突处理。
- 首次登录可把游客存档复制到账户；游客原件不会被删除。
- `file:` 打开的独立 HTML 自动禁用账户入口，本地单机存档仍可使用。

## 数据与同步模型

前端始终先写本地存档，再以 1.4 秒防抖上传。云端保存完整快照，不尝试字段级合并，避免把背包、实体、门和玩家位置拼成无效状态。

每份云存档有递增 `revision`。客户端上传时必须提供自己最后看到的 `baseRevision`：

1. 一致时保存成功，服务端生成下一版本。
2. 不一致时返回 HTTP 409、云端版本号和云端快照。
3. 前端让玩家明确选择“保留当前设备并覆盖云端”或“使用云端存档”。

存档载荷由 `src/save-schema.js` 统一校验，当前包含游戏快照、到达/完成层级、已拾取道具、构建号、设备标识和客户端保存时间。

## 后端结构

- `server/app.js`：HTTP 路由、会话、Origin 校验、限流和错误协议。
- `server/security.js`：邮箱/密码规则、Argon2id、令牌哈希和会话 Cookie。
- `server/memory-store.js`：仅用于本地开发与自动化测试。
- `server/mysql-store.js`：生产 MySQL 适配器，所有外部值通过预处理参数绑定。
- `server/mailer.js`：本地捕获邮件或生产 SMTP；兼容现有 `yuwen-score` 的 `SMTP_*` 配置约定。
- `server/migrations/001_accounts.sql`：MySQL 5.7 兼容表结构。

生产会话使用只保存哈希的随机令牌；Cookie 为 Host-only、HttpOnly、SameSite=Lax，生产模式增加 Secure。验证与重置令牌同样只在数据库保存 SHA-256 哈希。密码使用 Argon2id（19 MiB、2 次迭代、并行度 1）。

## 本地运行

Node.js 22：

```bash
npm ci
npm run api:dev
```

另开终端：

```bash
npm run dev
```

打开 `http://127.0.0.1:5173/app.html`。Vite 会把 `/api` 代理到 `127.0.0.1:8787`。开发模式返回一次性测试验证/重置令牌，前端会自动填入；生产模式不会返回这些字段。

自动化验证：

```bash
npm run test:accounts
npm run check
npm run build
```

## 生产部署要点

1. 使用权限受限的 MySQL 用户和独立数据库，执行 `server/migrations/001_accounts.sql`。
2. 复制 `server/config.example.env` 为项目根目录 `.env`，替换数据库和 SMTP 占位值并设置为仅运行用户可读；不要提交真实密钥。服务启动时会自动读取该文件，进程管理器不必重复保存这些变量。
3. 设置 `NODE_ENV=production`、`BACKROOMS_DB_MODE=mysql`、精确的 `BACKROOMS_ALLOWED_ORIGINS` 和 HTTPS `BACKROOMS_PUBLIC_URL`。
4. 以独立低权限系统用户运行 `node server/index.js`，只监听 `127.0.0.1:8787`。
5. 将 Nginx 静态根目录指向项目的 `dist/`；仅反代 `/api/` 到本地 API，并保留原始 `Host`、`X-Forwarded-Proto` 和客户端地址。
6. 验证 SMTP 发件域 SPF/DKIM/DMARC、邮件链接、Secure Cookie、注册/重置限流及数据库备份恢复。
7. 用测试域或维护窗口完成 MySQL、SMTP、Nginx、PM2/进程守护和真实浏览器验收，再决定是否切生产。

邮件配置优先读取 `BACKROOMS_SMTP_*`，也兼容 `SMTP_HOST`、`SMTP_PORT`、`SMTP_USERNAME`、`SMTP_PASSWORD`、`SMTP_FROM_EMAIL` 和 `SMTP_FROM_NAME`。465 端口默认启用隐式 TLS；也可通过 `SMTP_SECURE=1/0` 明确设置。运行 `npm run smtp:verify` 只验证 TLS 与 SMTP 认证，不发送邮件。

`dist/index.html` 应使用 `no-cache`，`dist/assets/` 中带哈希的静态资源应使用一年 `immutable` 缓存；账户 API 响应继续使用 `no-store`。
