import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { reportEvidence, reports } from "../src/db/schema";
import { runCleanup } from "../src/jobs/cleanup";
import { nextStrike } from "../src/safety/enforce";
import { createHarness, type Harness, ORIGIN } from "./harness";
import { TestClient } from "./ws-client";

let h: Harness;
let url: string;
let admin: string;
beforeAll(async () => {
  h = await createHarness();
  url = await h.listen();
});
beforeEach(async () => {
  await h.reset();
  admin = await h.signUp("admin@mit.edu", "Admin");
});
afterAll(async () => {
  await h.close();
});

/** Riya reports Kenji during a video chat; returns their cookies. */
async function fileReport() {
  const riya = await h.signUp("riya@iitb.ac.in", "Riya");
  const kenji = await h.signUp("kenji@kyoto-u.ac.jp", "Kenji");
  const a = h.track(await TestClient.connect(url, riya));
  const b = h.track(await TestClient.connect(url, kenji));
  a.send({ t: "queue.join", mode: "video" });
  await a.next("queue.waiting");
  b.send({ t: "queue.join", mode: "video" });
  await a.next("match");
  b.send({ t: "chat.send", clientId: "1", text: "hi" });
  await a.next("chat.msg");
  const frame = `data:image/jpeg;base64,${Buffer.from("jpeg!").toString("base64")}`;
  a.send({ t: "call.report", category: "nudity", frame });
  await a.next("report.received");
  return { riya, kenji, kenjiClient: b };
}

describe("ladder", () => {
  it("goes warning → 24h → 7 days → ban", () => {
    expect([0, 1, 2, 3, 7].map(nextStrike)).toEqual([
      "warn",
      "suspend_24h",
      "suspend_7d",
      "ban",
      "ban",
    ]);
  });
});

describe("admin report queue", () => {
  it("lists open reports with context and serves the evidence frame", async () => {
    await fileReport();
    const list = (await h.get("/api/admin/reports", admin)).json().reports;
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({
      category: "nudity",
      callMode: "video",
      hasFrame: true,
      reporter: { displayName: "Riya" },
      reported: { displayName: "Kenji", strikeCount: 0, reportsTotal: 1 },
      chatExcerpt: [expect.objectContaining({ from: "reported", text: "hi" })],
    });
    const frame = await h.get(`/api/admin/reports/${list[0].id}/frame`, admin);
    expect(frame.headers["content-type"]).toBe("image/jpeg");
    expect(frame.headers["cache-control"]).toContain("no-store");
    expect(frame.body).toBe("jpeg!");
  });

  it("is admin only", async () => {
    const { riya } = await fileReport();
    expect((await h.get("/api/admin/reports", riya)).statusCode).toBe(403);
  });

  it("applies strikes up the ladder and tells the person", async () => {
    const { kenji } = await fileReport();
    const [first] = (await h.get("/api/admin/reports", admin)).json().reports;
    const res = await h.post(`/api/admin/reports/${first.id}/resolve`, { action: "strike" }, admin);
    expect(res.json()).toEqual({ ok: true, action: "warn" });

    const me = (await h.get("/api/me", kenji)).json();
    expect(me.status).toBe("active");
    expect(me.notices).toHaveLength(1);
    expect(me.notices[0]).toMatchObject({ kind: "warning" });
    const seen = await h.post(`/api/me/notices/${me.notices[0].id}/seen`, undefined, kenji);
    expect(seen.json().notices).toHaveLength(0);

    // A second confirmed report suspends for 24 hours.
    await h.ctx.redis.flushdb();
    const second = await fileReportAgainst(kenji);
    const res2 = await h.post(`/api/admin/reports/${second}/resolve`, { action: "strike" }, admin);
    expect(res2.json().action).toBe("suspend_24h");
    expect((await h.get("/api/me", kenji)).json().status).toBe("suspended");
    expect((await h.get("/api/admin/reports", admin)).json().reports).toHaveLength(0);
  });

  it("dismisses without touching the account", async () => {
    const { kenji } = await fileReport();
    const [report] = (await h.get("/api/admin/reports", admin)).json().reports;
    await h.post(`/api/admin/reports/${report.id}/resolve`, { action: "dismiss" }, admin);
    expect((await h.get("/api/me", kenji)).json()).toMatchObject({ status: "active", notices: [] });
    const dismissed = (await h.get("/api/admin/reports?status=dismissed", admin)).json().reports;
    expect(dismissed).toHaveLength(1);
  });
});

/** Files another report against the owner of `cookie` from a new student. */
async function fileReportAgainst(cookie: string) {
  const other = await h.signUp(`o${Date.now()}@ox.ac.uk`, "Other");
  const a = h.track(await TestClient.connect(url, other));
  const b = h.track(await TestClient.connect(url, cookie));
  a.send({ t: "queue.join", mode: "text" });
  await a.next("queue.waiting");
  b.send({ t: "queue.join", mode: "text" });
  await a.next("match");
  a.send({ t: "call.report", category: "harassment" });
  await a.next("report.received");
  const [row] = (await h.get("/api/admin/reports", admin)).json().reports;
  return row.id as string;
}

describe("device bans", () => {
  it("stops a banned person signing up again from the same browser", async () => {
    const device = "quad_device=device-123";
    const email = "cheater@iitb.ac.in";
    // Sign up with a fixed device cookie.
    await h.app.inject({
      method: "POST",
      url: "/api/auth/otp/request",
      headers: { origin: ORIGIN, cookie: device },
      payload: { email },
    });
    const verify = await h.app.inject({
      method: "POST",
      url: "/api/auth/otp/verify",
      headers: { origin: ORIGIN, cookie: device },
      payload: { email, code: h.lastCode() },
    });
    const session = verify.cookies.find((c) => c.name === "quad_session")?.value;
    const cookie = `${device}; quad_session=${session}`;
    await h.post(
      "/api/onboarding",
      { displayName: "C", dob: "2004-01-01", acceptGuidelines: true },
      cookie,
    );
    await h.get("/api/me", cookie); // records the device

    const id = (await h.get("/api/me", cookie)).json().id;
    await h.post(`/api/admin/users/${id}/ban`, { reason: "Nudity" }, admin);

    const next = "fresh@kyoto-u.ac.jp";
    await h.app.inject({
      method: "POST",
      url: "/api/auth/otp/request",
      headers: { origin: ORIGIN, cookie: device },
      payload: { email: next },
    });
    const blocked = await h.app.inject({
      method: "POST",
      url: "/api/auth/otp/verify",
      headers: { origin: ORIGIN, cookie: device },
      payload: { email: next, code: h.lastCode() },
    });
    expect(blocked.statusCode).toBe(403);
    expect(blocked.json().error.code).toBe("BANNED");
  });
});

describe("evidence retention", () => {
  it("deletes frames and chat excerpts after 30 days but keeps the report", async () => {
    await fileReport();
    h.advance(31 * 24 * 3_600_000);
    const deleted = await runCleanup(h.ctx);
    expect(deleted.reportEvidence).toBe(1);
    expect(await h.ctx.db.select().from(reportEvidence)).toHaveLength(0);
    const [report] = await h.ctx.db.select().from(reports);
    expect(report?.chatExcerpt).toBeNull();
    expect(report?.evidenceClearedAt).not.toBeNull();
  });
});
