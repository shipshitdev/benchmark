# inventory-api-fixture

A Bun runtime project. There is no framework and no separate database server:
storage is `bun:sqlite`, and the HTTP layer is `Bun.serve`.

## Runtime contract

- **Database.** `bun:sqlite` reads and writes the file named by the
  `DATABASE_PATH` environment variable. No other datastore is permitted.
- **Server.** `bun run start` starts an HTTP server listening on the port
  named by the `PORT` environment variable, implementing every endpoint in
  `openapi.yaml`.
- **Migrations.** `bun run migrate` creates the schema described by
  `openapi.yaml`'s data model. It must be safe to run more than once against
  the same database file: running it twice in a row must succeed both times
  with no error and no duplicated schema or data.
- **Readiness.** `GET /health` returns `200` once the service is ready to
  accept traffic. It exists only so the process can be health-checked by the
  harness that runs this fixture; it is not part of the OpenAPI contract and
  must not appear in `openapi.yaml`.

## Contract

`openapi.yaml` is the source of truth for every other endpoint: request and
response shapes, status codes, and pagination. Every validation failure,
on every endpoint, returns the same fixed error shape documented there as
`#/components/schemas/Error`.
