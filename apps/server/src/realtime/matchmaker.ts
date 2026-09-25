import type { CallMode } from "@quad/shared";
import { eq, or } from "drizzle-orm";
import type { Redis } from "ioredis";
import type { Db } from "../db/client";
import { blocks } from "../db/schema";

/** Never re-match the person you just left for this long. */
export const HARD_COOLDOWN_MS = 2 * 60_000;
/** Prefer new people over anyone met in this window, but allow them if nobody else is around. */
export const SOFT_COOLDOWN_MS = 30 * 60_000;

const queueKey = (mode: CallMode) => `mm:q:${mode}`;
const blocksKey = (userId: string) => `mm:blocks:${userId}`;
const recentKey = (userId: string) => `mm:recent:${userId}`;

/**
 * Atomically takes the caller out of the queue and pairs them with the longest-waiting compatible
 * person. Blocked pairs never match; recent partners only match when there's nobody else.
 * Returns the partner id, or false after putting the caller back in line (keeping their place).
 */
const TRY_MATCH = `
local q = KEYS[1]
local me = ARGV[1]
local now = tonumber(ARGV[2])
local hard = tonumber(ARGV[3])
local soft = tonumber(ARGV[4])
local joinedAt = tonumber(ARGV[5])
redis.call('ZREM', q, me)
local cands = redis.call('ZRANGE', q, 0, 199)
local function ok(c, window)
  if c == me then return false end
  if redis.call('SISMEMBER', 'mm:blocks:' .. me, c) == 1 then return false end
  local t = redis.call('ZSCORE', 'mm:recent:' .. me, c)
  if t and (now - tonumber(t)) < window then return false end
  t = redis.call('ZSCORE', 'mm:recent:' .. c, me)
  if t and (now - tonumber(t)) < window then return false end
  return true
end
for _, c in ipairs(cands) do
  if ok(c, soft) then redis.call('ZREM', q, c) return c end
end
for _, c in ipairs(cands) do
  if ok(c, hard) then redis.call('ZREM', q, c) return c end
end
redis.call('ZADD', q, joinedAt, me)
return false
`;

export class Matchmaker {
  constructor(
    private readonly redis: Redis,
    private readonly db: Db,
  ) {}

  /** Refreshes the Redis copy of everyone this user blocked or was blocked by. */
  async loadBlocks(userId: string) {
    const rows = await this.db
      .select({ a: blocks.blockerId, b: blocks.blockedId })
      .from(blocks)
      .where(or(eq(blocks.blockerId, userId), eq(blocks.blockedId, userId)));
    const others = rows.map((r) => (r.a === userId ? r.b : r.a));
    const key = blocksKey(userId);
    const multi = this.redis.multi().del(key);
    if (others.length > 0) multi.sadd(key, ...others).expire(key, 3600);
    await multi.exec();
  }

  /** Makes a new block take effect in matching immediately, in both directions. */
  async addBlock(a: string, b: string) {
    await this.redis
      .multi()
      .sadd(blocksKey(a), b)
      .expire(blocksKey(a), 3600)
      .sadd(blocksKey(b), a)
      .expire(blocksKey(b), 3600)
      .exec();
  }

  async tryMatch(userId: string, mode: CallMode, joinedAt: number, now: number) {
    const partner = (await this.redis.eval(
      TRY_MATCH,
      1,
      queueKey(mode),
      userId,
      String(now),
      String(HARD_COOLDOWN_MS),
      String(SOFT_COOLDOWN_MS),
      String(joinedAt),
    )) as string | null;
    return partner || null;
  }

  async leave(userId: string) {
    await this.redis.multi().zrem(queueKey("video"), userId).zrem(queueKey("text"), userId).exec();
  }

  async rememberPair(a: string, b: string, now: number) {
    await this.redis
      .multi()
      .zadd(recentKey(a), now, b)
      .expire(recentKey(a), 3600)
      .zadd(recentKey(b), now, a)
      .expire(recentKey(b), 3600)
      .exec();
  }
}
