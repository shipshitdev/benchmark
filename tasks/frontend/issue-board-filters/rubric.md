# Rubric: Issue board filters

Score each dimension 0 to 4, based on the diff and the screenshots.

## Code quality and pattern conformance (weight 50)

- 0: New code ignores the existing `components/` and `lib/` structure, introduces a
  different state-management approach than the existing status filter, or duplicates logic
  the fixture already provides.
- 1: Code runs but the new filters are implemented as one large, unstructured addition
  rather than following the existing per-filter component shape.
- 2: New filters mirror the existing status filter's structure and naming, but with
  noticeable inconsistency (different prop shapes, mixed conventions, or logic that should
  live in `lib/` left inline in a component).
- 3: New filters closely match the existing status filter's component boundaries, state
  handling, and URL-sync approach, with clear, single-purpose functions in `lib/`.
- 4: Indistinguishable in style and structure from code the fixture's original author would
  have written: consistent naming, no duplication between the label, assignee, and search
  filters, and a `lib/` layer that composes cleanly with the existing status filter.

## UX polish (weight 50)

- 0: One or more required filters (label, assignee, search) does not work, or filter state
  is lost on reload despite being expected in the URL.
- 1: Filters work but combining more than one produces wrong results, or the empty state is
  missing or confusing.
- 2: All filters work individually and combine correctly, with a plain empty state and
  basic keyboard access, but interactions feel rough (no clear indication of active filters,
  awkward multi-select for labels).
- 3: Filters combine correctly, the empty state is clear and helpful, active filters are
  visibly indicated, and every control is comfortably keyboard-operable.
- 4: The filtering experience feels considered end to end: clearing filters is easy and
  discoverable, the label multi-select and assignee filter are pleasant to use with a
  keyboard or a mouse, and the empty state suggests a next action.
