# Implement the inventory service

You are working inside an empty Bun and TypeScript project. `openapi.yaml` in this directory
describes an inventory service contract. `README.md` describes the runtime requirements.
Implement the service so it conforms to the contract.

## Scope

Read `openapi.yaml` fully before writing code. It defines:

- Products: create, list (paginated), fetch by id, update.
- Warehouses: create, list.
- Stock movements: record a movement of stock for a product at a warehouse, supporting a
  client-supplied idempotency key so retried requests do not double-apply.
- A low-stock report endpoint that lists products whose stock has fallen below their
  configured reorder threshold.
- Pagination on every list endpoint.
- A fixed error shape for validation failures, used consistently across every endpoint.

## Requirements

- Design a schema for products, warehouses, and stock movements, and store it in SQLite via
  `bun:sqlite`, reading the database file path from the `DATABASE_PATH` environment
  variable.
- Write migrations that create this schema and are safe to run more than once against the
  same database file without error or duplication.
- `bun run migrate` must run those migrations.
- `bun run start` must start an HTTP server listening on the port from the `PORT`
  environment variable, implementing every endpoint in `openapi.yaml`.
- Validate every request body and query parameter against the contract, and return the
  error shape from `openapi.yaml` (not a framework default) for every validation failure.
- Apply the idempotency key on stock movements: replaying the same key must not create a
  second movement or double-count stock.
- Use parameterized queries everywhere; never build SQL by concatenating request input.
- Add a `GET /health` endpoint that returns `200` once the service is ready to accept
  traffic. It is not part of the OpenAPI contract; it exists only so the process can be
  health-checked.

## Constraints

- Bun runtime only. Do not add a separate database server or ORM; use `bun:sqlite` directly.
- Do not change `openapi.yaml`.

Work only within this fixture directory.
