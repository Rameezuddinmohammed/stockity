import { Redis } from "ioredis";
import { buildApp } from "./app";
import { loadConfig } from "./config";
import { createDb } from "./db/client";
import { runCleanup } from "./jobs/cleanup";
import { createMailer } from "./lib/mailer";

const config = loadConfig();
const { db, client } = createDb(config.DATABASE_URL);
const redis = new Redis(config.REDIS_URL, { maxRetriesPerRequest: 3 });

const ctx = {
  config,
  db,
  redis,
  mailer: createMailer(config, (msg) => app.log.info(msg)),
  now: () => new Date(),
};
const app = await buildApp(ctx, { logger: true });

// Hourly retention cleanup (see jobs/cleanup.ts and the Privacy Policy).
const cleanup = () =>
  runCleanup(ctx).then(
    (deleted) => app.log.info({ deleted }, "retention cleanup"),
    (err) => app.log.error({ err }, "retention cleanup failed"),
  );
setInterval(cleanup, 60 * 60 * 1000).unref();
void cleanup();

const shutdown = async () => {
  await app.close();
  await client.end();
  redis.disconnect();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

await app.listen({ port: config.PORT, host: config.HOST });
