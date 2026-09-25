import type { Redis } from "ioredis";
import { AppError } from "./errors";

export type Limit = { key: string; max: number; windowSeconds: number };

/** Fixed-window counter. Throws RATE_LIMITED once `max` hits happen within the window. */
export async function enforce(redis: Redis, limit: Limit): Promise<void> {
  const key = `rl:${limit.key}`;
  const results = await redis
    .multi()
    .incr(key)
    .expire(key, limit.windowSeconds, "NX")
    .ttl(key)
    .exec();
  const count = Number(results?.[0]?.[1] ?? 0);
  const ttl = Number(results?.[2]?.[1] ?? limit.windowSeconds);
  if (count > limit.max) {
    throw new AppError(429, "RATE_LIMITED", "Slow down a little and try again soon.", {
      retryAfterSeconds: Math.max(ttl, 1),
    });
  }
}

/** One action per `seconds` for a key (e.g. resend cooldown). */
export async function cooldown(redis: Redis, key: string, seconds: number): Promise<void> {
  const ok = await redis.set(`cd:${key}`, "1", "EX", seconds, "NX");
  if (ok !== "OK") {
    const ttl = await redis.ttl(`cd:${key}`);
    throw new AppError(429, "RATE_LIMITED", `Wait ${Math.max(ttl, 1)}s before asking again.`, {
      retryAfterSeconds: Math.max(ttl, 1),
    });
  }
}
