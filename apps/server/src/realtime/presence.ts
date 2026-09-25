import type { Redis } from "ioredis";

const KEY = "presence";
/** A connection counts as online if its heartbeat is newer than this. */
const STALE_MS = 60_000;

export const touchPresence = (redis: Redis, userId: string, now: Date) =>
  redis.zadd(KEY, now.getTime(), userId);

export const dropPresence = (redis: Redis, userId: string) => redis.zrem(KEY, userId);

export async function onlineCount(redis: Redis, now: Date): Promise<number> {
  await redis.zremrangebyscore(KEY, "-inf", now.getTime() - STALE_MS);
  return redis.zcard(KEY);
}
