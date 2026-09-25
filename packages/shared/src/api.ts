import type { AvatarColor, ErrorCode, InterestId, LanguageCode, SocialPlatform } from "./constants";

export type ApiError = { error: { code: ErrorCode; message: string; details?: unknown } };

export type UserStatus = "onboarding" | "active" | "suspended" | "banned";

export type University = { id: string; name: string; country: string; countryCode: string };

export type Me = {
  id: string;
  email: string;
  role: "user" | "admin";
  status: UserStatus;
  suspendedUntil: string | null;
  university: University;
  verifiedAt: string;
  verificationExpiresAt: string;
  profile: {
    displayName: string;
    about: string;
    course: string;
    year: number | null;
    interests: InterestId[];
    languages: LanguageCode[];
    avatarColor: AvatarColor;
  } | null;
  socials: { platform: SocialPlatform; handle: string }[];
};

export type OtpRequestResponse = { ok: true; university: University; resendInSeconds: number };
export type OtpVerifyResponse = { me: Me; needsOnboarding: boolean };

export type AdminUserRow = {
  id: string;
  email: string;
  displayName: string | null;
  university: string;
  status: UserStatus;
  suspendedUntil: string | null;
  statusReason: string | null;
  role: "user" | "admin";
  createdAt: string;
};

export type DomainRequestRow = {
  id: string;
  email: string;
  domain: string;
  universityName: string;
  country: string;
  website: string | null;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
};

export type PublicStats = { students: number; universities: number; countries: number };
