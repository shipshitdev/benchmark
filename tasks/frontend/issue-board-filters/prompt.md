# Add filters to the issue board

You are working inside an existing Next.js app that renders a list of issues on the home
page (`/`), reading from static JSON data. There is already one working filter, for issue
status. Read `README.md` in this fixture before making changes; it documents the existing
`components/` and `lib/` structure and the `data-testid` convention used by this app's
tests.

## Requirements

Add the following to the existing issue board, matching the way the status filter is
already built (same folder, same state and query-param approach, same component style):

- A label filter that lets the user select multiple labels at once. An issue matches when it
  has at least one of the selected labels.
- An assignee filter that lets the user pick a single assignee (or "unassigned").
- A free-text search box that filters issues by matching the search text against the issue
  title, case-insensitively.
- All filter state (status, labels, assignees, search text) must be reflected in the URL
  query string, so that reloading the page or sharing the URL preserves the current filters.
- When the combination of active filters matches zero issues, show a clear empty state
  instead of an empty list.
- Every new interactive control must be usable with the keyboard alone (tab to reach it,
  and the expected key operates it), and must have an accessible name.
- Use the existing `data-testid` convention documented in the README for every new
  interactive element, so they are consistent with the existing status filter's test ids.

## Constraints

- Follow the existing patterns in `components/` and `lib/` rather than introducing a new
  state-management approach, a new folder layout, or a new UI library.
- Do not change the on-disk shape of the issue data or remove the existing status filter.
- Keep `bun run build`, `bun run start`, and `bun run typecheck` working exactly as
  documented in the fixture's README.

Work only within this fixture directory.
