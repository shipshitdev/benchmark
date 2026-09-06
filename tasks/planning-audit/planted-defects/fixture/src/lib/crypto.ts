import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

export function generateId(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, "")}`;
}

export function generateSecret(): string {
  return randomUUID().replace(/-/g, "");
}

/** HMAC-SHA256 signature for an outbound delivery, sent as the `x-relay-signature` header. */
export function signPayload(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

/**
 * Constant-time string comparison for secrets and tokens. Callers that compare a
 * caller-supplied credential against a stored value should use this instead of `===`
 * or `!==`, which short-circuit on the first differing byte and leak timing information
 * about how much of the credential was guessed correctly.
 */
export function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}
