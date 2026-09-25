import {
  AVATAR_COLORS,
  type AvatarColor,
  type InterestId,
  type LanguageCode,
  type Me,
  type SocialPlatform,
  type University,
} from "@quad/shared";
import { eq, inArray } from "drizzle-orm";
import type { Db } from "../db/client";
import {
  approvedEmails,
  profiles,
  socials,
  universities,
  universityDomains,
  users,
} from "../db/schema";
import { domainCandidates, splitEmail } from "./email";
import { AppError } from "./errors";

/** Most specific allowlisted domain wins (mail.uni.edu before uni.edu). */
export async function findUniversityForDomain(db: Db, domain: string): Promise<University | null> {
  const candidates = domainCandidates(domain);
  if (candidates.length === 0) return null;
  const rows = await db
    .select({
      domain: universityDomains.domain,
      id: universities.id,
      name: universities.name,
      country: universities.country,
      countryCode: universities.countryCode,
    })
    .from(universityDomains)
    .innerJoin(universities, eq(universities.id, universityDomains.universityId))
    .where(inArray(universityDomains.domain, candidates));
  if (rows.length === 0) return null;
  rows.sort((a, b) => b.domain.length - a.domain.length);
  const { domain: _domain, ...university } = rows[0] as (typeof rows)[number];
  return university;
}

/** An admin-approved address wins; otherwise fall back to the email's domain. */
export async function resolveUniversity(db: Db, canonical: string): Promise<University | null> {
  const [approved] = await db
    .select({
      id: universities.id,
      name: universities.name,
      country: universities.country,
      countryCode: universities.countryCode,
    })
    .from(approvedEmails)
    .innerJoin(universities, eq(universities.id, approvedEmails.universityId))
    .where(eq(approvedEmails.emailCanonical, canonical));
  return approved ?? findUniversityForDomain(db, splitEmail(canonical).domain);
}

export function avatarColorFor(id: string): AvatarColor {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length] as AvatarColor;
}

export async function loadMe(db: Db, userId: string): Promise<Me> {
  const [row] = await db
    .select({ user: users, university: universities, profile: profiles })
    .from(users)
    .innerJoin(universities, eq(universities.id, users.universityId))
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .where(eq(users.id, userId));
  if (!row) throw new AppError(401, "UNAUTHENTICATED", "Please sign in again.");
  const socialRows = await db
    .select({ platform: socials.platform, handle: socials.handle })
    .from(socials)
    .where(eq(socials.userId, userId));
  const { user, university, profile } = row;
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    status: user.status,
    suspendedUntil: user.suspendedUntil?.toISOString() ?? null,
    university: {
      id: university.id,
      name: university.name,
      country: university.country,
      countryCode: university.countryCode,
    },
    verifiedAt: user.verifiedAt.toISOString(),
    verificationExpiresAt: user.verificationExpiresAt.toISOString(),
    profile: profile
      ? {
          displayName: profile.displayName,
          about: profile.about,
          course: profile.course,
          year: profile.year,
          interests: profile.interests as InterestId[],
          languages: profile.languages as LanguageCode[],
          avatarColor: profile.avatarColor as AvatarColor,
        }
      : null,
    socials: socialRows.map((s) => ({ platform: s.platform as SocialPlatform, handle: s.handle })),
  };
}
