function lineClass(line: string): string {
  if (line.startsWith('+') && !line.startsWith('+++')) return 'text-good';
  if (line.startsWith('-') && !line.startsWith('---')) return 'text-bad';
  if (line.startsWith('@@')) return 'text-accent';
  if (line.startsWith('diff ') || line.startsWith('index ')) return 'text-text-faint';
  return 'text-text-dim';
}

export function DiffViewer({ diff }: { diff: string | null }) {
  if (!diff) return <p className="text-sm text-text-faint">No diff recorded for this run.</p>;
  const lines = diff.split('\n');
  return (
    <pre className="overflow-x-auto rounded border border-border bg-bg-inset p-4 text-xs leading-relaxed">
      {lines.map((line, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: diff lines have no natural id and only ever append
        <div key={i} className={lineClass(line)}>
          {line.length > 0 ? line : ' '}
        </div>
      ))}
    </pre>
  );
}
