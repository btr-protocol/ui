import type { ComponentChildren } from 'preact';
import { cn } from '../lib/cn';

export interface KeyValueRow {
  key: string;
  label: ComponentChildren;
  value: ComponentChildren;
}
export interface KeyValueSection {
  id: string;
  /** Section heading band (omit for the first, headless block). */
  title?: ComponentChildren;
  /** Key / value rows, or free content (a call tree) in `children`. */
  rows?: readonly KeyValueRow[];
  children?: ComponentChildren;
}

/** ONE bordered block with one row style: label | value rows, optional titled sections. Outer border + radius, divided rows, no nested boxes.
 *  For hashes, nonce, decoded calls: anything a reader compares line by line. */
export function KeyValueTable({ sections, className }: { sections: readonly KeyValueSection[]; className?: string }) {
  return (
    <div className={cn('surface divide-y divide-border overflow-hidden rounded-lg border border-border bg-bg-1', className)}>
      {sections.map((s) => (
        <section key={s.id}>
          {s.title && <h4 className="bg-bg-2 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-fg-2">{s.title}</h4>}
          {s.rows && (
            <dl className="divide-y divide-border">
              {s.rows.map((r) => (
                <div key={r.key} className="grid gap-x-6 gap-y-1 px-3 py-2.5 sm:grid-cols-[10rem_minmax(0,1fr)]">
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
