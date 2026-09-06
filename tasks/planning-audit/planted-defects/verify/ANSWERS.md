# Answer key: 10 planted defects

Private grading reference for `tasks/planning-audit/planted-defects`. Never shown to the
agent under test and never copied into a run directory. Cross-checked 1:1 against
`checklist.yaml` (same 10 ids, same files, same line numbers).

All line numbers are current against `fixture/src/**` as written for this task.

---

## 1. SQL injection via string interpolation — Security

**File / lines:** `src/routes/events.ts`, line 24 (the vulnerable statement), inside
`listEvents` (lines 8-32).

```ts
if (type) {
  query += ` AND type = '${type}'`;
}
```

**Why it's real:** `type` comes straight from `url.searchParams.get("type")`, i.e. an
unauthenticated request's own query string, and is spliced into the SQL text. Everything
else in the same query (`account_id`, `LIMIT`, `OFFSET`) is bound via `?` placeholders
through `getDb().query(query).all(...params)` (line 30) — only this one field skips the
parameterized path. A request like `GET /events?type=x' OR '1'='1` turns the filter into
a tautology and returns every account's events, not just the caller's; a `type` value
using `UNION SELECT` can pull arbitrary columns from other tables (e.g. `accounts.api_key`
or another account's `payload`).

**Severity:** Critical. It is a cross-tenant data exposure and full read access to the
`events` table (and, via UNION, arguably any table) directly reachable by any caller who
already holds one valid API key. There is no secondary control (e.g. row-level
permission check after the query) that limits the blast radius.

**Fix:** Bind `type` as a parameter instead of interpolating it:

```ts
if (type) {
  query += " AND type = ?";
  params.splice(1, 0, type); // insert after account_id, before LIMIT/OFFSET
}
```

or, simpler, build the params array in the same order the clauses are appended (push
`type` right after the `if` block instead of pushing `PAGE_SIZE`/`offset` at the end
unconditionally). Either way, no request-controlled value should ever be spliced into
the `query` string.

---

## 2. Timing-unsafe internal token comparison — Security

**File / lines:** `src/middleware/auth.ts`, line 38, inside `requireInternalToken`
(lines 36-41).

```ts
if (token !== config.internalToken) {
```

**Why it's real:** `!==` on strings in V8 compares byte-by-byte and returns as soon as a
mismatch is found, so the time taken leaks how many leading bytes of `token` matched
`config.internalToken`. That is a classic timing side-channel: an attacker who can make
enough requests and measure response latency precisely enough can recover the token
byte-by-byte, far faster than brute-forcing the whole secret. The codebase already has
the right tool for this — `safeCompare` in `src/lib/crypto.ts` (lines 22-29), documented
specifically for "comparing a caller-supplied credential against a stored value" — but
`requireInternalToken` doesn't use it, unlike (implicitly) how a signing-secret
comparison should be done.

**Severity:** High. `/internal/dispatch-now` is the only route this guards, so the
practical exposure is one operator-only endpoint, not the whole account/API-key auth
path (`requireAuth`, which correctly looks up the account by exact key match in SQL and
never compares the raw key with `===`). Still, a timing attack that recovers
`internalToken` gives an outside caller the ability to trigger dispatch sweeps at will,
so it is not a low-severity nit.

**Fix:** Reuse the existing helper:

```ts
import { safeCompare } from "../lib/crypto";
...
if (!safeCompare(token, config.internalToken)) {
  throw new UnauthorizedError("invalid internal token");
}
```

---

## 3. Pagination off-by-one in webhook listing — Correctness

**File / lines:** `src/routes/webhooks.ts`, line 17, inside `listWebhooks` (lines 8-21).

```ts
const page = Math.max(1, Number(url.searchParams.get("page") ?? "1"));
...
const offset = page * PAGE_SIZE;
```

**Why it's real:** The API is 1-indexed (`page` defaults to `"1"` and is clamped to a
minimum of 1 via `Math.max(1, ...)`), so page 1 should mean "the first `PAGE_SIZE` rows,"
i.e. `OFFSET 0`. Using `offset = page * PAGE_SIZE` instead of
`(page - 1) * PAGE_SIZE` means page 1 requests `OFFSET 10` (with `PAGE_SIZE = 10`),
page 2 requests `OFFSET 20`, and so on — every page is shifted forward by one full page.
The most recently created `PAGE_SIZE` webhooks (rows 1-10 in `created_at DESC` order)
are never returned by this endpoint at any page number; they are permanently
unreachable through `GET /webhooks`. The sibling endpoints (`listEvents` in
`routes/events.ts` line 13, `listDeliveries` in `routes/deliveries.ts` line 11) both use
the correct `(page - 1) * PAGE_SIZE` formula, which is why this specific file is the
outlier and confirms the intended formula.

**Severity:** Medium. It's a client-visible data-completeness bug (missing webhooks in a
management UI or CLI) rather than a security or data-loss issue — the rows are never
actually lost from the database, only unreachable through this one list endpoint (they
are still visible via `GET /webhooks/:id` if the id is already known).

**Fix:** `const offset = (page - 1) * PAGE_SIZE;`

---

## 4. UTC-stored timestamps compared against a local-time boundary — Correctness

**File / lines:** `src/routes/deliveries.ts`, lines 36-37, inside `deliveryStatsToday`
(lines 27-41).

```ts
const startOfDay = new Date();
startOfDay.setHours(0, 0, 0, 0);
```

**Why it's real:** Every timestamp written to the `deliveries` table is
`new Date().toISOString()` (see `src/db.ts`: `markDelivered` line 218, `markFailed`
line 225, `createDeliveriesForActiveWebhooks` line 197) — i.e. UTC, ISO-8601.
`Date.prototype.setHours` mutates the `Date` in the **process's local
timezone**, not UTC. `startOfDay.toISOString()` (used both as the query bound in
`countDeliveriesByStatusSince` and echoed back in the response's `since` field) is then
midnight local time re-expressed as a UTC instant — which is not the same instant as UTC
midnight unless the process happens to run with a UTC local offset. In any other
timezone (which is the deployment default virtually everywhere outside a container
explicitly pinned to `TZ=UTC`), a comparison like `d.created_at >= ?` in
`countDeliveriesByStatusSince` (`src/db.ts`) either double-counts or under-counts
deliveries near the day boundary relative to what "today" means in UTC — e.g. in
`UTC-7`, "today" per this code starts 7 hours into the actual UTC day, so the stats
silently exclude the first 7 hours of genuine UTC-today deliveries and instead include
the last 7 hours of UTC-yesterday.

**Severity:** Medium. It's a silent correctness bug in a reporting endpoint (wrong
counts, no error), not a security or availability issue, but it would mislead anyone
using `/deliveries/stats/today` to monitor delivery health, especially right around
midnight UTC.

**Fix:** Compute the boundary in UTC instead of local time, e.g.:

```ts
const now = new Date();
const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
```

---

## 5. N+1 query when listing deliveries — Performance

**File / lines:** `src/routes/deliveries.ts`, line 20, inside `listDeliveries` (lines
7-25); the missing join lives in `listDeliveriesByAccount` in `src/db.ts`
(lines 237-248).

```ts
const enriched = deliveries.map((delivery) => {
  const webhook = getWebhookById(delivery.webhookId);
  return { ...delivery, webhookUrl: webhook?.url ?? null };
});
```

**Why it's real:** `listDeliveriesByAccount` already joins `deliveries` to `events` to
filter by `account_id`, but returns only `deliveries` columns (`d.*`) — it does not also
join `webhooks`. To attach the destination URL, `listDeliveries` then calls
`getWebhookById` once per row inside `.map`, each of which is its own
`SELECT * FROM webhooks WHERE id = ?` (`src/db.ts`, `getWebhookById`). A single page of
25 deliveries issues 1 + 25 = 26 queries instead of 1; the cost scales linearly with
`PAGE_SIZE` and with how active an account is, on every single request to this endpoint.

**Severity:** Medium. It doesn't return wrong data and there's no data-loss risk, but it
is an unnecessary O(n) round-trip pattern on a list endpoint that will get worse as
usage grows, and it's straightforward to eliminate.

**Fix:** Extend the query in `listDeliveriesByAccount` (`src/db.ts`) to also join
`webhooks` and select `w.url as webhook_url`, add `webhookUrl` to the `Delivery`-mapping
row type, and delete the per-row `getWebhookById` loop in `routes/deliveries.ts`
entirely.

---

## 6. Unbounded API-key cache — Performance (with a security side-effect)

**File / lines:** `src/middleware/auth.ts`, line 10 (`const keyCache = ...`), read at
line 18 and written at line 28, inside `requireAuth` (lines 12-30).

```ts
const keyCache = new Map<string, Account>();
...
keyCache.set(key, account);
```

**Why it's real:** Every distinct API key that successfully authenticates gets a
permanent entry in a module-level `Map` that lives for the process's lifetime. There is
no `maxSize`, no TTL, no LRU eviction, and no cleanup on process idle. For a
long-running service this grows without bound as new accounts sign up or existing ones
rotate keys (a rotated-out key's entry is never removed, so `keyCache` also
accumulates dead entries indefinitely). As a secondary consequence: because entries are
never invalidated, a revoked or rotated API key that was cached before revocation keeps
authenticating successfully forever (or until process restart), since `requireAuth`
checks the cache before it would ever re-query `getAccountByApiKey` and notice the key
no longer exists.

**Severity:** Medium as a pure performance/memory issue (slow, predictable memory
growth); the stale-key side effect pushes it toward High in an environment where key
rotation is a security control the team relies on, since this cache silently defeats
that control for already-cached keys.

**Fix:** Bound the cache, e.g. swap the plain `Map` for an LRU cache with a max entry
count and a TTL (a few minutes is enough to keep the hot-path benefit), and invalidate
(`keyCache.delete(key)`) whenever a key is rotated or revoked in whatever admin flow
does that.

---

## 7. Unawaited, uncaught dispatch call — Reliability

**File / lines:** `src/routes/events.ts`, line 58, inside `ingestEvent` (lines 34-61).

```ts
dispatchPendingDeliveries();
```

**Why it's real:** `dispatchPendingDeliveries` is `async` (`src/jobs/dispatcher.ts`,
returns `Promise<void>`) and can reject — e.g. if `getDb()` throws on a locked SQLite
file, or if a delivery's webhook URL is malformed in a way that surfaces before the
`try/catch` inside `sendDelivery` (unlikely today, but the point is the caller has no
way to know). Here the call is made with no `await` and no `.catch()`. If it rejects,
that becomes an unhandled promise rejection: Bun logs a generic unhandled-rejection
warning at best, `ingestEvent` has already returned its `201` response by the time the
rejection happens, and no application code ever sees or reports the failure. Compare
this to the identical call inside the two `setInterval` sweeps in `src/server.ts`
(lines 18 and 22), which are both correctly wrapped with `.catch((err) => console.error(...))`
— this is the one call site that was missed.

**Severity:** Medium. The event itself is safely persisted (delivery rows already exist
before this call, per line 50 of the same function), and the periodic sweep in
`server.ts` will eventually pick up any pending delivery this call fails to kick off
immediately — so the failure mode is a delay up to `DISPATCH_INTERVAL_MS`, not data
loss, but it is a genuinely silent failure with no log line anywhere.

**Fix:**

```ts
dispatchPendingDeliveries().catch((err) => console.error("dispatch nudge failed", err));
```

matching the pattern already used in `server.ts`.

---

## 8. Non-idempotent retry of deliveries stuck in `sending` — Reliability

**File / lines:** `src/db.ts`, lines 272-284 (`listRetryableDeliveries`), specifically
the `WHERE` clause at lines 276-278; the status transition that creates the hazard is in
`src/jobs/dispatcher.ts`, `sendDelivery` (line 26 sets `sending`, lines 30-38 perform the
`fetch`, line 41 marks `delivered`); consumed by `src/jobs/retry.ts`
(`retryFailedDeliveries`, lines 5-11).

```ts
// db.ts
WHERE status IN ('failed', 'sending')
```

```ts
// dispatcher.ts
markSending(deliveryId);
const signature = signPayload(webhook.secret, event.payload);
try {
  const res = await fetch(webhook.url, { ... });
  if (res.ok) {
    markDelivered(deliveryId, res.status);
  ...
```

**Why it's real:** A delivery transitions `pending -> sending` (line 26) *before* the
outbound `fetch` runs, and only reaches `delivered` *after* `fetch` resolves
successfully (line 41). If the process crashes, is OOM-killed, or is redeployed in the
window between those two points — after the destination has already received and acted
on the webhook, but before `markDelivered` runs — the row is left stuck at `sending`
forever; nothing ever revisits it except the retry sweep. `listRetryableDeliveries`
explicitly includes `'sending'` in its `WHERE status IN (...)` (this is documented in
the function's own comment as intentional, to handle exactly this stuck case), so
`retryFailedDeliveries` (`jobs/retry.ts`) picks the row up and calls `sendDelivery`
again — sending the same payload to the same URL a second time. There is no idempotency
key on the outbound request (`x-relay-signature` is a content signature, not a
per-attempt or per-delivery nonce) and no server-side check for "this delivery may have
already succeeded" before resending, so a receiver that isn't independently
deduplicating (e.g. by event id) double-applies whatever side effect the webhook
triggers (a duplicate order-confirmation email, a duplicate charge, etc.).

**Severity:** High. This is a data-correctness problem at the third-party receiver, not
just inside this service, and it's the kind of bug that only manifests under real
partial-failure conditions (crash/restart mid-delivery), making it easy to miss in
testing and expensive when it does happen in production.

**Fix:** Two complementary changes: (1) include a stable idempotency key in the outbound
request (e.g. an `X-Relay-Idempotency-Key: <delivery.id>` header) so a well-behaved
receiver can deduplicate; (2) on the sending side, don't treat every `sending` row as
retryable — either verify with the receiver isn't possible here, so instead make the
transition safe by recording the attempt timestamp when moving to `sending` and only
retrying `sending` rows whose age exceeds a generous timeout (long enough that a normal
in-flight request would have completed or already failed), so a request that's still
genuinely in flight isn't retried concurrently, and use `UPDATE ... WHERE status =
'sending'` (a conditional write) when marking a stuck row for retry so two sweeps can't
both grab it.

---

## 9. Webhook create validation errors return HTTP 200 — API DX

**File / lines:** `src/routes/webhooks.ts`, lines 41 and 48, inside
`createWebhookHandler` (lines 32-60).

```ts
if (!body || typeof body.url !== "string" || body.url.length === 0) {
  return json({ error: "url is required" }, 200);
}
...
} catch {
  return json({ error: "url must be a valid absolute URL" }, 200);
}
```

**Why it's real:** Both branches are unambiguous client-input problems (missing `url`,
or a `url` that fails `new URL()` parsing) and both return status `200` with an
`{ error }` body. Any caller that checks `response.ok`, `response.status`, or uses an
HTTP client / SDK that throws on non-2xx (i.e. almost every convention in REST API
tooling) will observe a "successful" request and never see the `error` field at all —
the webhook registration silently did not happen, and the caller has no reliable signal
that it needs to look at the body. This is inconsistent with the rest of the same file:
`getWebhookHandler` and `deactivateWebhookHandler` both correctly `throw new
NotFoundError(...)` / `throw new ValidationError(...)` for their failure cases, which
(setting aside defect #10) are meant to map to real 4xx statuses.

**Severity:** High. This isn't a cosmetic inconsistency — it actively hides failures
from integrators in the most common way API clients check for success, and webhook
registration is exactly the kind of one-time setup step where a silently-failed call
leaves a customer never receiving events with no error surfaced anywhere.

**Fix:**

```ts
if (!body || typeof body.url !== "string" || body.url.length === 0) {
  throw new ValidationError("url is required");
}
let parsedUrl: URL;
try {
  parsedUrl = new URL(body.url);
} catch {
  throw new ValidationError("url must be a valid absolute URL");
}
```

`ValidationError` (already imported in this file) carries `status = 400` and will be
handled correctly by the top-level catch **once defect #10 is also fixed** — seeing
which is why these two fixes are sequenced together in the remediation plan.

---

## 10. Top-level error handler collapses every error to 500 — API DX

**File / lines:** `src/server.ts`, lines 68-75, the `catch (err)` block in the
`Bun.serve` `fetch` handler (lines 27-77).

```ts
} catch (err) {
  console.error(err);
  return Response.json({ error: "internal server error" }, { status: 500 });
}
```

**Why it's real:** `src/lib/http.ts` defines `HttpError` with a `status` field and three
subclasses (`ValidationError` = 400, `NotFoundError` = 404, `UnauthorizedError` = 401)
that route handlers already throw in exactly the situations that warrant those codes
(e.g. `ValidationError` in `routes/events.ts` lines 39 and 42, `NotFoundError` in
`routes/webhooks.ts` lines 27 and 66, `UnauthorizedError` throughout
`middleware/auth.ts`). None of that is used here: the catch block ignores `err.status`
entirely and always responds `500`. Every one of those legitimate 4xx cases —
a malformed ingest body, an unknown webhook id, a missing API key — is reported to the
client as "internal server error," which is both wrong (it isn't the server's fault)
and actively misleading for anyone building against this API, since 5xx conventionally
means "retry later, this is our bug," while 4xx means "fix your request."

**Severity:** High. This affects every authenticated route in the service (all of them
call `requireAuth`, which throws `UnauthorizedError` on a bad key) and every validated
input path, so it's a systemic issue, not a one-off endpoint quirk, and it actively
teaches API consumers the wrong retry behavior (retrying a 500 that's really a 400 wastes
requests and can look like a self-inflicted outage).

**Fix:**

```ts
} catch (err) {
  if (err instanceof HttpError) {
    return Response.json({ error: err.message }, { status: err.status });
  }
  console.error(err);
  return Response.json({ error: "internal server error" }, { status: 500 });
}
```

(`HttpError` needs to be imported from `./lib/http` in `server.ts`, which it currently
is not.)

---

# Remediation plan

Sequencing below is written as if for a review of `AUDIT.md`'s own remediation section —
i.e. this is the shape a strong report's plan should take, covering order, dependencies,
and rollout risk.

**Batch 1 — no dependencies, ship as isolated one-line/few-line diffs, land first:**

1. **#1 SQL injection (events.ts)** — fix immediately, ahead of everything else. It's
   the only finding with an active cross-tenant data-exposure path; every hour it stays
   in production is hours of exposure, and the fix (bind `type` as a parameter) touches
   nothing else.
2. **#2 timing-unsafe token compare (auth.ts)** — independent one-line swap to the
   already-existing `safeCompare` helper. No coordination needed.
3. **#3 pagination off-by-one (webhooks.ts)** — independent one-line arithmetic fix.
   Flag for the API consumers/docs team only if any client has already worked around the
   bug (e.g. by requesting `page=2` to mean "first page") — check before shipping if
   there's reason to think a caller has calibrated against the buggy behavior; otherwise
   plain deploy.
4. **#7 unawaited dispatch call (events.ts)** — one-line `.catch()` addition, matches an
   existing pattern already in the codebase (`server.ts`).

**Batch 2 — depends on Batch 1's #7 pattern but otherwise independent, ship together:**

5. **#5 N+1 query (deliveries.ts / db.ts)** — requires changing the `Delivery` row shape
   returned by `listDeliveriesByAccount` (adding `webhookUrl`) and updating the mapper in
   `db.ts`, plus deleting the loop in the route. Self-contained to those two files; no
   external migration needed since it only changes a `SELECT`, not the schema.
6. **#6 unbounded cache (auth.ts)** — swap the `Map` for a bounded/TTL cache. Do this in
   the same review pass as #2 since both touch `auth.ts`'s hot path, but they are
   functionally independent and can be one commit or two.

**Batch 3 — the pair with a real dependency, sequence #10 before #9:**

7. **#10 generic 500 handler (server.ts)** must land **before** #9. Right now, changing
   `createWebhookHandler` to `throw new ValidationError(...)` (the fix for #9) would be
   silently absorbed by the current catch-all and still come back as a 500 — the two
   defects currently compound into a working-by-accident 500 masking a 200. Fix the
   handler first so it correctly maps `HttpError` subclasses to their status codes, land
   and verify that existing thrown errors (already present for other routes) now return
   the right codes, *then*:
8. **#9 webhook create returns 200 on validation failure** — switch to
   `throw new ValidationError(...)`, which now (post-#10) will correctly surface as 400.
   This is a **breaking change for existing API consumers**: any client currently
   checking `body.error` while ignoring the (previously always-200) status code needs to
   be updated to check the status code instead, or the response shape needs a transition
   period. Treat this as needing a coordinated rollout / changelog entry to API
   consumers, not a silent deploy — flag it to whoever owns external API documentation
   before merging.

**Batch 4 — needs more than a code change, plan separately:**

9. **#8 non-idempotent retry of `sending` deliveries** — the safest code-only mitigation
   (only retry `sending` rows past a timeout, per the fix above) can ship as a normal
   change and should land promptly given the severity. But fully closing the duplicate-
   delivery risk requires adding an idempotency key to the outbound webhook payload
   (`X-Relay-Idempotency-Key`), which is a **contract change for every existing webhook
   receiver** — it doesn't break anyone (an unrecognized header is harmless), but
   realizing its benefit requires webhook consumers to actually start deduplicating on
   it, which is outside this codebase's control. Ship the header addition alongside a
   note to customers/integration docs that the key is now available, rather than
   presenting it as a fully-closed fix in this PR alone.

**Why this order overall:** Batch 1 is pure risk reduction with zero interaction
between fixes — land it same-day. Batch 2 touches shared hot-path files but each fix is
independently verifiable. Batch 3 is the one pair where fixing them in the wrong order
(shipping #9 without #10) would leave the validation-error bug effectively unfixed from
the caller's point of view, and unlike the others it needs external communication
because it changes a status code real clients may depend on. Batch 4 is flagged last not
because it's low severity (#8 is High) but because its full fix reaches outside this
repository's boundary and needs a decision from whoever owns customer-facing API
contracts, not just a merge.
