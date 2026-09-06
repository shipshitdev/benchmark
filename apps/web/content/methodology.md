## What actually runs

Every release runs the same six tasks, one per category (UX/UI, frontend, backend,
planning audit, bug fix, and a signature task carried over every release for visual
continuity) through each CLI coding agent under test. Today the site shows one attempt per
cell — the suite is built to average several attempts per task, but the current release has
not run repeats yet, so every score you see is a single run.

Each run goes through the same three layers, in order:

1. **Gates.** Deterministic pass/fail checks — install, build, typecheck, an axe
   accessibility sweep, a contract test suite — run in the order `task.yaml` lists them.
   The first gate that fails stops the run there: it scores no objective or subjective
   result for that task, and the leaderboard shows the cell as a gate failure rather than a
   zero.
2. **Hidden tests.** For tasks with an objective layer, a spec the agent never saw is copied
   in and run against the agent's own code: hidden unit tests for a bug fix, a Playwright
   suite for a UI feature, a contract test suite for a backend service, or a checklist
   match for a planning audit. This produces the objective score.
3. **Blind rubric judging.** A panel of read-only agent judges scores the diff, report, or
   screenshots against the task's rubric, without seeing which model produced the work — a
   randomized blind label stands in for the agent name. A judge is never asked to score a
   contestant from its own model family; that cell is filled by the other judges in the
   panel instead.

A run that fails a gate is excluded from every score average, not counted as a zero — a
crashed build shouldn't drag down the same average as a working one that scored low. The
leaderboard and task pages show a gate-failed cell as no score, with a link to the run so
you can see exactly what failed.

## Cost, tokens, and what "API-equivalent" means

Every run reports token counts by class: input, cache read, cache write, and output. Cost
on this site is always the API-equivalent price of those tokens at the vendor's current
list price, computed from the price table below — never what was actually billed. All the
runs behind this site were driven through subscriptions, not pay-per-token API keys, so no
real invoice exists to report; API-equivalent cost is the fairest stand-in, and it is
recomputed from the live price table whenever prices change, not baked in at run time.

## Judging and pairwise ratings

Judges are configured in `bench.config.json` and read out per release below. For tasks
where the rubric marks pairwise comparisons on, judges also pick a winner for every pair of
runs; those picks feed a Bradley-Terry rating with a confidence interval, shown on the
task's results page whenever there are pairs to compare. A task with a single agent in a
release has no pairs, so no rating renders for it yet.

## Known limits of the current suite

- **Single attempt per cell.** The suite design calls for several runs per task per agent,
  averaged into the spread shown elsewhere on this site; the current release has not run
  repeats, so every number is one run, not an average.
- **Two judge families in practice, not three.** `bench.config.json` configures a
  three-family panel, but the judgments recorded on this release's runs came from only two
  of them — the third configured judge produced no judgments here. See the judge panel
  below for exactly who is configured versus who judged this release.
- **Grok has not run the suite yet.** Grok appears in the judge panel but not yet as a
  contestant agent in a completed release.
