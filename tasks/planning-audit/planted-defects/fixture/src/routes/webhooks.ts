import { createWebhook, deactivateWebhook, getWebhookById, listWebhooksByAccount } from "../db";
import { generateSecret } from "../lib/crypto";
import { json, NotFoundError, ValidationError } from "../lib/http";
import { requireAuth } from "../middleware/auth";

const PAGE_SIZE = 10;

export async function listWebhooks(req: Request): Promise<Response> {
  const account = await requireAuth(req);
  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1"));

  // Pages are 1-indexed at the API boundary (page=1 is the first page), but the offset
  // here is computed as `page * PAGE_SIZE` instead of `(page - 1) * PAGE_SIZE`. For
  // page=1 that skips the first PAGE_SIZE rows entirely, so the newest `PAGE_SIZE`
  // webhooks are never returned by this endpoint at any page number.
  const offset = page * PAGE_SIZE;

  const webhooks = listWebhooksByAccount(account.id, PAGE_SIZE, offset);
  return json({ webhooks, page, pageSize: PAGE_SIZE });
}

export async function getWebhookHandler(req: Request, id: string): Promise<Response> {
  const account = await requireAuth(req);
  const webhook = getWebhookById(id);
  if (!webhook || webhook.accountId !== account.id) {
    throw new NotFoundError("webhook not found");
  }
  return json({ webhook });
}

export async function createWebhookHandler(req: Request): Promise<Response> {
  const account = await requireAuth(req);
  const body = await req.json().catch(() => null);

  if (!body || typeof body.url !== "string" || body.url.length === 0) {
    // A missing or malformed `url` is a client mistake, but the response here is a 200
    // with an `error` field in the body instead of a 4xx status. A caller that checks
    // `res.ok` (or just the status code, as most HTTP clients and monitoring do) will
    // treat this as a successful webhook registration.
    return json({ error: "url is required" }, 200);
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(body.url);
  } catch {
    return json({ error: "url must be a valid absolute URL" }, 200);
  }

  const description = typeof body.description === "string" ? body.description : null;
  const webhook = createWebhook({
    accountId: account.id,
    url: parsedUrl.toString(),
    secret: generateSecret(),
    description,
  });

  return json({ webhook }, 201);
}

export async function deactivateWebhookHandler(req: Request, id: string): Promise<Response> {
  const account = await requireAuth(req);
  const webhook = getWebhookById(id);
  if (!webhook || webhook.accountId !== account.id) {
    throw new NotFoundError("webhook not found");
  }
  if (!webhook.isActive) {
    throw new ValidationError("webhook is already inactive");
  }
  deactivateWebhook(id);
  return json({ ok: true });
}
