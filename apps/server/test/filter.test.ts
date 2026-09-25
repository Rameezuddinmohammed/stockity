import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config";
import { censorText, containsContactInfo } from "../src/realtime/filter";
import { iceConfigFor } from "../src/realtime/turn";

describe("chat filter", () => {
  it("spots links, emails, handles and phone numbers", () => {
    for (const text of [
      "check https://example.com",
      "go to www.site.org",
      "my site is riya.dev",
      "mail me riya@gmail.com",
      "add me @riya.s",
      "call +91 98765 43210",
      "text 555-123-4567",
    ]) {
      expect(containsContactInfo(text), text).toBe(true);
    }
  });

  it("leaves normal sentences alone", () => {
    for (const text of [
      "what's your major?",
      "I have 3 exams this week",
      "e.g. biology or chem",
      "it's 9.30 here, you?",
      "we met in 2024",
    ]) {
      expect(containsContactInfo(text), text).toBe(false);
    }
  });

  it("masks sexual terms but allows everyday swearing", () => {
    expect(censorText("this exam is fucking hard")).toBe("this exam is fucking hard");
    expect(censorText("show me your tits")).not.toContain("tits");
    expect(censorText("hello there")).toBe("hello there");
  });
});

describe("TURN credentials", () => {
  const base = {
    DATABASE_URL: "x",
    REDIS_URL: "x",
    APP_SECRET: "0123456789abcdef",
    APP_ORIGIN: "http://localhost:3000",
  };

  it("uses direct connections when TURN isn't configured", () => {
    const ice = iceConfigFor(loadConfig(base), "u1", new Date(0));
    expect(ice).toEqual({ iceServers: [], iceTransportPolicy: "all" });
  });

  it("issues relay-only, expiring credentials when it is", () => {
    const config = loadConfig({
      ...base,
      TURN_SECRET: "s3cret",
      TURN_URLS: "turn:turn.example:3478?transport=udp, turn:turn.example:3478?transport=tcp",
    });
    const ice = iceConfigFor(config, "u1", new Date("2026-01-01T00:00:00Z"));
    expect(ice.iceTransportPolicy).toBe("relay");
    const server = ice.iceServers[0];
    expect(server?.urls).toHaveLength(2);
    expect(server?.username).toBe(`${Date.parse("2026-01-01T00:00:00Z") / 1000 + 21600}:u1`);
    expect(server?.credential).toMatch(/^[A-Za-z0-9+/]+=*$/);
  });
});
