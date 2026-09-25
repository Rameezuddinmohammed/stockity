import { Redis } from "ioredis";
import { buildApp } from "./app";
import { loadConfig } from "./config";
import { createDb } from "./db/client";
import { createMailer } from "./lib/mailer";

const config = loadConfig();
const { db, client } = createDb(config.DATABASE_URL);
const redis = new Redis(config.REDIS_URL, { maxRetriesPerRequest: 3 });

const app = await buildApp(
  {
    config,
    db,
    redis,
    mailer: createMailer(config, (msg) => app.log.info(msg)),
    now: () => new Date(),
  },
  { logger: true },
);

const shutdown = async () => {
  await app.close();
  await client.end();
  redis.disconnect();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

await app.listen({ port: config.PORT, host: config.HOST });
