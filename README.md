# shipshit.dev benchmark

A developer benchmark for frontier model releases. Every time a new model ships, the same
task suite runs through the CLI coding agents people actually use (Claude Code, Codex CLI,
Grok Build, Cursor), on ordinary subscriptions. Runs are scored on deterministic gates,
hidden tests and blind rubric judging, with tokens, turns, wall time and API-equivalent
cost next to every score. Results are JSON in this repo and a static site on Vercel.

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

## License

MIT
