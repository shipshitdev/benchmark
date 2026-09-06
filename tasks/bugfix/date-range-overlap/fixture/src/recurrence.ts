import { createRange, type DateRange } from "./dateRange";

/**
 * A simple daily recurrence: the same start/end time-of-day, repeated once
 * per calendar day for `days` days, starting on `startDate`.
 */
export interface DailyRecurrenceRule {
  readonly startDate: Date;
  readonly startHour: number;
  readonly startMinute: number;
  readonly endHour: number;
  readonly endMinute: number;
  readonly days: number;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function expandDailyRecurrence(rule: DailyRecurrenceRule): DateRange[] {
  if (rule.days <= 0) {
    return [];
  }

  const firstStart = new Date(rule.startDate);
  firstStart.setHours(rule.startHour, rule.startMinute, 0, 0);

  const ranges: DateRange[] = [];
  for (let day = 0; day < rule.days; day++) {
    const dayStart = new Date(firstStart.getTime() + day * MS_PER_DAY);
    const dayEnd = new Date(dayStart);
    dayEnd.setHours(rule.endHour, rule.endMinute, 0, 0);
    ranges.push(createRange(dayStart, dayEnd));
  }

  return ranges;
}
