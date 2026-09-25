import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { calls, reports } from "../src/db/schema";
import { botReply } from "../src/realtime/bot";
import { createHarness, type Harness } from "./harness";
import { TestClient } from "./ws-client";

describe("Quad Bot replies", () => {
  const first = () => 0;
  it("admits it's a bot", () => {
    expect(botReply("wait are you a bot?", first).text).toMatch(/robot/);
  });
  it("rickrolls on request", () => {
    expect(botReply("play some music", first)).toMatchObject({ scene: "rickroll" });
  });
  it("sends memes when asked for jokes", () => {
    expect(botReply("tell me a joke lol", first).scene).toBe("meme");
  });
  it("greets back", () => {
    expect(botReply("heyy", first).text).toMatch(/studying/);
  });
  it("always has something to say", () => {
    expect(botReply("asdfgh", first).text.length).toBeGreaterThan(5);
    expect(botReply("why is the sky blue?", first).text.length).toBeGreaterThan(5);
  });
});

let h: Harness;
let url: string;
beforeAll(async () => {
  h = await createHarness();
  url = await h.listen();
});
beforeEach(async () => {
  await h.reset();
});
afterAll(async () => {
  await h.close();
});

async function connect() {
  const cookie = await h.signUp("riya@iitb.ac.in", "Riya");
  const client = h.track(await TestClient.connect(url, cookie));
  await client.next("hello");
  return client;
}

describe("practice chat with Quad Bot", () => {
  it("matches instantly with a clearly labelled bot that says hi", async () => {
    const c = await connect();
    c.send({ t: "bot.start", mode: "video" });
    const match = await c.next("match");
    expect(match.peer).toMatchObject({ displayName: "Quad Bot", bot: true });
    expect((await c.next("chat.msg")).text.length).toBeGreaterThan(0);
    expect((await c.next("bot.scene")).scene).toBe("robot");
    const [row] = await h.ctx.db.select().from(calls).where(eq(calls.id, match.callId));
    expect(row).toMatchObject({ mode: "video", userB: null });
  });

  it("answers messages and rickrolls on request", async () => {
    const c = await connect();
    c.send({ t: "bot.start", mode: "text" });
    await c.next("match");
    await c.next("chat.msg");
    expect((await c.next("bot.scene")).scene).toBe("robot");
    c.send({ t: "chat.send", clientId: "1", text: "play me a song" });
    await c.next("chat.ack");
    await c.next("chat.typing");
    expect((await c.next("chat.msg")).text).toMatch(/./);
    expect((await c.next("bot.scene")).scene).toBe("rickroll");
  });

  it("leaves the bot with Next and can then join the real queue", async () => {
    const c = await connect();
    c.send({ t: "bot.start", mode: "video" });
    await c.next("match");
    c.send({ t: "call.next" });
    expect(await c.next("call.ended")).toMatchObject({ reason: "next", by: "you" });
    c.send({ t: "queue.join", mode: "video" });
    await c.next("queue.waiting");
  });

  it("never files reports or nudity flags against the bot", async () => {
    const c = await connect();
    c.send({ t: "bot.start", mode: "video" });
    await c.next("match");
    c.send({ t: "nsfw.flag", score: 0.99 });
    c.send({ t: "call.report", category: "other" });
    expect((await c.next("call.ended")).by).toBe("you");
    expect(await h.ctx.db.select().from(reports)).toHaveLength(0);
  });
});
