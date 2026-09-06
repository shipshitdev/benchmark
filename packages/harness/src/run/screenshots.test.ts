import { describe, expect, test } from 'bun:test';
import { slugify } from './screenshots';

describe('slugify', () => {
  test('turns a path into a filename-safe slug', () => {
    expect(slugify('/pricing')).toBe('pricing');
    expect(slugify('/blog/post-1')).toBe('blog-post-1');
  });

  test('falls back to "root" for the home path', () => {
    expect(slugify('/')).toBe('root');
  });
});
