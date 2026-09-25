import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { OTP_LENGTH } from "@quad/shared";

export const randomToken = (bytes = 32) => randomBytes(bytes).toString("base64url");

export const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

export const hmac = (secret: string, value: string) =>
  createHmac("sha256", secret).update(value).digest("hex");

export const generateOtp = () =>
  randomInt(0, 10 ** OTP_LENGTH)
    .toString()
    .padStart(OTP_LENGTH, "0");

export function safeEqualHex(a: string, b: string): boolean {
  const ab = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}
