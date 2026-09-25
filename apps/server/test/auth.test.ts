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

describe("OTP request", () => {
  it("recognizes the university and mails a 6-digit code", async () => {
    const res = await h.post("/api/auth/otp/request", { email: "Riya@IITB.ac.in" });
    expect(res.statusCode).toBe(200);
    expect(res.json().university.name).toBe("Indian Institute of Technology Bombay");
    expect(h.mailer.sent).toHaveLength(1);
    expect(h.mailer.sent[0]?.to).toBe("riya@iitb.ac.in");
    expect(h.lastCode()).toMatch(/^\d{6}$/);
  });

  it("matches student subdomains to their university", async () => {
    const res = await h.post("/api/auth/otp/request", { email: "aisha@cs.students.uonbi.ac.ke" });
    expect(res.json().university.name).toBe("University of Nairobi");
  });

  it("rejects unknown, alumni and disposable domains", async () => {
    const unknown = await h.post("/api/auth/otp/request", { email: "x@unknown-college.edu" });
    expect(unknown.statusCode).toBe(404);
    expect(unknown.json().error).toMatchObject({
      code: "UNKNOWN_DOMAIN",
      details: { domain: "unknown-college.edu" },
    });
    const alumni = await h.post("/api/auth/otp/request", { email: "x@alumni.utoronto.ca" });
    expect(alumni.json().error.code).toBe("ALUMNI_EMAIL");
    const temp = await h.post("/api/auth/otp/request", { email: "x@mailinator.com" });
    expect(temp.json().error.code).toBe("DISPOSABLE_EMAIL");
    expect(h.mailer.sent).toHaveLength(0);
  });

  it("enforces a resend cooldown", async () => {
    await h.post("/api/auth/otp/request", { email: "riya@iitb.ac.in" });
    const again = await h.post("/api/auth/otp/request", { email: "riya@iitb.ac.in" });
    expect(again.statusCode).toBe(429);
    expect(again.headers["retry-after"]).toBeDefined();
  });

  it("rejects invalid emails", async () => {
    const res = await h.post("/api/auth/otp/request", { email: "nope" });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe("VALIDATION");
  });
});

describe("OTP verify", () => {
  it("signs in a new user who still needs onboarding", async () => {
    await h.post("/api/auth/otp/request", { email: "riya@iitb.ac.in" });
    const res = await h.post("/api/auth/otp/verify", {
      email: "riya@iitb.ac.in",
      code: h.lastCode(),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      needsOnboarding: true,
      me: { status: "onboarding", role: "user", profile: null },
    });
    const cookie = res.cookies.find((c) => c.name === "quad_session");
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe("Lax");
  });

  it("rejects a wrong code and locks after 5 tries", async () => {
    await h.post("/api/auth/otp/request", { email: "riya@iitb.ac.in" });
    const right = h.lastCode();
    const wrong = right === "000000" ? "111111" : "000000";
    const first = await h.post("/api/auth/otp/verify", { email: "riya@iitb.ac.in", code: wrong });
    expect(first.json().error).toMatchObject({ code: "OTP_INVALID", details: { attemptsLeft: 4 } });
    for (let i = 0; i < 4; i++) {
      await h.post("/api/auth/otp/verify", { email: "riya@iitb.ac.in", code: wrong });
    }
    const locked = await h.post("/api/auth/otp/verify", { email: "riya@iitb.ac.in", code: right });
    expect(locked.json().error.code).toBe("OTP_TOO_MANY_ATTEMPTS");
  });

  it("expires codes after 10 minutes", async () => {
    await h.post("/api/auth/otp/request", { email: "riya@iitb.ac.in" });
    h.advance(11 * 60_000);
    const res = await h.post("/api/auth/otp/verify", {
      email: "riya@iitb.ac.in",
      code: h.lastCode(),
    });
    expect(res.json().error.code).toBe("OTP_EXPIRED");
  });

  it("only accepts the newest code, and only once", async () => {
    await h.post("/api/auth/otp/request", { email: "riya@iitb.ac.in" });
    const old = h.lastCode();
    await h.ctx.redis.flushdb(); // skip the resend cooldown
    await h.post("/api/auth/otp/request", { email: "riya@iitb.ac.in" });
    const fresh = h.lastCode();
    if (old !== fresh) {
      const res = await h.post("/api/auth/otp/verify", { email: "riya@iitb.ac.in", code: old });
      expect(res.statusCode).toBe(400);
    }
    const ok = await h.post("/api/auth/otp/verify", { email: "riya@iitb.ac.in", code: fresh });
    expect(ok.statusCode).toBe(200);
    const reuse = await h.post("/api/auth/otp/verify", { email: "riya@iitb.ac.in", code: fresh });
    expect(reuse.statusCode).toBe(400);
  });

  it("treats +tag addresses as the same account", async () => {
    const a = await h.signIn("riya@iitb.ac.in");
    await h.ctx.redis.flushdb();
    const b = await h.signIn("Riya+quad@iitb.ac.in");
    const meA = (await h.get("/api/me", a)).json();
    const meB = (await h.get("/api/me", b)).json();
    expect(meA.id).toBe(meB.id);
  });

  it("gives configured emails the admin role", async () => {
    const cookie = await h.signIn("admin@mit.edu");
    expect((await h.get("/api/me", cookie)).json().role).toBe("admin");
  });
});

describe("sessions", () => {
  it("requires a session for /api/me", async () => {
    const res = await h.get("/api/me");
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe("UNAUTHENTICATED");
  });

  it("reports the session quietly", async () => {
    expect((await h.get("/api/auth/session")).json()).toEqual({ me: null });
    const cookie = await h.signIn("riya@iitb.ac.in");
    const res = await h.get("/api/auth/session", cookie);
    expect(res.statusCode).toBe(200);
    expect(res.json().me.email).toBe("riya@iitb.ac.in");
  });

  it("logs out one device or all devices", async () => {
    const one = await h.signIn("riya@iitb.ac.in");
    await h.ctx.redis.flushdb();
    const two = await h.signIn("riya@iitb.ac.in");

    await h.post("/api/auth/logout", undefined, one);
    expect((await h.get("/api/me", one)).statusCode).toBe(401);
    expect((await h.get("/api/me", two)).statusCode).toBe(200);

    await h.ctx.redis.flushdb();
    const three = await h.signIn("riya@iitb.ac.in");
    await h.post("/api/auth/logout-all", undefined, three);
    expect((await h.get("/api/me", two)).statusCode).toBe(401);
    expect((await h.get("/api/me", three)).statusCode).toBe(401);
  });

  it("expires sessions after 30 days of inactivity", async () => {
    const cookie = await h.signIn("riya@iitb.ac.in");
    h.advance(31 * 24 * 3_600_000);
    expect((await h.get("/api/me", cookie)).statusCode).toBe(401);
  });
});

describe("request hardening", () => {
  it("blocks cross-origin writes", async () => {
    const res = await h.app.inject({
      method: "POST",
      url: "/api/auth/otp/request",
      headers: { origin: "https://evil.example" },
      payload: { email: "riya@iitb.ac.in" },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe("BAD_ORIGIN");
  });

  it("refuses text/plain bodies", async () => {
    const res = await h.app.inject({
      method: "POST",
      url: "/api/auth/otp/request",
      headers: { origin: "http://localhost:3000", "content-type": "text/plain" },
      payload: JSON.stringify({ email: "riya@iitb.ac.in" }),
    });
    expect(res.statusCode).toBe(415);
  });
});
