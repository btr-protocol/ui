import { Checkbox } from '../ui/Checkbox';

export interface SeriesItem {
  id: string;
  label: string;
  /** One muted figure at the right (Sharpe, last value). */
  note?: string;
}

/** Series selector: check box, swatch in the series' colour, name, one figure. The left slot of a `ChartStack`. */
export function SeriesSelector({ items, selected, onChange, colorOf }: { items: readonly SeriesItem[]; selected: readonly string[]; onChange: (ids: string[]) => void; colorOf: (id: string) => string }) {
  return (
    <div className="max-h-[26rem] overflow-y-auto">
      {items.map((it) => (
        <label key={it.id} className="flex h-7 cursor-pointer items-center gap-2 px-3 text-xs hover:bg-bg-2">
          <Checkbox checked={selected.includes(it.id)} onChange={() => onChange(selected.includes(it.id) ? selected.filter((n) => n !== it.id) : [...selected, it.id])} />
          <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-[2px]" style={{ background: selected.includes(it.id) ? colorOf(it.id) : 'transparent' }} />
          <span className="min-w-0 flex-1 truncate text-fg-1" title={it.label}>{it.label}</span>
          <span className="font-numeric tabular-nums text-fg-2">{it.note}</span>
        </label>
      ))}
    </div>
  );
}
