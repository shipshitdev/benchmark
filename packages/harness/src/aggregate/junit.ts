export interface JunitSummary {
  tests: number;
  failures: number;
  errors: number;
  skipped: number;
  /** (tests - failures - errors) / tests; skipped tests count toward the denominator, not the pass count. */
  passRate: number;
}

function attrNumber(tag: string, name: string): number {
  const match = new RegExp(`${name}="(\\d+)"`).exec(tag);
  return match?.[1] ? Number(match[1]) : 0;
}

/**
 * Sums `tests`/`failures`/`errors`/`skipped` across every `<testsuite>` tag, whether the file is a
 * single suite or wrapped in `<testsuites>` with several. Attribute regex over a DOM parser keeps
 * this dependency-free; `bun test --reporter=junit` output has no nesting that would confuse it.
 */
export function parseJunit(xml: string): JunitSummary {
  const suiteTags = xml.match(/<testsuite\b[^>]*>/g) ?? [];
  let tests = 0;
  let failures = 0;
  let errors = 0;
  let skipped = 0;
  for (const tag of suiteTags) {
    tests += attrNumber(tag, 'tests');
    failures += attrNumber(tag, 'failures');
    errors += attrNumber(tag, 'errors');
    skipped += attrNumber(tag, 'skipped');
  }
  const passed = Math.max(0, tests - failures - errors);
  return { tests, failures, errors, skipped, passRate: tests > 0 ? passed / tests : 0 };
}
