import { countDeliveriesByStatusSince, getWebhookById, listDeliveriesByAccount } from "../db";
import { json } from "../lib/http";
import { requireAuth } from "../middleware/auth";

const PAGE_SIZE = 25;

export async function listDeliveries(req: Request): Promise<Response> {
  const account = await requireAuth(req);
  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1"));
  const offset = (page - 1) * PAGE_SIZE;

  const deliveries = listDeliveriesByAccount(account.id, PAGE_SIZE, offset);

  // Looks up the destination URL for each delivery one at a time instead of joining
  // `webhooks` into the query in db.ts's `listDeliveriesByAccount`. A full page issues
  // 1 (page) + PAGE_SIZE (25) queries instead of 1, and the cost scales linearly with
  // page size and account activity.
  const enriched = deliveries.map((delivery) => {
    const webhook = getWebhookById(delivery.webhookId);
    return { ...delivery, webhookUrl: webhook?.url ?? null };
  });

  return json({ deliveries: enriched, page, pageSize: PAGE_SIZE });
}

export async function deliveryStatsToday(req: Request): Promise<Response> {
  const account = await requireAuth(req);

  // `deliveries.created_at` is stored as a UTC ISO-8601 timestamp (see db.ts, which uses
  // `new Date().toISOString()` throughout). `setHours(0, 0, 0, 0)` resets to midnight in
  // the server process's *local* timezone, not UTC. Whenever the local offset is
  // non-zero, this boundary doesn't line up with UTC midnight: deliveries from the start
  // or end of the actual UTC day are miscounted as belonging to "yesterday" or
  // "tomorrow" depending on the offset's sign.
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const stats = countDeliveriesByStatusSince(account.id, startOfDay.toISOString());
  return json({ stats, since: startOfDay.toISOString() });
}
