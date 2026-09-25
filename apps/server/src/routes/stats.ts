import type { PublicStats } from "@quad/shared";
import { countDistinct, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import type { Ctx } from "../context";
import { universities, users } from "../db/schema";
import { onlineCount } from "../realtime/presence";

const CACHE_KEY = "stats:public";

/** Real numbers only: the design doc forbids fake online counts. Cached for a minute. */
export function statsRoutes(app: FastifyInstance, ctx: Ctx) {
  app.get("/api/stats", async (): Promise<PublicStats> => {
    const cached = await ctx.redis.get(CACHE_KEY);
    if (cached) {
      return {
        ...(JSON.parse(cached) as PublicStats),
        online: await onlineCount(ctx.redis, ctx.now()),
      };
    }
    const [row] = await ctx.db
      .select({
        students: countDistinct(users.id),
        universities: countDistinct(users.universityId),
        countries: countDistinct(universities.countryCode),
      })
      .from(users)
      .innerJoin(universities, eq(universities.id, users.universityId))
      .where(eq(users.status, "active"));
    const stats = {
      students: Number(row?.students ?? 0),
      universities: Number(row?.universities ?? 0),
      countries: Number(row?.countries ?? 0),
    };
    await ctx.redis.set(CACHE_KEY, JSON.stringify(stats), "EX", 60);
    return { ...stats, online: await onlineCount(ctx.redis, ctx.now()) };
  });
}
