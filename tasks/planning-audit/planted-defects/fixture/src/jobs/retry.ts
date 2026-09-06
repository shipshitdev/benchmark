import { config } from "../config";
import { listRetryableDeliveries } from "../db";
import { sendDelivery } from "./dispatcher";

export async function retryFailedDeliveries(): Promise<void> {
  const now = new Date().toISOString();
  const retryable = listRetryableDeliveries(now, config.maxDeliveryAttempts);

  for (const delivery of retryable) {
    await sendDelivery(delivery.id, delivery.webhookId, delivery.eventId, delivery.attemptCount);
  }
}
