import { Database } from "bun:sqlite";
import { config } from "./config";
import { generateId } from "./lib/crypto";
import type { Account, Delivery, DeliveryStats, Event, Webhook } from "./types";

interface AccountRow {
  id: string;
  name: string;
  api_key: string;
  created_at: string;
}

interface WebhookRow {
  id: string;
  account_id: string;
  url: string;
  secret: string;
  description: string | null;
  is_active: number;
  created_at: string;
}

interface EventRow {
  id: string;
  account_id: string;
  type: string;
  payload: string;
  created_at: string;
}

interface DeliveryRow {
  id: string;
  event_id: string;
  webhook_id: string;
  status: string;
  attempt_count: number;
  response_status: number | null;
  last_attempt_at: string | null;
  next_attempt_at: string | null;
  created_at: string;
}

interface DeliveryStatusCountRow {
  status: string;
  count: number;
}

let db: Database | null = null;

export function getDb(): Database {
  if (!db) {
    db = new Database(config.dbPath, { create: true });
    db.exec("PRAGMA journal_mode = WAL;");
  }
  return db;
}

export function initSchema(): void {
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      api_key TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS webhooks (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      url TEXT NOT NULL,
      secret TEXT NOT NULL,
      description TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      type TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS deliveries (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL,
      webhook_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      attempt_count INTEGER NOT NULL DEFAULT 0,
      response_status INTEGER,
      last_attempt_at TEXT,
      next_attempt_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_deliveries_status ON deliveries(status);
    CREATE INDEX IF NOT EXISTS idx_events_account ON events(account_id);
    CREATE INDEX IF NOT EXISTS idx_webhooks_account ON webhooks(account_id);
  `);
}

function rowToAccount(row: AccountRow): Account {
  return { id: row.id, name: row.name, apiKey: row.api_key, createdAt: row.created_at };
}

function rowToWebhook(row: WebhookRow): Webhook {
  return {
    id: row.id,
    accountId: row.account_id,
    url: row.url,
    secret: row.secret,
    description: row.description,
    isActive: !!row.is_active,
    createdAt: row.created_at,
  };
}

function rowToEvent(row: EventRow): Event {
  return { id: row.id, accountId: row.account_id, type: row.type, payload: row.payload, createdAt: row.created_at };
}

function rowToDelivery(row: DeliveryRow): Delivery {
  return {
    id: row.id,
    eventId: row.event_id,
    webhookId: row.webhook_id,
    status: row.status as Delivery["status"],
    attemptCount: row.attempt_count,
    responseStatus: row.response_status,
    lastAttemptAt: row.last_attempt_at,
    nextAttemptAt: row.next_attempt_at,
    createdAt: row.created_at,
  };
}

export function getAccountByApiKey(apiKey: string): Account | null {
  const row = getDb().query("SELECT * FROM accounts WHERE api_key = ?").get(apiKey) as AccountRow | null;
  return row ? rowToAccount(row) : null;
}

export function createWebhook(input: {
  accountId: string;
  url: string;
  secret: string;
  description: string | null;
}): Webhook {
  const id = generateId("wh");
  const createdAt = new Date().toISOString();
  getDb()
    .query(
      "INSERT INTO webhooks (id, account_id, url, secret, description, is_active, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)",
    )
    .run(id, input.accountId, input.url, input.secret, input.description, createdAt);
  return { id, accountId: input.accountId, url: input.url, secret: input.secret, description: input.description, isActive: true, createdAt };
}

export function listWebhooksByAccount(accountId: string, limit: number, offset: number): Webhook[] {
  const rows = getDb()
    .query("SELECT * FROM webhooks WHERE account_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?")
    .all(accountId, limit, offset) as WebhookRow[];
  return rows.map(rowToWebhook);
}

export function listActiveWebhooksByAccount(accountId: string): Webhook[] {
  const rows = getDb()
    .query("SELECT * FROM webhooks WHERE account_id = ? AND is_active = 1")
    .all(accountId) as WebhookRow[];
  return rows.map(rowToWebhook);
}

export function getWebhookById(id: string): Webhook | null {
  const row = getDb().query("SELECT * FROM webhooks WHERE id = ?").get(id) as WebhookRow | null;
  return row ? rowToWebhook(row) : null;
}

export function deactivateWebhook(id: string): void {
  getDb().query("UPDATE webhooks SET is_active = 0 WHERE id = ?").run(id);
}

export function createEvent(input: { accountId: string; type: string; payload: string }): Event {
  const id = generateId("evt");
  const createdAt = new Date().toISOString();
  getDb()
    .query("INSERT INTO events (id, account_id, type, payload, created_at) VALUES (?, ?, ?, ?, ?)")
    .run(id, input.accountId, input.type, input.payload, createdAt);
  return { id, accountId: input.accountId, type: input.type, payload: input.payload, createdAt };
}

export function getEventById(id: string): Event | null {
  const row = getDb().query("SELECT * FROM events WHERE id = ?").get(id) as EventRow | null;
  return row ? rowToEvent(row) : null;
}

export function createDeliveriesForActiveWebhooks(eventId: string, accountId: string): void {
  const webhooks = listActiveWebhooksByAccount(accountId);
  const createdAt = new Date().toISOString();
  const insert = getDb().query(
    "INSERT INTO deliveries (id, event_id, webhook_id, status, created_at) VALUES (?, ?, ?, 'pending', ?)",
  );
  for (const webhook of webhooks) {
    insert.run(generateId("dlv"), eventId, webhook.id, createdAt);
  }
}

export function listPendingDeliveries(limit: number): Delivery[] {
  const rows = getDb()
    .query("SELECT * FROM deliveries WHERE status = 'pending' ORDER BY created_at ASC LIMIT ?")
    .all(limit) as DeliveryRow[];
  return rows.map(rowToDelivery);
}

export function markSending(id: string): void {
  getDb().query("UPDATE deliveries SET status = 'sending' WHERE id = ?").run(id);
}

export function markDelivered(id: string, responseStatus: number): void {
  const now = new Date().toISOString();
  getDb()
    .query("UPDATE deliveries SET status = 'delivered', response_status = ?, last_attempt_at = ? WHERE id = ?")
    .run(responseStatus, now, id);
}

export function markFailed(id: string, responseStatus: number, attemptCount = 0): void {
  const now = new Date().toISOString();
  const backoffMs = 60_000 * (attemptCount + 1);
  const nextAttempt = new Date(Date.now() + backoffMs).toISOString();
  getDb()
    .query(
      `UPDATE deliveries
       SET status = 'failed', response_status = ?, attempt_count = ?, last_attempt_at = ?, next_attempt_at = ?
       WHERE id = ?`,
    )
    .run(responseStatus, attemptCount, now, nextAttempt, id);
}

export function listDeliveriesByAccount(accountId: string, limit: number, offset: number): Delivery[] {
  const rows = getDb()
    .query(
      `SELECT d.* FROM deliveries d
       JOIN events e ON e.id = d.event_id
       WHERE e.account_id = ?
       ORDER BY d.created_at DESC
       LIMIT ? OFFSET ?`,
    )
    .all(accountId, limit, offset) as DeliveryRow[];
  return rows.map(rowToDelivery);
}

export function countDeliveriesByStatusSince(accountId: string, sinceIso: string): DeliveryStats {
  const rows = getDb()
    .query(
      `SELECT d.status as status, COUNT(*) as count FROM deliveries d
       JOIN events e ON e.id = d.event_id
       WHERE e.account_id = ? AND d.created_at >= ?
       GROUP BY d.status`,
    )
    .all(accountId, sinceIso) as DeliveryStatusCountRow[];
  const stats: DeliveryStats = { pending: 0, sending: 0, delivered: 0, failed: 0 };
  for (const row of rows) {
    stats[row.status as keyof DeliveryStats] = row.count;
  }
  return stats;
}

/**
 * Deliveries eligible for a retry sweep. Includes rows still marked `sending` because a
 * delivery can get stuck there if the process dies between the outbound `fetch` in
 * jobs/dispatcher.ts and the `markDelivered` call that follows it — see jobs/retry.ts for
 * why treating those the same as `failed` is not safe.
 */
export function listRetryableDeliveries(nowIso: string, maxAttempts: number): Delivery[] {
  const rows = getDb()
    .query(
      `SELECT * FROM deliveries
       WHERE status IN ('failed', 'sending')
         AND attempt_count < ?
         AND (next_attempt_at IS NULL OR next_attempt_at <= ?)
       ORDER BY next_attempt_at ASC
       LIMIT 50`,
    )
    .all(maxAttempts, nowIso) as DeliveryRow[];
  return rows.map(rowToDelivery);
}
