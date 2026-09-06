#!/usr/bin/env bun
/**
 * Generates `apps/web/fixtures/sample-data/` — a small, clearly-synthetic release so every route
 * on the site renders real-shaped content in local development (`bun run build:sample`). Wipes
 * and rewrites the whole directory on every run rather than appending, so it's safe to rerun.
 *
 * Every object below is built as a plain JS value and passed through the real `@benchmark/schema`
 * zod parsers before it touches disk — that's the correctness gate against `lib/data.ts`, which
 * trusts these shapes without re-validating them.
 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import {
  type AgentSpec,
  agentSlug,
  type Category,
  costUsdEquivalent,
  type ModelPrice,
  PairwiseVerdict,
  PriceTable,
  parseAgentSpec,
  priceKeyFor,
  Release,
  RunResult,
  runId,
  type TaskId,
  VIEWPORTS,
} from '@benchmark/schema';
import { encodeSolidPng } from './png';

const SYNTHETIC_NOTE = 'synthetic sample for site development';
const RELEASE_ID = 'sample-synthetic';
const SUITE_VERSION = 'v2026.09-sample-synthetic';
const GENERATED_AT = '2026-09-06T12:00:00.000Z';
const PRICES_AS_OF = '2026-09-06';

const outDir = path.join(import.meta.dirname, '..', 'fixtures', 'sample-data');

// ---------------------------------------------------------------------------
// Price table — feeds costUsdEquivalent() so run usage and standings cost agree.
// ---------------------------------------------------------------------------

const priceTable = PriceTable.parse({
  asOf: PRICES_AS_OF,
  currency: 'USD',
  unit: 'per 1M tokens',
  models: {
    'claude-fable-5-1': {
      vendorId: 'claude-fable-5-1',
      input: 5,
      output: 25,
      cacheRead: 0.5,
      cacheWrite: 6.25,
      source: 'https://www.anthropic.com/pricing',
      note: 'placeholder price for synthetic sample data',
    },
    'gpt-6-astra': {
      vendorId: 'gpt-6-astra',
      input: 3,
      output: 12,
      cacheRead: 0.3,
      cacheWrite: 3.75,
      source: 'https://openai.com/api/pricing',
      note: 'placeholder price for synthetic sample data',
    },
  },
});

function priceFor(model: string): { key: string; price: ModelPrice } {
  const key = priceKeyFor(model) ?? model;
  const price = priceTable.models[key];
  if (!price) throw new Error(`no price entry for model "${model}" (resolved key "${key}")`);
  return { key, price };
}

// ---------------------------------------------------------------------------
// Agents
// ---------------------------------------------------------------------------

type AgentDef = {
  spec: AgentSpec;
  version: string;
  permissionMode: string;
  command: string[];
  color: [number, number, number];
};

const CLAUDE: AgentDef = {
  spec: parseAgentSpec('claude:fable@high'),
  version: '2.1.260',
  permissionMode: 'bypassPermissions',
  command: [
    'claude',
    '-p',
    '--output-format',
    'json',
    '--model',
    'fable',
    '--effort',
    'high',
    '--max-turns',
    '40',
    '--max-budget-usd',
    '5',
  ],
  color: [37, 99, 235], // blue-600
};

const CODEX: AgentDef = {
  spec: parseAgentSpec('codex:gpt-6-astra@high'),
  version: '0.153.2',
  permissionMode: 'full-auto',
  command: ['codex', 'exec', '--json', '--model', 'gpt-6-astra', '--effort', 'high'],
  color: [234, 88, 12], // orange-600
};

const CAPS = { maxTurns: 40, maxBudgetUsd: 5, timeboxMinutes: 30 };

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

type GateDef = { id: string; detail: string; durationMs: number };
type TaskDef = {
  id: TaskId;
  category: Category;
  title: string;
  version: number;
  gates: GateDef[];
};

const UX_TASK: TaskDef = {
  id: 'ux-ui/pricing-page' as TaskId,
  category: 'ux-ui',
  title: 'Redesign the pricing page',
  version: 1,
  gates: [
    { id: 'build', detail: 'next build succeeded', durationMs: 21_000 },
    { id: 'axe', detail: 'no violations at serious impact or above', durationMs: 4_500 },
  ],
};

const BUGFIX_TASK: TaskDef = {
  id: 'bugfix/pagination-off-by-one' as TaskId,
  category: 'bugfix',
  title: 'Fix off-by-one in paginate()',
  version: 1,
  gates: [
    { id: 'build', detail: 'tsc --noEmit succeeded', durationMs: 9_000 },
    { id: 'typecheck', detail: 'no type errors', durationMs: 6_000 },
  ],
};

// ---------------------------------------------------------------------------
// Content generators — transcript lines and diffs, parameterized per run.
// ---------------------------------------------------------------------------

function buildTranscriptLines(agent: AgentDef, task: TaskDef): Record<string, unknown>[] {
  return [
    { type: 'system_init', model: agent.spec.model, cwd: '/workspace/fixture' },
    { type: 'assistant_text', text: `Reading the task brief for "${task.title}".` },
    { type: 'tool_call', name: 'read_file', input: 'app/pricing/page.tsx' },
    { type: 'tool_result', name: 'read_file', output: '(140 lines, truncated)' },
    { type: 'assistant_text', text: 'Implementing the change.' },
    { type: 'tool_call', name: 'bash', input: 'bun run build' },
    { type: 'tool_result', name: 'bash', output: 'Build succeeded.' },
    { type: 'assistant_text', text: 'Verified the build passes; wrapping up.' },
  ];
}

function writeTranscript(runDir: string, agent: AgentDef, task: TaskDef): string {
  const lines = buildTranscriptLines(agent, task);
  const body = lines.map((line) => JSON.stringify(line)).join('\n');
  writeFileSync(path.join(runDir, 'transcript.jsonl.gz'), gzipSync(Buffer.from(body, 'utf8')));
  return 'transcript.jsonl.gz';
}

function writeDiff(runDir: string, patch: string): string {
  writeFileSync(path.join(runDir, 'diff.patch'), patch);
  return 'diff.patch';
}

const UX_DIFF = `--- a/app/pricing/page.tsx
+++ b/app/pricing/page.tsx
@@ -12,7 +12,7 @@ export default function PricingPage() {
   return (
     <main className="mx-auto max-w-5xl px-6 py-16">
-      <h1 className="text-3xl font-semibold">Pricing</h1>
+      <h1 className="text-4xl font-bold tracking-tight">Simple, transparent pricing</h1>
       <p className="mt-2 text-muted-foreground">Choose the plan that fits your team.</p>
     </main>
   );
`;

function bugfixDiff(variable: string): string {
  return `--- a/lib/pagination.ts
+++ b/lib/pagination.ts
@@ -8,7 +8,7 @@ export function paginate<T>(items: T[], page: number, pageSize: number): T[] {
   const start = (page - 1) * pageSize;
-  const ${variable} = start + pageSize - 1;
+  const ${variable} = start + pageSize;
   return items.slice(start, ${variable});
 }
`;
}

function writeGateLogs(runDir: string, task: TaskDef, run: { id: string }): void {
  const gatesDir = path.join(runDir, 'gates');
  mkdirSync(gatesDir, { recursive: true });
  for (const gate of task.gates) {
    writeFileSync(
      path.join(gatesDir, `${gate.id}.log`),
      `[${gate.id}] run ${run.id}\n${gate.detail}\nexit code 0\n`,
    );
  }
}

function writeScreenshots(
  runDir: string,
  agent: AgentDef,
): Array<{ path: string; viewport: string; file: string }> {
  const dir = path.join(runDir, 'screenshots');
  mkdirSync(dir, { recursive: true });
  return (Object.keys(VIEWPORTS) as Array<keyof typeof VIEWPORTS>).map((viewport) => {
    const { width, height } = VIEWPORTS[viewport];
    const file = `screenshots/${viewport}.png`;
    writeFileSync(path.join(runDir, file), encodeSolidPng(width, height, agent.color));
    return { path: '/pricing', viewport, file };
  });
}

// ---------------------------------------------------------------------------
// Run construction
// ---------------------------------------------------------------------------

const round2 = (n: number): number => Math.round(n * 100) / 100;

type RawUsage = {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  turns: number;
  toolCalls: number;
  durationMs: number;
};

function runUsage(raw: RawUsage, agent: AgentDef, includeReportedCost: boolean) {
  const { key, price } = priceFor(agent.spec.model);
  const cost = costUsdEquivalent(raw, price);
  return {
    input: raw.input,
    output: raw.output,
    cacheRead: raw.cacheRead,
    cacheWrite: raw.cacheWrite,
    turns: raw.turns,
    toolCalls: raw.toolCalls,
    durationMs: raw.durationMs,
    costUsdEquivalent: cost,
    priceKey: key,
    ...(includeReportedCost && cost !== null ? { reportedCostUsd: cost } : {}),
  };
}

function usageTotals(raw: RawUsage, cost: number | null) {
  return {
    input: raw.input,
    output: raw.output,
    cacheRead: raw.cacheRead,
    cacheWrite: raw.cacheWrite,
    turns: raw.turns,
    toolCalls: raw.toolCalls,
    durationMs: raw.durationMs,
    costUsdEquivalent: cost,
  };
}

function sumUsageTotals(a: ReturnType<typeof usageTotals>, b: ReturnType<typeof usageTotals>) {
  return {
    input: (a.input ?? 0) + (b.input ?? 0),
    output: (a.output ?? 0) + (b.output ?? 0),
    cacheRead: (a.cacheRead ?? 0) + (b.cacheRead ?? 0),
    cacheWrite: (a.cacheWrite ?? 0) + (b.cacheWrite ?? 0),
    turns: (a.turns ?? 0) + (b.turns ?? 0),
    toolCalls: (a.toolCalls ?? 0) + (b.toolCalls ?? 0),
    durationMs: a.durationMs + b.durationMs,
    costUsdEquivalent:
      a.costUsdEquivalent !== null && b.costUsdEquivalent !== null
        ? round2(a.costUsdEquivalent + b.costUsdEquivalent)
        : null,
  };
}

const JUDGE_OPUS = { cli: 'claude', model: 'opus', version: '2.1.260' } as const;
const JUDGE_GROK = { cli: 'grok', model: 'grok-4.6', version: '1.0.13' } as const;

function dimensionScore(scores: Record<string, number>): number {
  const values = Object.values(scores);
  return round2((values.reduce((sum, v) => sum + v, 0) / (values.length * 4)) * 100);
}

function judgment(
  judge: { cli: 'claude' | 'grok'; model: string; version: string },
  scores: Record<string, number>,
  rationale: string,
) {
  const subjective = dimensionScore(scores);
  return {
    judge,
    blindLabel: judge === JUDGE_OPUS ? 'A' : 'B',
    scores,
    subjective,
    rationale,
    usage: {
      input: 2200,
      output: 380,
      cacheRead: 0,
      cacheWrite: 0,
      turns: 1,
      toolCalls: 0,
      durationMs: 7_800,
      costUsdEquivalent: null,
    },
  };
}

console.log(`generating sample data into ${outDir}`);
rmSync(outDir, { recursive: true, force: true });
mkdirSync(path.join(outDir, 'releases'), { recursive: true });
mkdirSync(path.join(outDir, 'runs'), { recursive: true });

function makeRun(opts: {
  task: TaskDef;
  agent: AgentDef;
  usage: RawUsage;
  objective: number;
  diff: string | null;
  judgments: ReturnType<typeof judgment>[];
  screenshots: boolean;
  includeReportedCost: boolean;
}) {
  const id = runId(RELEASE_ID, opts.task.id, opts.agent.spec, 1);
  const runDir = path.join(outDir, 'runs', id);
  mkdirSync(runDir, { recursive: true });

  const transcript = writeTranscript(runDir, opts.agent, opts.task);
  writeGateLogs(runDir, opts.task, { id });
  const diffFile = opts.diff !== null ? writeDiff(runDir, opts.diff) : null;
  const screenshots = opts.screenshots ? writeScreenshots(runDir, opts.agent) : [];

  const usage = runUsage(opts.usage, opts.agent, opts.includeReportedCost);
  const run = RunResult.parse({
    id,
    release: RELEASE_ID,
    suiteVersion: SUITE_VERSION,
    task: opts.task.id,
    taskVersion: opts.task.version,
    agent: {
      ...opts.agent.spec,
      version: opts.agent.version,
      permissionMode: opts.agent.permissionMode,
      caps: CAPS,
      command: opts.agent.command,
    },
    attempt: 1,
    startedAt: GENERATED_AT,
    finishedAt: new Date(new Date(GENERATED_AT).getTime() + opts.usage.durationMs).toISOString(),
    host: 'sample-host.local',
    status: 'ok',
    usage,
    gates: opts.task.gates.map((gate) => ({
      id: gate.id,
      pass: true,
      durationMs: gate.durationMs,
      detail: gate.detail,
    })),
    objective: opts.objective,
    judgments: opts.judgments,
    artifacts: {
      transcript,
      diff: diffFile,
      screenshots,
      report: null,
    },
    notes: [SYNTHETIC_NOTE],
  });

  writeFileSync(path.join(runDir, 'result.json'), `${JSON.stringify(run, null, 2)}\n`);
  return { run, usageTotals: usageTotals(opts.usage, usage.costUsdEquivalent) };
}

const uxClaudeJudgments = [
  judgment(
    JUDGE_OPUS,
    { aesthetics: 4, hierarchy: 3, 'interaction-states': 3, responsiveness: 4 },
    'Clear visual hierarchy and a confident headline; the mobile CTA could use more spacing.',
  ),
  judgment(
    JUDGE_GROK,
    { aesthetics: 3, hierarchy: 3, 'interaction-states': 4, responsiveness: 3 },
    'Solid interaction states on hover and focus; tablet layout feels slightly cramped.',
  ),
];

const uxCodexJudgments = [
  judgment(
    JUDGE_OPUS,
    { aesthetics: 3, hierarchy: 3, 'interaction-states': 2, responsiveness: 3 },
    'Functional layout but the pricing cards read as a generic template.',
  ),
  judgment(
    JUDGE_GROK,
    { aesthetics: 3, hierarchy: 2, 'interaction-states': 3, responsiveness: 3 },
    'Hierarchy between plans is unclear; the recommended plan does not stand out.',
  ),
];

const uxClaude = makeRun({
  task: UX_TASK,
  agent: CLAUDE,
  usage: {
    input: 45_000,
    output: 8_000,
    cacheRead: 12_000,
    cacheWrite: 3_000,
    turns: 18,
    toolCalls: 34,
    durationMs: 185_000,
  },
  objective: 100,
  diff: UX_DIFF,
  screenshots: true,
  includeReportedCost: true,
  judgments: uxClaudeJudgments,
});

const uxCodex = makeRun({
  task: UX_TASK,
  agent: CODEX,
  usage: {
    input: 38_000,
    output: 9_500,
    cacheRead: 9_000,
    cacheWrite: 2_000,
    turns: 22,
    toolCalls: 41,
    durationMs: 210_000,
  },
  objective: 92,
  diff: null,
  screenshots: true,
  includeReportedCost: false,
  judgments: uxCodexJudgments,
});

const bugfixClaude = makeRun({
  task: BUGFIX_TASK,
  agent: CLAUDE,
  usage: {
    input: 12_000,
    output: 3_000,
    cacheRead: 4_000,
    cacheWrite: 800,
    turns: 8,
    toolCalls: 14,
    durationMs: 65_000,
  },
  objective: 100,
  diff: bugfixDiff('end'),
  screenshots: false,
  includeReportedCost: true,
  judgments: [],
});

const bugfixCodex = makeRun({
  task: BUGFIX_TASK,
  agent: CODEX,
  usage: {
    input: 15_000,
    output: 3_600,
    cacheRead: 3_000,
    cacheWrite: 500,
    turns: 10,
    toolCalls: 17,
    durationMs: 72_000,
  },
  objective: 87.5,
  diff: bugfixDiff('sliceEnd'),
  screenshots: false,
  includeReportedCost: false,
  judgments: [],
});

// ---------------------------------------------------------------------------
// Release aggregate — cells, standings, pairwise.
// ---------------------------------------------------------------------------

function meanSubjective(judgments: ReturnType<typeof judgment>[]): number | null {
  if (judgments.length === 0) return null;
  return round2(judgments.reduce((sum, j) => sum + j.subjective, 0) / judgments.length);
}

function combinedScore(objective: number, subjective: number | null): number {
  return subjective === null ? objective : round2(objective * 0.5 + subjective * 0.5);
}

function spread(value: number): { mean: number; min: number; max: number; n: number } {
  return { mean: value, min: value, max: value, n: 1 };
}

function makeCell(
  task: TaskDef,
  agent: AgentDef,
  outcome: { run: RunResult; usageTotals: ReturnType<typeof usageTotals> },
  objective: number,
  judgments: ReturnType<typeof judgment>[],
) {
  const subjective = meanSubjective(judgments);
  return {
    task: task.id,
    agent: agent.spec,
    runs: [outcome.run.id],
    gatePassRate: 1,
    objective: spread(objective),
    subjective: subjective === null ? null : spread(subjective),
    score: spread(combinedScore(objective, subjective)),
    usage: outcome.usageTotals,
  };
}

const cellUxClaude = makeCell(UX_TASK, CLAUDE, uxClaude, 100, uxClaudeJudgments);
const cellUxCodex = makeCell(UX_TASK, CODEX, uxCodex, 92, uxCodexJudgments);
const cellBugfixClaude = makeCell(BUGFIX_TASK, CLAUDE, bugfixClaude, 100, []);
const cellBugfixCodex = makeCell(BUGFIX_TASK, CODEX, bugfixCodex, 87.5, []);

type CellResult = ReturnType<typeof makeCell>;

function makeStanding(agent: AgentDef, uxCell: CellResult, bugfixCell: CellResult) {
  const categories = [
    { category: UX_TASK.category, agent: agent.spec, score: uxCell.score.mean, tasks: 1 },
    { category: BUGFIX_TASK.category, agent: agent.spec, score: bugfixCell.score.mean, tasks: 1 },
  ];
  const overall = round2((uxCell.score.mean + bugfixCell.score.mean) / 2);
  const usage = sumUsageTotals(uxCell.usage, bugfixCell.usage);
  return {
    agent: agent.spec,
    overall,
    categories,
    usage,
    scorePerDollar:
      usage.costUsdEquivalent !== null && usage.costUsdEquivalent > 0
        ? round2(overall / usage.costUsdEquivalent)
        : null,
    telemetry: 'full' as const,
  };
}

const standingClaude = makeStanding(CLAUDE, cellUxClaude, cellBugfixClaude);
const standingCodex = makeStanding(CODEX, cellUxCodex, cellBugfixCodex);

const pairwiseVerdict = PairwiseVerdict.parse({
  task: UX_TASK.id,
  judge: { cli: JUDGE_OPUS.cli, model: JUDGE_OPUS.model },
  a: uxClaude.run.id,
  b: uxCodex.run.id,
  winner: 'a',
  rationale: 'A reads as a more finished, confident redesign; B is safer and more template-like.',
});
writeFileSync(
  path.join(outDir, 'releases', `${RELEASE_ID}.pairwise.jsonl`),
  `${JSON.stringify(pairwiseVerdict)}\n`,
);

const release = Release.parse({
  release: RELEASE_ID,
  title: 'Sample Synthetic Release',
  suiteVersion: SUITE_VERSION,
  generatedAt: GENERATED_AT,
  pricesAsOf: PRICES_AS_OF,
  categoryWeights: {
    'ux-ui': 0.5,
    bugfix: 0.5,
    frontend: 0,
    backend: 0,
    'planning-audit': 0,
    signature: 0,
  },
  agents: [CLAUDE.spec, CODEX.spec],
  tasks: [
    { id: UX_TASK.id, category: UX_TASK.category, title: UX_TASK.title, version: UX_TASK.version },
    {
      id: BUGFIX_TASK.id,
      category: BUGFIX_TASK.category,
      title: BUGFIX_TASK.title,
      version: BUGFIX_TASK.version,
    },
  ],
  cells: [cellUxClaude, cellUxCodex, cellBugfixClaude, cellBugfixCodex],
  standings: [standingClaude, standingCodex],
  pairwise: [
    {
      task: UX_TASK.id,
      ratings: [
        { agent: CLAUDE.spec, rating: 0.42, ciLow: -0.15, ciHigh: 0.99, comparisons: 1 },
        { agent: CODEX.spec, rating: -0.42, ciLow: -0.99, ciHigh: 0.15, comparisons: 1 },
      ],
    },
  ],
  judges: [
    { cli: JUDGE_OPUS.cli, model: JUDGE_OPUS.model },
    { cli: JUDGE_GROK.cli, model: JUDGE_GROK.model },
  ],
  notes: [SYNTHETIC_NOTE],
});

writeFileSync(
  path.join(outDir, 'releases', `${RELEASE_ID}.json`),
  `${JSON.stringify(release, null, 2)}\n`,
);
writeFileSync(path.join(outDir, 'prices.json'), `${JSON.stringify(priceTable, null, 2)}\n`);

console.log(`wrote release "${RELEASE_ID}" with ${release.cells.length} cells:`);
for (const cell of release.cells) {
  console.log(`  ${cell.task} / ${agentSlug(cell.agent)} -> score ${cell.score?.mean ?? 'null'}`);
}
console.log(`agents: ${release.agents.map(agentSlug).join(', ')}`);
console.log(`runs written under runs/<id>: ${release.cells.flatMap((c) => c.runs).length}`);
