import { createHash, randomBytes, randomUUID } from "node:crypto";
import argon2 from "argon2";

const PASSWORD_OPTIONS = Object.freeze({
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
});

export function normalizeEmail(value) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (normalized.length < 5 || normalized.length > 254) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return null;
  return normalized;
}

export function normalizeDisplayName(value) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/\s+/g, " ");
  if (normalized.length < 2 || normalized.length > 32) return null;
  if (/[\u0000-\u001f\u007f<>]/.test(normalized)) return null;
  return normalized;
}

export function validatePassword(value) {
  if (typeof value !== "string" || value.length < 10 || value.length > 128) return false;
  return /\p{L}/u.test(value) && /\p{N}/u.test(value);
}

export function hashPassword(password) {
  return argon2.hash(password, PASSWORD_OPTIONS);
}

export function verifyPassword(hash, password) {
  if (typeof hash !== "string" || typeof password !== "string") return false;
  return argon2.verify(hash, password).catch(() => false);
}

export function createOpaqueToken(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

export function hashToken(token) {
  return createHash("sha256").update(String(token)).digest("hex");
}

export function createId() {
  return randomUUID();
}

export function parseCookies(header) {
  const cookies = {};
  for (const part of String(header ?? "").split(";")) {
    const index = part.indexOf("=");
    if (index <= 0) continue;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (key) cookies[key] = decodeURIComponent(value);
  }
  return cookies;
}

export function createSessionCookie(name, token, { secure, maxAgeSeconds }) {
  const attributes = [
    `${name}=${encodeURIComponent(token)}`,
    "Path=/api/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${Math.max(0, Math.floor(maxAgeSeconds))}`,
  ];
  if (secure) attributes.push("Secure");
  return attributes.join("; ");
}

export function clearSessionCookie(name, { secure }) {
  return createSessionCookie(name, "", { secure, maxAgeSeconds: 0 });
}
