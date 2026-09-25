export const MIN_AGE = 18;
export const MAX_AGE = 100;
export const OTP_LENGTH = 6;
export const OTP_TTL_MINUTES = 10;
export const OTP_RESEND_SECONDS = 30;
export const VERIFICATION_VALID_DAYS = 365;

export const AVATAR_COLORS = ["grape", "zest", "tang", "gum", "sky"] as const;
export type AvatarColor = (typeof AVATAR_COLORS)[number];

export const SOCIAL_PLATFORMS = [
  "instagram",
  "linkedin",
  "x",
  "snapchat",
  "discord",
  "github",
  "spotify",
  "tiktok",
] as const;
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

export const INTERESTS = [
  { id: "film", label: "film nerd", emoji: "🎬" },
  { id: "music", label: "music", emoji: "🎧" },
  { id: "gaming", label: "gaming", emoji: "🎮" },
  { id: "chess", label: "chess", emoji: "♟" },
  { id: "board-games", label: "board games", emoji: "🎲" },
  { id: "anime", label: "anime", emoji: "🍥" },
  { id: "books", label: "books", emoji: "📚" },
  { id: "writing", label: "writing", emoji: "✍️" },
  { id: "art", label: "art", emoji: "🎨" },
  { id: "design", label: "design", emoji: "📐" },
  { id: "photography", label: "photography", emoji: "📷" },
  { id: "fashion", label: "fashion", emoji: "🧥" },
  { id: "food", label: "street food", emoji: "🍜" },
  { id: "cooking", label: "cooking", emoji: "🍳" },
  { id: "travel", label: "travel", emoji: "✈️" },
  { id: "languages", label: "languages", emoji: "🗣" },
  { id: "football", label: "football", emoji: "⚽" },
  { id: "cricket", label: "cricket", emoji: "🏏" },
  { id: "basketball", label: "basketball", emoji: "🏀" },
  { id: "fitness", label: "fitness", emoji: "💪" },
  { id: "hiking", label: "outdoors", emoji: "🥾" },
  { id: "coding", label: "coding", emoji: "💻" },
  { id: "startups", label: "startups", emoji: "🚀" },
  { id: "ai", label: "AI", emoji: "🤖" },
  { id: "science", label: "science", emoji: "🔬" },
  { id: "space", label: "space", emoji: "🪐" },
  { id: "debate", label: "debate", emoji: "🎤" },
  { id: "politics", label: "politics", emoji: "🗳" },
  { id: "philosophy", label: "philosophy", emoji: "🤔" },
  { id: "memes", label: "memes", emoji: "🐸" },
  { id: "kpop", label: "K-pop", emoji: "💜" },
  { id: "afrobeats", label: "afrobeats", emoji: "🥁" },
  { id: "dance", label: "dance", emoji: "💃" },
  { id: "theatre", label: "theatre", emoji: "🎭" },
  { id: "volunteering", label: "volunteering", emoji: "🤝" },
  { id: "study-abroad", label: "study abroad", emoji: "🌍" },
] as const;
export type InterestId = (typeof INTERESTS)[number]["id"];
export const INTEREST_IDS = INTERESTS.map((i) => i.id) as unknown as readonly [
  InterestId,
  ...InterestId[],
];
export const MAX_INTERESTS = 10;

export const LANGUAGES = [
  { code: "en", name: "English" },
  { code: "es", name: "Spanish" },
  { code: "hi", name: "Hindi" },
  { code: "ur", name: "Urdu" },
  { code: "bn", name: "Bengali" },
  { code: "ta", name: "Tamil" },
  { code: "te", name: "Telugu" },
  { code: "zh", name: "Chinese" },
  { code: "ja", name: "Japanese" },
  { code: "ko", name: "Korean" },
  { code: "ar", name: "Arabic" },
  { code: "fr", name: "French" },
  { code: "de", name: "German" },
  { code: "it", name: "Italian" },
  { code: "pt", name: "Portuguese" },
  { code: "ru", name: "Russian" },
  { code: "tr", name: "Turkish" },
  { code: "id", name: "Indonesian" },
  { code: "ms", name: "Malay" },
  { code: "vi", name: "Vietnamese" },
  { code: "th", name: "Thai" },
  { code: "fa", name: "Persian" },
  { code: "sw", name: "Swahili" },
  { code: "yo", name: "Yoruba" },
  { code: "nl", name: "Dutch" },
  { code: "pl", name: "Polish" },
] as const;
export type LanguageCode = (typeof LANGUAGES)[number]["code"];
export const LANGUAGE_CODES = LANGUAGES.map((l) => l.code) as unknown as readonly [
  LanguageCode,
  ...LanguageCode[],
];
export const MAX_LANGUAGES = 5;

/** Big free email providers: never allowlisted as a whole domain. */
export const FREE_EMAIL_PROVIDERS = [
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "msn.com",
  "yahoo.com",
  "ymail.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
  "gmx.com",
  "gmx.de",
  "mail.com",
  "yandex.com",
  "yandex.ru",
  "zoho.com",
  "qq.com",
  "163.com",
  "126.com",
  "naver.com",
  "rediffmail.com",
] as const;

export const SURVEY_MODES = [
  { id: "chat", label: "Just Chat" },
  { id: "play", label: "Quick Play" },
  { id: "tables", label: "Tables" },
  { id: "cinema", label: "Cinema" },
] as const;
export type SurveyMode = (typeof SURVEY_MODES)[number]["id"];
export const SURVEY_MODE_IDS = SURVEY_MODES.map((m) => m.id) as unknown as readonly [
  SurveyMode,
  ...SurveyMode[],
];

/** Machine-readable error codes returned by the API as `{ error: { code, message } }`. */
export const ERROR_CODES = [
  "VALIDATION",
  "INVALID_EMAIL",
  "DISPOSABLE_EMAIL",
  "ALUMNI_EMAIL",
  "UNKNOWN_DOMAIN",
  "EMAIL_BLOCKED",
  "BANNED",
  "SUSPENDED",
  "RATE_LIMITED",
  "OTP_INVALID",
  "OTP_EXPIRED",
  "OTP_TOO_MANY_ATTEMPTS",
  "UNDERAGE",
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "ONBOARDING_REQUIRED",
  "ALREADY_ONBOARDED",
  "NOT_FOUND",
  "CONFLICT",
  "BAD_ORIGIN",
  "INTERNAL",
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];
