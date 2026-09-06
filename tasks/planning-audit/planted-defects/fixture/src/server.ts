import { config } from "./config";
import { initSchema } from "./db";
import { deliveryStatsToday, listDeliveries } from "./routes/deliveries";
import { ingestEvent, listEvents } from "./routes/events";
import {
  createWebhookHandler,
  deactivateWebhookHandler,
  getWebhookHandler,
  listWebhooks,
} from "./routes/webhooks";
import { dispatchPendingDeliveries } from "./jobs/dispatcher";
import { retryFailedDeliveries } from "./jobs/retry";
import { requireInternalToken } from "./middleware/auth";

initSchema();

setInterval(() => {
  dispatchPendingDeliveries().catch((err) => console.error("dispatch sweep failed", err));
}, config.dispatchIntervalMs);

setInterval(() => {
  retryFailedDeliveries().catch((err) => console.error("retry sweep failed", err));
}, config.retryIntervalMs);

const WEBHOOK_ID_ROUTE = /^\/webhooks\/([^/]+)$/;

Bun.serve({
  port: config.port,
  async fetch(req) {
    const url = new URL(req.url);

    try {
      if (req.method === "GET" && url.pathname === "/webhooks") {
        return await listWebhooks(req);
      }
      if (req.method === "POST" && url.pathname === "/webhooks") {
        return await createWebhookHandler(req);
      }

      const webhookMatch = url.pathname.match(WEBHOOK_ID_ROUTE);
      if (webhookMatch) {
        const id = webhookMatch[1]!;
        if (req.method === "GET") return await getWebhookHandler(req, id);
        if (req.method === "DELETE") return await deactivateWebhookHandler(req, id);
      }

      if (req.method === "GET" && url.pathname === "/events") {
        return await listEvents(req);
      }
      if (req.method === "POST" && url.pathname === "/events") {
        return await ingestEvent(req);
      }

      if (req.method === "GET" && url.pathname === "/deliveries") {
        return await listDeliveries(req);
      }
      if (req.method === "GET" && url.pathname === "/deliveries/stats/today") {
        return await deliveryStatsToday(req);
      }

      if (req.method === "POST" && url.pathname === "/internal/dispatch-now") {
        requireInternalToken(req);
        await dispatchPendingDeliveries();
        return Response.json({ ok: true });
      }

      return Response.json({ error: "not found" }, { status: 404 });
    } catch (err) {
      // Every error thrown by a route handler — including `ValidationError` (400,
      // client's fault) and `UnauthorizedError`/`NotFoundError` from lib/http.ts, each of
      // which already carries the right `status` — is flattened to a generic 500 here.
      // The `err.status` that HttpError subclasses carry is never read.
      console.error(err);
      return Response.json({ error: "internal server error" }, { status: 500 });
    }
  },
});

console.log(`webhook relay listening on :${config.port}`);
