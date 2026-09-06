/** Minimal fixed-width table for CLI output; no ANSI, no dependency. */
export function renderTable(headers: string[], rows: string[][]): string {
  const widths = headers.map((header, column) =>
    Math.max(header.length, ...rows.map((row) => (row[column] ?? '').length)),
  );
  const renderRow = (cells: string[]) =>
    cells.map((cell, column) => cell.padEnd(widths[column] ?? 0)).join('  ');
  const separator = widths.map((width) => '-'.repeat(width)).join('  ');
  return [renderRow(headers), separator, ...rows.map(renderRow)].join('\n');
}
