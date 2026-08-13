import { URL } from "node:url";
import { sanitizeCloudSaveEnvelope } from "../src/save-schema.js";
import {
  clearSessionCookie,
  createId,
  createOpaqueToken,
  createSessionCookie,
  hashPassword,
  hashToken,
  normalizeDisplayName,
  normalizeEmail,
  parseCookies,
  validatePassword,
  verifyPassword,
} from "./security.js";

const MAX_JSON_BYTES = 1_150_000;

class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    emailVerified: Boolean(user.emailVerifiedAt),
    createdAt: user.createdAt,
  };
}

function sendJson(response, status, payload, headers = {}) {
  const body = JSON.stringify(payload);
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
    ...headers,
  });
  response.end(body);
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_JSON_BYTES) {
        reject(new HttpError(413, "PAYLOAD_TOO_LARGE", "Request payload is too large"));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      if (chunks.length === 0) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(new HttpError(400, "INVALID_JSON", "Request body must be valid JSON"));
      }
    });
    request.on("error", reject);
  });
}

function clientAddress(request, trustProxy) {
  if (trustProxy) {
    const forwarded = String(request.headers["x-forwarded-for"] ?? "").split(",")[0].trim();
    if (forwarded) return forwarded;
  }
  return request.socket.remoteAddress ?? "unknown";
}

function createRateLimiter(clock) {
  const buckets = new Map();
  return function rateLimit(key, limit, windowMs) {
    const now = clock();
    const current = buckets.get(key);
    if (!current || current.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return true;
    }
    current.count += 1;
    if (buckets.size > 10_000) {
      for (const [bucketKey, bucket] of buckets) {
        if (bucket.resetAt <= now) buckets.delete(bucketKey);
      }
    }
    return current.count <= limit;
  };
}

function assertAllowedOrigin(request, config) {
  if (!new Set(["POST", "PUT", "PATCH", "DELETE"]).has(request.method)) return;
  const origin = request.headers.origin;
  if (origin && !config.allowedOrigins.has(origin)) {
    throw new HttpError(403, "ORIGIN_NOT_ALLOWED", "Request origin is not allowed");
  }
}

function passwordMessage() {
  return "密码需为 10–128 个字符，并同时包含字母和数字";
}

export function createAccountApiHandler({ store, mailer, config, clock = Date.now }) {
  const rateLimit = createRateLimiter(clock);

  async function authenticate(request) {
    const token = parseCookies(request.headers.cookie)[config.sessionCookieName];
    if (!token) return null;
    return store.findSession(hashToken(token), clock());
  }

  async function requireAuthentication(request) {
    const auth = await authenticate(request);
    if (!auth) throw new HttpError(401, "AUTH_REQUIRED", "请先登录账户");
    return auth;
  }

  async function sendVerification(user, token) {
    const url = `${config.publicBaseUrl}/?accountAction=verify&token=${encodeURIComponent(token)}`;
    await mailer.send({ kind: "verify", to: user.email, url });
  }

  async function register(request, response) {
    const ip = clientAddress(request, config.trustProxy);
    if (!rateLimit(`register:${ip}`, 8, 60 * 60 * 1000)) {
      throw new HttpError(429, "RATE_LIMITED", "注册请求过于频繁，请稍后再试");
    }
    const body = await readJson(request);
    const email = normalizeEmail(body.email);
    const displayName = normalizeDisplayName(body.displayName);
    if (!email || !displayName || !validatePassword(body.password)) {
      throw new HttpError(400, "INVALID_REGISTRATION", `请填写有效邮箱、2–32 字符昵称；${passwordMessage()}`);
    }
    const now = clock();
    const token = createOpaqueToken();
    const user = await store.createUser({
      id: createId(),
      email,
      displayName,
      passwordHash: await hashPassword(body.password),
      emailVerifiedAt: null,
      verificationTokenHash: hashToken(token),
      verificationExpiresAt: now + config.verificationTtlMs,
      createdAt: now,
      passwordChangedAt: null,
    });
    if (!user) throw new HttpError(409, "EMAIL_EXISTS", "该邮箱已注册");
    await sendVerification(user, token);
    sendJson(response, 201, {
      user: publicUser(user),
      verificationRequired: true,
      ...(config.exposeTestTokens ? { testVerificationToken: token } : {}),
    });
  }

  async function resendVerification(request, response) {
    const ip = clientAddress(request, config.trustProxy);
    if (!rateLimit(`resend:${ip}`, 5, 60 * 60 * 1000)) {
      throw new HttpError(429, "RATE_LIMITED", "验证邮件请求过于频繁");
    }
    const body = await readJson(request);
    const email = normalizeEmail(body.email);
    const user = email ? await store.findUserByEmail(email) : null;
    let testVerificationToken;
    if (user && !user.emailVerifiedAt) {
      const token = createOpaqueToken();
      await store.setVerificationToken(user.id, hashToken(token), clock() + config.verificationTtlMs);
      await sendVerification(user, token);
      testVerificationToken = token;
    }
    sendJson(response, 202, {
      accepted: true,
      ...(config.exposeTestTokens && testVerificationToken ? { testVerificationToken } : {}),
    });
  }

  async function verifyEmail(request, response) {
    const body = await readJson(request);
    if (typeof body.token !== "string" || body.token.length < 20) {
      throw new HttpError(400, "INVALID_TOKEN", "验证链接无效或已过期");
    }
    const user = await store.verifyEmail(hashToken(body.token), clock());
    if (!user) throw new HttpError(400, "INVALID_TOKEN", "验证链接无效或已过期");
    sendJson(response, 200, { verified: true, user: publicUser(user) });
  }

  async function login(request, response) {
    const ip = clientAddress(request, config.trustProxy);
    if (!rateLimit(`login:${ip}`, 20, 15 * 60 * 1000)) {
      throw new HttpError(429, "RATE_LIMITED", "登录尝试过于频繁，请稍后再试");
    }
    const body = await readJson(request);
    const email = normalizeEmail(body.email);
    const user = email ? await store.findUserByEmail(email) : null;
    const valid = user ? await verifyPassword(user.passwordHash, body.password) : false;
    if (!valid) throw new HttpError(401, "INVALID_CREDENTIALS", "邮箱或密码不正确");
    if (!user.emailVerifiedAt) throw new HttpError(403, "EMAIL_NOT_VERIFIED", "请先验证邮箱");
    const now = clock();
    const token = createOpaqueToken();
    await store.createSession({
      tokenHash: hashToken(token),
      userId: user.id,
      createdAt: now,
      expiresAt: now + config.sessionTtlMs,
    });
    sendJson(response, 200, { user: publicUser(user) }, {
      "set-cookie": createSessionCookie(config.sessionCookieName, token, {
        secure: config.production,
        maxAgeSeconds: config.sessionTtlMs / 1000,
      }),
    });
  }

  async function logout(request, response) {
    const token = parseCookies(request.headers.cookie)[config.sessionCookieName];
    if (token) await store.deleteSession(hashToken(token));
    sendJson(response, 200, { loggedOut: true }, {
      "set-cookie": clearSessionCookie(config.sessionCookieName, { secure: config.production }),
    });
  }

  async function forgotPassword(request, response) {
    const ip = clientAddress(request, config.trustProxy);
    if (!rateLimit(`forgot:${ip}`, 6, 60 * 60 * 1000)) {
      throw new HttpError(429, "RATE_LIMITED", "重置请求过于频繁，请稍后再试");
    }
    const body = await readJson(request);
    const email = normalizeEmail(body.email);
    const user = email ? await store.findUserByEmail(email) : null;
    let testResetToken;
    if (user) {
      const now = clock();
      const token = createOpaqueToken();
      await store.createPasswordReset({
        tokenHash: hashToken(token),
        userId: user.id,
        createdAt: now,
        expiresAt: now + config.resetTtlMs,
        usedAt: null,
      });
      const url = `${config.publicBaseUrl}/?accountAction=reset&token=${encodeURIComponent(token)}`;
      await mailer.send({ kind: "reset", to: user.email, url });
      testResetToken = token;
    }
    sendJson(response, 202, {
      accepted: true,
      ...(config.exposeTestTokens && testResetToken ? { testResetToken } : {}),
    });
  }

  async function resetPassword(request, response) {
    const body = await readJson(request);
    if (typeof body.token !== "string" || body.token.length < 20 || !validatePassword(body.password)) {
      throw new HttpError(400, "INVALID_RESET", `重置链接无效；${passwordMessage()}`);
    }
    const reset = await store.consumePasswordReset(hashToken(body.token), clock());
    if (!reset) throw new HttpError(400, "INVALID_RESET", "重置链接无效或已过期");
    await store.updatePassword(reset.userId, await hashPassword(body.password), clock());
    sendJson(response, 200, { reset: true }, {
      "set-cookie": clearSessionCookie(config.sessionCookieName, { secure: config.production }),
    });
  }

  async function getSave(request, response) {
    const { user } = await requireAuthentication(request);
    const current = await store.getSave(user.id);
    sendJson(response, 200, { save: current.envelope, revision: current.revision, updatedAt: current.updatedAt });
  }

  async function putSave(request, response) {
    const { user } = await requireAuthentication(request);
    const body = await readJson(request);
    const baseRevision = Number(body.baseRevision);
    const envelope = sanitizeCloudSaveEnvelope(body.envelope);
    if (!Number.isInteger(baseRevision) || baseRevision < 0 || !envelope) {
      throw new HttpError(400, "INVALID_SAVE", "存档格式或版本号无效");
    }
    const result = await store.putSave(user.id, baseRevision, envelope, clock());
    if (result.conflict) {
      return sendJson(response, 409, {
        error: { code: "SAVE_CONFLICT", message: "云端存档已被其他设备修改" },
        save: result.current.envelope,
        revision: result.current.revision,
        updatedAt: result.current.updatedAt,
      });
    }
    sendJson(response, 200, {
      saved: true,
      revision: result.current.revision,
      updatedAt: result.current.updatedAt,
    });
  }

  async function deleteSave(request, response) {
    const { user } = await requireAuthentication(request);
    const body = await readJson(request);
    const baseRevision = Number(body.baseRevision);
    if (!Number.isInteger(baseRevision) || baseRevision < 0) {
      throw new HttpError(400, "INVALID_REVISION", "存档版本号无效");
    }
    const result = await store.deleteSave(user.id, baseRevision, clock());
    if (result.conflict) {
      return sendJson(response, 409, {
        error: { code: "SAVE_CONFLICT", message: "云端存档已被其他设备修改" },
        save: result.current.envelope,
        revision: result.current.revision,
        updatedAt: result.current.updatedAt,
      });
    }
    sendJson(response, 200, { deleted: true, revision: result.current.revision, updatedAt: result.current.updatedAt });
  }

  return async function accountApiHandler(request, response) {
    try {
      assertAllowedOrigin(request, config);
      const url = new URL(request.url, "http://localhost");
      const route = `${request.method} ${url.pathname}`;
      if (route === "GET /api/v1/health") return sendJson(response, 200, { ok: true, database: config.databaseMode });
      if (route === "POST /api/v1/auth/register") return await register(request, response);
      if (route === "POST /api/v1/auth/resend-verification") return await resendVerification(request, response);
      if (route === "POST /api/v1/auth/verify-email") return await verifyEmail(request, response);
      if (route === "POST /api/v1/auth/login") return await login(request, response);
      if (route === "POST /api/v1/auth/logout") return await logout(request, response);
      if (route === "POST /api/v1/auth/forgot-password") return await forgotPassword(request, response);
      if (route === "POST /api/v1/auth/reset-password") return await resetPassword(request, response);
      if (route === "GET /api/v1/auth/me") {
        const auth = await authenticate(request);
        return sendJson(response, 200, { user: auth ? publicUser(auth.user) : null });
      }
      if (route === "GET /api/v1/save") return await getSave(request, response);
      if (route === "PUT /api/v1/save") return await putSave(request, response);
      if (route === "DELETE /api/v1/save") return await deleteSave(request, response);
      sendJson(response, 404, { error: { code: "NOT_FOUND", message: "接口不存在" } });
    } catch (error) {
      if (response.headersSent || response.destroyed) return;
      const known = error instanceof HttpError;
      if (!known) console.error("Account API error", error);
      sendJson(response, known ? error.status : 500, {
        error: {
          code: known ? error.code : "INTERNAL_ERROR",
          message: known ? error.message : "服务器暂时无法处理请求",
        },
      });
    }
  };
}
