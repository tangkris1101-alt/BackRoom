import assert from "node:assert/strict";
import test from "node:test";
import { loadServerConfig } from "../server/config.js";

test("SMTP aliases match the existing yuwen-score environment contract", () => {
  const config = loadServerConfig({
    NODE_ENV: "production",
    SMTP_HOST: "smtp.example.test",
    SMTP_PORT: "465",
    SMTP_USERNAME: "mailer-user",
    SMTP_PASSWORD: "mailer-password",
    SMTP_FROM_EMAIL: "no-reply@example.test",
    SMTP_FROM_NAME: "Backrooms Test",
  });

  assert.equal(config.mailMode, "smtp");
  assert.equal(config.smtp.host, "smtp.example.test");
  assert.equal(config.smtp.port, 465);
  assert.equal(config.smtp.secure, true);
  assert.equal(config.smtp.user, "mailer-user");
  assert.equal(config.smtp.password, "mailer-password");
  assert.deepEqual(config.smtp.from, { name: "Backrooms Test", address: "no-reply@example.test" });
});

test("Backrooms-prefixed SMTP settings override compatibility aliases", () => {
  const config = loadServerConfig({
    BACKROOMS_MAIL_MODE: "smtp",
    BACKROOMS_SMTP_HOST: "override.example.test",
    BACKROOMS_SMTP_PORT: "587",
    BACKROOMS_SMTP_SECURE: "0",
    BACKROOMS_SMTP_USER: "override-user",
    BACKROOMS_SMTP_PASSWORD: "override-password",
    BACKROOMS_MAIL_FROM: "Backrooms <override@example.test>",
    SMTP_HOST: "alias.example.test",
    SMTP_PORT: "465",
    SMTP_USERNAME: "alias-user",
    SMTP_PASSWORD: "alias-password",
  });

  assert.equal(config.smtp.host, "override.example.test");
  assert.equal(config.smtp.port, 587);
  assert.equal(config.smtp.secure, false);
  assert.equal(config.smtp.user, "override-user");
  assert.equal(config.smtp.password, "override-password");
  assert.equal(config.smtp.from, "Backrooms <override@example.test>");
});
