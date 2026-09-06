/**
 * Pure sentence-building over a release's standings — no I/O, no JSX, so the rules that decide
 * what the verdict says are easy to change and to eyeball against a release's real numbers.
 */
import type { AgentSpec, Standing } from '@benchmark/schema';
import { formatAgentLabel, formatScore } from './format';

function byNumber<T>(get: (item: T) => number | null, pick: 'max' | 'min') {
  return (best: T, cur: T): T => {
    const a = get(cur);
    const b = get(best);
    if (a === null || b === null) return best;
    return (pick === 'max' ? a > b : a < b) ? cur : best;
  };
}

export function findLeader(standings: Standing[]): Standing | null {
  const scored = standings.filter((s) => s.overall !== null);
  if (scored.length === 0) return null;
  return scored.reduce(byNumber((s) => s.overall, 'max'));
}

/** The scored agent with the lowest positive API-equivalent cost — "cheapest" is meaningless for
 *  an agent with no cost data or a free/zero run, so both are excluded. */
export function findCheapestScored(standings: Standing[]): Standing | null {
  const eligible = standings.filter(
    (s) =>
      s.overall !== null && s.usage.costUsdEquivalent !== null && s.usage.costUsdEquivalent > 0,
  );
  if (eligible.length === 0) return null;
  return eligible.reduce(byNumber((s) => s.usage.costUsdEquivalent, 'min'));
}

/** Agents entered into the release that produced no scored result at all — every cell gate-failed
 *  or errored, so `overall` never resolved. */
export function agentsWithNoResult(standings: Standing[]): Standing[] {
  return standings.filter((s) => s.overall === null);
}

export function agentKey(agent: AgentSpec): string {
  return `${agent.cli}:${agent.model}${agent.effort ? `@${agent.effort}` : ''}`;
}

export type Rank = { rank: number; total: number };

/** Where `agent` places among standings that have this metric, best first per `direction`. Null
 *  when `agent` itself lacks the metric — there is no meaningful rank to show. */
export function rankAmong(
  standings: Standing[],
  metric: (s: Standing) => number | null,
  direction: 'higher-is-better' | 'lower-is-better',
  agent: Standing,
): Rank | null {
  if (metric(agent) === null) return null;
  const eligible = standings.filter((s) => metric(s) !== null);
  const sorted = [...eligible].sort((a, b) => {
    const av = metric(a) as number;
    const bv = metric(b) as number;
    return direction === 'higher-is-better' ? bv - av : av - bv;
  });
  const index = sorted.findIndex((s) => agentKey(s.agent) === agentKey(agent.agent));
  return index === -1 ? null : { rank: index + 1, total: sorted.length };
}

/**
 * One sentence summarizing a release: who leads, who is meaningfully cheaper for meaningfully
 * less score, and who entered but produced nothing. Built from `Standing[]` alone so it stays in
 * sync with whatever the leaderboard itself shows.
 */
export function buildReleaseVerdict(standings: Standing[]): string {
  const leader = findLeader(standings);
  if (!leader) return 'No agent has produced a scored run yet.';

  const cheapest = findCheapestScored(standings);
  const noResult = agentsWithNoResult(standings);

  let sentence = `${formatAgentLabel(leader.agent)} leads at ${formatScore(leader.overall)}`;

  if (
    cheapest &&
    agentKey(cheapest.agent) !== agentKey(leader.agent) &&
    leader.usage.costUsdEquivalent !== null &&
    leader.usage.costUsdEquivalent > 0 &&
    cheapest.usage.costUsdEquivalent !== null
  ) {
    const ratio = leader.usage.costUsdEquivalent / cheapest.usage.costUsdEquivalent;
    sentence += `, ${formatAgentLabel(cheapest.agent)} is ${Math.round(ratio)}x cheaper at ${formatScore(cheapest.overall)}`;
  }

  if (noResult.length > 0) {
    const names = noResult.map((s) => formatAgentLabel(s.agent)).join(', ');
    sentence += `; ${names} did not run.`;
  } else {
    sentence += '.';
  }

  return sentence;
}

/**
 * Two-sentence prose verdict for one agent's model page: what it won (its overall rank), what it
 * lost against the release leader, and what that cost relative to the cheapest scored agent.
 */
export function buildAgentVerdict(standings: Standing[], agent: Standing): string {
  if (agent.overall === null) {
    return `${formatAgentLabel(agent.agent)} produced no scored run in this release.`;
  }

  const ranked = [...standings]
    .filter((s) => s.overall !== null)
    .sort((a, b) => (b.overall as number) - (a.overall as number));
  const rank = ranked.findIndex((s) => agentKey(s.agent) === agentKey(agent.agent)) + 1;
  const leader = findLeader(standings);
  const cheapest = findCheapestScored(standings);

  const isLeader = leader !== null && agentKey(leader.agent) === agentKey(agent.agent);
  const firstSentence = isLeader
    ? `${formatAgentLabel(agent.agent)} leads this release at ${formatScore(agent.overall)} overall.`
    : `${formatAgentLabel(agent.agent)} ranks #${rank} of ${ranked.length} at ${formatScore(agent.overall)} overall, ${formatScore((leader?.overall ?? 0) - agent.overall)} behind ${leader ? formatAgentLabel(leader.agent) : 'the leader'}.`;

  let costSentence = 'API-equivalent cost is unknown for this run.';
  if (agent.usage.costUsdEquivalent !== null) {
    const isCheapest = cheapest !== null && agentKey(cheapest.agent) === agentKey(agent.agent);
    if (isCheapest) {
      costSentence = `It is also the cheapest scored agent this release, at ${agent.usage.costUsdEquivalent.toFixed(2)} API-equivalent.`;
    } else if (
      cheapest &&
      cheapest.usage.costUsdEquivalent !== null &&
      agent.usage.costUsdEquivalent > 0
    ) {
      const ratio = agent.usage.costUsdEquivalent / cheapest.usage.costUsdEquivalent;
      costSentence = `At ${agent.usage.costUsdEquivalent.toFixed(2)} API-equivalent it costs ${ratio.toFixed(1)}x ${formatAgentLabel(cheapest.agent)}, the cheapest scored agent this release.`;
    }
  }

  return `${firstSentence} ${costSentence}`;
}
