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

describe("allowlisted domains", () => {
  it("adds a domain to an existing university and lets its students in", async () => {
    const [uoft] = (await h.get("/api/admin/universities?q=toronto", admin)).json().universities;
    const res = await h.post(
      "/api/admin/domains",
      { domain: "@Student.UToronto-New.ca", universityId: uoft.id },
      admin,
    );
    expect(res.statusCode).toBe(201);
    const otp = await h.post("/api/auth/otp/request", { email: "li@student.utoronto-new.ca" });
    expect(otp.json().university.name).toBe("University of Toronto");

    const list = (await h.get("/api/admin/domains", admin)).json().domains;
    expect(list[0]).toMatchObject({ domain: "student.utoronto-new.ca", source: "admin" });
  });

  it("approves pending requests for the domain it adds", async () => {
    await h.post("/api/domain-requests", {
      email: "ade@unilag.edu.ng",
      universityName: "University of Lagos",
      country: "Nigeria",
    });
    const res = await h.post(
      "/api/admin/domains",
      {
        domain: "unilag.edu.ng",
        newUniversity: { name: "University of Lagos", countryCode: "NG", country: "Nigeria" },
      },
      admin,
    );
    expect(res.json()).toMatchObject({ ok: true, approvedRequests: 1 });
    expect(h.mailer.sent.at(-1)?.to).toBe("ade@unilag.edu.ng");
    expect((await h.get("/api/admin/domain-requests", admin)).json().requests).toHaveLength(0);
  });

  it("refuses duplicates, personal providers and temporary email services", async () => {
    const [uoft] = (await h.get("/api/admin/universities?q=toronto", admin)).json().universities;
    const dup = await h.post(
      "/api/admin/domains",
      { domain: "utoronto.ca", universityId: uoft.id },
      admin,
    );
    expect(dup.statusCode).toBe(409);
    const gmail = await h.post(
      "/api/admin/domains",
      { domain: "gmail.com", universityId: uoft.id },
      admin,
    );
    expect(gmail.statusCode).toBe(400);
    const temp = await h.post(
      "/api/admin/domains",
      { domain: "mailinator.com", universityId: uoft.id },
      admin,
    );
    expect(temp.json().error.code).toBe("DISPOSABLE_EMAIL");
  });

  it("removes a domain", async () => {
    const res = await h.del("/api/admin/domains/ox.ac.uk", admin);
    expect(res.statusCode).toBe(200);
    const otp = await h.post("/api/auth/otp/request", { email: "tom@ox.ac.uk" });
    expect(otp.json().error.code).toBe("UNKNOWN_DOMAIN");
    expect((await h.del("/api/admin/domains/ox.ac.uk", admin)).statusCode).toBe(404);
  });

  it("searches by domain or university name", async () => {
    const res = await h.get("/api/admin/domains?q=kyoto", admin);
    expect(res.json().domains.map((d: { domain: string }) => d.domain)).toEqual(["kyoto-u.ac.jp"]);
  });
});

describe("approved emails", () => {
  it("lets one address in without opening its whole domain", async () => {
    const [iitb] = (await h.get("/api/admin/universities?q=bombay", admin)).json().universities;
    const res = await h.post(
      "/api/admin/approved-emails",
      {
        email: "Priya.IITB+x@gmail.com",
        universityId: iitb.id,
        note: "Showed student ID on support call",
      },
      admin,
    );
    expect(res.statusCode).toBe(201);
    expect(h.mailer.sent.at(-1)?.to).toBe("priya.iitb+x@gmail.com");

    const ok = await h.post("/api/auth/otp/request", { email: "priya.iitb@gmail.com" });
    expect(ok.json().university.name).toBe("Indian Institute of Technology Bombay");
    await h.ctx.redis.flushdb();
    const other = await h.post("/api/auth/otp/request", { email: "someone@gmail.com" });
    expect(other.json().error).toMatchObject({
      code: "UNKNOWN_DOMAIN",
      details: { personal: true },
    });

    const list = (await h.get("/api/admin/approved-emails", admin)).json().emails;
    expect(list[0]).toMatchObject({
      email: "priya.iitb@gmail.com",
      note: "Showed student ID on support call",
    });
  });

  it("can skip the notification email", async () => {
    const [iitb] = (await h.get("/api/admin/universities?q=bombay", admin)).json().universities;
    const before = h.mailer.sent.length;
    await h.post(
      "/api/admin/approved-emails",
      { email: "quiet@gmail.com", universityId: iitb.id, notify: false },
      admin,
    );
    expect(h.mailer.sent.length).toBe(before);
  });

  it("refuses temporary addresses and duplicates", async () => {
    const [iitb] = (await h.get("/api/admin/universities?q=bombay", admin)).json().universities;
    const temp = await h.post(
      "/api/admin/approved-emails",
      { email: "x@mailinator.com", universityId: iitb.id },
      admin,
    );
    expect(temp.json().error.code).toBe("DISPOSABLE_EMAIL");
    await h.post(
      "/api/admin/approved-emails",
      { email: "a@gmail.com", universityId: iitb.id },
      admin,
    );
    const dup = await h.post(
      "/api/admin/approved-emails",
      { email: "A+tag@gmail.com", universityId: iitb.id },
      admin,
    );
    expect(dup.statusCode).toBe(409);
  });

  it("approves just the requester's email from a request", async () => {
    await h.post("/api/domain-requests", {
      email: "zara@gmail.com",
      universityName: "University of Lagos",
      country: "Nigeria",
    });
    const [request] = (await h.get("/api/admin/domain-requests", admin)).json().requests;
    const res = await h.post(
      `/api/admin/domain-requests/${request.id}/approve-email`,
      { newUniversity: { name: "University of Lagos", countryCode: "NG", country: "Nigeria" } },
      admin,
    );
    expect(res.statusCode).toBe(200);
    const otp = await h.post("/api/auth/otp/request", { email: "zara@gmail.com" });
    expect(otp.json().university.name).toBe("University of Lagos");
    // The whole domain is still closed.
    await h.ctx.redis.flushdb();
    const other = await h.post("/api/auth/otp/request", { email: "bob@gmail.com" });
    expect(other.statusCode).toBe(404);
  });

  it("refuses whole-domain approval for personal providers", async () => {
    await h.post("/api/domain-requests", {
      email: "zara@gmail.com",
      universityName: "University of Lagos",
      country: "Nigeria",
    });
    const [request] = (await h.get("/api/admin/domain-requests", admin)).json().requests;
    const [iitb] = (await h.get("/api/admin/universities?q=bombay", admin)).json().universities;
    const res = await h.post(
      `/api/admin/domain-requests/${request.id}/approve`,
      { universityId: iitb.id },
      admin,
    );
    expect(res.statusCode).toBe(400);
  });

  it("removes an approved email", async () => {
    const [iitb] = (await h.get("/api/admin/universities?q=bombay", admin)).json().universities;
    await h.post(
      "/api/admin/approved-emails",
      { email: "a@gmail.com", universityId: iitb.id },
      admin,
    );
    expect((await h.del("/api/admin/approved-emails/a@gmail.com", admin)).statusCode).toBe(200);
    const otp = await h.post("/api/auth/otp/request", { email: "a@gmail.com" });
    expect(otp.statusCode).toBe(404);
  });
});

describe("survey results", () => {
  it("aggregates answers by mode and UTC hour", async () => {
    const riya = await h.signUp("riya@iitb.ac.in");
    const kenji = await h.signUp("kenji@kyoto-u.ac.jp", "Kenji");
    await h.put("/api/me/survey", { modes: ["chat", "cinema"], freeHoursUtc: [14, 15] }, riya);
    await h.put("/api/me/survey", { modes: ["cinema"], freeHoursUtc: [15, 16] }, kenji);
    const res = (await h.get("/api/admin/survey", admin)).json();
    expect(res.responses).toBe(2);
    expect(res.modes).toEqual({ chat: 1, play: 0, tables: 0, cinema: 2 });
    expect(res.hoursUtc[15]).toBe(2);
    expect(res.hoursUtc[14]).toBe(1);
    expect(res.hoursUtc).toHaveLength(24);
  });
});
