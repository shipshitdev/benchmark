export interface Account {
  id: string;
  name: string;
  apiKey: string;
  createdAt: string;
}

export interface Webhook {
  id: string;
  accountId: string;
  url: string;
  secret: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface Event {
  id: string;
  accountId: string;
  type: string;
  payload: string;
  createdAt: string;
}

export type DeliveryStatus = "pending" | "sending" | "delivered" | "failed";

export interface Delivery {
  id: string;
  eventId: string;
  webhookId: string;
  status: DeliveryStatus;
  attemptCount: number;
  responseStatus: number | null;
  lastAttemptAt: string | null;
  nextAttemptAt: string | null;
  createdAt: string;
}

export interface DeliveryStats {
  pending: number;
  sending: number;
  delivered: number;
  failed: number;
}
