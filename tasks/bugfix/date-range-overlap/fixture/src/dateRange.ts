/**
 * A `DateRange` is a closed interval: both `start` and `end` are part of the
 * range. Two ranges that touch at exactly one instant (one's `end` equals the
 * other's `start`) share that instant and count as overlapping.
 */
export interface DateRange {
  readonly start: Date;
  readonly end: Date;
}

export function createRange(start: Date, end: Date): DateRange {
  if (start.getTime() > end.getTime()) {
    throw new RangeError("DateRange start must not be after end");
  }
  return { start: new Date(start.getTime()), end: new Date(end.getTime()) };
}

export function rangeDurationMs(range: DateRange): number {
  return range.end.getTime() - range.start.getTime();
}

export function overlaps(a: DateRange, b: DateRange): boolean {
  return a.start.getTime() < b.end.getTime() && b.start.getTime() < a.end.getTime();
}

/**
 * Sorts the given ranges by start time and merges every run of overlapping
 * (or touching) ranges into the smallest set of non-overlapping ranges that
 * covers the same instants.
 */
export function mergeRanges(ranges: readonly DateRange[]): DateRange[] {
  if (ranges.length === 0) {
    return [];
  }

  const sorted = [...ranges].sort((a, b) => a.start.getTime() - b.start.getTime());
  const merged: DateRange[] = [createRange(sorted[0].start, sorted[0].end)];

  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1];
    const current = sorted[i];

    if (overlaps(last, current)) {
      if (current.end.getTime() > last.end.getTime()) {
        merged[merged.length - 1] = createRange(last.start, current.end);
      }
    } else {
      merged.push(createRange(current.start, current.end));
    }
  }

  return merged;
}
