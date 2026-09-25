import type { Redis } from "ioredis";
import type { Config } from "./config";
import type { Db } from "./db/client";
import type { Mailer } from "./lib/mailer";

/** Everything a route needs; built once in index.ts and swapped out in tests. */
export type Ctx = {
  config: Config;
  db: Db;
  redis: Redis;
  mailer: Mailer;
  now: () => Date;
};
