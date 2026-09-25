import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { runCleanup } from "../src/jobs/cleanup";
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

describe("retention cleanup", () => {
  it("keeps fresh data", async () => {
    await h.signUp("riya@iitb.ac.in");
    await h.signIn("pending@mit.edu");
    expect(await runCleanup(h.ctx)).toEqual({
      otpCodes: 0,
      sessions: 0,
      unfinishedSignups: 0,
      domainRequests: 0,
      adminActions: 0,
    });
  });

  it("removes old codes, expired sessions and abandoned sign-ups", async () => {
    const active = await h.signUp("riya@iitb.ac.in");
    await h.signIn("pending@mit.edu");
    h.advance(31 * 24 * 3_600_000);
    const deleted = await runCleanup(h.ctx);
    expect(deleted.otpCodes).toBe(2);
    expect(deleted.sessions).toBe(2);
    expect(deleted.unfinishedSignups).toBe(1);

    // The finished account survives; its expired session doesn't.
    const stats = (await h.get("/api/stats")).json();
    expect(stats.students).toBe(1);
    expect((await h.get("/api/me", active)).statusCode).toBe(401);
  });
});
