# Webhook Relay audit

## Scope and verification

Read all 16 fixture files: `README.md`, `.gitignore`, `package.json`, `tsconfig.json`, `src/config.ts`, `src/db.ts`, `src/types.ts`, `src/server.ts`, `src/middleware/auth.ts`, `src/lib/crypto.ts`, `src/lib/http.ts`, all three files in `src/routes/`, and both files in `src/jobs/`.

Verified selected findings with Bun using `DB_PATH=:memory:`, synthetic accounts, and mocked outbound fetches. A mocked `Bun.serve` captured the request handler without opening a listener. Checks exercised SQL injection, key revocation, pagination, validation responses, partial fan-out, concurrent delivery, attempt accounting, response cleanup, timezone handling, and SQLite query plans. No external requests, dependency installation, or persistent database changes were made. Only this report was written. This is not a claim that a complete application test suite passed; none is provided in the fixture.

Severity reflects demonstrated capability and the service's tenant and delivery boundaries. Deployment conditions are called out where relevant.

## Findings

### F01 — SQL injection exposes every tenant's events and credentials

- **Location:** `src/routes/events.ts:18–30`.
- **Severity: critical.** Any authenticated tenant can bypass account isolation and extract credentials for other tenants. The account binding does not protect the interpolated filter.
- **Problem/evidence:** The `type` parameter is inserted directly into SQL. Setting it to `x' OR '1'='1` returned events from both synthetic accounts. Setting it to `x' UNION SELECT id, name, api_key, created_at FROM accounts WHERE '1'='1` returned account API keys in the `payload` field. The same four-column UNION mechanism can read webhook signing secrets.
- **Recommended fix:** Append ` AND type = ?` and push `type` into the bound parameters before limit and offset. Use SQLite-compatible parameter types rather than `unknown[]`. Add cross-tenant regression cases for quotes, boolean injection, and credential UNIONs. After patching, treat API keys and signing secrets in any exposed deployment as potentially compromised and rotate them as described in the plan.

### F02 — Webhook destinations allow server-side request forgery and insecure transport

- **Location:** `src/routes/webhooks.ts:44–57`; `src/jobs/dispatcher.ts:29–38`.
- **Severity: high.** An authenticated tenant controls requests made from the relay's network position, including access to services unavailable to that tenant directly. Impact depends on network reachability.
- **Problem/evidence:** `new URL()` is the only destination check; loopback, private-network destinations, plain HTTP, and unsupported schemes are accepted. A `file:///etc/passwd` URL was accepted with 201; this demonstrates missing scheme validation, not demonstrated file disclosure. Fetch uses the supplied destination without an egress policy or redirect restriction. Plain HTTP also exposes event contents and signatures in transit.
- **Recommended fix:** Define an explicit destination policy. Require HTTPS and reject credentials embedded in URLs and unsupported schemes. If internal destinations are a business requirement, allow only approved hosts/ports rather than all private addresses. Otherwise reject loopback, private, link-local, unspecified, reserved, and equivalent IPv4/IPv6 destinations. Validate at registration and delivery; enforce the result at connection time through a pinned validated address or controlled egress proxy so DNS changes cannot bypass the check. Disable redirects or revalidate every hop. Audit existing stored URLs before enforcing the policy; quarantine destinations that fail it.

### F03 — Internal authentication fails open on missing or empty configuration

- **Location:** `src/config.ts:5–8`; `src/middleware/auth.ts:36–39`; `src/server.ts:61–64`.
- **Severity: high.** A deployment missing its secret exposes an operator action to anyone who knows the source default. An explicitly empty secret allows a request with no header.
- **Problem:** `INTERNAL_TOKEN` defaults to the public string `dev-internal-token` with no environment restriction. Because `??` preserves an empty environment value and a missing request header becomes `""`, an empty configured token authenticates missing headers. The action starts a global dispatch sweep.
- **Recommended fix:** Require a nonempty, sufficiently strong operator token at startup and fail startup when absent or empty. Remove the automatic fallback; local development can explicitly supply a local token. Require a nonempty header independently of comparison. Provision the token before deploying this change and update operator callers when rotating it.

### F04 — Internal token comparison is not constant-time

- **Location:** `src/middleware/auth.ts:37–38`; existing helper at `src/lib/crypto.ts:22–28`.
- **Severity: low.** Credential comparison lacks the available timing-resistant primitive, but remote exploitability is not established by this audit.
- **Problem:** The internal guard uses ordinary string inequality for a shared secret even though `safeCompare` exists. Ordinary equality provides no constant-time guarantee.
- **Recommended fix:** After rejecting empty credentials, use `safeCompare(token, config.internalToken)` with an explicit fixed-length token format. Test equal, unequal, empty, and different-length inputs. Do not claim that this alone fixes the default-token problem in F03.

### F05 — API-key cache defeats revocation and grows indefinitely

- **Location:** `src/middleware/auth.ts:10–28`.
- **Severity: high.** Once used successfully, a revoked or rotated key continues authorizing tenant access until that process restarts. Memory also grows with all successfully seen keys.
- **Problem/evidence:** A key was cached, changed in `accounts`, and then successfully authenticated again using the old value. There is no TTL, capacity, or invalidation, including for out-of-band account deletion.
- **Recommended fix:** Prefer removing the cache and using the existing indexed API-key lookup. If caching remains necessary, specify a revocation bound, enforce TTL and capacity, and deliver invalidations to every process for rotation/deletion. Evict current caches across all running instances during remediation; rotating database rows alone is insufficient.

### F06 — Event persistence and delivery fan-out are not atomic

- **Location:** `src/routes/events.ts:45–50`; `src/db.ts:181–203`.
- **Severity: high.** An insert failure or process interruption can permanently leave an accepted event with missing deliveries; a client retry can create another event and duplicate the deliveries already inserted.
- **Problem/evidence:** The event and each delivery are separate autocommitted writes. An in-memory trigger that rejected the second delivery left one event and one delivery committed for an account with two active webhooks. No reconciliation path completes that event's fan-out.
- **Recommended fix:** Put event insertion, active-webhook selection, and all delivery inserts in one synchronous SQLite transaction on the same connection. Dispatch only after commit. Add a unique `(event_id, webhook_id)` constraint if reconciliation/replay will insert missing deliveries. Before backfilling existing partial events, establish which subscriptions were active at ingestion; current activation state alone cannot reconstruct history safely.

### F07 — Delivery selection is not an exclusive claim

- **Location:** `src/db.ts:206–215, 272–282`; `src/jobs/dispatcher.ts:5–9, 26`; `src/jobs/retry.ts:5–10`; `src/server.ts:17–23`.
- **Severity: high.** Ordinary concurrent sweeps can send duplicate requests and overwrite each other's delivery results, even without a crash.
- **Problem/evidence:** Jobs read a batch and later unconditionally set each row to `sending`. They never verify that a row still has the selected status. Two overlapping dispatcher sweeps sent the second of two pending deliveries twice after one sweep's snapshot became stale. Separately, a live `sending` row with a null `next_attempt_at` was immediately selected by retry and sent concurrently with the original request. Retried rows retain already-due timestamps, too.
- **Recommended fix:** Atomically claim each eligible row with a conditional update/transaction and proceed only if the claim succeeds. Persist a lease owner/token and expiration; retry `sending` only after lease expiry, never simply because `next_attempt_at` is null or due. Finalize results conditionally on the same token to reject stale workers. Use a lease longer than the bounded network operation, or renew it. Apply this protocol to dispatch, retry, and the operator route together. A process-local mutex alone does not protect multiple processes or crash recovery.

### F08 — Crash recovery cannot prevent duplicate receiver side effects

- **Location:** `src/jobs/dispatcher.ts:30–41`; `src/db.ts:272–282`.
- **Severity: high.** A receiver can commit a side effect before the relay records success; recovery then repeats that side effect without providing a usable deduplication identity.
- **Problem:** A crash or response loss after the POST leaves the outcome ambiguous. Only the payload and its HMAC are sent: there is no stable event/delivery identifier. Distinct legitimate events with identical payloads have the same signature, so receivers cannot safely deduplicate by signature or body. F07's leases prevent concurrent ownership but cannot make a network request and local database commit atomic.
- **Recommended fix:** Send a stable delivery ID on every attempt, plus event ID where useful. Document at-least-once delivery and require consumers with side effects to persist a deduplication record atomically with those effects. Bind the identity to authenticated content, using a versioned signed envelope or canonical signed header format. Do not generate a new identity for each retry. Coordinate receiver adoption and signature compatibility before relying on safe replay of ambiguous historical `sending` rows.

### F09 — Attempt counts record failures instead of actual attempts

- **Location:** `src/db.ts:213–234`; `src/jobs/dispatcher.ts:26–46`; retry limit at `src/db.ts:276–278`.
- **Severity: medium.** Delivery history understates requests, and crashes before failure recording can bypass the configured attempt budget repeatedly.
- **Problem/evidence:** `markSending` does not increment attempts and `markDelivered` never updates the count. A successful first delivery remained at zero attempts. A retry succeeding after one failure remains at one despite two requests. Counts are supplied from potentially stale snapshots rather than incremented atomically.
- **Recommended fix:** Define `MAX_DELIVERY_ATTEMPTS` as total outbound attempts, increment the count atomically when claiming an attempt, and use the persisted value for the maximum and backoff. Do not increment again on completion. Clear obsolete retry timestamps on success/terminal failure. Historical counts cannot be reconstructed exactly from this schema; preserve that limitation instead of inventing counts during migration.

### F10 — Inactive or missing destinations retry forever without consuming the budget

- **Location:** `src/jobs/dispatcher.ts:18–23`; `src/db.ts:224–234, 272–282`.
- **Severity: medium.** Deactivated webhooks leave permanently retryable work, consuming the limited retry batch and repeatedly querying records that cannot be delivered.
- **Problem/evidence:** The early failure path passes the unchanged attempt count to `markFailed`, which schedules another retry. A deactivated webhook remained `failed` with count zero and a new retry time. Each future due sweep repeats this without reaching the maximum. The same path handles missing related rows.
- **Recommended fix:** Represent cancellation or permanent failure separately from retryable failure, with an explicit reason. Make inactive/missing destinations terminal and exclude them from retry selection; clearing `next_attempt_at` alone will not work because the current query treats null as eligible. Preserve historical deliveries when deactivating a webhook. Migrate existing impossible retries to the chosen terminal representation.

### F11 — Serial batches and unrestricted sweep scheduling amplify slow destinations

- **Location:** `src/jobs/dispatcher.ts:5–9`; `src/jobs/retry.ts:9–10`; `src/server.ts:17–23`; `src/routes/events.ts:58`.
- **Severity: medium.** A slow tenant delays unrelated deliveries and creates accumulating in-flight sweeps, increasing memory, database work, and outbound traffic.
- **Problem:** Each batch awaits up to 50 requests serially. At the default 8-second timeout a batch can approach 400 seconds, while dispatch starts every 5 seconds. Event ingestion and the operator endpoint start additional sweeps. There is neither a shared worker limit nor a mechanism to coalesce wakeups. Fixing only duplicate claims still leaves avoidable scheduling and fairness problems.
- **Recommended fix:** After F07, use one bounded worker pool with a fixed global concurrency cap and per-destination/account limits. Coalesce interval, event, and operator triggers into wakeups for that pool. Await completion before scheduling another sweep, or explicitly track an active sweep with cleanup in `finally`. Use bounded batch acquisition so slow destinations cannot monopolize the entire worker capacity.

### F12 — Ingestion drops the dispatch promise without handling rejection

- **Location:** `src/routes/events.ts:52–58`.
- **Severity: medium.** A dispatch failure escapes application error handling after persistence and can become an unhandled rejection; the runtime's rejection policy determines additional impact.
- **Problem:** The async dispatcher is neither awaited nor given a rejection handler. The request handler's `try/catch` cannot catch this detached rejection. The scheduled sweeps already attach handlers, but this entry point does not.
- **Recommended fix:** After the transaction commits, signal the managed dispatcher from F11. Until that exists, use `void dispatchPendingDeliveries().catch(...)` with structured logging and an error metric. Keep ingestion's success tied to durable acceptance, and let persisted pending rows support later retries; do not turn a post-commit nudge failure into an ambiguous ingestion failure.

### F13 — Outbound failures lose their cause and database errors are misclassified

- **Location:** `src/jobs/dispatcher.ts:29–46`.
- **Severity: medium.** Operators cannot distinguish network/timeouts from persistence failures, and a successful remote request can be recorded as a generic failed delivery after a local write error.
- **Problem:** The bare catch discards the exception and stores response status zero. It covers both `fetch` and `markDelivered`/`markFailed`. Consequently, a database exception after a successful HTTP response is treated as an outbound failure and scheduled again. If the second database update also fails, it aborts the batch.
- **Recommended fix:** Catch transport errors around the network operation separately. Record a bounded error category/message and attempt identity, without payloads or secrets. Treat completion-write failures as persistence/ambiguous-outcome errors, log and alert them, and recover through leases plus F08's deduplication contract. Do not overwrite a known HTTP outcome with a fabricated transport status. Ensure one row's error does not silently prevent the rest of a batch from progressing.

### F14 — Outbound response bodies are never released explicitly

- **Location:** `src/jobs/dispatcher.ts:30–46`.
- **Severity: medium.** Slow or large response bodies can retain network resources beyond header receipt, reducing connection reuse and adding pressure across overlapping sweeps.
- **Problem/evidence:** The sender reads only `res.ok` and `res.status`; it never consumes or cancels `res.body`. A mocked streaming response completed the delivery without its cancel callback being invoked. The timeout provides a bound for real requests but does not replace prompt cleanup.
- **Recommended fix:** Cancel an unused body in a `finally` block after receiving headers, or consume only a strictly bounded amount if diagnostic response text is required. Keep body handling inside the deadline and isolate cleanup errors from a known HTTP delivery result. Do not buffer arbitrary webhook responses in full.

### F15 — All route exceptions become HTTP 500

- **Location:** `src/server.ts:68–74`; status-bearing errors in `src/lib/http.ts:10–34`.
- **Severity: medium.** Invalid credentials, invalid input, and missing resources are reported as server outages, causing misleading monitoring and inappropriate client retries.
- **Problem/evidence:** `HttpError.status` is ignored. The captured server handler returned 500 for both missing authentication and an event without its required fields, despite thrown statuses 401 and 400.
- **Recommended fix:** Recognize `HttpError` at the top-level boundary and return its status and safe public message. Preserve a generic 500 for unexpected exceptions and log those with request context. Add endpoint-level checks for 400, 401, 404, and an unexpected 500 so helper classes alone cannot give false confidence.

### F16 — Invalid webhook registration returns success

- **Location:** `src/routes/webhooks.ts:36–48`.
- **Severity: medium.** Clients using HTTP status or `res.ok` conclude that registration succeeded even though no webhook exists.
- **Problem/evidence:** Missing and syntactically invalid URLs return an error body with status 200. An invalid URL reproduced that response.
- **Recommended fix:** Throw `ValidationError` for both cases once F15 is implemented, or explicitly return 400 in the interim. Route scheme/destination validation failures from F02 through the same error contract. Keep 201 exclusively for successful persistence.

### F17 — Webhook pagination permanently skips the newest page

- **Location:** `src/routes/webhooks.ts:11–19`.
- **Severity: medium.** The endpoint cannot return the newest ten webhooks at any valid page number, breaking discovery and management.
- **Problem/evidence:** `page * PAGE_SIZE` skips ten rows for page 1. With one registered webhook, the default list returned an empty array.
- **Recommended fix:** Compute `(page - 1) * PAGE_SIZE`. Add a deterministic secondary ordering key, such as `id DESC` after `created_at DESC`, to make tied timestamps stable. Check empty, partial, and multi-page results for no initial omission.

### F18 — Pagination accepts nonfinite and fractional input

- **Location:** `src/routes/events.ts:12–13`; `src/routes/webhooks.ts:11–17`; `src/routes/deliveries.ts:10–11`.
- **Severity: low.** Malformed requests cause avoidable database exceptions or inconsistent page semantics; the issue does not itself bypass authorization.
- **Problem/evidence:** `Math.max` does not reject NaN, Infinity, or fractions. `page=abc` and `page=Infinity` produced SQLite datatype errors in event listing. `page=1.5` was accepted with a fractional page number; some fractional values produce a noninteger offset and fail instead.
- **Recommended fix:** Share a parser that accepts only a positive safe integer within a documented maximum, validates that offset multiplication remains safe, defaults only an absent parameter, and throws `ValidationError` otherwise. Apply it to all three routes after F15. Use stable ordering across paginated queries.

### F19 — Today's statistics depend on the server's local timezone

- **Location:** `src/routes/deliveries.ts:30–39`.
- **Severity: medium.** The same account's daily statistics change with host timezone and can shift after deployment or daylight-saving changes.
- **Problem/evidence:** Records are UTC ISO timestamps, while the start boundary uses local `setHours`. With `TZ=Europe/Malta`, the September 8 boundary was `2026-09-07T22:00:00.000Z`, not UTC midnight. UTC storage alone does not require UTC reporting, but the service has no explicit account/reporting timezone; it silently uses the process setting.
- **Recommended fix:** Define the API day explicitly. For a UTC day, use `setUTCHours(0, 0, 0, 0)` and document UTC. If account-local days are required, persist an account timezone and calculate both boundaries in that zone instead of using host settings. Test midnight and daylight-saving boundaries. Coordinate the semantic change with consumers of daily reports.

### F20 — Delivery listing performs an N+1 lookup pattern

- **Location:** `src/routes/deliveries.ts:13–22`; `src/db.ts:237–246`.
- **Severity: medium.** Every full page performs 26 synchronous SQLite queries, consuming request-thread time unnecessarily under load.
- **Problem:** After loading 25 deliveries, the route separately fetches each webhook, including repeated lookups for the same destination and unused secret columns.
- **Recommended fix:** Add a `LEFT JOIN webhooks w ON w.id = d.webhook_id` to the tenant-scoped delivery query, project `w.url AS webhook_url`, and map it in a dedicated listing result type. Preserve null for missing destinations and the existing tenant filter. This reduces the page to one query without exposing signing secrets.

### F21 — Hot delivery queries lack indexes for their joins and ordering

- **Location:** `src/db.ts:97–99, 206–209, 237–257, 272–282`.
- **Severity: medium.** Work grows with retained delivery history, including other tenants' history, and synchronous scans/sorts block the service's request thread.
- **Problem/evidence:** The schema indexes delivery status only. `EXPLAIN QUERY PLAN` for account delivery listing showed `SCAN d`, a per-row event lookup, and a temporary B-tree for ordering. Pending selection used the status index but still required a temporary ordering B-tree. There is no delivery `event_id` index to support account-event joins.
- **Recommended fix:** Add an index beginning with `deliveries(event_id)` and appropriate time/id suffixes for the account-history queries, plus `(status, created_at, id)` for pending selection. Once F07/F10 define the final eligible/leased/terminal model, add matching due-work indexes for failed retries and lease expiry, using separate queries if the OR conditions prevent efficient access. Evaluate plans with representative multi-tenant history; join indexes alone may not eliminate global ordering work. Use a bounded keyset/history strategy if needed. Index creation on a large live SQLite file is a production migration and can block writes; schedule accordingly.

### F22 — Numeric configuration is parsed without validation

- **Location:** `src/config.ts:2, 11–15`; consumers in `src/server.ts:17–28`, `src/jobs/dispatcher.ts:37`, and `src/db.ts:276–282`.
- **Severity: medium.** A deployment typo can disable retries, make delivery attempts fail locally, or create excessively frequent jobs.
- **Problem:** `Number()` accepts empty strings as zero, nonnumeric values as NaN, and fractional, negative, or infinite values. For example, `MAX_DELIVERY_ATTEMPTS=0` excludes all retry candidates, while an invalid timeout can throw when constructing `AbortSignal.timeout` and be misrecorded as a transport failure. Interval and port values also pass directly to runtime APIs.
- **Recommended fix:** Validate configuration once before opening the database or starting jobs. Require finite integers with explicit ranges: positive bounded intervals and timeout, positive maximum attempts, and a valid deployment port (reserve port zero only if deliberately supported for testing). Emit a precise startup error naming the setting without printing secrets. Validate the internal token under F03 at the same boundary.

### F23 — Outbound deliveries discard the event type

- **Location:** `src/routes/events.ts:38–48`; `src/jobs/dispatcher.ts:27–36`; `src/types.ts:18–23`.
- **Severity: medium.** Receivers subscribed to all account events cannot distinguish different event types when their payloads have the same shape or contents.
- **Problem:** Ingestion requires and stores `type`, but the POST sends only `event.payload` and its signature. There is no event-type header or envelope field, and the registration model provides no type-specific subscription that could supply that information indirectly.
- **Recommended fix:** Define a versioned outbound contract carrying event ID, type, and payload, or add an authenticated event-type header while preserving existing payload bytes. Implement it together with the identity/signature contract in F08. Coordinate receiver parsing and signature verification before switching existing webhooks to a new body format.

## Remediation plan

### 1. Close credential and network exposure first

1. **Patch F01 immediately.** Parameter binding closes a demonstrated cross-tenant credential disclosure path. Add the tenant-isolation regression cases before release.
2. **Fix F03–F05 in the same urgent security wave.** Provision a strong internal token before enforcing startup validation; use the constant-time helper and remove or invalidate the API-key cache. F04 alone is lower priority than the bypass and revocation defects.
3. **Rotate exposed credentials after F01 is closed and F05 is deployed everywhere.** Otherwise a rotated key can remain usable in another process's cache. API-key rotation requires updating internal producers. Webhook secret rotation requires receiver coordination, a bounded old/new verification window where necessary, and retirement of compromised old secrets. The current service has no rotation/versioning endpoint, so prepare an explicit out-of-band procedure or implement that support. Do not invalidate all receiver secrets without a delivery continuity plan.
4. **Enforce F02 at delivery time promptly, then at registration.** Inventory and quarantine unsafe stored URLs; coordinate exceptions for intentionally internal webhooks. Destination enforcement must cover existing rows, redirects, and DNS changes, not just new registrations.

These are urgent because improving retry throughput first could amplify unauthorized egress or duplicate requests while credentials remain exposed.

### 2. Make acceptance and delivery state reliable before increasing concurrency

1. **Implement F06's ingestion transaction.** This is a plain code change for new events. Reconciliation of existing partial fan-out is a separate data repair, requiring historical subscription evidence and duplicate safeguards.
2. **Design and migrate the state model for F07, F09, and F10 together.** Add leases/claim tokens, atomic attempt accounting, and an explicit terminal reason/state or eligibility flag. Update `DeliveryStatus`, row mapping, retry selection, and stats if a new status is introduced. Backfill terminal inactive/missing-destination rows; identify ambiguous existing `sending` rows. Consider the `(event_id, webhook_id)` uniqueness migration after checking existing duplicates.
3. **Coordinate dispatcher cutover.** Stop/drain old workers and operator dispatch calls, migrate, and start only workers that honor claims. Rolling old unconditional workers alongside new lease-aware workers would defeat exclusivity. Preserve pending work during the handoff. Schema changes need a versioned production migration; editing `CREATE TABLE IF NOT EXISTS` does not alter existing tables.
4. **Implement F08 and F23 with receivers.** Agree on stable IDs, authenticated type metadata, signature versioning, and atomic receiver deduplication. A claim lease cannot provide exactly-once side effects. Do not blindly replay historical ambiguous sends until receiver deduplication or an operator reconciliation decision makes it safe. Historical attempt counts are not recoverable exactly.
5. **Fix F13 and F14 in the sender.** Separate transport and persistence outcomes and ensure body cleanup. These should accompany the state-machine work so failures enter the correct recovery path.

### 3. Bound scheduling and restore accurate API behavior

1. **Apply F11 after atomic claims exist.** Introduce bounded workers and coalesced wakeups; then route F12's ingestion nudge and the internal endpoint through that scheduler. A small rejection-handler fix for F12 can ship earlier independently.
2. **Implement F15 before converting F16/F18 to thrown validation errors.** Otherwise those changes merely replace incorrect successes/database errors with more 500 responses. Verify 400/401/404/500 at the actual request boundary.
3. **Fix F17 and validate pagination under F18 across all list routes.** The webhook offset correction itself is independent and can ship immediately.
4. **Apply F22's startup validation with deployment configuration checks first.** A deliberate fail-fast change must not unexpectedly strand the deployment because existing settings were never validated.
5. **Resolve and document F19's reporting timezone.** UTC is a straightforward code fix if that is the desired contract; notify reporting consumers because day totals change. Account-local reporting would instead require account metadata and a migration.

### 4. Reduce database cost and complete production reconciliation

1. **Implement F20's joined listing query.** It is an independent code improvement and can ship earlier if needed.
2. **Apply F21's indexes after the queue state/query design stabilizes.** Schedule SQLite index creation with a backup and a write-lock/maintenance plan appropriate to production data size. Check query plans on representative history, including tenant listing and due work.
3. **Reconcile historical anomalies deliberately.** Review partial fan-out, ambiguous sending rows, permanently retryable inactive destinations, and inaccurate attempt counts. Backfills depend on F06's duplicate guard and F08's receiver behavior; do not treat them as automatic code-only cleanup.

### Acceptance checks for the fixes

- Injected filters never return another account's data or credentials; rotated keys stop working on every instance; missing/empty internal configuration fails startup; unsafe destinations and redirects cannot escape the egress policy.
- A forced fan-out insert failure leaves neither event nor deliveries committed. Concurrent dispatch/retry/operator triggers acquire a delivery only once; stale workers cannot overwrite newer outcomes. Expired leases recover, inactive destinations terminate, and actual attempts obey the configured maximum.
- Simulate a receiver committing before the relay crashes: replay uses the same authenticated identity and causes no second receiver side effect. Check signature compatibility and type metadata with both old and migrated consumers.
- Client errors use their documented 4xx statuses, pagination includes the newest rows and rejects invalid input, and the chosen day boundary is independent of server timezone.
- Slow/streaming responses release resources within bounds; worker concurrency remains capped; persistence errors retain their cause; delivery listing uses one query and the revised queue/history queries have verified plans.
