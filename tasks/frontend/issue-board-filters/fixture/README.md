# Issue board

A Next.js App Router app that lists software issues from static JSON data, with filters
synced to the URL query string. One filter (status) is already implemented; this README
documents its pattern precisely enough to extend it with more filters.

## Layout

- `data/issues.json` — the on-disk issue data. Do not change its shape.
- `lib/issues.ts` — the `Issue` / `IssueStatus` types, `getIssues()`, small derived-data
  helpers (`getAllLabels()`, `getAllAssignees()`), and pure filter functions
  (`filterByStatus`, and comments describing the filter functions still to add). A filter
  function always has the shape `(issues: Issue[], criterion) => Issue[]` and is pure: no
  React, no URL access, no side effects.
- `components/` — one client component per filter, plus `IssueList`. Each filter component
  is `'use client'`, reads its own value from `useSearchParams()`, and writes it back with
  `useRouter().replace(...)` built from `usePathname()` and a copy of the current
  `URLSearchParams`. A filter component never filters the issue list itself; it only reads
  and writes its slice of the URL.
- `app/page.tsx` — a server component. It awaits the `searchParams` promise, parses each
  known query key into a typed value, runs the issue list through every filter function
  from `lib/issues.ts` in sequence, and renders the filter components plus `IssueList` with
  the final filtered array.

Adding a new filter means: add its query-param parsing to `app/page.tsx`, add its pure
filter function to `lib/issues.ts`, add its filter component to `components/`, and render
that component in `app/page.tsx`. Nothing else changes.

## URL query-param convention

Every filter's state lives in the URL so a reload or a shared link preserves it.

| Filter | Query key | Value format | Status |
|---|---|---|---|
| Status | `status` | one of `open`, `in-progress`, `done`; key absent = all statuses | implemented |
| Labels | `labels` | comma-separated label names, e.g. `labels=bug,docs`; key absent = no label filter | not yet implemented |
| Assignee | `assignee` | an exact assignee name, or the literal string `unassigned`; key absent = no assignee filter | not yet implemented |
| Search | `q` | free text, matched case-insensitively as a substring of the issue title; key absent or empty = no search filter | not yet implemented |

The existing `StatusFilter` component (`components/StatusFilter.tsx`) shows the pattern:
read the current value with `searchParams.get("status")`, and on change, clone the current
params with `new URLSearchParams(searchParams.toString())`, `set()` or `delete()` only its
own key, then `router.replace(`${pathname}?${params.toString()}`, { scroll: false })`. A new
filter component follows the same shape for its own key, leaving every other key untouched.

## `data-testid` convention

| Element | `data-testid` | Notes | Status |
|---|---|---|---|
| Issue list container | `issue-list` | A `<ul>` (or similar) wrapping all visible issue rows. Rendered only when at least one issue matches; absent when the result is empty. | implemented |
| Each issue row | `` issue-item-<id> `` | `<id>` is the issue's `id` field verbatim, e.g. `issue-item-ISSUE-101`. | implemented |
| Status filter control | `filter-status` | The `<select>` for status. | implemented |
| Labels filter container | `filter-labels` | The element wrapping all label checkboxes (e.g. a `<fieldset>`). | not yet implemented |
| Each label checkbox | `` filter-label-option-<label> `` | `<label>` is the label string verbatim, e.g. `filter-label-option-bug`. One `<input type="checkbox">` per label returned by `getAllLabels()`, each with an accessible name (e.g. wrapped in a `<label>` element). | not yet implemented |
| Assignee filter control | `filter-assignee` | A `<select>` with an `unassigned` option plus one option per name from `getAllAssignees()`. | not yet implemented |
| Search filter control | `filter-search` | A text `<input>` with an accessible name (e.g. `aria-label`), filtering by title substring. | not yet implemented |
| Empty state | `empty-state` | Rendered instead of `issue-list` when the active filters match zero issues. | not yet implemented (the code path already exists in `IssueList`; wiring more filters into `app/page.tsx` is what triggers it) |

`IssueList` (`components/IssueList.tsx`) already renders `empty-state` in place of
`issue-list` whenever it receives zero issues. Composing the new filters in `app/page.tsx`
is enough to make that path reachable; no change to `IssueList` is required.

## Accessibility

Every filter control must be reachable by `Tab` alone and operable with its native key (a
`<select>` with arrow keys, a checkbox with `Space`, a text input by typing), and must have
an accessible name — either a `<label htmlFor>` pairing or an `aria-label`. The existing
`StatusFilter` demonstrates both.

## Scripts

- `bun run dev` — start the dev server.
- `bun run build` — production build.
- `bun run start` — serve the production build on `${PORT:-4174}`.
- `bun run typecheck` — `tsc --noEmit`.
