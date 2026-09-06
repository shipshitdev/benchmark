export const config = {
  port: Number(process.env.PORT ?? 3000),
  dbPath: process.env.DB_PATH ?? "relay.db",

  // Shared secret for the internal maintenance route (see routes wired in server.ts).
  // In production this comes from the deploy environment; the fallback here is only for
  // local development.
  internalToken: process.env.INTERNAL_TOKEN ?? "dev-internal-token",

  // How often the background sweeps run.
  dispatchIntervalMs: Number(process.env.DISPATCH_INTERVAL_MS ?? 5000),
  retryIntervalMs: Number(process.env.RETRY_INTERVAL_MS ?? 15000),

  maxDeliveryAttempts: Number(process.env.MAX_DELIVERY_ATTEMPTS ?? 5),
  webhookTimeoutMs: Number(process.env.WEBHOOK_TIMEOUT_MS ?? 8000),
};
