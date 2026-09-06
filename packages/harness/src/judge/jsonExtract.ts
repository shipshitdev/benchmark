/** Scans forward from `startIndex` for the `{` there to balance, honoring quoted strings. */
function findBalancedJson(text: string, startIndex: number): string | undefined {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = startIndex; i < text.length; i++) {
    const char = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === '{') depth += 1;
    else if (char === '}') {
      depth -= 1;
      if (depth === 0) return text.slice(startIndex, i + 1);
    }
  }
  return undefined;
}

/**
 * Judges are asked for strict JSON but often wrap it in prose or a markdown code fence. This
 * finds the first `{` in the text, extends to its matching `}`, and parses that; a failed parse
 * (e.g. a `{` from unrelated prose) moves on to the next `{` rather than giving up.
 */
export function extractFirstJsonObject(text: string): unknown | undefined {
  let searchFrom = 0;
  for (;;) {
    const start = text.indexOf('{', searchFrom);
    if (start === -1) return undefined;
    const candidate = findBalancedJson(text, start);
    if (candidate) {
      try {
        return JSON.parse(candidate);
      } catch {
        // not valid JSON after all; keep looking past this brace
      }
    }
    searchFrom = start + 1;
  }
}
