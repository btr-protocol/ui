import type { ComponentChildren } from 'preact';
import { useMemo } from 'preact/hooks';
import { useOpen } from '../lib/modalRoute';
import type { IconType } from '../lib/uiTypes';
import { Button } from './Button';
import { Icon } from './Icon';
import { type SelectionItem, SelectionModal } from './Select';

export interface SelectModalItem<T extends string = string> {
  value: T;
  label: string;
  /** Muted caption under the label. */
  caption?: string;
  /** Right-aligned detail on the row (an amount, a count). */
  detail?: ComponentChildren;
  icon?: IconType;
  disabled?: boolean;
}

interface Common<T extends string> {
  items: readonly SelectModalItem<T>[];
  /** Trigger label (what is being chosen: "Safe", "Network"). */
  label: string;
  /** Modal title; defaults to `label`. */
  title?: string;
  searchPlaceholder?: string;
  /** History key: the modal is a route entry (Back closes it). Required: every sheet is routed. */
  routeKey: string;
  className?: string;
  /** Apply button label (multi). */
  applyLabel?: string;
}

const toItem = <T extends string>(i: SelectModalItem<T>): SelectionItem => ({ id: i.value, label: i.label, caption: i.caption, badge: i.detail, icon: i.icon, disabled: i.disabled });

/** Single choice: a trigger Button (label + current value) that opens the modal picker. THE selector of the design system: no dropdown popups. */
export function SelectModal<T extends string>({ value, onChange, items, label, title, searchPlaceholder = 'Search…', routeKey, applyLabel }: Common<T> & { value: T | ''; onChange: (v: T) => void }) {
  const [open, setOpen] = useOpen(routeKey);
  const sel = useMemo(() => items.map(toItem), [items]);
  const cur = items.find((i) => i.value === value);
  return (
    <>
      <Button type="button" size="sm" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-expanded={open} rightIcon={<Icon name="caret-down" className="h-3.5 w-3.5 shrink-0 text-fg-3" />}>
        <span className="min-w-0 max-w-[10rem] truncate">{cur?.label ?? label}</span>
      </Button>
      <SelectionModal
        isOpen={open}
        onClose={() => setOpen(false)}
        title={title ?? label}
        searchPlaceholder={searchPlaceholder}
        items={sel}
        selectedIds={value ? [value] : []}
        onSelect={(ids) => { setOpen(false); const v = (Array.isArray(ids) ? ids[0] : ids) as T | undefined; if (v !== undefined) onChange(v); }}
        applyLabel={applyLabel}
        size="sm"
      />
    </>
  );
}

/** Several choices: the same trigger, the modal in multi mode (Select all / none, Apply). */
export function MultiSelectModal<T extends string>({ value, onChange, items, label, title, searchPlaceholder = 'Search…', routeKey, applyLabel = 'Apply', allLabel = 'All' }: Common<T> & { value: readonly T[]; onChange: (v: T[]) => void; allLabel?: string }) {
  const [open, setOpen] = useOpen(routeKey);
  const sel = useMemo(() => items.map(toItem), [items]);
  const all = items.length > 0 && value.length >= items.length;
  return (
    <>
      <Button type="button" size="sm" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-expanded={open} rightIcon={<Icon name="caret-down" className="h-3.5 w-3.5 shrink-0 text-fg-3" />}>
        <span>{label}</span>
        <span className="text-fg-2">{all ? allLabel : value.length}</span>
      </Button>
      <SelectionModal
        isOpen={open}
        onClose={() => setOpen(false)}
        title={title ?? label}
        searchPlaceholder={searchPlaceholder}
        items={sel}
        selectedIds={value.map(String)}
        multiSelect
        minSelect={0}
        onSelect={(ids) => { setOpen(false); onChange((Array.isArray(ids) ? ids : [ids]) as T[]); }}
        applyLabel={applyLabel}
        size="sm"
      />
    </>
  );
}
