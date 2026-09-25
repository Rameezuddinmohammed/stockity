import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createHarness, type Harness } from "./harness";

let h: Harness;
beforeAll(async () => {
  h = await createHarness();
});
beforeEach(async () => {
  await h.reset();
});
afterAll(async () => {
  await h.close();
});

const onboard = (cookie: string, dob: string, displayName = "Riya S.") =>
  h.post("/api/onboarding", { displayName, dob, acceptGuidelines: true }, cookie);

describe("onboarding", () => {
  it("activates the account and creates a profile", async () => {
    const cookie = await h.signIn("riya@iitb.ac.in");
    const res = await onboard(cookie, "2005-04-12");
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      status: "active",
      profile: { displayName: "Riya S.", interests: [], languages: [] },
    });
    expect((await onboard(cookie, "2005-04-12")).json().error.code).toBe("ALREADY_ONBOARDED");
  });

  it("requires the guidelines to be accepted", async () => {
    const cookie = await h.signIn("riya@iitb.ac.in");
    const res = await h.post(
      "/api/onboarding",
      { displayName: "Riya", dob: "2005-04-12", acceptGuidelines: false },
      cookie,
    );
    expect(res.statusCode).toBe(400);
  });

  it("accepts someone turning 18 today", async () => {
    const cookie = await h.signIn("riya@iitb.ac.in");
    expect((await onboard(cookie, "2008-09-25")).statusCode).toBe(200);
  });

  it("deletes under-18 accounts and blocks the email for good", async () => {
    const cookie = await h.signIn("kid@iitb.ac.in");
    const res = await onboard(cookie, "2008-09-26");
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe("UNDERAGE");
    expect((await h.get("/api/me", cookie)).statusCode).toBe(401);

    await h.ctx.redis.flushdb();
    const retry = await h.post("/api/auth/otp/request", { email: "Kid+again@iitb.ac.in" });
    expect(retry.statusCode).toBe(403);
    expect(retry.json().error.code).toBe("EMAIL_BLOCKED");
  });

  it("rejects impossible or unrealistic dates", async () => {
    const cookie = await h.signIn("riya@iitb.ac.in");
    expect((await onboard(cookie, "2005-02-30")).statusCode).toBe(400);
    expect((await onboard(cookie, "1900-01-01")).statusCode).toBe(400);
  });
});

describe("profile", () => {
  it("is locked until onboarding is done", async () => {
    const cookie = await h.signIn("riya@iitb.ac.in");
    const res = await h.patch("/api/me/profile", { about: "hi" }, cookie);
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe("ONBOARDING_REQUIRED");
  });

  it("updates fields and validates them", async () => {
    const cookie = await h.signUp("riya@iitb.ac.in");
    const res = await h.patch(
      "/api/me/profile",
      {
        about: "design student, ludo champion",
        course: "Design",
        year: 1,
        interests: ["film", "board-games", "film"],
        languages: ["en", "hi"],
        avatarColor: "zest",
      },
      cookie,
    );
    expect(res.statusCode).toBe(200);
    expect(res.json().profile).toMatchObject({
      about: "design student, ludo champion",
      year: 1,
      interests: ["film", "board-games"],
      languages: ["en", "hi"],
      avatarColor: "zest",
    });
    const bad = await h.patch("/api/me/profile", { displayName: "dm me @ insta" }, cookie);
    expect(bad.statusCode).toBe(400);
  });

  it("replaces socials as a set", async () => {
    const cookie = await h.signUp("riya@iitb.ac.in");
    await h.put(
      "/api/me/socials",
      {
        socials: [
          { platform: "instagram", handle: "@riya.s" },
          { platform: "x", handle: "riya" },
        ],
      },
      cookie,
    );
    const res = await h.put(
      "/api/me/socials",
      { socials: [{ platform: "linkedin", handle: "riya-s" }] },
      cookie,
    );
    expect(res.json().socials).toEqual([{ platform: "linkedin", handle: "riya-s" }]);
  });

  it("deletes the account", async () => {
    const cookie = await h.signUp("riya@iitb.ac.in");
    const res = await h.app.inject({
      method: "DELETE",
      url: "/api/me",
      headers: { origin: "http://localhost:3000", cookie },
    });
    expect(res.statusCode).toBe(200);
    expect((await h.get("/api/me", cookie)).statusCode).toBe(401);
  });
});

describe("stats", () => {
  it("counts only active students", async () => {
    await h.signUp("riya@iitb.ac.in");
    await h.signUp("kenji@kyoto-u.ac.jp", "Kenji");
    await h.signIn("pending@mit.edu");
    const res = await h.get("/api/stats");
    expect(res.json()).toEqual({ students: 2, universities: 2, countries: 2, online: 0 });
  });
});

describe("survey", () => {
  it("saves and replaces answers", async () => {
    const cookie = await h.signUp("riya@iitb.ac.in");
    expect((await h.get("/api/me/survey", cookie)).json()).toEqual({ answers: null });
    await h.put(
      "/api/me/survey",
      { modes: ["chat"], freeHoursUtc: [15, 14, 14], timezone: "Asia/Kolkata" },
      cookie,
    );
    await h.put(
      "/api/me/survey",
      { modes: ["tables", "cinema"], freeHoursUtc: [20, 3], timezone: "Asia/Kolkata" },
      cookie,
    );
    expect((await h.get("/api/me/survey", cookie)).json().answers).toEqual({
      modes: ["tables", "cinema"],
      freeHoursUtc: [3, 20],
      timezone: "Asia/Kolkata",
    });
  });

  it("rejects hours outside 0-23", async () => {
    const cookie = await h.signUp("riya@iitb.ac.in");
    const res = await h.put("/api/me/survey", { modes: [], freeHoursUtc: [24] }, cookie);
    expect(res.statusCode).toBe(400);
  });
});
