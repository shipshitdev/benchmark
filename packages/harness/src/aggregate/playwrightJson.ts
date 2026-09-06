export interface PlaywrightSummary {
  expected: number;
  unexpected: number;
  flaky: number;
  skipped: number;
  /** expected / (expected + unexpected + flaky); skipped tests are excluded from the denominator. */
  passRate: number;
}

interface PlaywrightJsonReport {
  stats?: { expected?: number; unexpected?: number; flaky?: number; skipped?: number };
}

/** Parses `playwright test --reporter=json` output (its `stats` block is all this needs). */
export function parsePlaywrightJson(json: string): PlaywrightSummary {
  const parsed = JSON.parse(json) as PlaywrightJsonReport;
  const expected = parsed.stats?.expected ?? 0;
  const unexpected = parsed.stats?.unexpected ?? 0;
  const flaky = parsed.stats?.flaky ?? 0;
  const skipped = parsed.stats?.skipped ?? 0;
  const total = expected + unexpected + flaky;
  return { expected, unexpected, flaky, skipped, passRate: total > 0 ? expected / total : 0 };
}
