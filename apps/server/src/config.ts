import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().default(4000),
  HOST: z.string().default("0.0.0.0"),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  APP_SECRET: z.string().min(16, "APP_SECRET must be at least 16 characters"),
  APP_ORIGIN: z.url(),
  TRUST_PROXY: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  ADMIN_EMAILS: z
    .string()
    .default("")
    .transform((v) =>
      v
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),
    ),
  MAIL_PROVIDER: z.enum(["console", "resend"]).default("console"),
  RESEND_API_KEY: z.string().optional(),
  MAIL_FROM: z.string().default("Quad <hello@example.com>"),
  /** coturn `static-auth-secret`. Without it calls fall back to direct connections (dev only). */
  TURN_SECRET: z.string().optional(),
  /** Comma-separated, e.g. "turn:turn.quad.example:3478?transport=udp,turn:turn.quad.example:3478?transport=tcp" */
  TURN_URLS: z
    .string()
    .default("")
    .transform((v) =>
      v
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  STUN_URLS: z
    .string()
    .default("")
    .transform((v) =>
      v
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  /** "relay" hides both people's IP addresses from each other (the default whenever TURN is set up). */
  ICE_POLICY: z.enum(["relay", "all"]).optional(),
});

export type Config = z.infer<typeof envSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment:\n${issues}`);
  }
  if (parsed.data.MAIL_PROVIDER === "resend" && !parsed.data.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is required when MAIL_PROVIDER=resend");
  }
  return parsed.data;
}
