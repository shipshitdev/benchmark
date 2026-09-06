# Security & Reliability Audit

## Findings

### 1. SQL Injection via Unparameterized Type Filter (CRITICAL)

**Location:** `src/routes/events.ts:24`

**Summary:** The `type` query parameter is interpolated directly into the SQL query string instead of being bound as a parameter, allowing SQL injection attacks.

**Severity:** CRITICAL — An attacker can extract arbitrary data from any table, modify data, or execute arbitrary SQL by crafting a malicious `type` parameter such as `x' OR '1'='1` or using UNION SELECT to read columns from other tables.

**Fix:** Bind the `type` parameter as a query placeholder, consistent with how `account.id`, `limit`, and `offset` are handled:
```typescript
if (type) {
  query += ` AND type = ?`;
  params.splice(1, 0, type); // Insert after account.id
}
```

---

### 2. Unbounded Authentication Cache with No Invalidation (HIGH)

**Location:** `src/middleware/auth.ts:10, 28`

**Summary:** The `keyCache` Map stores API keys indefinitely with no size limit, no TTL, and no invalidation mechanism. Entries are never removed.

**Severity:** HIGH — This is a memory leak that causes the cache to grow without bound. More critically, if an account rotates its API key, the old key remains valid forever because it's cached, defeating key rotation security.

**Fix:** Implement one of the following:
- Add a max size with LRU eviction (e.g., limit to 10,000 entries)
- Add a TTL with periodic cleanup (e.g., 1-hour expiry)
- Add an explicit invalidation hook (requires changes to account management)

Recommended approach: Add a TTL-based cache with periodic cleanup:
```typescript
const keyCache = new Map<string, { account: Account; expiresAt: number }>();
const CACHE_TTL_MS = 3600000; // 1 hour

export async function requireAuth(req: Request): Promise<Account> {
  const key = req.headers.get("x-api-key");
  if (!key) throw new UnauthorizedError("missing x-api-key header");
  
  const cached = keyCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.account;
  }
  
  const account = getAccountByApiKey(key);
  if (!account) throw new UnauthorizedError("invalid api key");
  
  keyCache.set(key, { account, expiresAt: Date.now() + CACHE_TTL_MS });
  return account;
}

// Clean expired entries periodically (e.g., in server.ts)
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of keyCache.entries()) {
    if (value.expiresAt <= now) keyCache.delete(key);
  }
}, 60000);
```

---

### 3. HTTP Error Status Codes Not Honored (HIGH)

**Location:** `src/server.ts:68-74`

**Summary:** The global error handler catches all exceptions (including `HttpError` subclasses that carry specific status codes like 400, 401, 404) and returns a generic 500 for everything. The `err.status` property is never read.

**Severity:** HIGH — Clients receive incorrect HTTP status codes, breaking standard HTTP semantics:
- Validation errors (400) are reported as server errors (500)
- Authentication failures (401) are reported as server errors (500)
- Resource not found (404) is reported as server errors (500)

This breaks monitoring, client error handling, and HTTP caching.

**Fix:** Check the status property and use it:
```typescript
catch (err) {
  console.error(err);
  const status = err instanceof HttpError ? err.status : 500;
  const message = err instanceof HttpError ? err.message : "internal server error";
  return Response.json({ error: message }, { status });
}
```

---

### 4. Pagination Offset Bug in Webhooks Endpoint (HIGH)

**Location:** `src/routes/webhooks.ts:17`

**Summary:** The pagination offset is calculated as `page * PAGE_SIZE` instead of `(page - 1) * PAGE_SIZE`. This causes the first page to skip the first PAGE_SIZE webhooks entirely, and they are never returned by any page number.

**Severity:** HIGH — Users cannot see their first PAGE_SIZE webhooks through the list API. These webhooks are inaccessible via pagination.

**Fix:** Change line 17 from:
```typescript
const offset = page * PAGE_SIZE;
```
to:
```typescript
const offset = (page - 1) * PAGE_SIZE;
```

---

### 5. Wrong HTTP Status Codes on Validation Errors (MEDIUM)

**Location:** `src/routes/webhooks.ts:41, 48`

**Summary:** When webhook creation validation fails (missing or invalid URL), the response returns HTTP 200 with an error message in the JSON body, instead of HTTP 400. Callers checking `res.ok` or the status code will treat these as successful responses.

**Severity:** MEDIUM — Clients cannot distinguish validation failures from success using standard HTTP semantics. Automated monitoring and retry logic will mishandle these responses.

**Fix:** Return the appropriate error status:
```typescript
return json({ error: "url is required" }, 400);
// and
return json({ error: "url must be a valid absolute URL" }, 400);
```

---

### 6. Unhandled Promise Rejection in Event Ingestion (MEDIUM)

**Location:** `src/routes/events.ts:58`

**Summary:** The call to `dispatchPendingDeliveries()` is neither awaited nor given a `.catch()` handler. If dispatch fails (database lock, malformed webhook URL from `new URL()`, etc.), the rejection is unhandled and silently ignored. The event is created but never dispatched.

**Severity:** MEDIUM — Events are created successfully but fail to dispatch with no error signal. Users see successful event creation but deliveries never happen. Errors are invisible and cause silent data loss.

**Fix:** Either await and handle errors, or add a catch handler:
```typescript
// Option 1: Await and handle
try {
  await dispatchPendingDeliveries();
} catch (err) {
  console.error("failed to dispatch events immediately", err);
  // Fall back to scheduled sweep
}

// Option 2: Fire-and-forget with error logging
dispatchPendingDeliveries().catch((err) => 
  console.error("failed to dispatch events immediately", err)
);
```

---

### 7. N+1 Query Problem in Delivery List Enrichment (MEDIUM)

**Location:** `src/routes/deliveries.ts:19-22`

**Summary:** For each delivery in a page of results, the code performs a separate database query to fetch the associated webhook. A single page of PAGE_SIZE=25 deliveries results in 1 + 25 = 26 queries instead of 1.

**Severity:** MEDIUM — Performance degrades linearly with page size and account activity. High-activity accounts with large deliveries lists will experience slow list responses and excessive database load.

**Fix:** Join the webhook table in the original query in `db.ts`:
```typescript
export function listDeliveriesByAccountWithWebhooks(accountId: string, limit: number, offset: number): Array<Delivery & { webhookUrl: string | null }> {
  const rows = getDb()
    .query(
      `SELECT d.*, w.url as webhook_url FROM deliveries d
       JOIN events e ON e.id = d.event_id
       LEFT JOIN webhooks w ON w.id = d.webhook_id
       WHERE e.account_id = ?
       ORDER BY d.created_at DESC
       LIMIT ? OFFSET ?`,
    )
    .all(accountId, limit, offset) as Array<DeliveryRow & { webhook_url: string | null }>;
  return rows.map(row => ({
    ...rowToDelivery(row),
    webhookUrl: row.webhook_url,
  }));
}
```

Then in `src/routes/deliveries.ts`:
```typescript
const enriched = listDeliveriesByAccountWithWebhooks(account.id, PAGE_SIZE, offset);
return json({ deliveries: enriched, page, pageSize: PAGE_SIZE });
```

---

### 8. Timezone Bug in "Today" Boundary Calculation (MEDIUM)

**Location:** `src/routes/deliveries.ts:36-37`

**Summary:** The code uses `new Date().setHours(0, 0, 0, 0)` to calculate the start of the day, but `setHours()` operates on the server's local timezone, not UTC. Since `deliveries.created_at` is stored as UTC ISO-8601 timestamps, the boundary misaligns whenever the server's timezone offset is non-zero.

**Severity:** MEDIUM — Depending on the server's timezone:
- If offset > 0, deliveries from the start of the UTC day are miscounted as "yesterday"
- If offset < 0, deliveries from the end of the UTC day are miscounted as "tomorrow"
- Only servers in UTC timezone have correct results

**Fix:** Calculate midnight UTC instead:
```typescript
const startOfDay = new Date(Date.now());
startOfDay.setUTCHours(0, 0, 0, 0);
```

Or use a utility that always works:
```typescript
const now = new Date();
const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
```

---

### 9. Invalid Environment Variable Parsing (MEDIUM)

**Location:** `src/config.ts:2, 11-15`

**Summary:** The code uses `Number(process.env.PORT ?? 3000)` and similar patterns. If an environment variable is set to a non-numeric string, `Number()` returns `NaN`, which causes runtime errors or unexpected behavior (NaN comparisons, NaN in JSON, etc.).

**Severity:** MEDIUM — Misconfigured deployments with invalid PORT, DISPATCH_INTERVAL_MS, or other numeric config values will fail at runtime instead of failing fast at startup.

**Fix:** Validate environment variables at startup:
```typescript
function parseEnvNumber(name: string, defaultValue: number): number {
  const value = process.env[name];
  if (value === undefined) return defaultValue;
  const parsed = Number(value);
  if (isNaN(parsed)) {
    throw new Error(`Invalid ${name}: expected a number, got "${value}"`);
  }
  return parsed;
}

export const config = {
  port: parseEnvNumber("PORT", 3000),
  dbPath: process.env.DB_PATH ?? "relay.db",
  internalToken: process.env.INTERNAL_TOKEN ?? "dev-internal-token",
  dispatchIntervalMs: parseEnvNumber("DISPATCH_INTERVAL_MS", 5000),
  retryIntervalMs: parseEnvNumber("RETRY_INTERVAL_MS", 15000),
  maxDeliveryAttempts: parseEnvNumber("MAX_DELIVERY_ATTEMPTS", 5),
  webhookTimeoutMs: parseEnvNumber("WEBHOOK_TIMEOUT_MS", 8000),
};
```

---

## Remediation Plan

### Phase 1: Critical Security Fix (Deploy First)
1. **Fix SQL Injection (Finding #1)** — Parameterize the `type` filter in events.ts
   - This is a security breach and should be fixed immediately
   - No dependencies on other fixes
   - No production migration required

### Phase 2: High-Priority Fixes (Deploy Together)
2. **Fix HTTP Error Status Codes (Finding #3)** — Use err.status in global error handler
   - Depends on: Nothing
   - **Then also fix:** Wrong HTTP Status Codes (Finding #5) — webhooks validation should return 400, not 200
   - These work together to restore proper HTTP semantics
   - No production migration required

3. **Fix Pagination Bug (Finding #4)** — Correct webhook list offset calculation
   - Depends on: Nothing
   - No production migration required, but clients may need to re-fetch list after fix

4. **Fix Auth Cache Invalidation (Finding #2)** — Add TTL to keyCache
   - Depends on: Nothing
   - Must be deployed before any account key rotation procedure is documented
   - No production migration required

### Phase 3: Data Correctness Fixes (Deploy Together)
5. **Fix Unhandled Promise (Finding #6)** — Add error handling to dispatch call in events.ts
   - Depends on: Nothing
   - Deploy early to start logging dispatch failures
   - No production migration required

6. **Fix Timezone Bug (Finding #8)** — Use UTC midnight for "today" calculation
   - Depends on: Nothing
   - Only affects `/deliveries/stats/today` endpoint
   - No production migration required (historical data unaffected)

### Phase 4: Performance Optimization (Can Deploy Any Time After Phase 2)
7. **Fix N+1 Query (Finding #7)** — Join webhooks in listDeliveriesByAccount query
   - Depends on: Nothing
   - Low risk optimization
   - No production migration required

8. **Fix Environment Variable Parsing (Finding #9)** — Add startup validation
   - Depends on: Nothing
   - Should be deployed early to catch misconfigurations faster
   - No production migration required (fails fast at startup)

### Suggested Deployment Order
1. Deploy Phase 1 (SQL injection fix) immediately
2. Deploy Phase 2 together (status codes + auth cache + pagination)
3. Deploy Phase 3 together (promise handling + timezone)
4. Deploy Phase 4 in a follow-up (performance + startup validation)

**No complex coordination required:** None of these fixes require coordinated rollouts, feature flags, or production data migrations. All can be deployed as standard code changes.

---

## Summary

| Issue | Severity | Type | Impact |
|-------|----------|------|--------|
| SQL Injection | CRITICAL | Security | Data breach, full database compromise |
| Auth Cache | HIGH | Reliability | Memory leak, broken key rotation |
| Status Codes | HIGH | Correctness | Wrong error responses to clients |
| Pagination Bug | HIGH | Correctness | Users can't access first PAGE_SIZE webhooks |
| Validation Status | MEDIUM | Correctness | Clients see 200 on validation errors |
| Promise Rejection | MEDIUM | Reliability | Silent event delivery failures |
| N+1 Queries | MEDIUM | Performance | Linear slowdown with activity |
| Timezone Bug | MEDIUM | Correctness | Wrong "today" boundary on non-UTC servers |
| Config Parsing | MEDIUM | Reliability | NaN crashes on invalid env vars |

Total: 9 findings (1 critical, 2 high, 6 medium)
