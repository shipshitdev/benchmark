# shipshit.dev model benchmark — audit and design

Date: 2026-09-06. Status: proposal, nothing built yet.

Purpose: every time a frontier model ships, run the same developer-task suite through the
CLI coding agents Vincent already pays for, score the results, publish them on a static
site on Vercel, and turn them into content that travels on X.

## 1. What the public benchmarks do

Seventeen benchmarks were audited. The table keeps only what changes our design.

| Benchmark | Tasks | Harness | Scoring | Cost reported | Lesson |
|---|---|---|---|---|---|
| SWE-bench Verified | 500 real GitHub issues, Python only | vendor-chosen scaffold (swings scores 4–10 pts) | hidden unit tests, pass@1 | no | undisclosed harness is the 2026 credibility crisis |
| SWE-bench Pro | 731 public + private split | same | hidden tests | no | ~30% of tasks found broken, recommendation retracted |
| Aider polyglot | 225 Exercism exercises, 6 langs | the Aider CLI itself, 2 attempts with test feedback | tests + separate "edit format compliance" | yes, $ per full run | results as YAML in a git repo, Jekyll site, community PRs |
| Terminal-Bench 2.x | 89 terminal tasks, verifier script each | Harbor, one Docker container per task, any agent | verifier reward 1.0 | yes, $/task split by token class | public trajectories per entry; harness disclosed per score |
| LiveCodeBench | contest problems with dates | raw model | tests, filtered by model cutoff date | no | date-stamp tasks against training cutoffs |
| LiveBench | 18 tasks, monthly rotation | raw model | objective ground truth, no LLM judge | no | rotate to avoid contamination |
| Artificial Analysis | index over other evals | runs everything itself | weighted composite | yes, tokens × price, score-vs-cost scatter | never trust self-reported numbers |
| METR time horizon | tasks with human baseline times | own ReAct scaffold | logistic fit, 50% horizon | no | one legible headline number |
| SWE-Lancer | 1,400 Upwork tasks | own | e2e tests triple-verified, $ earned | yes | denominate in something people care about |
| WebDev Arena | live user prompts, fixed system prompt | E2B sandbox iframes side by side | blind human pairwise, Bradley-Terry, CIs | no | blind pairwise kills brand bias; style-control variant |
| Design Arena Fullstack | fixed prompts | agent in sandbox with Postgres, deploys to Vercel | blind human pairwise | no | real deploy plus real interaction, not a screenshot |
| UI-Bench | 30 prompts, 10 tools, 300 sites | tool output | paid expert designers, TrueSkill, adaptive pairing | no | 4,000 judgments get stable rankings on a tiny prompt set |
| FrontendBench | 148 prompt/test pairs | sandbox | Puppeteer/Jest gate, then binary human pass | no | automated gate before any subjective pass |
| BaxBench / BackendForge | 392 / 56 tasks with OpenAPI contract | Dockerized service | black-box HTTP contract tests + exploit checks | no | correctness and security move independently |
| PRDBench / PaperBench | 50 / 20 projects, thousands of checkpoints | agent | rubric checkpoints, judge validated against humans | no | granular checklists beat one 1–10 score; publish judge agreement |
| cline-bench | real repos where a frontier model got stuck | container | tests from the shipped fix | no | source tasks from real failures |
| Simon Willison's pelican | one prompt, every release | raw model | eyeball | no | a single legible signature task out-travels 500-task suites on X |

### Patterns we copy

1. Disclose the harness with every score: agent CLI, version, model, effort, permission mode, budget.
2. Keep every trajectory public: prompt, transcript, diff, screenshots, verifier output.
3. Report tokens split by class and a derived cost per task next to every score.
4. Small hand-curated task set, versioned and date-stamped (`v2026.09`), with authorship dates.
5. Objective gates first (build, typecheck, tests, axe, contract tests), subjective scoring second, never blended into one number.
6. Blind pairwise judging for the subjective axes, aggregated with Bradley-Terry and confidence intervals.
7. Judges from a different model family than the contestant; publish judge-vs-human agreement.
8. Repeat every task at least 3 times per model and show the spread, never a single best-of run.
9. Results live as JSON in the repo; the site is a static build of that data.
10. One signature task per release for the X post, backed by the full suite for people who click through.

### Pitfalls we design against

Reward hacking through leaked answers, a frozen prompt set that leaks into training data,
LLM-judge self-preference, length and polish bias, effort settings that make cost comparisons
meaningless, broken tasks discovered after publication, and a single cherry-picked run.

## 2. Running on subscriptions, not API keys

Audited on this MacBook on 2026-09-06 from help output, docs and local config only; nothing was executed.

| Agent | Installed | Subscription auth | Headless | Tokens | Turns | Duration | Cost field |
|---|---|---|---|---|---|---|---|
| Claude Code 2.1.260 | yes | OAuth, 3 config dirs | `claude -p --output-format json` | `usage`, `modelUsage` | `num_turns` | `duration_ms` | `total_cost_usd` (list price applied to tokens, populated on OAuth too) |
| Codex CLI 0.153.2 | yes | ChatGPT OAuth | `codex exec --json` | `turn.completed.usage` | count events | from timestamps | none |
| Grok Build CLI 1.0.13 | yes | SuperGrok OAuth | `grok -p --output-format json --max-turns N` | not in JSON; `grok trace <id> --local --json` exports the session (contents unverified) | same | same | none |
| Cursor CLI 2026.08.11 | yes | Ultra | `cursor-agent -p --output-format json --force` | none | none | `duration_ms` | none |
| Gemini CLI | no | Google account (unverified) | `gemini -p --output-format json` | `stats.models.*.tokens` | no | no | none |

Decisions that follow:

- **Adapters** for Claude Code, Codex and Grok in v1. Cursor runs but its efficiency columns show "not reported" rather than an estimate. Gemini once installed.
- **Cost is always derived**, never billed. The repo carries a dated `prices.json` per model and computes API-equivalent cost from token counts for every agent the same way. Claude's own `total_cost_usd` is stored as a cross-check. The site labels the column "API-equivalent cost" and says the runs used subscriptions.
- **Account selection** is the config-dir mechanism the launchers use (`CLAUDE_CONFIG_DIR`, `GROK_HOME`), set directly by the harness. The `claude-ship` and `claude-gen` launchers pin `--model fable --effort high` and refuse overrides, so the harness cannot go through them for contestant runs. It can use `claude-review-gen` unchanged as a read-only judge lane.
- **Turn caps**: Claude has `--max-turns` (hidden from `--help` in 2.1.260 but registered and used by the Agent SDK) plus `--max-budget-usd`; Grok has `--max-turns`; Codex has neither and is stopped by the harness on wall clock. Every run records the cap that applied.
- **Terms**: Anthropic's OAuth terms describe subscription access as "ordinary use" by the subscriber. A release run of roughly 20 tasks × 3 repeats is bursty but personal, non-resold use. Keep repeats modest. Contestant runs use whichever account is connected on the machine running the bench.
- **Host**: the harness and site build fine on either machine. Gates and verifiers are tests (Playwright, hidden specs, Lighthouse), so a full bench run belongs on the Mac Studio per the global verification-host rule. A second reason is that contestant agents run tests inside their fixture, and on the MacBook the account's PreToolUse guard would block them; running on the Studio, or from a config dir without the guard, avoids skewing scores.

## 3. Task suite v1

Five categories, three or four tasks each, twenty tasks total. Each task is a directory:

```
tasks/<category>/<slug>/
  task.yaml        id, category, version, authored, timebox, turn/budget caps, weights
  prompt.md        exactly what the agent receives
  fixture/         starter repo copied into a fresh temp dir for every run (or a git ref)
  gates/           deterministic checks run before any judging
  verify/          hidden tests, contract tests, planted-issue checklist
  rubric.md        0–4 anchors per dimension, shown to judges
```

| Category | Task shape | Objective layer | Subjective layer |
|---|---|---|---|
| UX/UI | build a page or flow from a brief in a Next.js 16 fixture | build, no console errors, axe, screenshots at 3 viewports | blind pairwise on screenshots + live page: aesthetics, hierarchy, interaction states, responsiveness |
| Frontend job | implement a feature in an existing app | hidden Playwright e2e, typecheck, axe, Lighthouse | code quality against the fixture's own patterns |
| Backend architecture | build a service to an OpenAPI contract with Postgres | service boots, black-box HTTP contract tests, a few exploit probes | schema soundness, boundaries, migration safety |
| Planning audit | audit a repo with N planted defects and write a plan | recall of planted issues, penalty for hallucinated findings | actionability, sequencing, risk coverage |
| Bug fix / refactor | real past issues from shipshitdev public repos, cline-bench style | hidden tests from the shipped fix | none |

Plus one **signature task** per release: a single visual brief, same every time, rendered
side by side across models. This is the image in the X post.

Rules: tasks are authored by us, date-stamped, versioned as a set. One task per category
rotates each quarter and the retired task stays published. Fixtures are stripped of git
history so agents cannot dig up a reference solution.

## 4. Scoring

Per task, per model, n = 3 runs.

- **Gate pass rate** (0–1): fraction of runs that clear every deterministic gate. A run that fails a gate scores 0 on the subjective layer for that run.
- **Objective score** (0–100): tests or checklist recall, averaged over runs.
- **Subjective score** (0–100): rubric dimensions 0–4, weighted per `task.yaml`, judged blind by a panel of three read-only agent lanes from three families (Claude Opus via `claude-review-gen`, Codex read-only sandbox, Grok). A judge never scores a contestant from its own family; that cell is filled by the other two. Judges see outputs labelled A/B/C in shuffled order with no model names.
- **Pairwise rating**: for UX/UI and the signature task, judges also pick a winner per pair. Bradley-Terry over all pairs gives a rating with a confidence interval, the number people recognise from the arenas.
- **Category score** = mean of objective and subjective where both exist, objective alone where only tests exist.
- **Overall** = weighted mean of category scores, weights published on the methodology page.
- **Efficiency** per task: input, output, cache read, cache write tokens; turns; tool calls; wall time; API-equivalent cost. Published as a score-vs-cost scatter and a "score per dollar" column.
- **Reliability**: spread across the 3 runs shown as a band. Judge agreement with a human-labelled subset published once per suite version.

Everything a reader sees traces back to a `runs/<run-id>/result.json` they can open.

## 5. Repository layout

New public MIT repo `shipshitdev/benchmark`, same shape as `shipcut` and `shiplead`: Bun
workspaces, Turborepo, Biome, Vitest, Next.js 16.2.4 static export, `vercel.json` with
`bun install` and `outputDirectory: apps/web/out`.

```
apps/web/           Next.js 16 static site (leaderboard, model, task, run, compare, methodology)
packages/harness/   `bench` CLI: run, judge, aggregate, publish
packages/adapters/  claude, codex, grok, cursor: spawn headless, parse usage, normalise
packages/schema/    zod types for task.yaml, run results, judgments, prices
tasks/              the suite (section 3)
data/
  releases/<release>.json      aggregated leaderboard per release run
  runs/<run-id>/result.json    normalised usage + scores
  runs/<run-id>/transcript.jsonl.gz, diff.patch, screenshots/*.png, gates.json
  prices.json                  dated price table
```

Core data shape, named first because everything else hangs off it:

```ts
type Run = {
  id: RunId; release: string; suiteVersion: string;
  task: TaskId;
  agent: { cli: 'claude' | 'codex' | 'grok' | 'cursor'; version: string;
           model: string; effort?: string; permissionMode: string; caps: Caps };
  attempt: 1 | 2 | 3;
  usage: { input: number; output: number; cacheRead: number; cacheWrite: number;
           turns: number | null; toolCalls: number | null; durationMs: number;
           costUsdEquivalent: number | null; reportedCostUsd?: number };
  gates: Record<string, { pass: boolean; detail: string }>;
  objective: number | null;
  judgments: Judgment[];          // one per judge lane, blind labels resolved after scoring
  artifacts: { transcript: string; diff: string; screenshots: string[] };
  status: 'ok' | 'gate_failed' | 'timeout' | 'error';
};
```

`bench run` is idempotent on `(release, task, agent, attempt)`: rerunning resumes, never
duplicates. Each attempt gets its own temp directory, so concurrent runs never share a tree.

## 6. Site and sharing

- Static export, one route per model, task, run and release, built from `data/`. No server, no database, free tier on Vercel.
- Per-model and per-release `opengraph-image.tsx` and `twitter-image.tsx`, the same pattern shipcut uses, so a pasted link renders a scorecard on X.
- Signature-task page renders the side-by-side grid as a single PNG at build time; the X post is that image plus the link.
- A "Post on X" button on every model and compare page builds an `x.com/intent/post` URL with the headline numbers pre-filled.
- Compare page takes two models and shows the same task's screenshots and diffs side by side with the judge verdicts.
- Run page renders the transcript with tool calls collapsed, usage totals at the top, and the exact CLI command that produced it.
- Methodology page carries the suite version, price table date, judge panel, agreement rate and the changelog of removed or fixed tasks.

Artifact size: screenshots and gzipped transcripts at 20 tasks × 3 runs × 5 models are tens of
megabytes per release. Commit them until the repo passes about 500 MB, then move blobs to
GitHub release assets and keep only JSON in git.

## 7. Build order

1. Schema package, harness skeleton, Claude and Codex adapters, one UX/UI task and one bug-fix task end to end on the Studio. Prove the usage numbers match the CLI's own output.
2. Gates and verifiers (Playwright, axe, Lighthouse, contract tests). Judge lanes with blind labelling and Bradley-Terry aggregation. Grok adapter, including the trace export if it carries tokens.
3. Site: leaderboard, run viewer, OG images, X intent. Deploy to Vercel through CI.
4. Fill the suite to twenty tasks, write the methodology page, run a full baseline against current models, label a human subset to publish judge agreement.
5. First release run when the next model ships. Content: signature-task image, thread from the leaderboard, links into run pages.

Decided 2026-09-06: open source under MIT as `shipshitdev/benchmark`; contestant runs use the
account connected on the bench host. Still open: whether Cursor ships in v1 as a quality-only
row with blank efficiency columns.
