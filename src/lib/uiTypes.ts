import type { ComponentChildren } from 'preact';

/** CSS class name, SVG path, or ComponentChildren. */
export type IconType = string | ComponentChildren;

/** SelectionModal item. */
export interface SelectionItem {
  id: string;
  label: string;
  caption?: string;
  /** Own wrapped line under the caption (a reason, a warning): never truncated. */
  note?: string;
  icon?: IconType;
  miniIcon?: IconType; // compact FilterButton display
  badge?: ComponentChildren;
  data?: unknown;
  disabled?: boolean;
  /** Stays first, whatever the sort (an "All" scope row); still a normal row for search, keyboard and selection. */
  pinned?: boolean;
  /** Section of the row (`SelectionModal` `groups`: e.g. the chain of a pool leg). */
  group?: string;
  /** Filter chip ids the row answers to (`SelectionList` `filters`). */
  tags?: string[];
}

/** Dropdown menu item. */
export interface DropdownItem<T = string> {
  value: T;
  label: string;
  icon?: IconType;
  disabled?: boolean;
  tooltip?: string;
  /** Renders the item as an external link rather than a button. */
  href?: string;
  /** Muted right-aligned value on the row (an amount, a count). Inert: the whole row stays the hit target. */
  detail?: ComponentChildren;
  /** Control rendered immediately after the label (e.g. InfoBox), before the check. */
  trailing?: ComponentChildren;
}
