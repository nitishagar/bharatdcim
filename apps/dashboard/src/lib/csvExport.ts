/**
 * Serialises headers + rows into RFC 4180 CSV and triggers a browser download.
 * All values are double-quoted; internal double-quotes are escaped as "".
 */
export function exportToCSV(
  filename: string,
  headers: string[],
  rows: string[][],
): void {
  const escape = (v: string) => `"${String(v).replace(/"/g, '""')}"`;

  const lines = [
    headers.map(escape).join(','),
    ...rows.map((row) => row.map(escape).join(',')),
  ];
  const csv = lines.join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
