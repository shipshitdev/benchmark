import { describe, expect, test } from 'bun:test';
import { createRange, expandDailyRecurrence, mergeRanges, overlaps, rangeDurationMs } from '../src';

process.env.TZ = 'America/New_York';

describe('issue repro: back-to-back bookings that touch exactly', () => {
  test('two ranges where one ends exactly when the next starts merge into one', () => {
    const morning = createRange(new Date(2026, 2, 8, 9, 0, 0), new Date(2026, 2, 8, 13, 0, 0));
    const afternoon = createRange(new Date(2026, 2, 8, 13, 0, 0), new Date(2026, 2, 8, 17, 0, 0));

    const merged = mergeRanges([morning, afternoon]);

    expect(merged).toHaveLength(1);
    expect(merged[0].start.getTime()).toBe(morning.start.getTime());
    expect(merged[0].end.getTime()).toBe(afternoon.end.getTime());
  });
});

describe('overlap boundary edge cases', () => {
  test("overlaps is true when one range's end equals the other's start, in either argument order", () => {
    const a = createRange(new Date(2026, 5, 1, 8, 0, 0), new Date(2026, 5, 1, 10, 0, 0));
    const b = createRange(new Date(2026, 5, 1, 10, 0, 0), new Date(2026, 5, 1, 12, 0, 0));

    expect(overlaps(a, b)).toBe(true);
    expect(overlaps(b, a)).toBe(true);
  });

  test('ranges with a real gap between them do not merge', () => {
    const a = createRange(new Date(2026, 5, 1, 8, 0, 0), new Date(2026, 5, 1, 10, 0, 0));
    const b = createRange(new Date(2026, 5, 1, 10, 0, 1), new Date(2026, 5, 1, 12, 0, 0));

    const merged = mergeRanges([a, b]);

    expect(merged).toHaveLength(2);
  });

  test('a range that fully contains another merges into the larger one', () => {
    const outer = createRange(new Date(2026, 5, 1, 8, 0, 0), new Date(2026, 5, 1, 18, 0, 0));
    const inner = createRange(new Date(2026, 5, 1, 10, 0, 0), new Date(2026, 5, 1, 12, 0, 0));

    const merged = mergeRanges([outer, inner]);

    expect(merged).toHaveLength(1);
    expect(merged[0].start.getTime()).toBe(outer.start.getTime());
    expect(merged[0].end.getTime()).toBe(outer.end.getTime());
  });

  test('only the touching pair merges when a third range has a real gap', () => {
    const a = createRange(new Date(2026, 5, 1, 8, 0, 0), new Date(2026, 5, 1, 10, 0, 0));
    const b = createRange(new Date(2026, 5, 1, 10, 0, 0), new Date(2026, 5, 1, 12, 0, 0));
    const c = createRange(new Date(2026, 5, 1, 13, 0, 0), new Date(2026, 5, 1, 14, 0, 0));

    const merged = mergeRanges([c, a, b]);

    expect(merged).toHaveLength(2);
    expect(merged[0].start.getTime()).toBe(a.start.getTime());
    expect(merged[0].end.getTime()).toBe(b.end.getTime());
    expect(merged[1].start.getTime()).toBe(c.start.getTime());
  });

  test('ranges that touch exactly at the moment clocks spring forward still merge into one', () => {
    const beforeChange = createRange(
      new Date(Date.UTC(2026, 2, 8, 5, 0, 0)), // Mar 8, 2026, 00:00 America/New_York
      new Date(Date.UTC(2026, 2, 8, 7, 0, 0)), // the instant clocks jump from 02:00 to 03:00
    );
    const afterChange = createRange(
      new Date(Date.UTC(2026, 2, 8, 7, 0, 0)), // same instant as beforeChange's end
      new Date(Date.UTC(2026, 2, 8, 9, 0, 0)), // Mar 8, 2026, 05:00 America/New_York
    );

    const merged = mergeRanges([beforeChange, afterChange]);

    expect(merged).toHaveLength(1);
    expect(merged[0].start.getTime()).toBe(beforeChange.start.getTime());
    expect(merged[0].end.getTime()).toBe(afterChange.end.getTime());
  });
});

describe('recurrence across a spring-forward transition', () => {
  test('a daily 09:00-17:00 recurrence keeps the requested local start time on and after the transition day', () => {
    const days = expandDailyRecurrence({
      startDate: new Date(2026, 2, 7), // Sat Mar 7, 2026
      startHour: 9,
      startMinute: 0,
      endHour: 17,
      endMinute: 0,
      days: 5, // through Wed Mar 11, 2026; clocks spring forward in the US on Mar 8
    });

    expect(days).toHaveLength(5);
    for (const [index, range] of days.entries()) {
      expect(range.start.getDate()).toBe(7 + index);
      expect(range.start.getHours()).toBe(9);
      expect(range.start.getMinutes()).toBe(0);
      expect(range.end.getHours()).toBe(17);
      expect(range.end.getMinutes()).toBe(0);
    }
  });

  test('every day in that recurrence is a full 8 hours, including the transition day', () => {
    const days = expandDailyRecurrence({
      startDate: new Date(2026, 2, 7),
      startHour: 9,
      startMinute: 0,
      endHour: 17,
      endMinute: 0,
      days: 3,
    });

    const durations = days.map((range) => rangeDurationMs(range));

    expect(durations).toEqual([8, 8, 8].map((hours) => hours * 60 * 60 * 1000));
  });

  test('the same recurrence keeps the requested start time during an ordinary week with no clock change', () => {
    const days = expandDailyRecurrence({
      startDate: new Date(2026, 5, 1), // Mon Jun 1, 2026 - not near a transition
      startHour: 9,
      startMinute: 0,
      endHour: 17,
      endMinute: 0,
      days: 5,
    });

    for (const range of days) {
      expect(range.start.getHours()).toBe(9);
      expect(range.end.getHours()).toBe(17);
    }
  });

  test('full-day bookings generated across the spring-forward weekend merge into one continuous booking', () => {
    const days = expandDailyRecurrence({
      startDate: new Date(2026, 2, 7), // Sat Mar 7, 2026
      startHour: 0,
      startMinute: 0,
      endHour: 24,
      endMinute: 0,
      days: 3, // Sat, Sun (transition day), Mon
    });

    const merged = mergeRanges(days);

    expect(merged).toHaveLength(1);
    expect(merged[0].start.getTime()).toBe(days[0].start.getTime());
    expect(merged[0].end.getTime()).toBe(days[days.length - 1].end.getTime());
  });
});
