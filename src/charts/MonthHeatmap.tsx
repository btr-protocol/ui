import { Heatmap } from './Heatmap';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Year x month heatmap of a `{ 'YYYY-MM': ratio }` map (returns): cell text is whole percent, hover reads `format`. */
export function MonthHeatmap({ values, format, label = 'Monthly returns' }: { values: Record<string, number>; format: (v: number) => string; label?: string }) {
  const years = [...new Set(Object.keys(values).map((k) => k.slice(0, 4)))].sort();
  if (!years.length) return <p className="text-sm text-fg-2">Not enough history.</p>;
  return (
    <Heatmap
      label={label}
      rows={years}
      cols={MONTHS}
      values={years.map((y) => MONTHS.map((_, i) => values[`${y}-${String(i + 1).padStart(2, '0')}`] ?? null))}
      format={(v) => (v * 100).toFixed(0)}
      describe={(r, c, v) => `${c} ${r}: ${format(v)}`}
      cell={2.6}
      labelWidth={3}
    />
  );
}
