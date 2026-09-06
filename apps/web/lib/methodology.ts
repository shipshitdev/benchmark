/**
 * Pure derivations for the methodology page's generated "known limits" list. Kept out of
 * lib/data.ts (the I/O boundary) and out of the page component so the logic that decides what
 * counts as a limit is testable on its own, independent of the filesystem or JSX.
 */
import { type AgentSpec, agentSlug, type Release, type RunResult } from '@benchmark/schema';
import { formatAgentLabel } from './format';

export function judgeClisFromConfig(judges: string[]): string[] {
  return [
    ...new Set(judges.map((spec) => spec.split(':')[0]).filter((cli): cli is string => !!cli)),
  ];
}

function neverRan(release: Release, agent: AgentSpec): boolean {
  const cells = release.cells.filter((c) => agentSlug(c.agent) === agentSlug(agent));
  return cells.length > 0 && cells.every((c) => c.usage.durationMs === 0 && c.gatePassRate === 0);
}

/**
 * Derives the methodology page's "known limits" bullets from the release's own data instead of
 * asserting them as fixed prose, so a future release that actually repeats attempts, gets a full
 * judge panel, or gets every configured agent running drops the corresponding bullet on its own.
 */
export function deriveKnownLimits(input: {
  release: Release;
  runs: RunResult[];
  configuredJudges: string[];
}): string[] {
  const limits: string[] = [];

  const attemptCounts = input.release.cells.flatMap((c) =>
    [c.objective?.n, c.subjective?.n, c.score?.n].filter((n): n is number => n !== undefined),
  );
  const maxAttempts = attemptCounts.length > 0 ? Math.max(...attemptCounts) : 0;
  if (maxAttempts <= 1) {
    limits.push(
      'Single attempt per cell — every score on this release is one run, not an average over repeats.',
    );
  }

  const configuredClis = judgeClisFromConfig(input.configuredJudges);
  const actualClis = new Set<string>(
    input.runs.flatMap((r) => r.judgments.map((j) => j.judge.cli)),
  );
  const missing = configuredClis.filter((cli) => !actualClis.has(cli));
  if (actualClis.size > 0 && missing.length > 0) {
    limits.push(
      `${configuredClis.length}-family judge panel is configured, but only ${actualClis.size} produced judgments on this release — ${missing.join(', ')} did not judge here.`,
    );
  }

  for (const agent of input.release.agents) {
    if (neverRan(input.release, agent)) {
      limits.push(
        `${formatAgentLabel(agent)} is listed as a contestant but completed no run in this release.`,
      );
    }
  }

  return limits;
}
