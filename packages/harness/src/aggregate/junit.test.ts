import { describe, expect, test } from 'bun:test';
import { parseJunit } from './junit';

describe('parseJunit', () => {
  test('reads a single testsuite', () => {
    const xml = '<testsuite name="a" tests="10" failures="2" errors="1" skipped="1"></testsuite>';
    expect(parseJunit(xml)).toEqual({
      tests: 10,
      failures: 2,
      errors: 1,
      skipped: 1,
      passRate: 0.7,
    });
  });

  test('sums multiple testsuite tags under testsuites', () => {
    const xml = [
      '<testsuites>',
      '<testsuite name="a" tests="4" failures="0" errors="0" skipped="0"></testsuite>',
      '<testsuite name="b" tests="6" failures="1" errors="0" skipped="0"></testsuite>',
      '</testsuites>',
    ].join('\n');
    expect(parseJunit(xml)).toEqual({
      tests: 10,
      failures: 1,
      errors: 0,
      skipped: 0,
      passRate: 0.9,
    });
  });

  test('is 0 for an empty report', () => {
    expect(parseJunit('<testsuites></testsuites>')).toEqual({
      tests: 0,
      failures: 0,
      errors: 0,
      skipped: 0,
      passRate: 0,
    });
  });
});
