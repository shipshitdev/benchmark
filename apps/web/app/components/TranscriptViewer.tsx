import type { TranscriptLine } from '@/lib/data';

const RENDER_LIMIT = 800;

function stringField(event: Record<string, unknown> | null, keys: string[]): string | undefined {
  if (!event) return undefined;
  for (const key of keys) {
    const value = event[key];
    if (typeof value === 'string') return value;
  }
  return undefined;
}

/** The transcript format is adapter-specific JSON lines, so this stays heuristic: any event whose
 *  type/kind field mentions "tool" renders collapsed via native `<details>`, everything else
 *  renders open. No client JS — the export stays fully static. */
function isToolCall(event: Record<string, unknown> | null): boolean {
  const marker = stringField(event, ['type', 'kind', 'event']);
  return marker !== undefined && /tool/i.test(marker);
}

export function TranscriptViewer({ lines }: { lines: TranscriptLine[] }) {
  if (lines.length === 0) {
    return <p className="text-sm text-text-faint">No transcript recorded for this run.</p>;
  }
  const shown = lines.slice(0, RENDER_LIMIT);
  return (
    <div className="space-y-1.5 font-mono text-xs">
      {shown.map((line) => {
        if (isToolCall(line.event)) {
          const name = stringField(line.event, ['name', 'tool', 'tool_name']) ?? 'unnamed tool';
          return (
            <details
              key={line.index}
              className="rounded border border-border bg-bg-raised px-3 py-2"
            >
              <summary className="cursor-pointer text-text-dim">
                #{line.index} · tool call · {name}
              </summary>
              <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-text-faint">
                {JSON.stringify(line.event, null, 2)}
              </pre>
            </details>
          );
        }
        return (
          <pre
            key={line.index}
            className="overflow-x-auto whitespace-pre-wrap rounded border border-border px-3 py-2 text-text-dim"
          >
            {line.event ? JSON.stringify(line.event, null, 2) : line.raw}
          </pre>
        );
      })}
      {lines.length > RENDER_LIMIT && (
        <p className="pt-2 text-text-faint">
          Showing the first {RENDER_LIMIT.toLocaleString('en-US')} of{' '}
          {lines.length.toLocaleString('en-US')} events.
        </p>
      )}
    </div>
  );
}
