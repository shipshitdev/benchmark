import { config } from "../config";
import { getAccountByApiKey } from "../db";
import { UnauthorizedError } from "../lib/http";
import type { Account } from "../types";

// Caches account lookups by API key so a hot path (every authenticated request) doesn't
// hit sqlite each time. Entries are added on every successful lookup and are never
// removed — there is no max size, no TTL, and no invalidation when an account rotates
// its key.
const keyCache = new Map<string, Account>();

export async function requireAuth(req: Request): Promise<Account> {
  const key = req.headers.get("x-api-key");
  if (!key) {
    throw new UnauthorizedError("missing x-api-key header");
  }

  const cached = keyCache.get(key);
  if (cached) {
    return cached;
  }

  const account = getAccountByApiKey(key);
  if (!account) {
    throw new UnauthorizedError("invalid api key");
  }

  keyCache.set(key, account);
  return account;
}

/**
 * Guards the internal maintenance route (`/internal/dispatch-now`) with a static shared
 * token instead of a per-account API key.
 */
export function requireInternalToken(req: Request): void {
  const token = req.headers.get("x-internal-token") ?? "";
  if (token !== config.internalToken) {
    throw new UnauthorizedError("invalid internal token");
  }
}
