function parseInteger(value, fallback, minimum, maximum) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.max(minimum, Math.min(maximum, parsed));
}

function parseOrigins(value) {
  return new Set(String(value ?? "http://127.0.0.1:5173,http://localhost:5173")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean));
}

export function loadServerConfig(env = process.env) {
  const production = env.NODE_ENV === "production";
  const smtpPort = parseInteger(env.BACKROOMS_SMTP_PORT ?? env.SMTP_PORT, 465, 1, 65535);
  const smtpFromName = env.BACKROOMS_SMTP_FROM_NAME || env.SMTP_FROM_NAME || "Backrooms";
  const smtpFromEmail = env.BACKROOMS_SMTP_FROM_EMAIL || env.SMTP_FROM_EMAIL || "";
  return {
    production,
    host: env.BACKROOMS_API_HOST || "127.0.0.1",
    port: parseInteger(env.BACKROOMS_API_PORT, 8787, 1, 65535),
    databaseMode: env.BACKROOMS_DB_MODE === "mysql" ? "mysql" : "memory",
    sessionCookieName: env.BACKROOMS_SESSION_COOKIE || "backrooms_session",
    sessionTtlMs: parseInteger(env.BACKROOMS_SESSION_DAYS, 30, 1, 180) * 24 * 60 * 60 * 1000,
    verificationTtlMs: parseInteger(env.BACKROOMS_VERIFY_HOURS, 24, 1, 168) * 60 * 60 * 1000,
    resetTtlMs: parseInteger(env.BACKROOMS_RESET_MINUTES, 30, 5, 180) * 60 * 1000,
    allowedOrigins: parseOrigins(env.BACKROOMS_ALLOWED_ORIGINS),
    exposeTestTokens: !production && env.BACKROOMS_EXPOSE_TEST_TOKENS !== "0",
    publicBaseUrl: env.BACKROOMS_PUBLIC_URL || "http://127.0.0.1:5173",
    trustProxy: env.BACKROOMS_TRUST_PROXY === "1",
    mailMode: env.BACKROOMS_MAIL_MODE === "smtp" || (production && env.BACKROOMS_MAIL_MODE !== "console")
      ? "smtp"
      : "console",
    mysql: {
      host: env.BACKROOMS_DB_HOST || "127.0.0.1",
      port: parseInteger(env.BACKROOMS_DB_PORT, 3306, 1, 65535),
      user: env.BACKROOMS_DB_USER || "backrooms_api",
      password: env.BACKROOMS_DB_PASSWORD || "",
      database: env.BACKROOMS_DB_NAME || "backrooms_game",
      connectionLimit: parseInteger(env.BACKROOMS_DB_POOL_SIZE, 8, 1, 32),
    },
    smtp: {
      host: env.BACKROOMS_SMTP_HOST || env.SMTP_HOST || "",
      port: smtpPort,
      secure: env.BACKROOMS_SMTP_SECURE !== undefined
        ? env.BACKROOMS_SMTP_SECURE === "1"
        : env.SMTP_SECURE !== undefined
          ? env.SMTP_SECURE === "1"
          : smtpPort === 465,
      user: env.BACKROOMS_SMTP_USER || env.SMTP_USERNAME || env.SMTP_USER || "",
      password: env.BACKROOMS_SMTP_PASSWORD || env.SMTP_PASSWORD || "",
      from: env.BACKROOMS_MAIL_FROM || (smtpFromEmail ? { name: smtpFromName, address: smtpFromEmail } : null),
    },
  };
}
