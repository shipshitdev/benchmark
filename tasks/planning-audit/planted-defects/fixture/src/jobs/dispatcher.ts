import { config } from "../config";
import { getEventById, getWebhookById, listPendingDeliveries, markDelivered, markFailed, markSending } from "../db";
import { signPayload } from "../lib/crypto";

export async function dispatchPendingDeliveries(): Promise<void> {
  const pending = listPendingDeliveries(50);
  for (const delivery of pending) {
    await sendDelivery(delivery.id, delivery.webhookId, delivery.eventId, delivery.attemptCount);
  }
}

export async function sendDelivery(
  deliveryId: string,
  webhookId: string,
  eventId: string,
  attemptCount: number,
): Promise<void> {
  const webhook = getWebhookById(webhookId);
  const event = getEventById(eventId);

  if (!webhook || !event || !webhook.isActive) {
    markFailed(deliveryId, 0, attemptCount);
    return;
  }

  markSending(deliveryId);
  const signature = signPayload(webhook.secret, event.payload);

  try {
    const res = await fetch(webhook.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-relay-signature": signature,
      },
      body: event.payload,
      signal: AbortSignal.timeout(config.webhookTimeoutMs),
    });

    if (res.ok) {
      markDelivered(deliveryId, res.status);
    } else {
      markFailed(deliveryId, res.status, attemptCount + 1);
    }
  } catch {
    markFailed(deliveryId, 0, attemptCount + 1);
  }
}
