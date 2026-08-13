import { loadServerConfig } from "../server/config.js";
import { createSmtpMailer } from "../server/mailer.js";

const config = loadServerConfig({ ...process.env, BACKROOMS_MAIL_MODE: "smtp" });
const mailer = createSmtpMailer(config.smtp);

try {
  await mailer.verify();
  console.info("SMTP authentication and TLS verification passed; no email was sent.");
} finally {
  mailer.close();
}
