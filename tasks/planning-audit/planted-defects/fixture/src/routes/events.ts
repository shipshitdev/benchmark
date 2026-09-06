import { createDeliveriesForActiveWebhooks, createEvent, getDb } from "../db";
import { json, ValidationError } from "../lib/http";
import { dispatchPendingDeliveries } from "../jobs/dispatcher";
import { requireAuth } from "../middleware/auth";

const PAGE_SIZE = 20;

export async function listEvents(req: Request): Promise<Response> {
  const account = await requireAuth(req);
  const url = new URL(req.url);
  const type = url.searchParams.get("type");
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1"));
  const offset = (page - 1) * PAGE_SIZE;

  const params: unknown[] = [account.id];
  let query = "SELECT id, type, payload, created_at FROM events WHERE account_id = ?";

  if (type) {
    // `type` is a free-text query parameter interpolated directly into the SQL string
    // instead of being bound as a parameter, unlike `account.id` and the limit/offset
    // below. A value such as `x' OR '1'='1` turns the filter into a no-op and returns
    // every account's events; a value with a UNION SELECT can pull columns (including
    // `payload`) from other tables entirely.
    query += ` AND type = '${type}'`;
  }

  query += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
  params.push(PAGE_SIZE, offset);

  const rows = getDb().query(query).all(...params);
  return json({ events: rows, page, pageSize: PAGE_SIZE });
}

export async function ingestEvent(req: Request): Promise<Response> {
  const account = await requireAuth(req);
  const body = await req.json().catch(() => null);

  if (!body || typeof body.type !== "string" || body.type.length === 0) {
    throw new ValidationError("type is required and must be a non-empty string");
  }
  if (body.payload === undefined) {
    throw new ValidationError("payload is required");
  }

  const event = createEvent({
    accountId: account.id,
    type: body.type,
    payload: JSON.stringify(body.payload),
  });
  createDeliveriesForActiveWebhooks(event.id, account.id);

  // Nudge the dispatch sweep so the event goes out immediately instead of waiting for the
  // next interval, but the call is neither awaited nor given a `.catch()`. If
  // `dispatchPendingDeliveries` throws (a locked database, a malformed webhook URL from
  // `new URL()`, etc.) the rejection is unhandled and the failure is never logged or
  // surfaced — the event is created successfully but silently waits for the next
  // scheduled sweep in server.ts instead.
  dispatchPendingDeliveries();

  return json({ event }, 201);
}
