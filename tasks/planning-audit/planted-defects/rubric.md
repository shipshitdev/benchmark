# Rubric: Codebase audit report

Score each dimension 0 to 4, based on `AUDIT.md`.

## Actionability (weight 40)

- 0: Findings are vague ("improve error handling") with no file, line, or concrete fix.
- 1: Findings name a file but the recommended fix is generic advice rather than a specific
  change.
- 2: Most findings name a file, line, and a fix, but some fixes are too vague for an
  engineer to implement without re-investigating the issue.
- 3: Every finding names a file and line, states the problem clearly, and gives a fix
  specific enough to implement directly.
- 4: All of the above, plus fixes that account for the surrounding code (naming the actual
  function or variable to change, and noting any caller that would need to change too).

## Sequencing and risk coverage (weight 30)

- 0: No remediation plan, or findings are listed with no stated order.
- 1: A plan exists but is just the findings list re-ordered by severity label with no
  reasoning.
- 2: The plan orders fixes sensibly and gives some reasoning, but misses a real dependency
  between two findings (fixing one changes how the other should be fixed) or ignores
  rollout risk entirely.
- 3: The plan correctly sequences dependent fixes, gives a reason for the ordering, and
  flags which fixes are safe as a plain code change versus which need a migration or
  coordinated rollout.
- 4: All of the above, plus a plan that groups fixes into batches that could ship as
  separate, independently verifiable changes rather than one large patch.

## Precision (weight 30)

- 0: The report includes findings that do not correspond to anything in the actual code
  (hallucinated issues), or misidentifies severity in a way that would misdirect a team.
- 1: Mostly accurate, but at least one finding is materially wrong about what the code does.
- 2: All findings are accurate, but severity ratings are inconsistent (e.g., a planted
  security issue rated the same as a minor style nit).
- 3: All findings are accurate with reasonable, consistent severity ratings, and the report
  does not pad itself with speculative issues beyond what the code supports.
- 4: All of the above, plus every stated severity is justified by a concrete consequence
  (data exposure, incorrect results, an outage path) rather than a bare label.
