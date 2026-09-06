import { readFileSync } from 'node:fs';
import path from 'node:path';

/** Extracts one or more numbered top-level sections ("## 3. Task suite v1") out of DESIGN.md,
 *  from the repo root two levels up from apps/web, up to (not including) the next top-level
 *  heading not in `sections`. Used by the methodology page so the site stays the single source
 *  of truth already written for the repo, instead of a duplicated copy. */
export function getDesignDocSections(sections: number[]): string {
  const file = path.resolve(process.cwd(), '../../DESIGN.md');
  const text = readFileSync(file, 'utf8');
  const lines = text.split('\n');
  const wanted = new Set(sections);
  const out: string[] = [];
  let capturing = false;
  for (const line of lines) {
    const heading = /^##\s+(\d+)\./.exec(line);
    if (heading) {
      const num = heading[1] !== undefined ? Number(heading[1]) : Number.NaN;
      capturing = wanted.has(num);
    }
    if (capturing) out.push(line);
  }
  return out.join('\n').trim();
}
