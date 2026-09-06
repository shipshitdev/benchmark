# Back-to-back bookings don't combine, and times shift after the clock-change weekend

I'm using this library to manage a small equipment rental calendar. Customers can book
back-to-back days, and when two bookings are exactly adjacent (one ends the moment the next
one starts) I expect `mergeRanges` to show them as a single continuous booking. That works
most of the time, but I ran into a case where it doesn't.

## Repro

```ts
import { createRange, mergeRanges } from "./src";

const morning = createRange(
  new Date(2026, 2, 8, 9, 0, 0), // Mar 8, 2026, 09:00
  new Date(2026, 2, 8, 13, 0, 0), // Mar 8, 2026, 13:00
);
const afternoon = createRange(
  new Date(2026, 2, 8, 13, 0, 0), // Mar 8, 2026, 13:00 - exactly when `morning` ends
  new Date(2026, 2, 8, 17, 0, 0), // Mar 8, 2026, 17:00
);

console.log(mergeRanges([morning, afternoon]));
```

I expected a single range from 09:00 to 17:00. Instead I get the two ranges back
unchanged, as if they never touched at all.

## A related problem I noticed on the same day

While tracking this down I also generated a multi-day booking with `expandDailyRecurrence`
for the week of March 7-11, 2026 (the weekend the clocks changed here). The booking is
supposed to run 09:00-17:00 every day, but every day from March 8th onward shows up starting
at 10:00 instead of 09:00, and only lasts 7 hours instead of 8. Bookings for weeks before or
after that one don't have this problem, so it seems tied to that specific weekend.

## What I expected

- Two ranges that touch at exactly the same instant should merge into one continuous range.
- A recurring 09:00-17:00 booking should start at 09:00 and run 8 hours on every day it
  covers, no matter which week it falls in.
