/** Client-side file export: CSV from rows, and a Blob download. No server, works from file://. */

const NUMERIC = /^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i;

const cell = (v: unknown): string => {
  if (v == null) return '';
  let s = typeof v === 'number' ? (Number.isFinite(v) ? String(v) : '') : String(v);
  // A cell a spreadsheet would run as a formula (= + - @, tab, CR; also after leading spaces) gets a leading apostrophe, except a plain
  // number ("-12.5", "+1", "1e-3", a bigint) which is data and would show the apostrophe in Excel.
  if (typeof v !== 'number' && !NUMERIC.test(s) && /^ *[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** CSV text (CRLF-free, header first). `rows` are arrays in column order. */
export function toCsv(header: readonly string[], rows: readonly (readonly unknown[])[]): string {
  return `${[header, ...rows].map((r) => r.map(cell).join(',')).join('\n')}\n`;
}

export function downloadText(filename: string, text: string, mime = 'text/plain'): void {
  const url = URL.createObjectURL(new Blob([text], { type: `${mime};charset=utf-8` }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
