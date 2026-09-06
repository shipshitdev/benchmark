import { describe, expect, test } from "bun:test";
import { expandDailyRecurrence } from "../src";

process.env.TZ = "America/New_York";

describe("expandDailyRecurrence", () => {
  test("returns one range per day with the requested start and end time", () => {
    const days = expandDailyRecurrence({
      startDate: new Date(2026, 5, 1), // Mon Jun 1, 2026 - no clock change nearby
      startHour: 9,
      startMinute: 0,
      endHour: 17,
      endMinute: 0,
      days: 4,
    });

    expect(days).toHaveLength(4);
    for (const range of days) {
      expect(range.start.getHours()).toBe(9);
      expect(range.start.getMinutes()).toBe(0);
      expect(range.end.getHours()).toBe(17);
      expect(range.end.getMinutes()).toBe(0);
    }
  });

  test("advances the calendar date by one day per entry", () => {
    const days = expandDailyRecurrence({
      startDate: new Date(2026, 5, 1),
      startHour: 9,
      startMinute: 0,
      endHour: 17,
      endMinute: 0,
      days: 3,
    });

    expect(days.map((range) => range.start.getDate())).toEqual([1, 2, 3]);
  });

  test("returns an empty array when days is zero", () => {
    const days = expandDailyRecurrence({
      startDate: new Date(2026, 5, 1),
      startHour: 9,
      startMinute: 0,
      endHour: 17,
      endMinute: 0,
      days: 0,
    });
    expect(days).toEqual([]);
  });
});
