import { sql } from "drizzle-orm";
import {
  boolean,
  customType,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  real,
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
    /** Confirmed rule breaks; drives the warning → 24h → 7d → ban ladder. */
    strikeCount: integer("strike_count").notNull().default(0),
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

/** Individual addresses an admin let in even though their domain isn't allowlisted. */
export const approvedEmails = pgTable("approved_emails", {
  emailCanonical: text("email_canonical").primaryKey(),
  universityId: uuid("university_id")
    .notNull()
    .references(() => universities.id, { onDelete: "cascade" }),
  note: text("note"),
  addedBy: uuid("added_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: createdAt(),
});

/** Phase 0 demand survey: which modes people want and when they're free (as UTC hours). */
export const surveyResponses = pgTable("survey_responses", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  modes: text("modes").array().notNull().default(sql`'{}'::text[]`),
  freeHoursUtc: smallint("free_hours_utc").array().notNull().default(sql`'{}'::smallint[]`),
  timezone: text("timezone"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

const bytea = customType<{ data: Buffer }>({ dataType: () => "bytea" });

export const callMode = pgEnum("call_mode", ["video", "text"]);
export const reportStatus = pgEnum("report_status", ["open", "actioned", "dismissed"]);

/** One random chat. Content is never stored here, only who, when and how it ended. */
export const calls = pgTable(
  "calls",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userA: uuid("user_a").references(() => users.id, { onDelete: "set null" }),
    userB: uuid("user_b").references(() => users.id, { onDelete: "set null" }),
    mode: callMode("mode").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    endedBy: uuid("ended_by"),
    endReason: text("end_reason"),
  },
  (t) => [index("calls_started_idx").on(t.startedAt)],
);

export const blocks = pgTable(
  "blocks",
  {
    blockerId: uuid("blocker_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    blockedId: uuid("blocked_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.blockerId, t.blockedId] }),
    index("blocks_blocked_idx").on(t.blockedId),
  ],
);

export type ChatExcerptLine = { from: "reporter" | "reported"; text: string; at: string };

export const reports = pgTable(
  "reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    callId: uuid("call_id").references(() => calls.id, { onDelete: "set null" }),
    reporterId: uuid("reporter_id").references(() => users.id, { onDelete: "set null" }),
    reportedId: uuid("reported_id").references(() => users.id, { onDelete: "cascade" }),
    category: text("category").notNull(),
    note: text("note"),
    /** Last messages of the chat at report time; cleared after 30 days. */
    chatExcerpt: jsonb("chat_excerpt").$type<ChatExcerptLine[]>(),
    /** True when the report was raised automatically (e.g. repeated nudity flags). */
    automatic: boolean("automatic").notNull().default(false),
    status: reportStatus("status").notNull().default("open"),
    action: text("action"),
    reviewerId: uuid("reviewer_id").references(() => users.id, { onDelete: "set null" }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    evidenceClearedAt: timestamp("evidence_cleared_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index("reports_status_idx").on(t.status, t.createdAt),
    index("reports_reported_idx").on(t.reportedId),
  ],
);

/** Still frame captured by the reporter's device at report time. Deleted after 30 days. */
export const reportEvidence = pgTable("report_evidence", {
  reportId: uuid("report_id")
    .primaryKey()
    .references(() => reports.id, { onDelete: "cascade" }),
  mime: text("mime").notNull(),
  frame: bytea("frame").notNull(),
  createdAt: createdAt(),
});

/** Signals from automated checks, e.g. a viewer's device flagging nudity in the video it receives. */
export const moderationEvents = pgTable(
  "moderation_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    subjectId: uuid("subject_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    observerId: uuid("observer_id").references(() => users.id, { onDelete: "set null" }),
    callId: uuid("call_id").references(() => calls.id, { onDelete: "set null" }),
    kind: text("kind").notNull(),
    score: real("score"),
    createdAt: createdAt(),
  },
  (t) => [index("moderation_events_subject_idx").on(t.subjectId, t.createdAt)],
);

/** Messages for a user from the safety team (warnings, suspensions), shown until acknowledged. */
export const userNotices = pgTable(
  "user_notices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    message: text("message").notNull(),
    seenAt: timestamp("seen_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("user_notices_user_idx").on(t.userId)],
);

/** Hashed device cookies seen per account, so bans can also cover the devices used. */
export const userDevices = pgTable(
  "user_devices",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    deviceHash: text("device_hash").notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.deviceHash] })],
);

export const bannedDevices = pgTable("banned_devices", {
  deviceHash: text("device_hash").primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: createdAt(),
});
