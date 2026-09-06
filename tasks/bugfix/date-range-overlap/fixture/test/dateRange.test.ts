import { describe, expect, test } from "bun:test";
import { createRange, mergeRanges, overlaps, rangeDurationMs } from "../src";

process.env.TZ = "America/New_York";

describe("createRange", () => {
  test("throws when start is after end", () => {
    expect(() =>
      createRange(new Date(2026, 0, 2, 12, 0, 0), new Date(2026, 0, 2, 10, 0, 0)),
    ).toThrow(RangeError);
  });

  test("stores independent copies of the given dates", () => {
    const start = new Date(2026, 0, 1, 9, 0, 0);
    const end = new Date(2026, 0, 1, 17, 0, 0);
    const range = createRange(start, end);
    start.setFullYear(1999);
    expect(range.start.getFullYear()).toBe(2026);
  });
});

describe("overlaps", () => {
  test("is true when two ranges genuinely overlap", () => {
    const a = createRange(new Date(2026, 0, 1, 10, 0, 0), new Date(2026, 0, 1, 12, 0, 0));
    const b = createRange(new Date(2026, 0, 1, 11, 0, 0), new Date(2026, 0, 1, 13, 0, 0));
    expect(overlaps(a, b)).toBe(true);
  });

  test("is false when two ranges have a real gap between them", () => {
    const a = createRange(new Date(2026, 0, 1, 8, 0, 0), new Date(2026, 0, 1, 9, 0, 0));
    const b = createRange(new Date(2026, 0, 1, 10, 0, 0), new Date(2026, 0, 1, 11, 0, 0));
    expect(overlaps(a, b)).toBe(false);
  });
});

describe("mergeRanges", () => {
  test("combines two overlapping ranges into one", () => {
    const a = createRange(new Date(2026, 0, 1, 8, 0, 0), new Date(2026, 0, 1, 12, 0, 0));
    const b = createRange(new Date(2026, 0, 1, 10, 0, 0), new Date(2026, 0, 1, 14, 0, 0));
    const merged = mergeRanges([a, b]);
    expect(merged).toHaveLength(1);
    expect(merged[0].start.getTime()).toBe(a.start.getTime());
    expect(merged[0].end.getTime()).toBe(b.end.getTime());
  });

  test("keeps ranges with a real gap separate", () => {
    const a = createRange(new Date(2026, 0, 1, 8, 0, 0), new Date(2026, 0, 1, 9, 0, 0));
    const b = createRange(new Date(2026, 0, 1, 11, 0, 0), new Date(2026, 0, 1, 12, 0, 0));
    const merged = mergeRanges([a, b]);
    expect(merged).toHaveLength(2);
  });

  test("sorts unsorted input before merging", () => {
    const a = createRange(new Date(2026, 0, 1, 8, 0, 0), new Date(2026, 0, 1, 10, 0, 0));
    const b = createRange(new Date(2026, 0, 1, 9, 0, 0), new Date(2026, 0, 1, 12, 0, 0));
    const merged = mergeRanges([b, a]);
    expect(merged).toHaveLength(1);
    expect(merged[0].start.getTime()).toBe(a.start.getTime());
    expect(merged[0].end.getTime()).toBe(b.end.getTime());
  });

  test("returns an empty array for an empty input", () => {
    expect(mergeRanges([])).toEqual([]);
  });
});

describe("rangeDurationMs", () => {
  test("computes the millisecond span between start and end", () => {
    const range = createRange(new Date(2026, 0, 1, 9, 0, 0), new Date(2026, 0, 1, 17, 0, 0));
    expect(rangeDurationMs(range)).toBe(8 * 60 * 60 * 1000);
  });
});
