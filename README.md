# shipshit.dev benchmark

A developer benchmark for frontier model releases. Every time a new model ships, the same
task suite runs through the CLI coding agents people actually use (Claude Code, Codex CLI,
Grok Build, Cursor), on ordinary subscriptions. Runs are scored on deterministic gates,
hidden tests and blind rubric judging, with tokens, turns, wall time and API-equivalent
cost next to every score. Results are JSON in this repo and a static site on Vercel.

Live site: https://benchmark.shipshit.dev (deployed by Vercel from `master`).
Design and methodology: [DESIGN.md](DESIGN.md).

## Layout

```
apps/web           static site (leaderboard, runs, compare, methodology)
packages/schema    zod types: task.yaml, run results, judgments, releases, prices
packages/harness   `bench` CLI: run, judge, aggregate
packages/adapters  claude / codex / grok / cursor headless adapters
tasks/             the suite, one directory per task
data/              prices.json, runs/<run-id>/, releases/<release>.json
```

## Commands

```bash
bun install
bun run bench run --release v2026.09 --agents claude:fable@high,codex:gpt-6-astra@high --tasks all --repeat 3
bun run bench judge --release v2026.09
bun run bench aggregate --release v2026.09
bun run --filter @benchmark/web build
```

Runs are idempotent on `(release, task, agent, attempt)`; rerunning resumes.

`bench validate` checks every `tasks/**/task.yaml` against the schema and confirms the referenced
files exist. `bench list` prints the suite, the supported CLIs and the configured judge panel.

## Running a release

A bench run executes coding agents on subscriptions and needs every CLI installed and logged in
on the machine that runs it (`claude`, `codex`, `grok`, `cursor-agent`), plus Playwright's
Chromium (`bunx playwright install chromium`). Results land in `data/runs/` and
`data/releases/`; commit them and the site rebuilds on push.

## Development

```bash
bun run lint                                  # biome
bun run typecheck && bun run test             # per package, through turbo
bun run --filter @benchmark/web sample:generate && bun run --filter @benchmark/web build:sample
```

The sample build renders a clearly synthetic release from `apps/web/fixtures/sample-data/`; nothing
synthetic is ever written under `data/`.

## License

MIT
