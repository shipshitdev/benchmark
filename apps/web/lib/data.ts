/**
 * The one boundary module that touches the filesystem. Everything here parses raw bytes through
 * the `@benchmark/schema` zod parsers before returning; every other module in this app trusts the
 * resulting types and does no further validation (principle: boundary discipline).
 *
 * Data root defaults to `../../data` (the repo's real data directory, read-only from here) and is
 * overridden by `BENCH_DATA_DIR` for the synthetic sample fixtures used in local development.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import {
  type AgentSpec,
  agentSlug,
  type Cell,
  PairwiseVerdict,
  PriceTable,
  Release,
  RunResult,
  type Standing,
  taskSlug,
} from '@benchmark/schema';

function dataDir(): string {
  const override = process.env.BENCH_DATA_DIR;
  return override
    ? path.resolve(process.cwd(), override)
    : path.resolve(process.cwd(), '../../data');
}

function readJson(filePath: string): unknown {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

function listFilesWithExt(dirPath: string, ext: string): string[] {
  if (!existsSync(dirPath)) return [];
  return readdirSync(dirPath).filter((name) => name.endsWith(ext));
}

function listDirs(dirPath: string): string[] {
  if (!existsSync(dirPath)) return [];
  return readdirSync(dirPath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}

// ---------------------------------------------------------------------------
// Releases
// ---------------------------------------------------------------------------

let releasesCache: Release[] | null = null;

/** Every release the repo has data for, newest `generatedAt` first. Empty when none exist yet. */
export function listReleases(): Release[] {
  if (releasesCache) return releasesCache;
  const dir = path.join(dataDir(), 'releases');
  const releases = listFilesWithExt(dir, '.json').map((file) =>
    Release.parse(readJson(path.join(dir, file))),
  );
  releases.sort((a, b) => b.generatedAt.localeCompare(a.generatedAt));
  releasesCache = releases;
  return releases;
}

export function getLatestRelease(): Release | undefined {
  return listReleases()[0];
}

export function getRelease(release: string): Release | undefined {
  return listReleases().find((r) => r.release === release);
}

/** Individual judge pairwise picks (rationale + which run won), distinct from the Bradley-Terry
 *  ratings already aggregated onto `Release.pairwise`. Empty when the release has no such file. */
export function listPairwiseVerdicts(release: string): PairwiseVerdict[] {
  const file = path.join(dataDir(), 'releases', `${release}.pairwise.jsonl`);
  if (!existsSync(file)) return [];
  return readFileSync(file, 'utf8')
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => PairwiseVerdict.parse(JSON.parse(line)));
}

// ---------------------------------------------------------------------------
// Release-scoped lookups (cells, standings, tasks, agents)
// ---------------------------------------------------------------------------

export function getStanding(release: Release, agentSlugParam: string): Standing | undefined {
  return release.standings.find((s) => agentSlug(s.agent) === agentSlugParam);
}

export function getCellsForAgent(release: Release, agentSlugParam: string): Cell[] {
  return release.cells.filter((cell) => agentSlug(cell.agent) === agentSlugParam);
}

export function getCellsForTask(release: Release, taskId: string): Cell[] {
  return release.cells.filter((cell) => cell.task === taskId);
}

export function getCell(
  release: Release,
  taskId: string,
  agentSlugParam: string,
): Cell | undefined {
  return release.cells.find(
    (cell) => cell.task === taskId && agentSlug(cell.agent) === agentSlugParam,
  );
}

export function getTask(release: Release, taskSlugParam: string) {
  return release.tasks.find((task) => taskSlug(task.id) === taskSlugParam);
}

export function getAgentBySlug(release: Release, agentSlugParam: string): AgentSpec | undefined {
  return release.agents.find((agent) => agentSlug(agent) === agentSlugParam);
}

export function getPairwiseRatings(release: Release, taskId: string) {
  return release.pairwise.find((p) => p.task === taskId)?.ratings ?? [];
}

// ---------------------------------------------------------------------------
// Runs
// ---------------------------------------------------------------------------

export function listRunIds(): string[] {
  return listDirs(path.join(dataDir(), 'runs'));
}

const runCache = new Map<string, RunResult>();

export function getRun(runId: string): RunResult | undefined {
  const cached = runCache.get(runId);
  if (cached) return cached;
  const file = path.join(dataDir(), 'runs', runId, 'result.json');
  if (!existsSync(file)) return undefined;
  const run = RunResult.parse(readJson(file));
  runCache.set(runId, run);
  return run;
}

export function listRuns(): RunResult[] {
  return listRunIds()
    .map((id) => getRun(id))
    .filter((run): run is RunResult => run !== undefined);
}

function runDir(runId: string): string {
  return path.join(dataDir(), 'runs', runId);
}

export function getRunDiff(run: RunResult): string | null {
  if (run.artifacts.diff === null) return null;
  const file = path.join(runDir(run.id), run.artifacts.diff);
  return existsSync(file) ? readFileSync(file, 'utf8') : null;
}

export function getRunReport(run: RunResult): string | null {
  if (run.artifacts.report === null) return null;
  const file = path.join(runDir(run.id), run.artifacts.report);
  return existsSync(file) ? readFileSync(file, 'utf8') : null;
}

export type TranscriptLine = { index: number; raw: string; event: Record<string, unknown> | null };

/** Decompresses `transcript.jsonl.gz` (or reads a plain `.jsonl`) and parses each line loosely —
 *  the transcript format is adapter-specific, so this stays untyped past "it's a JSON object". */
export function getRunTranscript(run: RunResult): TranscriptLine[] {
  const file = path.join(runDir(run.id), run.artifacts.transcript);
  if (!existsSync(file)) return [];
  const bytes = readFileSync(file);
  const text = (file.endsWith('.gz') ? gunzipSync(bytes) : bytes).toString('utf8');
  return text
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((raw, index) => {
      try {
        const parsed: unknown = JSON.parse(raw);
        return { index, raw, event: isRecord(parsed) ? parsed : null };
      } catch {
        return { index, raw, event: null };
      }
    });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function getRunGateLogs(run: RunResult): Array<{ id: string; log: string }> {
  const dir = path.join(runDir(run.id), 'gates');
  return listFilesWithExt(dir, '.log').map((file) => ({
    id: file.replace(/\.log$/, ''),
    log: readFileSync(path.join(dir, file), 'utf8'),
  }));
}

/** Public-facing screenshot URL for a screenshot artifact's `file` path (relative to the run
 *  directory). The `prebuild` script flattens `data/runs/<id>/screenshots/*.png` into
 *  `public/runs/<id>/`, so the URL is the run id plus the file's basename. */
export function screenshotUrl(runId: string, file: string): string {
  return `/runs/${runId}/${path.basename(file)}`;
}

// ---------------------------------------------------------------------------
// Prices
// ---------------------------------------------------------------------------

let pricesCache: PriceTable | null = null;

export function getPrices(): PriceTable | undefined {
  if (pricesCache) return pricesCache;
  const file = path.join(dataDir(), 'prices.json');
  if (!existsSync(file)) return undefined;
  pricesCache = PriceTable.parse(readJson(file));
  return pricesCache;
}

// ---------------------------------------------------------------------------
// Static params helpers — one place that enumerates the site's route space.
// ---------------------------------------------------------------------------

/**
 * `output: 'export'` refuses to build a dynamic segment whose `generateStaticParams` returns an
 * empty array, so with zero releases every nested dynamic route falls back to exactly one
 * placeholder path built around this sentinel. Nothing on the site ever links to it — the home
 * page and release picker only link to real releases — so it is only reachable by guessing the
 * URL, and every page component renders an explanatory empty state for it instead of content.
 */
export const EMPTY_PARAM = '_none';

function orPlaceholder<T>(items: T[], placeholder: T): T[] {
  return items.length > 0 ? items : [placeholder];
}

export function allReleaseParams(): Array<{ release: string }> {
  return orPlaceholder(
    listReleases().map((r) => ({ release: r.release })),
    { release: EMPTY_PARAM },
  );
}

export function allAgentParams(): Array<{ release: string; agentSlug: string }> {
  return orPlaceholder(
    listReleases().flatMap((r) =>
      r.agents.map((agent) => ({ release: r.release, agentSlug: agentSlug(agent) })),
    ),
    { release: EMPTY_PARAM, agentSlug: EMPTY_PARAM },
  );
}

export function allTaskParams(): Array<{ release: string; taskSlug: string }> {
  return orPlaceholder(
    listReleases().flatMap((r) =>
      r.tasks.map((task) => ({ release: r.release, taskSlug: taskSlug(task.id) })),
    ),
    { release: EMPTY_PARAM, taskSlug: EMPTY_PARAM },
  );
}

/** Every unordered pair of agents present in a release, for `/compare/[a]/[b]/`. */
export function allCompareParams(): Array<{ release: string; a: string; b: string }> {
  return orPlaceholder(
    listReleases().flatMap((r) => {
      const slugs = r.agents.map(agentSlug).sort();
      const pairs: Array<{ release: string; a: string; b: string }> = [];
      for (let i = 0; i < slugs.length; i++) {
        for (let j = i + 1; j < slugs.length; j++) {
          const first = slugs[i];
          const second = slugs[j];
          if (first !== undefined && second !== undefined) {
            pairs.push({ release: r.release, a: first, b: second });
          }
        }
      }
      return pairs;
    }),
    { release: EMPTY_PARAM, a: EMPTY_PARAM, b: EMPTY_PARAM },
  );
}

export function allRunParams(): Array<{ runId: string }> {
  return orPlaceholder(
    listRunIds().map((id) => ({ runId: id })),
    { runId: EMPTY_PARAM },
  );
}
