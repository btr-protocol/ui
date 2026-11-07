/**
 * Design tokens - single source of truth
 * Moved from components/ui/sizes.ts for centralization
 */

export type Size = 'xs' | 'sm' | 'default';

/** Display type for the token-amount input (`Input variant="amount"`): type only, no box. */
export type AmountSize = 'xl' | 'compact-xl';
export const AMOUNT_TEXT: Record<AmountSize, string> = {
  xl: 'text-xl',
  'compact-xl': 'text-2xl leading-tight',
};

// ============================================================================
// Border Radius
// ============================================================================

export const BORDER_RADIUS = 'rounded-sm' as const;

// ============================================================================
// Size Scales
// ============================================================================

/** Heights ride --ctl-s/m/l (styles/constants.css): 24/32/40 on desktop and mobile. */
export const SIZE_HEIGHTS = {
  xs: 'h-[var(--ctl-s)]',
  sm: 'h-[var(--ctl-m)]',
  default: 'h-[var(--ctl-l)]',
} as const;

export const SIZE_ICON_WIDTHS = {
  xs: 'w-[var(--ctl-s)]',
  sm: 'w-[var(--ctl-m)]',
  default: 'w-[var(--ctl-l)]',
} as const;

export const SIZE_PADDINGS = {
  xs: 'px-2',
  sm: 'px-3',
  default: 'px-4',
} as const;

export const SIZE_TEXT = {
  xs: 'text-xs',
  sm: 'text-sm',
  default: 'text-base',
} as const;

/**
 * A leading icon reads as lighter than a glyph of text, so the padding that looks right before a
 * word looks too wide before an icon. Pull it back by a fraction of a step so the optical left
 * inset matches the right one. Leading only: a trailing icon sits against the right padding, which
 * `PADDING_X.right` already trims.
 */
export const SIZE_LEADING_ICON_OFFSET = {
  xs: '-ml-0.5',
  sm: '-ml-0.5',
  default: '-ml-1',
} as const;

export const SIZE_GAPS = {
  xs: 'gap-1',
  sm: 'gap-1.5',
  default: 'gap-1.5',
} as const;

export const SIZE_CHECK = {
  xs: 'w-3 h-3',
  sm: 'w-3.5 h-3.5',
  default: 'w-4 h-4',
} as const;

/** Menu rows: compact under a mouse, ctl-tall under a finger. */
export const DROPDOWN_ITEM_SIZES = {
  xs: {
    item: 'px-2 py-1 text-xs gap-1.5 coarse:min-h-[var(--ctl-s)]',
    icon: 'w-3 h-3',
    check: 'w-3 h-3',
  },
  sm: {
    item: 'px-2 py-1.5 text-xs gap-2 coarse:min-h-[var(--ctl-m)]',
    icon: 'w-3.5 h-3.5',
    check: 'w-3.5 h-3.5',
  },
  default: {
    item: 'px-3 py-2 text-sm gap-2.5 coarse:min-h-[var(--ctl-m)]',
    icon: 'w-4 h-4',
    check: 'w-4 h-4',
  },
} as const;
