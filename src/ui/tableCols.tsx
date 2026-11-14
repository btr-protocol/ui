import { cn } from '../lib/cn';
import type { TableColumn } from './Table';

/** Numeric column: right-aligned, tabular figures, sortable on the raw number; `tone` colours the text (negatives red), `hint` is the header's ⓘ. */
export function numCol<R>(
  key: string,
  label: string,
  get: (r: R) => number | null | undefined,
  fmt: (v: number | null | undefined) => string,
  o: { tone?: (v: number | null | undefined) => string; hint?: string } = {},
): TableColumn<R> {
  return {
    key,
    label,
    sortable: true,
    align: 'right',
    hint: o.hint ? { label, content: o.hint } : undefined,
    getValue: (r) => get(r) ?? null,
    render: (r) => <span className={cn('font-numeric tabular-nums', o.tone?.(get(r)))}>{fmt(get(r))}</span>,
  };
}

/** Text column (sortable by default). */
export function textCol<R>(key: string, label: string, get: (r: R) => string | number | null | undefined, o: { sortable?: boolean; className?: string } = {}): TableColumn<R> {
  return { key, label, sortable: o.sortable ?? true, getValue: (r) => get(r) ?? '', render: (r) => <span className={o.className}>{get(r) ?? ''}</span> };
}
