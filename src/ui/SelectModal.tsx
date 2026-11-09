import type { ComponentChildren } from 'preact';
import { useMemo } from 'preact/hooks';
import { useOpen } from '../lib/modalRoute';
import type { IconType } from '../lib/uiTypes';
import { Button } from './Button';
import { Icon } from './Icon';
import { type SelectionGroup, type SelectionItem, type SelectionPreset, type SelectionSortColumn, SelectionModal } from './Select';
import { cn } from '../lib/cn';

export interface SelectModalItem<T extends string = string> {
  value: T;
  label: string;
  /** Muted caption under the label. */
  caption?: string;
  /** Own wrapped line under the caption (why a row is disabled, a warning). */
  note?: string;
  /** Right-aligned detail on the row (an amount, a count). */
  detail?: ComponentChildren;
  icon?: IconType;
  disabled?: boolean;
  /** Sort values by column key (`sortColumns`), e.g. `{ value: 1200 }`. */
  data?: Record<string, string | number | null>;
  /** Section (`groups` id): the chain of a pool leg, say. */
  group?: string;
}

/** Up to two initials by grapheme (an emoji or accented letter is one), skipping a leading "0x" of an address. */
const initials = (label: string): string =>
  label.replace(/^0x/i, '').split(/[\s_-]+/).filter(Boolean).map((w) => Array.from(w)[0]!).slice(0, 2).join('').toUpperCase() || '?';

/** A 32px rounded-square mark with initials, for rows that have no brand glyph (a Safe, an account): the same frame as a network mark in the main app. */
export function InitialsGlyph({ label, color, className }: { label: string; /** Tint (a CSS colour): text and a soft fill of it, e.g. a Safe's colour. */ color?: string; className?: string }) {
  return (
    <span aria-hidden="true" style={color ? { color, backgroundColor: `color-mix(in srgb, ${color} 18%, transparent)` } : undefined} className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-xs font-title text-xs font-semibold ring-1 ring-bg-0', !color && 'bg-bg-3 text-fg-1', className)}>
      {initials(label)}
    </span>
  );
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
  /** Trigger text instead of the default (multi: the label + count), e.g. "5 of 6 tokens selected". */
  triggerLabel?: string;
  /** Show the selected row's icon before its label in the trigger (a Safe's colour dot). Single only. */
  triggerIcon?: boolean;
  /** Sortable columns beside the pinned primary column, as the main app's chain modal (`Network / Chain ID`). */
  sortColumns?: SelectionSortColumn[];
  primaryColumnLabel?: string;
  /** Row pinned above the list. */
  listHeader?: ComponentChildren;
  /** Sections of the list (rows carry `group`): a chain heading its pools; empty sections show their `note`. */
  groups?: readonly SelectionGroup[];
}

const toItem = <T extends string>(i: SelectModalItem<T>): SelectionItem => ({ id: i.value, label: i.label, caption: i.caption, note: i.note, badge: i.detail, icon: i.icon, disabled: i.disabled, data: i.data, group: i.group });

/** Single choice: a trigger Button (label + current value) that opens the modal picker. THE selector of the design system: no dropdown popups. */
export function SelectModal<T extends string>({ value, onChange, items, label, title, searchPlaceholder = 'Search…', routeKey, applyLabel, triggerIcon = false, sortColumns, primaryColumnLabel, listHeader, groups }: Common<T> & { value: T | ''; onChange: (v: T) => void }) {
  const [open, setOpen] = useOpen(routeKey);
  const sel = useMemo(() => items.map(toItem), [items]);
  const cur = items.find((i) => i.value === value);
  return (
    <>
      <Button type="button" size="sm" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-expanded={open} rightIcon={<Icon name="caret-down" className="h-3.5 w-3.5 shrink-0 text-fg-3" />}>
        {triggerIcon && cur?.icon && typeof cur.icon !== 'string' ? <span className="flex h-5 w-5 shrink-0 items-center justify-center [&>*]:h-5 [&>*]:w-5 [&>*]:text-2xs">{cur.icon}</span> : null}
        <span className="min-w-0 max-w-[10rem] truncate">{cur?.label ?? label}</span>
      </Button>
      <SelectionModal
        isOpen={open}
        onClose={() => setOpen(false)}
        title={title ?? label}
        searchPlaceholder={searchPlaceholder}
        items={sel}
        selectedIds={value ? [value] : []}
        onSelect={(ids) => { const v = (Array.isArray(ids) ? ids[0] : ids) as T | undefined; setOpen(false, v !== undefined ? () => onChange(v) : undefined); }}
        applyLabel={applyLabel}
        sortColumns={sortColumns}
        primaryColumnLabel={primaryColumnLabel}
        listHeader={listHeader}
        groups={groups}
        size="sm"
      />
    </>
  );
}

/** Several choices: the same trigger, the modal in multi mode (Select all / none, Apply). THE multi picker of chains, pools, legs and
 *  assets: `groups` sections the list (pools by chain), `presets` are the quick picks (Whole DEX, a pool, an asset). */
export function MultiSelectModal<T extends string>({ value, onChange, items, label, title, searchPlaceholder = 'Search…', routeKey, applyLabel = 'Apply', allLabel = 'All', triggerLabel, triggerContent, sortColumns, primaryColumnLabel, listHeader, groups, presets, disabled, labels }: Common<T> & {
  value: readonly T[];
  onChange: (v: T[]) => void;
  allLabel?: string;
  /** Trigger body instead of the label + count (stacked chain marks, a scope summary). */
  triggerContent?: ComponentChildren;
  presets?: readonly SelectionPreset[];
  disabled?: boolean;
  labels?: Parameters<typeof SelectionModal>[0]['labels'];
}) {
  const [open, setOpen] = useOpen(routeKey);
  const sel = useMemo(() => items.map(toItem), [items]);
  const all = items.length > 0 && value.length >= items.length;
  return (
    <>
      <Button type="button" size="sm" disabled={disabled} onClick={() => setOpen(true)} aria-haspopup="dialog" aria-expanded={open} rightIcon={<Icon name="caret-down" className="h-3.5 w-3.5 shrink-0 text-fg-3" />}>
        {(triggerContent ?? triggerLabel) ? (triggerContent ?? <span>{triggerLabel}</span>) : <><span>{label}</span><span className="text-fg-2">{all ? allLabel : value.length}</span></>}
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
        onSelect={(ids) => setOpen(false, () => onChange((Array.isArray(ids) ? ids : [ids]) as T[]))}
        applyLabel={applyLabel}
        sortColumns={sortColumns}
        primaryColumnLabel={primaryColumnLabel}
        listHeader={listHeader}
        groups={groups}
        presets={presets}
        labels={labels}
        size="sm"
      />
    </>
  );
}
