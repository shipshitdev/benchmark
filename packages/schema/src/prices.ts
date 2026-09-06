import { z } from 'zod';
import type { Usage } from './run';

/** USD per one million tokens. `null` when the vendor publishes no API price for the model. */
export const ModelPrice = z.object({
  vendorId: z.string().min(1),
  input: z.number().nonnegative().nullable(),
  output: z.number().nonnegative().nullable(),
  cacheRead: z.number().nonnegative().nullable(),
  cacheWrite: z.number().nonnegative().nullable(),
  source: z.url(),
  note: z.string().default(''),
});
export type ModelPrice = z.infer<typeof ModelPrice>;

/** `data/prices.json`. Dated so every published cost names the table it came from. */
export const PriceTable = z.object({
  asOf: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  currency: z.literal('USD'),
  unit: z.literal('per 1M tokens'),
  models: z.record(z.string(), ModelPrice),
});
export type PriceTable = z.infer<typeof PriceTable>;

/** Maps the model string an adapter reports (or a CLI alias) onto a price table key. */
export const PRICE_KEY_ALIASES: Record<string, string> = {
  fable: 'claude-fable-5-1',
  opus: 'claude-opus-5',
  sonnet: 'claude-sonnet-5',
  haiku: 'claude-haiku-4-5',
  'claude-fable-5-1': 'claude-fable-5-1',
  'claude-opus-5': 'claude-opus-5',
  'claude-sonnet-5': 'claude-sonnet-5',
  'claude-haiku-4-5-20251001': 'claude-haiku-4-5',
  'gpt-6-astra': 'gpt-6-astra',
  'gpt-5.6-sol': 'gpt-5-6-sol',
  'gpt-5-6-sol': 'gpt-5-6-sol',
  'grok-4.6': 'grok-4-6',
  'grok-4-6': 'grok-4-6',
};

export function priceKeyFor(model: string): string | undefined {
  return PRICE_KEY_ALIASES[model] ?? PRICE_KEY_ALIASES[model.toLowerCase()];
}

/**
 * API-equivalent cost. Runs are billed to subscriptions, so this is what the same tokens would
 * cost at list price, not what was paid. Returns null when any needed token class or price is missing.
 */
export function costUsdEquivalent(
  usage: Pick<Usage, 'input' | 'output' | 'cacheRead' | 'cacheWrite'>,
  price: ModelPrice,
): number | null {
  if (usage.input === null || usage.output === null) return null;
  if (price.input === null || price.output === null) return null;
  const perToken = (tokens: number, perMillion: number) => (tokens * perMillion) / 1_000_000;
  let total = perToken(usage.input, price.input) + perToken(usage.output, price.output);
  if (usage.cacheRead) {
    if (price.cacheRead === null) return null;
    total += perToken(usage.cacheRead, price.cacheRead);
  }
  if (usage.cacheWrite) {
    if (price.cacheWrite === null) return null;
    total += perToken(usage.cacheWrite, price.cacheWrite);
  }
  return Math.round(total * 10_000) / 10_000;
}
