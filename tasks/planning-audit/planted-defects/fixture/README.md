# Webhook Relay

A small internal service that accepts events from other internal systems and delivers
them, over HTTP, to the webhook endpoints each account has registered. Think of it as a
lightweight version of what Stripe or GitHub run to fan a single event out to every
subscriber: an event comes in once, and this service takes care of signing it, retrying
failed deliveries, and tracking delivery status per webhook.

## Concepts

- **Account** — a tenant, identified by an API key sent as `X-Api-Key`.
- **Webhook** — a URL an account has registered to receive events, plus a per-webhook
  signing secret used to HMAC-sign every delivery (`X-Relay-Signature` header).
- **Event** — a typed payload ingested via `POST /events`. Ingesting an event creates one
  delivery per active webhook on the account.
- **Delivery** — one attempt (and its retries) to deliver a single event to a single
  webhook. Deliveries move through `pending -> sending -> delivered` or `failed`.

## API

- `POST /events` — ingest a new event (`{ type, payload }`) and fan it out to the
  account's active webhooks.
- `GET /events?type=&page=` — list ingested events, optionally filtered by type.
- `POST /webhooks` — register a new webhook (`{ url, description? }`).
- `GET /webhooks?page=` — list the account's registered webhooks.
- `GET /webhooks/:id` — fetch a single webhook.
- `DELETE /webhooks/:id` — deactivate a webhook; it stops receiving new deliveries.
- `GET /deliveries?page=` — list delivery attempts across the account's webhooks.
- `GET /deliveries/stats/today` — delivery counts by status for the current day.
- `POST /internal/dispatch-now` — operator-only route to trigger an immediate dispatch
  sweep, guarded by a shared `X-Internal-Token` header.

## Background jobs

Two sweeps run on an interval (`server.ts`):

- **Dispatcher** — sends every `pending` delivery.
- **Retry** — re-sends deliveries that didn't complete on the first attempt, with a
  backoff window before each retry, up to `MAX_DELIVERY_ATTEMPTS`.

## Running locally

Accounts and their API keys are provisioned out of band (there is no signup route in
this service); this repo assumes a row already exists in the `accounts` table.

```
bun install
bun run src/server.ts
```

Data is stored in a local `bun:sqlite` database file (`DB_PATH`, defaults to
`relay.db`).
