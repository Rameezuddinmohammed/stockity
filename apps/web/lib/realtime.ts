import type { ClientMessage, ServerMessage } from "@quad/shared";

type Listener = (msg: ServerMessage) => void;

export const wsUrl = () =>
  process.env.NEXT_PUBLIC_WS_URL ??
  `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/api/ws`;

/** Thin wrapper over the /api/ws socket: typed send/receive plus close notifications. */
export class RealtimeClient {
  private ws: WebSocket | null = null;
  private listeners = new Set<Listener>();
  private closeListeners = new Set<(code: number) => void>();
  private outbox: ClientMessage[] = [];

  connect() {
    if (this.ws && this.ws.readyState <= WebSocket.OPEN) return;
    const ws = new WebSocket(wsUrl());
    this.ws = ws;
    ws.onopen = () => {
      for (const msg of this.outbox.splice(0)) ws.send(JSON.stringify(msg));
    };
    ws.onmessage = (ev) => {
      const msg = JSON.parse(String(ev.data)) as ServerMessage;
      for (const l of this.listeners) l(msg);
    };
    ws.onclose = (ev) => {
      if (this.ws === ws) this.ws = null;
      for (const l of this.closeListeners) l(ev.code);
    };
  }

  send(msg: ClientMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
    else {
      this.outbox.push(msg);
      this.connect();
    }
  }

  on(listener: Listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  onClose(listener: (code: number) => void) {
    this.closeListeners.add(listener);
    return () => this.closeListeners.delete(listener);
  }

  close() {
    this.outbox = [];
    this.ws?.close(1000);
    this.ws = null;
  }
}
