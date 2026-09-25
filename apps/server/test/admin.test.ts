import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createHarness, type Harness } from "./harness";

let h: Harness;
let admin: string;
beforeAll(async () => {
  h = await createHarness();
});
beforeEach(async () => {
  await h.reset();
  admin = await h.signUp("admin@mit.edu", "Admin");
  await h.ctx.redis.flushdb();
});
afterAll(async () => {
  await h.close();
});

const userId = async (cookie: string) => (await h.get("/api/me", cookie)).json().id as string;

describe("admin access", () => {
  it("is for admins only", async () => {
    const user = await h.signUp("riya@iitb.ac.in");
    const res = await h.get("/api/admin/users", user);
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe("FORBIDDEN");
  });

  it("searches users by email or name", async () => {
    await h.signUp("riya@iitb.ac.in", "Riya S.");
    await h.signUp("kenji@kyoto-u.ac.jp", "Kenji T.");
    const res = await h.get("/api/admin/users?q=kenji", admin);
    expect(res.json().users.map((u: { email: string }) => u.email)).toEqual([
      "kenji@kyoto-u.ac.jp",
    ]);
  });
});

describe("university requests", () => {
  it("adds a new university and lets its students in", async () => {
    const req = await h.post("/api/domain-requests", {
      email: "sam@newuni.edu",
      universityName: "New University",
      country: "United States",
    });
    expect(req.statusCode).toBe(202);

    const list = (await h.get("/api/admin/domain-requests", admin)).json().requests;
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ domain: "newuni.edu", status: "pending" });

    const approve = await h.post(
      `/api/admin/domain-requests/${list[0].id}/approve`,
      { newUniversity: { name: "New University", countryCode: "us", country: "United States" } },
      admin,
    );
    expect(approve.json()).toMatchObject({ ok: true, approvedCount: 1 });
    expect(h.mailer.sent.at(-1)).toMatchObject({ to: "sam@newuni.edu" });

    const otp = await h.post("/api/auth/otp/request", { email: "sam@newuni.edu" });
    expect(otp.json().university.name).toBe("New University");
  });

  it("can attach a domain to an existing university", async () => {
    await h.post("/api/domain-requests", {
      email: "ana@utoronto-extra.ca",
      universityName: "University of Toronto",
      country: "Canada",
    });
    const [request] = (await h.get("/api/admin/domain-requests", admin)).json().requests;
    const [uoft] = (await h.get("/api/admin/universities?q=toronto", admin)).json().universities;
    await h.post(
      `/api/admin/domain-requests/${request.id}/approve`,
      { universityId: uoft.id },
      admin,
    );
    const otp = await h.post("/api/auth/otp/request", { email: "ana@utoronto-extra.ca" });
    expect(otp.json().university.name).toBe("University of Toronto");
  });

  it("rejects with a note", async () => {
    await h.post("/api/domain-requests", {
      email: "x@fake-school.com",
      universityName: "Fake",
      country: "Nowhere",
    });
    const [request] = (await h.get("/api/admin/domain-requests", admin)).json().requests;
    const res = await h.post(
      `/api/admin/domain-requests/${request.id}/reject`,
      { note: "This isn't a university email domain." },
      admin,
    );
    expect(res.statusCode).toBe(200);
    expect((await h.get("/api/admin/domain-requests", admin)).json().requests).toHaveLength(0);
  });

  it("refuses requests for domains already on Quad", async () => {
    const res = await h.post("/api/domain-requests", {
      email: "x@iitb.ac.in",
      universityName: "IIT Bombay",
      country: "India",
    });
    expect(res.statusCode).toBe(409);
  });

  it("rate limits requests per IP", async () => {
    for (let i = 0; i < 5; i++) {
      await h.post("/api/domain-requests", {
        email: `s${i}@spam${i}.edu`,
        universityName: "Spam",
        country: "X",
      });
    }
    const res = await h.post("/api/domain-requests", {
      email: "s9@spam9.edu",
      universityName: "Spam",
      country: "X",
    });
    expect(res.statusCode).toBe(429);
  });
});

describe("moderation", () => {
  it("suspends until the time runs out", async () => {
    const user = await h.signUp("riya@iitb.ac.in");
    const id = await userId(user);
    const res = await h.post(
      `/api/admin/users/${id}/suspend`,
      { hours: 24, reason: "Harassment in chat" },
      admin,
    );
    expect(res.statusCode).toBe(200);

    const blocked = await h.patch("/api/me/profile", { about: "x" }, user);
    expect(blocked.json().error.code).toBe("SUSPENDED");

    h.advance(25 * 3_600_000);
    const me = (await h.get("/api/me", user)).json();
    expect(me.status).toBe("active");
  });

  it("bans: signs the user out and blocks future sign-ins", async () => {
    const user = await h.signUp("riya@iitb.ac.in");
    const id = await userId(user);
    await h.ctx.redis.flushdb(); // skip the resend cooldown from signing up
    await h.post(`/api/admin/users/${id}/ban`, { reason: "Nudity" }, admin);
    expect((await h.get("/api/me", user)).statusCode).toBe(401);
    const otp = await h.post("/api/auth/otp/request", { email: "riya@iitb.ac.in" });
    expect(otp.json().error.code).toBe("BANNED");

    await h.post(`/api/admin/users/${id}/reinstate`, undefined, admin);
    await h.ctx.redis.flushdb();
    const again = await h.post("/api/auth/otp/request", { email: "riya@iitb.ac.in" });
    expect(again.statusCode).toBe(200);
  });

  it("cannot act on admins", async () => {
    const id = await userId(admin);
    const res = await h.post(`/api/admin/users/${id}/ban`, { reason: "test" }, admin);
    expect(res.statusCode).toBe(403);
  });
});
