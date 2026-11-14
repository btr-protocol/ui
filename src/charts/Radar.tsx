// Radar: several 0..1 scores on n axes (strategy vs folio). SVG polygons over rings; colours are series tokens (`seriesCss`), legend below.
import { cn } from '../lib/cn';
import { seriesCss } from './heatmapMath';

export interface RadarAxis {
  key: string;
  label: string;
}
export interface RadarSeries {
  id: string;
  label: string;
  /** By axis key, 0..1; null = no data (drawn at the centre and listed in the tooltip). */
  values: Record<string, number | null | undefined>;
  color?: string;
}

export interface RadarProps {
  axes: readonly RadarAxis[];
  series: readonly RadarSeries[];
  label: string;
  size?: number;
  className?: string;
  /** Value text of a score in tooltips (default 2 decimals). */
  format?: (v: number) => string;
}

/** A score as drawn: a non-finite value (NaN, Infinity) is missing data, same as null. */
export const score = (v: number | null | undefined): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

export function Radar({ axes, series, label, size = 280, className, format = (v) => v.toFixed(2) }: RadarProps) {
  const n = axes.length;
  const R = 100;
  const pt = (i: number, r: number): [number, number] => [r * Math.sin((2 * Math.PI * i) / n), -r * Math.cos((2 * Math.PI * i) / n)];
  const poly = (vals: Record<string, number | null | undefined>) =>
    axes.map((a, i) => pt(i, R * Math.min(1, Math.max(0, score(vals[a.key]) ?? 0))).map((x) => x.toFixed(1)).join(',')).join(' ');
  return (
    <div className={cn('flex min-w-0 flex-col items-center gap-2', className)}>
      <svg viewBox="-175 -125 350 250" width={size} height={(size * 250) / 350} role="img" aria-label={label} className="max-w-full">
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <polygon key={f} points={axes.map((_, i) => pt(i, R * f).map((x) => x.toFixed(1)).join(',')).join(' ')} fill="none" stroke="var(--border-color)" strokeWidth="0.8" />
        ))}
        {axes.map((a, i) => (
          <g key={a.key}>
            <line x1="0" y1="0" x2={pt(i, R)[0]} y2={pt(i, R)[1]} stroke="var(--border-color)" strokeWidth="0.8" />
            <text x={pt(i, R + 9)[0]} y={pt(i, R + 9)[1] + 3} textAnchor={Math.abs(pt(i, 1)[0]) < 0.2 ? 'middle' : pt(i, 1)[0] > 0 ? 'start' : 'end'} className="fill-fg-1 text-2xs">
              {a.label}
            </text>
          </g>
        ))}
        {series.map((s, k) => {
          const c = s.color ?? seriesCss(k);
          return (
            <polygon key={s.id} points={poly(s.values)} fill={c} fillOpacity="0.16" stroke={c} strokeWidth="1.6" strokeLinejoin="round">
              <title>{`${s.label}: ${axes.map((a) => `${a.label} ${score(s.values[a.key]) == null ? 'n/a' : format(score(s.values[a.key]) as number)}`).join(', ')}`}</title>
            </polygon>
          );
        })}
      </svg>
      <ul className="m-0 flex list-none flex-wrap justify-center gap-x-4 gap-y-1 p-0 text-xs">
        {series.map((s, k) => (
          <li key={s.id} className="flex items-center gap-1.5 text-fg-1">
            <span aria-hidden="true" className="h-2.5 w-2.5 rounded-[2px]" style={{ background: s.color ?? seriesCss(k) }} />
            {s.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
