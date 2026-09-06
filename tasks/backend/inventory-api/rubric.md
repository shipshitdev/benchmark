# Rubric: Inventory service

Score each dimension 0 to 4, based on the diff.

## Schema soundness (weight 40)

- 0: No real schema (e.g., a single denormalized table or JSON blobs standing in for
  structured columns), or the schema cannot represent the contract's entities correctly.
- 1: Tables exist for the main entities but lack constraints that the contract implies
  (foreign keys, uniqueness on idempotency keys, required fields left nullable).
- 2: A reasonable relational schema with basic constraints, but missing indexes that the
  access patterns (low-stock report, pagination) clearly need.
- 3: A normalized schema with correct constraints, foreign keys, and indexes matching the
  read patterns the contract requires, and migrations that are genuinely re-runnable.
- 4: All of the above, plus schema choices that anticipate real operational needs (e.g., an
  audit trail for stock movements, a design that makes the idempotency key check a simple
  unique-constraint lookup rather than an application-level race).

## Boundaries and error handling (weight 30)

- 0: No input validation, or validation errors return framework-default shapes instead of
  the contract's fixed error shape.
- 1: Validation exists for some endpoints but not others, or error shapes are inconsistent
  across endpoints.
- 2: Every endpoint validates input and returns the fixed error shape, but edge cases (bad
  pagination cursors, unknown ids, malformed idempotency keys) return misleading status
  codes or messages.
- 3: Validation and the fixed error shape are applied consistently, with correct status
  codes for not-found, validation, and conflict cases.
- 4: All of the above, plus clear separation between request parsing, business logic, and
  the HTTP layer, so a new endpoint could reuse the same validation and error handling
  without copy-paste.

## Security (weight 30)

- 0: Any SQL is built by string concatenation or interpolation of request input.
- 1: Most queries are parameterized, but at least one path (e.g., a filter or sort
  parameter) concatenates input into SQL or a query string.
- 2: All queries are parameterized, but input length, type, or range is not checked before
  reaching the database, allowing malformed but non-injecting input to cause errors.
- 3: All queries are parameterized and every input is validated against the contract before
  use, with no way to trigger a database error from malformed client input.
- 4: All of the above, plus deliberate handling of concurrent idempotent replays (no window
  where two simultaneous requests with the same idempotency key both succeed) and no
  internal error detail (stack traces, SQL text) leaked in any response.
