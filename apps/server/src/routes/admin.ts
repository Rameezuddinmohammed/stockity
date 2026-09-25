import {
  type AdminUserRow,
  type AllowedDomainRow,
  type ApprovedEmailRow,
  adminAddDomainSchema,
  adminAddEmailSchema,
  adminBanSchema,
  adminRejectDomainSchema,
  adminSuspendSchema,
  type DomainRequestRow,
  domainSchema,
  emailSchema,
  FREE_EMAIL_PROVIDERS,
  type SurveyMode,
  type SurveyResults,
  universityTargetSchema,
} from "@quad/shared";
import { and, desc, eq, ilike, or, type SQL } from "drizzle-orm";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { requireAdmin } from "../auth";
import type { Ctx } from "../context";
import {
  adminActions,
  approvedEmails,
  bannedDevices,
  domainRequests,
  profiles,
  surveyResponses,
  universities,
  universityDomains,
  userNotices,
  users,
} from "../db/schema";
import { canonicalEmail, isDisposableDomain, splitEmail } from "../lib/email";
import { AppError, parse } from "../lib/errors";
import { domainApprovedMail, domainRejectedMail } from "../lib/mailer";
import { resolveTarget } from "../lib/universities";
import type { Hub } from "../realtime/hub";
import { enforce } from "../safety/enforce";

const idParam = z.object({ id: z.uuid() });
const usersQuery = z.object({
  q: z.string().trim().max(100).optional(),
  status: z.enum(["onboarding", "active", "suspended", "banned"]).optional(),
});
const requestsQuery = z.object({
  status: z.enum(["pending", "approved", "rejected"]).default("pending"),
});
const universitiesQuery = z.object({ q: z.string().trim().min(2).max(100) });
const searchQuery = z.object({ q: z.string().trim().max(100).optional() });
const domainParam = z.object({ domain: domainSchema });
const emailParam = z.object({ email: emailSchema });

const universityColumns = {
  id: universities.id,
  name: universities.name,
  country: universities.country,
  countryCode: universities.countryCode,
};

const escapeLike = (v: string) => v.replace(/[%_\\]/g, (c) => `\\${c}`);

const FREE_PROVIDERS = new Set<string>(FREE_EMAIL_PROVIDERS);

/** Personal-email providers can't be allowlisted wholesale; approve single addresses instead. */
function assertDomainAllowlistable(domain: string) {
  if (FREE_PROVIDERS.has(domain)) {
    throw new AppError(
      400,
      "VALIDATION",
      `@${domain} is a personal email provider. Approve single addresses instead.`,
    );
  }
  if (isDisposableDomain(domain)) {
    throw new AppError(400, "DISPOSABLE_EMAIL", `@${domain} is a temporary email service.`);
  }
}

export function adminRoutes(app: FastifyInstance, ctx: Ctx, hub: Hub) {
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

  async function loadPendingRequest(id: string) {
    const [request] = await ctx.db.select().from(domainRequests).where(eq(domainRequests.id, id));
    if (!request) throw new AppError(404, "NOT_FOUND", "Request not found.");
    if (request.status !== "pending") {
      throw new AppError(409, "CONFLICT", "This request was already reviewed.");
    }
    return request;
  }

  async function notifyApproved(req: FastifyRequest, rows: { email: string }[], name: string) {
    for (const r of rows) {
      await ctx.mailer
        .send(domainApprovedMail(r.email, name, ctx.config.APP_ORIGIN))
        .catch((err) => req.log.error({ err }, "failed to send approval email"));
    }
  }

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
    const until = new Date(now.getTime() + hours * 3_600_000);
    await ctx.db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({ status: "suspended", suspendedUntil: until, statusReason: reason, updatedAt: now })
        .where(eq(users.id, target.id));
      await tx.insert(userNotices).values({
        userId: target.id,
        kind: "suspension",
        message: `Your account is suspended until ${until.toUTCString()}: ${reason}.`,
      });
    });
    await log(admin.id, `suspend:${hours}h`, { targetUserId: target.id, reason });
    hub.kick(target.id, "suspended");
    return { ok: true };
  });

  app.post("/api/admin/users/:id/ban", async (req) => {
    const { user: admin } = requireAdmin(req);
    const target = await loadTarget(req, admin.id);
    const { reason } = parse(adminBanSchema, req.body);
    await enforce(ctx, hub, {
      userId: target.id,
      action: "ban",
      reason,
      adminId: admin.id,
      countsAsStrike: false,
    });
    return { ok: true };
  });

  app.post("/api/admin/users/:id/reinstate", async (req) => {
    const { user: admin } = requireAdmin(req);
    const target = await loadTarget(req, admin.id);
    await ctx.db.delete(bannedDevices).where(eq(bannedDevices.userId, target.id));
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

  /** Approve a request by allowlisting its whole domain. Everyone waiting on that domain gets in. */
  app.post("/api/admin/domain-requests/:id/approve", async (req) => {
    const { user: admin } = requireAdmin(req);
    const { id } = parse(idParam, req.params);
    const target = parse(universityTargetSchema, req.body);
    const request = await loadPendingRequest(id);
    assertDomainAllowlistable(request.domain);

    const now = ctx.now();
    const approved = await ctx.db.transaction(async (tx) => {
      const university = await resolveTarget(tx, target);
      await tx
        .insert(universityDomains)
        .values({ domain: request.domain, universityId: university.id, source: "admin" })
        .onConflictDoNothing();
      const rows = await tx
        .update(domainRequests)
        .set({ status: "approved", reviewerId: admin.id, reviewedAt: now })
        .where(and(eq(domainRequests.domain, request.domain), eq(domainRequests.status, "pending")))
        .returning({ id: domainRequests.id, email: domainRequests.email });
      return { rows, universityName: university.name };
    });

    await log(admin.id, "approve_domain", { targetDomainRequestId: request.id });
    await notifyApproved(req, approved.rows, approved.universityName);
    return { ok: true, approvedCount: approved.rows.length };
  });

  /** Approve only the requester's address, e.g. when the domain is shared or too broad. */
  app.post("/api/admin/domain-requests/:id/approve-email", async (req) => {
    const { user: admin } = requireAdmin(req);
    const { id } = parse(idParam, req.params);
    const target = parse(universityTargetSchema, req.body);
    const request = await loadPendingRequest(id);
    if (isDisposableDomain(request.domain)) {
      throw new AppError(400, "DISPOSABLE_EMAIL", "Temporary email addresses can't be approved.");
    }

    const now = ctx.now();
    const universityName = await ctx.db.transaction(async (tx) => {
      const university = await resolveTarget(tx, target);
      await tx
        .insert(approvedEmails)
        .values({
          emailCanonical: canonicalEmail(request.email),
          universityId: university.id,
          note: `From request for @${request.domain}`,
          addedBy: admin.id,
        })
        .onConflictDoNothing();
      await tx
        .update(domainRequests)
        .set({ status: "approved", reviewerId: admin.id, reviewedAt: now })
        .where(eq(domainRequests.id, request.id));
      return university.name;
    });

    await log(admin.id, "approve_email", { targetDomainRequestId: request.id });
    await notifyApproved(req, [{ email: request.email }], universityName);
    return { ok: true };
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

  // ---- Allowlisted domains ----

  app.get("/api/admin/domains", async (req): Promise<{ domains: AllowedDomainRow[] }> => {
    requireAdmin(req);
    const { q } = parse(searchQuery, req.query);
    const like = q ? `%${escapeLike(q)}%` : null;
    const rows = await ctx.db
      .select({
        domain: universityDomains.domain,
        source: universityDomains.source,
        createdAt: universityDomains.createdAt,
        university: universityColumns,
      })
      .from(universityDomains)
      .innerJoin(universities, eq(universities.id, universityDomains.universityId))
      .where(
        like
          ? or(ilike(universityDomains.domain, like), ilike(universities.name, like))
          : eq(universityDomains.source, "admin"),
      )
      .orderBy(desc(universityDomains.createdAt))
      .limit(50);
    return { domains: rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })) };
  });

  app.post("/api/admin/domains", async (req, reply) => {
    const { user: admin } = requireAdmin(req);
    const input = parse(adminAddDomainSchema, req.body);
    assertDomainAllowlistable(input.domain);
    const [existing] = await ctx.db
      .select({ domain: universityDomains.domain })
      .from(universityDomains)
      .where(eq(universityDomains.domain, input.domain));
    if (existing) throw new AppError(409, "CONFLICT", `@${input.domain} is already allowed.`);

    const now = ctx.now();
    const result = await ctx.db.transaction(async (tx) => {
      const university = await resolveTarget(tx, input);
      await tx
        .insert(universityDomains)
        .values({ domain: input.domain, universityId: university.id, source: "admin" });
      // Anyone already waiting on this domain gets in.
      const rows = await tx
        .update(domainRequests)
        .set({ status: "approved", reviewerId: admin.id, reviewedAt: now })
        .where(and(eq(domainRequests.domain, input.domain), eq(domainRequests.status, "pending")))
        .returning({ email: domainRequests.email });
      return { rows, universityName: university.name };
    });
    await log(admin.id, `add_domain:${input.domain}`, {});
    await notifyApproved(req, result.rows, result.universityName);
    reply.code(201);
    return { ok: true, approvedRequests: result.rows.length };
  });

  app.delete("/api/admin/domains/:domain", async (req) => {
    const { user: admin } = requireAdmin(req);
    const { domain } = parse(domainParam, req.params);
    const removed = await ctx.db
      .delete(universityDomains)
      .where(eq(universityDomains.domain, domain))
      .returning({ domain: universityDomains.domain });
    if (removed.length === 0) throw new AppError(404, "NOT_FOUND", "That domain isn't allowed.");
    await log(admin.id, `remove_domain:${domain}`, {});
    return { ok: true };
  });

  // ---- Individually approved emails ----

  app.get("/api/admin/approved-emails", async (req): Promise<{ emails: ApprovedEmailRow[] }> => {
    requireAdmin(req);
    const { q } = parse(searchQuery, req.query);
    const like = q ? `%${escapeLike(q)}%` : null;
    const rows = await ctx.db
      .select({
        email: approvedEmails.emailCanonical,
        note: approvedEmails.note,
        createdAt: approvedEmails.createdAt,
        university: universityColumns,
      })
      .from(approvedEmails)
      .innerJoin(universities, eq(universities.id, approvedEmails.universityId))
      .where(
        like
          ? or(ilike(approvedEmails.emailCanonical, like), ilike(universities.name, like))
          : undefined,
      )
      .orderBy(desc(approvedEmails.createdAt))
      .limit(100);
    return { emails: rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })) };
  });

  app.post("/api/admin/approved-emails", async (req, reply) => {
    const { user: admin } = requireAdmin(req);
    const input = parse(adminAddEmailSchema, req.body);
    const canonical = canonicalEmail(input.email);
    const { domain } = splitEmail(canonical);
    if (isDisposableDomain(domain)) {
      throw new AppError(400, "DISPOSABLE_EMAIL", "Temporary email addresses can't be approved.");
    }
    const [already] = await ctx.db
      .select({ email: approvedEmails.emailCanonical })
      .from(approvedEmails)
      .where(eq(approvedEmails.emailCanonical, canonical));
    if (already) throw new AppError(409, "CONFLICT", `${canonical} is already approved.`);

    const now = ctx.now();
    const universityName = await ctx.db.transaction(async (tx) => {
      const university = await resolveTarget(tx, input);
      await tx.insert(approvedEmails).values({
        emailCanonical: canonical,
        universityId: university.id,
        note: input.note ?? null,
        addedBy: admin.id,
      });
      await tx
        .update(domainRequests)
        .set({ status: "approved", reviewerId: admin.id, reviewedAt: now })
        .where(and(eq(domainRequests.email, input.email), eq(domainRequests.status, "pending")));
      return university.name;
    });
    await log(admin.id, `add_email:${canonical}`, { reason: input.note ?? null });
    if (input.notify) await notifyApproved(req, [{ email: input.email }], universityName);
    reply.code(201);
    return { ok: true };
  });

  app.delete("/api/admin/approved-emails/:email", async (req) => {
    const { user: admin } = requireAdmin(req);
    const { email } = parse(emailParam, req.params);
    const canonical = canonicalEmail(email);
    const removed = await ctx.db
      .delete(approvedEmails)
      .where(eq(approvedEmails.emailCanonical, canonical))
      .returning({ email: approvedEmails.emailCanonical });
    if (removed.length === 0) throw new AppError(404, "NOT_FOUND", "That email isn't approved.");
    await log(admin.id, `remove_email:${canonical}`, {});
    return { ok: true };
  });

  // ---- Demand survey results ----

  app.get("/api/admin/survey", async (req): Promise<SurveyResults> => {
    requireAdmin(req);
    const rows = await ctx.db
      .select({ modes: surveyResponses.modes, hours: surveyResponses.freeHoursUtc })
      .from(surveyResponses);
    const modes: Record<SurveyMode, number> = { chat: 0, play: 0, tables: 0, cinema: 0 };
    const hoursUtc = Array.from({ length: 24 }, () => 0);
    for (const r of rows) {
      for (const m of r.modes) if (m in modes) modes[m as SurveyMode] += 1;
      for (const h of r.hours) if (h >= 0 && h < 24) hoursUtc[h] = (hoursUtc[h] ?? 0) + 1;
    }
    return { responses: rows.length, modes, hoursUtc };
  });
}
