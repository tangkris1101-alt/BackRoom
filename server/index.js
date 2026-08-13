import { createServer } from "node:http";
import { createAccountApiHandler } from "./app.js";
import { loadServerConfig } from "./config.js";
import { createConsoleMailer, createSmtpMailer } from "./mailer.js";
import { MemoryAccountStore } from "./memory-store.js";
import { MysqlAccountStore } from "./mysql-store.js";

const config = loadServerConfig();
const store = config.databaseMode === "mysql"
  ? MysqlAccountStore.create(config.mysql)
  : new MemoryAccountStore();
const mailer = config.mailMode === "smtp" ? createSmtpMailer(config.smtp) : createConsoleMailer();
const server = createServer(createAccountApiHandler({ store, mailer, config }));

async function start() {
  if (config.mailMode === "smtp") {
    await mailer.verify();
    console.info("SMTP connection verified");
  }
  server.listen(config.port, config.host, () => {
    console.info(`Backrooms account API listening on http://${config.host}:${config.port}`);
    console.info(`Database mode: ${config.databaseMode}`);
    console.info(`Mail mode: ${config.mailMode}`);
  });
}

start().catch(async (error) => {
  console.error("Account API startup failed", error?.message ?? error);
  mailer.close?.();
  await store.close();
  process.exitCode = 1;
});

async function shutdown(signal) {
  console.info(`Received ${signal}, closing account API`);
  server.close(async () => {
    mailer.close?.();
    await store.close();
    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
