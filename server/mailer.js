import nodemailer from "nodemailer";

export class CapturingMailer {
  constructor() {
    this.messages = [];
  }

  async send(message) {
    this.messages.push(structuredClone(message));
  }
}

export function createConsoleMailer() {
  return {
    async send(message) {
      const kind = message.kind === "verify" ? "verification" : "password-reset";
      console.info(`[mail:${kind}] recipient=${message.to}`);
    },
  };
}

export function createSmtpMailer(config) {
  if (!config.host || !config.user || !config.password || !config.from) {
    throw new Error("SMTP configuration is incomplete");
  }
  const transport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.password },
  });
  return {
    verify() {
      return transport.verify();
    },
    close() {
      transport.close();
    },
    async send(message) {
      const verify = message.kind === "verify";
      const title = verify ? "验证 Backrooms 账户" : "重置 Backrooms 账户密码";
      const action = verify ? "验证邮箱" : "重置密码";
      await transport.sendMail({
        from: config.from,
        to: message.to,
        subject: title,
        text: `${action}: ${message.url}\n\n如果不是你本人操作，请忽略这封邮件。`,
        html: `<p>${action}</p><p><a href="${message.url}">${message.url}</a></p><p>如果不是你本人操作，请忽略这封邮件。</p>`,
      });
    },
  };
}
