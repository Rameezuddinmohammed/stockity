import { sql } from "drizzle-orm";
import {
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const userStatus = pgEnum("user_status", ["onboarding", "active", "suspended", "banned"]);
export const userRole = pgEnum("user_role", ["user", "admin"]);
export const domainRequestStatus = pgEnum("domain_request_status", [
  "pending",
  "approved",
  "rejected",
]);

export const universities = pgTable(
  "universities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    country: text("country").notNull(),
    countryCode: text("country_code").notNull(),
    webPage: text("web_page"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("universities_name_country_idx").on(t.name, t.countryCode)],
);

export const universityDomains = pgTable("university_domains", {
  domain: text("domain").primaryKey(),
  universityId: uuid("university_id")
    .notNull()
    .references(() => universities.id, { onDelete: "cascade" }),
  source: text("source").notNull().default("hipo"),
  createdAt: createdAt(),
});

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    /** Lowercased with any +tag removed; one account per canonical email. */
    emailCanonical: text("email_canonical").notNull().unique(),
    universityId: uuid("university_id")
      .notNull()
      .references(() => universities.id),
    role: userRole("role").notNull().default("user"),
    status: userStatus("status").notNull().default("onboarding"),
    suspendedUntil: timestamp("suspended_until", { withTimezone: true }),
    statusReason: text("status_reason"),
    dob: date("dob", { mode: "string" }),
    guidelinesAcceptedAt: timestamp("guidelines_accepted_at", { withTimezone: true }),
    verifiedAt: timestamp("verified_at", { withTimezone: true }).notNull(),
    verificationExpiresAt: timestamp("verification_expires_at", { withTimezone: true }).notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("users_status_idx").on(t.status)],
);

export const profiles = pgTable("profiles", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  displayName: text("display_name").notNull(),
  about: text("about").notNull().default(""),
  course: text("course").notNull().default(""),
  year: smallint("year"),
  interests: text("interests").array().notNull().default(sql`'{}'::text[]`),
  languages: text("languages").array().notNull().default(sql`'{}'::text[]`),
  avatarColor: text("avatar_color").notNull().default("grape"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Private: only revealed to mutual connections (Phase 3). */
export const socials = pgTable(
  "socials",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    platform: text("platform").notNull(),
    handle: text("handle").notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.platform] })],
);

export const otpCodes = pgTable(
  "otp_codes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    emailCanonical: text("email_canonical").notNull(),
    codeHash: text("code_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    attempts: integer("attempts").notNull().default(0),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("otp_codes_email_idx").on(t.emailCanonical, t.createdAt)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    userAgent: text("user_agent"),
    ip: text("ip"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: createdAt(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

/** Emails that may never sign up again (e.g. under 18). Stored as an HMAC, never in plain text. */
export const blockedEmails = pgTable("blocked_emails", {
  emailHash: text("email_hash").primaryKey(),
  reason: text("reason").notNull(),
  createdAt: createdAt(),
});

export const domainRequests = pgTable(
  "domain_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    domain: text("domain").notNull(),
    universityName: text("university_name").notNull(),
    country: text("country").notNull(),
    website: text("website"),
    status: domainRequestStatus("status").notNull().default("pending"),
    reviewerId: uuid("reviewer_id").references(() => users.id, { onDelete: "set null" }),
    reviewNote: text("review_note"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("domain_requests_status_idx").on(t.status, t.createdAt)],
);

export const adminActions = pgTable("admin_actions", {
  id: uuid("id").primaryKey().defaultRandom(),
  adminId: uuid("admin_id").references(() => users.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  targetUserId: uuid("target_user_id").references(() => users.id, { onDelete: "set null" }),
  targetDomainRequestId: uuid("target_domain_request_id").references(() => domainRequests.id, {
    onDelete: "set null",
  }),
  reason: text("reason"),
  createdAt: createdAt(),
});
