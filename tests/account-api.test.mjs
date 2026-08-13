import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import { createAccountApiHandler } from "../server/app.js";
import { CapturingMailer } from "../server/mailer.js";
import { MemoryAccountStore } from "../server/memory-store.js";

function makeConfig() {
  return {
    production: false,
    databaseMode: "memory",
    sessionCookieName: "backrooms_session",
    sessionTtlMs: 30 * 24 * 60 * 60 * 1000,
    verificationTtlMs: 24 * 60 * 60 * 1000,
    resetTtlMs: 30 * 60 * 1000,
    allowedOrigins: new Set(["http://127.0.0.1:5173"]),
    exposeTestTokens: true,
    publicBaseUrl: "http://127.0.0.1:5173",
    trustProxy: false,
  };
}

function validEnvelope(savedAt = 100) {
  return {
    schemaVersion: 1,
    gameSave: {
      version: 2,
      savedAt,
      player: { level: 0, position: { x: 0, y: 1.7, z: 0 }, health: 100 },
      inventory: [],
      equippedIndex: -1,
      flashlight: { owned: false, on: false, battery: 0 },
      detector: { owned: false, activeTimer: 0, cooldownTimer: 0 },
      pickups: {}, interactions: {}, objectives: {}, entities: {}, worldItems: {},
    },
    progress: { reachedLevels: [0], completedLevels: [], pickedUpItems: [] },
    gameBuild: "test",
    deviceId: "test-device-1234",
    clientSavedAt: savedAt,
  };
}

async function startApi() {
  const store = new MemoryAccountStore();
  const mailer = new CapturingMailer();
  const server = createServer(createAccountApiHandler({ store, mailer, config: makeConfig() }));
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  return {
    store,
    mailer,
    baseUrl: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())),
  };
}

async function jsonRequest(api, path, { method = "GET", body, cookie, origin = "http://127.0.0.1:5173" } = {}) {
  const headers = {};
  if (body !== undefined) headers["content-type"] = "application/json";
  if (cookie) headers.cookie = cookie;
  if (origin) headers.origin = origin;
  const response = await fetch(`${api.baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await response.json();
  return { response, payload };
}

test("complete account, session, save conflict, and password reset flow", async (t) => {
  const api = await startApi();
  t.after(api.close);

  let result = await jsonRequest(api, "/api/v1/auth/register", {
    method: "POST",
    body: { email: "Player@example.com", displayName: "Player One", password: "backrooms123" },
  });
  assert.equal(result.response.status, 201);
  assert.equal(result.payload.user.email, "player@example.com");
  assert.ok(result.payload.testVerificationToken);
  assert.equal(api.mailer.messages[0].kind, "verify");

  result = await jsonRequest(api, "/api/v1/auth/login", {
    method: "POST",
    body: { email: "player@example.com", password: "backrooms123" },
  });
  assert.equal(result.response.status, 403);
  assert.equal(result.payload.error.code, "EMAIL_NOT_VERIFIED");

  result = await jsonRequest(api, "/api/v1/auth/resend-verification", {
    method: "POST",
    body: { email: "player@example.com" },
  });
  assert.equal(result.response.status, 202);
  assert.ok(result.payload.testVerificationToken);
  assert.equal(api.mailer.messages[1].kind, "verify");

  result = await jsonRequest(api, "/api/v1/auth/verify-email", {
    method: "POST",
    body: { token: result.payload.testVerificationToken },
  });
  assert.equal(result.response.status, 200);
  assert.equal(result.payload.verified, true);

  result = await jsonRequest(api, "/api/v1/auth/login", {
    method: "POST",
    body: { email: "player@example.com", password: "backrooms123" },
  });
  assert.equal(result.response.status, 200);
  const cookie = result.response.headers.get("set-cookie").split(";", 1)[0];
  assert.match(result.response.headers.get("set-cookie"), /HttpOnly/);
  assert.match(result.response.headers.get("set-cookie"), /SameSite=Lax/);

  result = await jsonRequest(api, "/api/v1/auth/me", { cookie });
  assert.equal(result.payload.user.displayName, "Player One");

  result = await jsonRequest(api, "/api/v1/save", {
    method: "PUT", cookie, body: { baseRevision: 0, envelope: validEnvelope(100) },
  });
  assert.equal(result.response.status, 200);
  assert.equal(result.payload.revision, 1);

  const conflicting = await jsonRequest(api, "/api/v1/save", {
    method: "PUT", cookie, body: { baseRevision: 0, envelope: validEnvelope(200) },
  });
  assert.equal(conflicting.response.status, 409);
  assert.equal(conflicting.payload.error.code, "SAVE_CONFLICT");
  assert.equal(conflicting.payload.revision, 1);

  result = await jsonRequest(api, "/api/v1/save", { cookie });
  assert.equal(result.payload.revision, 1);
  assert.equal(result.payload.save.clientSavedAt, 100);

  result = await jsonRequest(api, "/api/v1/auth/forgot-password", {
    method: "POST", body: { email: "player@example.com" },
  });
  assert.equal(result.response.status, 202);
  assert.ok(result.payload.testResetToken);

  result = await jsonRequest(api, "/api/v1/auth/reset-password", {
    method: "POST", body: { token: result.payload.testResetToken, password: "new-password456" },
  });
  assert.equal(result.response.status, 200);

  result = await jsonRequest(api, "/api/v1/auth/me", { cookie });
  assert.equal(result.payload.user, null);

  result = await jsonRequest(api, "/api/v1/auth/login", {
    method: "POST", body: { email: "player@example.com", password: "new-password456" },
  });
  assert.equal(result.response.status, 200);
});

test("state-changing requests reject an untrusted browser origin", async (t) => {
  const api = await startApi();
  t.after(api.close);
  const result = await jsonRequest(api, "/api/v1/auth/register", {
    method: "POST",
    origin: "https://evil.example",
    body: { email: "test@example.com", displayName: "Tester", password: "backrooms123" },
  });
  assert.equal(result.response.status, 403);
  assert.equal(result.payload.error.code, "ORIGIN_NOT_ALLOWED");
});
