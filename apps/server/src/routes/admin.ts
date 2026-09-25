import {
  type AdminUserRow,
  adminApproveDomainSchema,
  adminBanSchema,
  adminRejectDomainSchema,
  adminSuspendSchema,
  type DomainRequestRow,
} from "@quad/shared";
import { and, desc, eq, ilike, or, type SQL } from "drizzle-orm";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { requireAdmin } from "../auth";
import type { Ctx } from "../context";
import {
  adminActions,
  domainRequests,
  profiles,
  sessions,
  universities,
  universityDomains,
  users,
} from "../db/schema";
import { AppError, parse } from "../lib/errors";
import { domainApprovedMail, domainRejectedMail } from "../lib/mailer";

const idParam = z.object({ id: z.uuid() });
const usersQuery = z.object({
  q: z.string().trim().max(100).optional(),
  status: z.enum(["onboarding", "active", "suspended", "banned"]).optional(),
});
const requestsQuery = z.object({
  status: z.enum(["pending", "approved", "rejected"]).default("pending"),
});
const universitiesQuery = z.object({ q: z.string().trim().min(2).max(100) });

const escapeLike = (v: string) => v.replace(/[%_\\]/g, (c) => `\\${c}`);

export function adminRoutes(app: FastifyInstance, ctx: Ctx) {
  async function loadTarget(req: FastifyRequest, adminId: string) {
    const { id } = parse(idParam, req.params);
    const [target] = await ctx.db.select().from(users).where(eq(users.id, id));
    if (!target) throw new AppError(404, "NOT_FOUND", "User not found.");
    if (target.id === adminId || target.role === "admin") {
      throw new AppError(403, "FORBIDDEN", "Admins can't take action on admins.");
    }
    return target;
  }

  const log = (adminId: string, action: string, extra: Partial<typeof adminActions.$inferInsert>) =>
    ctx.db.insert(adminActions).values({ adminId, action, ...extra });

  app.get("/api/admin/users", async (req): Promise<{ users: AdminUserRow[] }> => {
    requireAdmin(req);
    const { q, status } = parse(usersQuery, req.query);
    const filters: SQL[] = [];
    if (status) filters.push(eq(users.status, status));
    if (q) {
      const like = `%${escapeLike(q)}%`;
      const match = or(ilike(users.email, like), ilike(profiles.displayName, like));
      if (match) filters.push(match);
    }
    const rows = await ctx.db
      .select({
        id: users.id,
        email: users.email,
        displayName: profiles.displayName,
        university: universities.name,
        status: users.status,
        suspendedUntil: users.suspendedUntil,
        statusReason: users.statusReason,
        role: users.role,
        createdAt: users.createdAt,
      })
      .from(users)
      .innerJoin(universities, eq(universities.id, users.universityId))
      .leftJoin(profiles, eq(profiles.userId, users.id))
      .where(filters.length ? and(...filters) : undefined)
      .orderBy(desc(users.createdAt))
      .limit(100);
    return {
      users: rows.map((r) => ({
        ...r,
        suspendedUntil: r.suspendedUntil?.toISOString() ?? null,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  });

  app.post("/api/admin/users/:id/suspend", async (req) => {
    const { user: admin } = requireAdmin(req);
    const target = await loadTarget(req, admin.id);
    if (target.status === "banned") throw new AppError(409, "CONFLICT", "This user is banned.");
    const { hours, reason } = parse(adminSuspendSchema, req.body);
    const now = ctx.now();
    await ctx.db
      .update(users)
      .set({
        status: "suspended",
        suspendedUntil: new Date(now.getTime() + hours * 3_600_000),
        statusReason: reason,
        updatedAt: now,
      })
      .where(eq(users.id, target.id));
    await log(admin.id, `suspend:${hours}h`, { targetUserId: target.id, reason });
    return { ok: true };
  });

  app.post("/api/admin/users/:id/ban", async (req) => {
    const { user: admin } = requireAdmin(req);
    const target = await loadTarget(req, admin.id);
    const { reason } = parse(adminBanSchema, req.body);
    await ctx.db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({ status: "banned", suspendedUntil: null, statusReason: reason, updatedAt: ctx.now() })
        .where(eq(users.id, target.id));
      await tx.delete(sessions).where(eq(sessions.userId, target.id));
    });
    await log(admin.id, "ban", { targetUserId: target.id, reason });
    return { ok: true };
  });

  app.post("/api/admin/users/:id/reinstate", async (req) => {
    const { user: admin } = requireAdmin(req);
    const target = await loadTarget(req, admin.id);
    await ctx.db
      .update(users)
      .set({
        status: target.dob ? "active" : "onboarding",
        suspendedUntil: null,
        statusReason: null,
        updatedAt: ctx.now(),
      })
      .where(eq(users.id, target.id));
    await log(admin.id, "reinstate", { targetUserId: target.id });
    return { ok: true };
  });

  app.get("/api/admin/domain-requests", async (req): Promise<{ requests: DomainRequestRow[] }> => {
    requireAdmin(req);
    const { status } = parse(requestsQuery, req.query);
    const rows = await ctx.db
      .select()
      .from(domainRequests)
      .where(eq(domainRequests.status, status))
      .orderBy(status === "pending" ? domainRequests.createdAt : desc(domainRequests.createdAt))
      .limit(200);
    return {
      requests: rows.map((r) => ({
        id: r.id,
        email: r.email,
        domain: r.domain,
        universityName: r.universityName,
        country: r.country,
        website: r.website,
        status: r.status,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  });

  app.get("/api/admin/universities", async (req) => {
    requireAdmin(req);
    const { q } = parse(universitiesQuery, req.query);
    const rows = await ctx.db
      .select({
        id: universities.id,
        name: universities.name,
        country: universities.country,
        countryCode: universities.countryCode,
      })
      .from(universities)
      .where(ilike(universities.name, `%${escapeLike(q)}%`))
      .orderBy(universities.name)
      .limit(20);
    return { universities: rows };
  });

  app.post("/api/admin/domain-requests/:id/approve", async (req) => {
    const { user: admin } = requireAdmin(req);
    const { id } = parse(idParam, req.params);
    const input = parse(adminApproveDomainSchema, req.body);
    const [request] = await ctx.db.select().from(domainRequests).where(eq(domainRequests.id, id));
    if (!request) throw new AppError(404, "NOT_FOUND", "Request not found.");
    if (request.status !== "pending") {
      throw new AppError(409, "CONFLICT", "This request was already reviewed.");
    }

    const now = ctx.now();
    const approved = await ctx.db.transaction(async (tx) => {
      let universityId: string;
      let universityName: string;
      if ("universityId" in input) {
        const [u] = await tx
          .select({ id: universities.id, name: universities.name })
          .from(universities)
          .where(eq(universities.id, input.universityId));
        if (!u) throw new AppError(404, "NOT_FOUND", "University not found.");
        universityId = u.id;
        universityName = u.name;
      } else {
        const [u] = await tx
          .insert(universities)
          .values(input.newUniversity)
          .onConflictDoUpdate({
            target: [universities.name, universities.countryCode],
            set: { country: input.newUniversity.country },
          })
          .returning({ id: universities.id, name: universities.name });
        if (!u) throw new AppError(500, "INTERNAL", "Couldn't create the university.");
        universityId = u.id;
        universityName = u.name;
      }
      await tx
        .insert(universityDomains)
        .values({ domain: request.domain, universityId, source: "admin" })
        .onConflictDoNothing();
      // Everyone else waiting on the same domain gets in too.
      const rows = await tx
        .update(domainRequests)
        .set({ status: "approved", reviewerId: admin.id, reviewedAt: now })
        .where(and(eq(domainRequests.domain, request.domain), eq(domainRequests.status, "pending")))
        .returning({ id: domainRequests.id, email: domainRequests.email });
      return { rows, universityName };
    });

    await log(admin.id, "approve_domain", { targetDomainRequestId: request.id });
    for (const r of approved.rows) {
      await ctx.mailer
        .send(domainApprovedMail(r.email, approved.universityName, ctx.config.APP_ORIGIN))
        .catch((err) => req.log.error({ err }, "failed to send approval email"));
    }
    return { ok: true, approvedCount: approved.rows.length };
  });

  app.post("/api/admin/domain-requests/:id/reject", async (req) => {
    const { user: admin } = requireAdmin(req);
    const { id } = parse(idParam, req.params);
    const { note } = parse(adminRejectDomainSchema, req.body);
    const [request] = await ctx.db
      .update(domainRequests)
      .set({ status: "rejected", reviewerId: admin.id, reviewNote: note, reviewedAt: ctx.now() })
      .where(and(eq(domainRequests.id, id), eq(domainRequests.status, "pending")))
      .returning();
    if (!request) throw new AppError(404, "NOT_FOUND", "No pending request with that id.");
    await log(admin.id, "reject_domain", { targetDomainRequestId: request.id, reason: note });
    await ctx.mailer
      .send(domainRejectedMail(request.email, note))
      .catch((err) => req.log.error({ err }, "failed to send rejection email"));
    return { ok: true };
  });
}
