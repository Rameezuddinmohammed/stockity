import cookie from "@fastify/cookie";
import websocket from "@fastify/websocket";
import type { ApiError } from "@quad/shared";
import Fastify from "fastify";
import { registerAuth } from "./auth";
import type { Ctx } from "./context";
import { AppError } from "./lib/errors";
import { Hub } from "./realtime/hub";
import { adminRoutes } from "./routes/admin";
import { authRoutes } from "./routes/auth";
import { domainRequestRoutes } from "./routes/domain-requests";
import { meRoutes } from "./routes/me";
import { reportRoutes } from "./routes/reports";
import { statsRoutes } from "./routes/stats";
import { registerDevices } from "./safety/devices";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export async function buildApp(ctx: Ctx, opts: { logger?: boolean } = {}) {
  const app = Fastify({
    logger: opts.logger ?? false,
    trustProxy: ctx.config.TRUST_PROXY,
    bodyLimit: 64 * 1024,
  });

  // Only JSON bodies: a cross-site <form> can post text/plain without a CORS preflight.
  app.removeContentTypeParser("text/plain");

  // CSRF: state-changing requests must come from our own web origin.
  app.addHook("onRequest", async (req) => {
    if (SAFE_METHODS.has(req.method)) return;
    const origin = req.headers.origin;
    const fetchSite = req.headers["sec-fetch-site"];
    if ((origin && origin !== ctx.config.APP_ORIGIN) || fetchSite === "cross-site") {
      throw new AppError(403, "BAD_ORIGIN", "Request blocked.");
    }
  });

  await app.register(cookie);
  await app.register(websocket, { options: { maxPayload: 256 * 1024 } });
  registerAuth(app, ctx);
  registerDevices(app, ctx);

  const hub = new Hub(ctx, app.log);
  hub.start();
  app.addHook("onClose", () => hub.stop());

  app.setErrorHandler((err, req, reply) => {
    if (err instanceof AppError) {
      const body: ApiError = { error: { code: err.code, message: err.message } };
      if (err.details !== undefined) body.error.details = err.details;
      const retry = (err.details as { retryAfterSeconds?: number } | undefined)?.retryAfterSeconds;
      if (retry) reply.header("Retry-After", String(retry));
      return reply.code(err.status).send(body);
    }
    const status = (err as { statusCode?: number }).statusCode ?? 500;
    if (status >= 500) req.log.error({ err }, "unhandled error");
    const message =
      status >= 500 ? "Something went wrong on our side. Try again?" : (err as Error).message;
    return reply
      .code(status)
      .send({ error: { code: status >= 500 ? "INTERNAL" : "VALIDATION", message } });
  });

  app.setNotFoundHandler((_req, reply) =>
    reply.code(404).send({ error: { code: "NOT_FOUND", message: "Not found." } }),
  );

  app.get("/api/health", async () => ({ ok: true }));
  app.get("/api/ws", { websocket: true }, (socket, req) => {
    hub.accept(socket, req).catch((err) => {
      req.log.error({ err }, "websocket accept failed");
      socket.close(1011, "server error");
    });
  });
  authRoutes(app, ctx, hub);
  meRoutes(app, ctx, hub);
  domainRequestRoutes(app, ctx);
  adminRoutes(app, ctx, hub);
  reportRoutes(app, ctx, hub);
  statsRoutes(app, ctx);

  return Object.assign(app, { hub });
}
