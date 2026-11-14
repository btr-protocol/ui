import type { ComponentChildren } from 'preact';
import { cn } from '../lib/cn';
import { Tooltip } from './FloatingPanel';
import { Table, type TableColumn } from './Table';

/** One metric across N columns: display strings, raw numbers (best / worst marking) and which direction wins. */
export interface MatrixRow {
  key: string;
  label: string;
  /** Definition shown on hover of the label. */
  def?: string;
  cells: string[];
  raw?: (number | null | undefined)[];
  better?: 'hi' | 'lo';
}

/** A label with its definition on hover (dotted underline). */
export const HintLabel = ({ text, tip }: { text: string; tip: string }) => (
  <Tooltip content={tip} side="top" maxWidth="22rem">
    <span className="cursor-help underline decoration-dotted decoration-fg-3 underline-offset-2">{text}</span>
  </Tooltip>
);

const tone = (r: MatrixRow, i: number): string => {
  const v = (r.raw ?? []).filter((x): x is number => x != null && Number.isFinite(x));
  const x = r.raw?.[i];
  if (!r.better || v.length < 2 || x == null || new Set(v).size < 2) return '';
  const hi = r.better === 'hi';
  return x === (hi ? Math.max(...v) : Math.min(...v)) ? 'text-green' : x === (hi ? Math.min(...v) : Math.max(...v)) ? 'text-red' : '';
};

/** Comparison matrix: rows = metrics, one column per item; the best / worst cell of a row is coloured; `diff` colours rows whose cells differ. */
export function MatrixTable({ title, cols, rows, meta, diff = false }: { title: string; cols: { id: string; label: string }[]; rows: MatrixRow[]; meta?: ComponentChildren; diff?: boolean }) {
  const columns: TableColumn<MatrixRow>[] = [
    { key: 'l', label: 'metric', render: (r) => (r.def ? <HintLabel text={r.label} tip={r.def} /> : <span className="text-fg-1">{r.label}</span>) },
    ...cols.map((c, i) => ({
      key: c.id,
      label: c.label,
      align: 'right' as const,
      render: (r: MatrixRow) => <span className={cn('block font-numeric tabular-nums', diff && new Set(r.cells).size > 1 && 'text-primary', tone(r, i))}>{r.cells[i]}</span>,
    })),
  ];
  return <Table variant="compact" scrollX searchable={false} stackBelow="lg" title={title} meta={meta} columns={columns} data={rows} rowKey={(r) => r.key} />;
}
