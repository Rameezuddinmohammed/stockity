import { z } from "zod";
import { isRealDate } from "./age";
import {
  AVATAR_COLORS,
  INTEREST_IDS,
  LANGUAGE_CODES,
  MAX_INTERESTS,
  MAX_LANGUAGES,
  OTP_LENGTH,
  SOCIAL_PLATFORMS,
  SURVEY_MODE_IDS,
} from "./constants";

const LINK_LIKE = /(https?:\/\/|www\.|\.com\b|@)/i;

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .pipe(z.email({ message: "That doesn't look like an email address" }));

export const otpRequestSchema = z.object({ email: emailSchema });

export const otpVerifySchema = z.object({
  email: emailSchema,
  code: z
    .string()
    .trim()
    .regex(new RegExp(`^\\d{${OTP_LENGTH}}$`), `Enter the ${OTP_LENGTH}-digit code`),
});

export const displayNameSchema = z
  .string()
  .trim()
  .min(1, "Add a name")
  .max(40, "Keep it under 40 characters")
  .refine((v) => !LINK_LIKE.test(v), "Names can't contain links or handles");

export const dobSchema = z.string().refine(isRealDate, "Enter a real date");

export const onboardingSchema = z.object({
  displayName: displayNameSchema,
  dob: dobSchema,
  acceptGuidelines: z.literal(true, { message: "You need to accept the guidelines" }),
});

export const profileUpdateSchema = z
  .object({
    displayName: displayNameSchema,
    about: z.string().trim().max(280, "Keep it under 280 characters"),
    course: z.string().trim().max(60),
    year: z.number().int().min(1).max(10).nullable(),
    interests: z
      .array(z.enum(INTEREST_IDS))
      .max(MAX_INTERESTS, `Pick up to ${MAX_INTERESTS}`)
      .transform((v) => [...new Set(v)]),
    languages: z
      .array(z.enum(LANGUAGE_CODES))
      .max(MAX_LANGUAGES, `Pick up to ${MAX_LANGUAGES}`)
      .transform((v) => [...new Set(v)]),
    avatarColor: z.enum(AVATAR_COLORS),
  })
  .partial();

export const socialsSchema = z.object({
  socials: z
    .array(
      z.object({
        platform: z.enum(SOCIAL_PLATFORMS),
        handle: z
          .string()
          .trim()
          .transform((v) => v.replace(/^@/, ""))
          .pipe(
            z
              .string()
              .min(1)
              .max(40)
              .regex(/^[A-Za-z0-9._#-]+$/, "Handles can use letters, numbers, . _ - #"),
          ),
      }),
    )
    .max(SOCIAL_PLATFORMS.length)
    .refine(
      (list) => new Set(list.map((s) => s.platform)).size === list.length,
      "One handle per platform",
    ),
});

export const domainRequestSchema = z.object({
  email: emailSchema,
  universityName: z.string().trim().min(2).max(120),
  country: z.string().trim().min(2).max(60),
  website: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((v) => (v ? v : undefined)),
});

export const adminSuspendSchema = z.object({
  hours: z
    .number()
    .int()
    .min(1)
    .max(24 * 90),
  reason: z.string().trim().min(3).max(300),
});

export const adminBanSchema = z.object({ reason: z.string().trim().min(3).max(300) });

/** Where an approved domain or email should point: an existing university or a new one. */
export const universityTargetSchema = z.union([
  z.object({ universityId: z.uuid() }),
  z.object({
    newUniversity: z.object({
      name: z.string().trim().min(2).max(120),
      countryCode: z
        .string()
        .trim()
        .toUpperCase()
        .regex(/^[A-Z]{2}$/, "Use a 2-letter country code, like NG"),
      country: z.string().trim().min(2).max(60),
    }),
  }),
]);
export type UniversityTarget = z.infer<typeof universityTargetSchema>;

/** @deprecated use universityTargetSchema */
export const adminApproveDomainSchema = universityTargetSchema;

const DOMAIN_RE = /^(?=.{4,253}$)([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/;

export const domainSchema = z
  .string()
  .trim()
  .toLowerCase()
  .transform((v) =>
    v
      .replace(/^@/, "")
      .replace(/^www\./, "")
      .replace(/\.$/, ""),
  )
  .pipe(z.string().regex(DOMAIN_RE, "Enter a domain like uni.edu"));

export const adminAddDomainSchema = z.object({ domain: domainSchema }).and(universityTargetSchema);

export const adminAddEmailSchema = z
  .object({
    email: emailSchema,
    note: z.string().trim().max(300).optional(),
    notify: z.boolean().default(true),
  })
  .and(universityTargetSchema);

export const surveySchema = z.object({
  modes: z
    .array(z.enum(SURVEY_MODE_IDS))
    .max(SURVEY_MODE_IDS.length)
    .transform((v) => [...new Set(v)]),
  freeHoursUtc: z
    .array(z.number().int().min(0).max(23))
    .max(24)
    .transform((v) => [...new Set(v)].sort((a, b) => a - b)),
  timezone: z.string().trim().max(64).optional(),
});
export type SurveyInput = z.infer<typeof surveySchema>;

export const adminRejectDomainSchema = z.object({ note: z.string().trim().min(3).max(300) });

export type OtpRequest = z.infer<typeof otpRequestSchema>;
export type OtpVerify = z.infer<typeof otpVerifySchema>;
export type OnboardingInput = z.infer<typeof onboardingSchema>;
export type ProfileUpdate = z.infer<typeof profileUpdateSchema>;
export type SocialsInput = z.infer<typeof socialsSchema>;
export type DomainRequestInput = z.infer<typeof domainRequestSchema>;
