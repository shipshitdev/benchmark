# Audit this service

You are working inside a small Bun and TypeScript HTTP service. Audit the codebase for
security, correctness, performance, reliability, and error-handling problems, then write
your findings to `AUDIT.md` in this directory.

## What to produce

For every problem you find, include in `AUDIT.md`:

- The file and line number (or line range) where it occurs.
- A short summary of the problem.
- Its severity (critical, high, medium, or low) and why you rated it that way.
- The fix you recommend, specific enough that another engineer could implement it without
  further investigation.

After listing the individual findings, add a remediation plan that sequences the fixes: say
which should be fixed first and why, call out any fix that depends on another, and flag
anything that needs a production migration or a coordinated rollout rather than a plain code
change.

## Constraints

- Do not modify any file except `AUDIT.md`. This is a read-only audit; do not fix the issues
  you find.
- Only report problems you can point to in this codebase. Do not pad the report with
  speculative or generic advice that isn't tied to a specific location in the code.
- Read every file in the service before concluding your audit; do not stop at the first
  file that looks suspicious.

Work only within this fixture directory.
