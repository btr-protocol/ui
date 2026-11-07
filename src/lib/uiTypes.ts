import type { ComponentChildren } from 'preact';

/** CSS class name, SVG path, or ComponentChildren. */
export type IconType = string | ComponentChildren;

/** SelectionModal item. */
export interface SelectionItem {
  id: string;
  label: string;
  caption?: string;
  icon?: IconType;
  miniIcon?: IconType; // compact FilterButton display
  badge?: ComponentChildren;
  data?: unknown;
  disabled?: boolean;
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
  /** Control rendered immediately after the label (e.g. InfoBox), before the check. */
  trailing?: ComponentChildren;
}
