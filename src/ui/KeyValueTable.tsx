import type { ComponentChildren } from 'preact';
import { cn } from '../lib/cn';

export interface KeyValueRow {
  key: string;
  label: ComponentChildren;
  value: ComponentChildren;
  /** Part of the row above (an argument under its call): no divider, tighter top. Keys stay in the one key column. */
  continued?: boolean;
}
export interface KeyValueSection {
  id: string;
  /** Section heading band (omit for the first, headless block). */
  title?: ComponentChildren;
  /** Key / value rows, or free content (a call tree) in `children`. */
  rows?: readonly KeyValueRow[];
  children?: ComponentChildren;
}

/** ONE bordered block with one row style: label | value rows (one key column for every section), optional titled sections. Outer border + radius,
 *  divided rows (a `continued` row joins the one above), no nested boxes.
 *  For hashes, nonce, decoded calls: anything a reader compares line by line. */
export function KeyValueTable({ sections, className }: { sections: readonly KeyValueSection[]; className?: string }) {
  return (
    <div className={cn('surface divide-y divide-border overflow-hidden rounded-lg border border-border bg-bg-1', className)}>
      {sections.map((s) => (
        <section key={s.id}>
          {s.title && <h4 className="bg-bg-2 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-fg-2">{s.title}</h4>}
          {s.rows && (
            <dl>
              {s.rows.map((r, i) => (
                <div key={r.key} className={cn('grid gap-x-6 gap-y-1 px-3 sm:grid-cols-[10rem_minmax(0,1fr)]', r.continued ? '-mt-1 pb-2.5' : 'py-2.5', i > 0 && !r.continued && 'border-t border-border')}>
                  <dt className="text-sm text-fg-2">{r.label}</dt>
                  <dd className="min-w-0 text-sm text-fg-1">{r.value}</dd>
                </div>
              ))}
            </dl>
          )}
          {s.children}
        </section>
      ))}
    </div>
  );
}
