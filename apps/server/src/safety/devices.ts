import { eq } from "drizzle-orm";
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { Ctx } from "../context";
import { bannedDevices, userDevices } from "../db/schema";
import { hmac, randomToken } from "../lib/crypto";

export const DEVICE_COOKIE = "quad_device";
const YEAR_MS = 365 * 24 * 3_600_000;

/** Keyed hash of the device cookie; the raw value is never stored. */
export const deviceHash = (ctx: Ctx, req: FastifyRequest) => {
  const raw = req.cookies[DEVICE_COOKIE];
  return raw ? hmac(ctx.config.APP_SECRET, `device:${raw}`) : null;
};

/**
 * Gives every browser a long-lived random device cookie and remembers which accounts use it,
 * so a ban can also cover the devices behind it. Cleared cookies make this a speed bump, not a wall.
 */
export function registerDevices(app: FastifyInstance, ctx: Ctx) {
  app.addHook("onRequest", async (req, reply) => {
    if (!req.cookies[DEVICE_COOKIE]) {
      const value = randomToken(16);
      req.cookies[DEVICE_COOKIE] = value;
      reply.setCookie(DEVICE_COOKIE, value, {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        secure: ctx.config.APP_ORIGIN.startsWith("https://"),
        expires: new Date(ctx.now().getTime() + YEAR_MS),
      });
    }
  });

  // Record the device against the signed-in account at most once a day.
  app.addHook("onRequest", async (req) => {
    const hash = deviceHash(ctx, req);
    if (!req.auth || !hash) return;
    const key = `dev:${req.auth.user.id}:${hash}`;
    const fresh = await ctx.redis.set(key, "1", "EX", 86_400, "NX");
    if (fresh !== "OK") return;
    await ctx.db
      .insert(userDevices)
      .values({ userId: req.auth.user.id, deviceHash: hash, lastSeenAt: ctx.now() })
      .onConflictDoUpdate({
        target: [userDevices.userId, userDevices.deviceHash],
        set: { lastSeenAt: ctx.now() },
      });
  });
}

export async function isDeviceBanned(ctx: Ctx, req: FastifyRequest): Promise<boolean> {
  const hash = deviceHash(ctx, req);
  if (!hash) return false;
  const [row] = await ctx.db
    .select({ hash: bannedDevices.deviceHash })
    .from(bannedDevices)
    .where(eq(bannedDevices.deviceHash, hash));
  return Boolean(row);
}
