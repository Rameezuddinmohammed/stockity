import type { ServerMessage } from "@quad/shared";
import WebSocket from "ws";
import { ORIGIN } from "./harness";

type Msg = ServerMessage;

/** A test WebSocket client that buffers messages and lets tests await a specific type. */
export class TestClient {
  readonly messages: Msg[] = [];
  private waiters: { type: string; resolve: (m: Msg) => void; reject: (e: Error) => void }[] = [];
  closeCode: number | null = null;
  private closed: Promise<number>;

  private constructor(readonly ws: WebSocket) {
    ws.on("message", (raw) => {
      const msg = JSON.parse(String(raw)) as Msg;
      const i = this.waiters.findIndex((w) => w.type === msg.t);
      if (i >= 0) {
        const [w] = this.waiters.splice(i, 1);
        w?.resolve(msg);
      } else {
        this.messages.push(msg);
      }
    });
    this.closed = new Promise((resolve) =>
      ws.on("close", (code) => {
        this.closeCode = code;
        for (const w of this.waiters)
          w.reject(new Error(`socket closed (${code}) waiting for ${w.type}`));
        this.waiters = [];
        resolve(code);
      }),
    );
  }

  static async connect(url: string, cookie?: string, origin = ORIGIN): Promise<TestClient> {
    const ws = new WebSocket(url, { headers: { origin, ...(cookie ? { cookie } : {}) } });
    const client = new TestClient(ws);
    await new Promise<void>((resolve, reject) => {
      ws.once("open", () => resolve());
      ws.once("error", reject);
      ws.once("close", () => resolve());
    });
    return client;
  }

  send(msg: object) {
    this.ws.send(JSON.stringify(msg));
  }

  /** Resolves with the next message of this type (including one already buffered). */
  next<T extends Msg["t"]>(type: T, timeoutMs = 3000): Promise<Extract<Msg, { t: T }>> {
    const i = this.messages.findIndex((m) => m.t === type);
    if (i >= 0) return Promise.resolve(this.messages.splice(i, 1)[0] as Extract<Msg, { t: T }>);
    if (this.closeCode !== null)
      return Promise.reject(new Error(`socket closed (${this.closeCode})`));
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.waiters = this.waiters.filter((w) => w.resolve !== done);
        reject(
          new Error(
            `timed out waiting for ${type}; got ${this.messages.map((m) => m.t).join(",")}`,
          ),
        );
      }, timeoutMs);
      const done = (m: Msg) => {
        clearTimeout(timer);
        resolve(m as Extract<Msg, { t: T }>);
      };
      this.waiters.push({ type, resolve: done, reject });
    });
  }

  /** True if no message of this type arrives within the window. */
  async nothing(type: Msg["t"], windowMs = 300) {
    try {
      await this.next(type, windowMs);
      return false;
    } catch {
      return true;
    }
  }

  waitClosed() {
    return this.closed;
  }

  close() {
    this.ws.close();
    return this.closed;
  }
}
