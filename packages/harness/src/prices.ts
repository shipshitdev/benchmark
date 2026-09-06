import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { costUsdEquivalent, PriceTable, priceKeyFor, type Usage } from '@benchmark/schema';

export interface CostResult {
  costUsdEquivalent: number | null;
  priceKey?: string;
  note?: string;
}

/** Returns null (not a validation error) when `data/prices.json` is simply absent. */
export async function loadPriceTable(dataDir: string): Promise<PriceTable | null> {
  const path = join(dataDir, 'prices.json');
  if (!existsSync(path)) return null;
  const raw = JSON.parse(await Bun.file(path).text());
  return PriceTable.parse(raw);
}

/** Derives API-equivalent cost for a run's usage, with a note whenever it comes back null. */
export function computeCost(
  model: string,
  usage: Pick<Usage, 'input' | 'output' | 'cacheRead' | 'cacheWrite'>,
  prices: PriceTable | null,
): CostResult {
  if (!prices) {
    return { costUsdEquivalent: null, note: 'data/prices.json not found; cost left null' };
  }
  const priceKey = priceKeyFor(model);
  const price = priceKey ? prices.models[priceKey] : undefined;
  if (!priceKey || !price) {
    return { costUsdEquivalent: null, note: `no price table entry for model "${model}"` };
  }
  const cost = costUsdEquivalent(usage, price);
  if (cost === null) {
    return { costUsdEquivalent: null, priceKey, note: 'token counts unavailable; cost left null' };
  }
  return { costUsdEquivalent: cost, priceKey };
}
