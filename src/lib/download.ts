/** Client-side file export: CSV from rows, and a Blob download. No server, works from file://. */

const cell = (v: unknown): string => {
  if (v == null) return '';
  let s = typeof v === 'number' ? (Number.isFinite(v) ? String(v) : '') : String(v);
  // A cell a spreadsheet would run as a formula (= + - @, tab, CR) gets a leading apostrophe. Numbers are data, not formulas.
  if (typeof v !== 'number' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
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
