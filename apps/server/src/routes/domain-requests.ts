import { domainRequestSchema } from "@quad/shared";
import { and, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import type { Ctx } from "../context";
import { domainRequests } from "../db/schema";
import { canonicalEmail, isAlumniDomain, isDisposableDomain, splitEmail } from "../lib/email";
import { AppError, parse } from "../lib/errors";
import { enforce } from "../lib/rate-limit";
import { resolveUniversity } from "../lib/users";

export function domainRequestRoutes(app: FastifyInstance, ctx: Ctx) {
  app.post("/api/domain-requests", async (req, reply) => {
    await enforce(ctx.redis, { key: `domainreq:ip:${req.ip}`, max: 5, windowSeconds: 86_400 });
    const input = parse(domainRequestSchema, req.body);
    const { domain } = splitEmail(input.email);

    if (isAlumniDomain(domain)) {
      throw new AppError(400, "ALUMNI_EMAIL", "Alumni emails can't be used on Quad.");
    }
    if (isDisposableDomain(domain)) {
      throw new AppError(400, "DISPOSABLE_EMAIL", "Use your college email, not a temporary one.");
    }
    if (await resolveUniversity(ctx.db, canonicalEmail(input.email))) {
      throw new AppError(
        409,
        "CONFLICT",
        "Your university is already on Quad. Go back and sign in.",
      );
    }

    const [existing] = await ctx.db
      .select({ id: domainRequests.id })
      .from(domainRequests)
      .where(
        and(
          eq(domainRequests.email, input.email),
          eq(domainRequests.domain, domain),
          eq(domainRequests.status, "pending"),
        ),
      );
    if (!existing) {
      await ctx.db.insert(domainRequests).values({
        email: input.email,
        domain,
        universityName: input.universityName,
        country: input.country,
        website: input.website ?? null,
      });
    }
    reply.code(202);
    return { ok: true };
  });
}
