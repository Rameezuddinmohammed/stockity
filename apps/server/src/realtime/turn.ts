import { createHmac } from "node:crypto";
import type { IceConfig } from "@quad/shared";
import type { Config } from "../config";

const TTL_SECONDS = 6 * 60 * 60;

/**
 * Short-lived TURN credentials using coturn's REST scheme (use-auth-secret):
 * username = "<expiry>:<userId>", credential = base64(HMAC-SHA1(secret, username)).
 */
export function iceConfigFor(config: Config, userId: string, now: Date): IceConfig {
  const stun = config.STUN_URLS.length ? [{ urls: config.STUN_URLS }] : [];
  if (!config.TURN_SECRET || config.TURN_URLS.length === 0) {
    return { iceServers: stun, iceTransportPolicy: "all" };
  }
  const username = `${Math.floor(now.getTime() / 1000) + TTL_SECONDS}:${userId}`;
  const credential = createHmac("sha1", config.TURN_SECRET).update(username).digest("base64");
  return {
    iceServers: [...stun, { urls: config.TURN_URLS, username, credential }],
    iceTransportPolicy: config.ICE_POLICY ?? "relay",
  };
}
