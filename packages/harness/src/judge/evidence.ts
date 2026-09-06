import { copyFile, mkdir, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, extname, join } from 'node:path';
import type { RunResult } from '@benchmark/schema';
import type { LabeledItem } from './blindLabels';
import type { EvidenceRef } from './promptBuilder';

export type EvidenceKind = 'screenshots' | 'diff' | 'report' | 'transcript-summary';

/**
 * Copies a blind-labelled entry's evidence into a scratch directory, so a judge running with `cwd`
 * set there can `Read` them without ever seeing a path that names the agent. Copies, not symlinks:
 * some CLIs' file tools skip links that point outside the working directory.
 */
export async function buildEvidenceScratchDir(
  dataDir: string,
  labeled: Array<LabeledItem<RunResult>>,
  evidenceKinds: EvidenceKind[],
): Promise<{ scratchDir: string; entries: Array<LabeledItem<EvidenceRef>> }> {
  const scratchDir = await mkdtemp(join(tmpdir(), 'bench-judge-'));
  const entries: Array<LabeledItem<EvidenceRef>> = [];

  for (const { label, item: run } of labeled) {
    const runDirectory = join(dataDir, 'runs', run.id);
    const ref: EvidenceRef = {};

    if (evidenceKinds.includes('diff') && run.artifacts.diff) {
      const linkName = `${label}-diff.patch`;
      await copyFile(join(runDirectory, run.artifacts.diff), join(scratchDir, linkName));
      ref.diffPath = linkName;
    }

    if (evidenceKinds.includes('report') && run.artifacts.report) {
      const linkName = `${label}-report${extname(run.artifacts.report) || '.md'}`;
      await copyFile(join(runDirectory, run.artifacts.report), join(scratchDir, linkName));
      ref.reportPath = linkName;
    }

    if (evidenceKinds.includes('screenshots') && run.artifacts.screenshots.length > 0) {
      const screenshotDir = join(scratchDir, `${label}-screenshots`);
      await mkdir(screenshotDir, { recursive: true });
      const linkedPaths: string[] = [];
      for (const screenshot of run.artifacts.screenshots) {
        const linkName = basename(screenshot.file);
        await copyFile(join(runDirectory, screenshot.file), join(screenshotDir, linkName));
        linkedPaths.push(join(`${label}-screenshots`, linkName));
      }
      ref.screenshots = linkedPaths;
    }

    if (evidenceKinds.includes('transcript-summary')) {
      // The transcript is gzipped and can be large; point the judge at the diff/report instead of
      // asking it to decompress a multi-turn tool-call log through a Read tool.
      ref.transcriptSummary = `${run.usage.turns ?? 'unknown'} turns, status ${run.status}`;
    }

    entries.push({ label, item: ref });
  }

  return { scratchDir, entries };
}
