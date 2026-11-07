import { BORDER_RADIUS, SIZE_GAPS, SIZE_PADDINGS, SIZE_TEXT } from '../lib/design';
import { cva } from '../lib/cva';
import type { ComponentChildren, JSX } from 'preact';

export interface BadgeProps {
  children: ComponentChildren;
  variant?: 'default' | 'primary' | 'positive' | 'negative' | 'code' | 'secondary' | 'chip';
  /** Renders an anchor, so a tag can be a filter link without a second component. */
  href?: string;
  className?: string;
  /**
   * DATA-DRIVEN COLOUR PAIR ONLY (`color` + `backgroundColor`), for the one case a tag's
   * colour comes from the row rather than from a variant - a per-category tint the palette
   * cannot enumerate. NEVER geometry: height, padding, radius, font-size and gap come from
   * the tokens above and overriding them here defeats the whole point of this component.
   */
  style?: JSX.CSSProperties;
}

/**
 * Badge - the ONE tag / chip / status label / kbd in the app.
 * CANONICAL COMPONENT: never hand-roll a `<span>` tag at a call site.
 *
 * Aliases: tag, chip, label, status badge, "already paired" indicator, kbd.
 *
 * Geometry is the `xs` BUTTON scale, taken from the same tokens the button
 * reads (`lib/design.ts`) rather than restated here, with a fixed h-6 (24px) height:
 *
 *   height   h-6, 24px
 *   padding  SIZE_PADDINGS.xs  px-2
 *   radius   BORDER_RADIUS     rounded-sm, 8px
 *   text     SIZE_TEXT.xs      text-xs
 *   gap      SIZE_GAPS.xs      gap-1
 *
 * Variants (colour only - geometry never varies):
 *   default   grey on grey, the common case
 *   primary   primary-tinted with a border: active filter, "Current"
 *   secondary muted text, lower emphasis than default
 *   positive / negative  success / error state
 *   chip      primary-tinted, borderless - lean tag (blog + article tags)
 *   code      the only variant that changes the FACE, for kbd and code
 */
const badgeVariants = cva(
  `inline-flex items-center justify-center font-title font-medium whitespace-nowrap h-6 ${SIZE_PADDINGS.xs} ${SIZE_GAPS.xs} ${SIZE_TEXT.xs} ${BORDER_RADIUS}`,
  {
    variants: {
      variant: {
        default: 'bg-bg-2 text-fg-1 border border-border',
        primary: 'bg-bg-primary text-primary border border-primary',
        positive: 'bg-bg-green text-success border border-transparent',
        negative: 'bg-bg-red text-red border border-transparent',
        // The one variant that changes the typeface: a keystroke is not prose.
        code: 'bg-bg-2 text-fg-1 border border-border font-mono',
        secondary: 'bg-bg-2 text-fg-2 border border-border',
        chip: 'bg-bg-primary text-primary border border-transparent',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export function Badge({ children, variant = 'default', href, className, style }: BadgeProps) {
  const cls = badgeVariants({ variant, className });
  // A border on every variant, transparent where the design has none: without it
  // a bordered and a borderless tag differ by 2px of height in the same row.
  return href ? (
    <a href={href} className={`${cls} hover:border-primary transition-colors`} style={style}>
      {children}
    </a>
  ) : (
    <span className={cls} style={style}>
      {children}
    </span>
  );
}
