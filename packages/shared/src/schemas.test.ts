import { describe, expect, it } from "vitest";
import { ageOn, isRealDate } from "./age";
import { displayNameSchema, emailSchema, profileUpdateSchema, socialsSchema } from "./schemas";

describe("ageOn", () => {
  const now = new Date("2026-09-25T12:00:00Z");
  it("counts the birthday itself as a new year", () => {
    expect(ageOn("2008-09-25", now)).toBe(18);
  });
  it("is one less the day before the birthday", () => {
    expect(ageOn("2008-09-26", now)).toBe(17);
  });
  it("handles leap-day birthdays", () => {
    expect(ageOn("2008-02-29", now)).toBe(18);
  });
});

describe("isRealDate", () => {
  it("rejects impossible dates", () => {
    expect(isRealDate("2007-02-30")).toBe(false);
    expect(isRealDate("2007-13-01")).toBe(false);
    expect(isRealDate("07-01-01")).toBe(false);
  });
  it("accepts real dates", () => {
    expect(isRealDate("2004-02-29")).toBe(true);
  });
});

describe("schemas", () => {
  it("normalizes emails", () => {
    expect(emailSchema.parse("  Riya@IITB.ac.in ")).toBe("riya@iitb.ac.in");
    expect(emailSchema.safeParse("not-an-email").success).toBe(false);
  });
  it("rejects links in display names", () => {
    expect(displayNameSchema.safeParse("find me @riya").success).toBe(false);
    expect(displayNameSchema.safeParse("리야 🌸").success).toBe(true);
  });
  it("dedupes interests and rejects unknown ones", () => {
    expect(profileUpdateSchema.parse({ interests: ["film", "film", "chess"] }).interests).toEqual([
      "film",
      "chess",
    ]);
    expect(profileUpdateSchema.safeParse({ interests: ["nope"] }).success).toBe(false);
  });
  it("strips @ from handles and rejects duplicate platforms", () => {
    expect(
      socialsSchema.parse({ socials: [{ platform: "instagram", handle: "@riya.s" }] }).socials[0]
        ?.handle,
    ).toBe("riya.s");
    expect(
      socialsSchema.safeParse({
        socials: [
          { platform: "x", handle: "a" },
          { platform: "x", handle: "b" },
        ],
      }).success,
    ).toBe(false);
  });
});
