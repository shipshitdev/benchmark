# Fix the reported date range bug

`ISSUE.md` in this directory describes a bug reported against this library, with a symptom,
a minimal repro, and the expected behavior. Read it, then fix the bug.

## Requirements

- Fix the root cause of the behavior described in `ISSUE.md`. Do not special-case the exact
  repro; fix the underlying logic so every equivalent input behaves correctly.
- Keep every existing test in `test/` passing.
- Add at least one new test that reproduces the reported bug and would fail against the old
  code, alongside the existing tests.

## Constraints

- Do not change the public API of `src/index.ts` (function names, parameter order, or
  return shapes) unless the bug cannot be fixed without it; if you do, update every caller
  in this fixture.
- Do not add a third-party date library; this project has none as a dependency and should
  keep it that way.

Work only within this fixture directory.
