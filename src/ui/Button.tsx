import {
  BORDER_RADIUS,
  SIZE_GAPS,
  SIZE_HEIGHTS,
  SIZE_ICON_WIDTHS,
  SIZE_LEADING_ICON_OFFSET,
  SIZE_TEXT,
  type Size,
} from '../lib/design';
import { navigateTo } from '../lib/nav';
import { type ClassValue, cn } from '../lib/cn';
import { cva } from '../lib/cva';
/**
 * Button scale - the one button in the app. Tokens live in lib/design.ts.
 *
 * Shapes - THREE, and only three:
 *   primary   filled CTA (orange). One per view where possible.
 *   secondary frosted glass + border. The default, and the app's "glass" look.
 *   ghost     tertiary / low-emphasis action.
 *
 * Axes, which compose with any shape rather than adding a fourth:
 *   tone="danger"  destructive, red family, same geometry.
 *   tone="primary" orange family, same geometry - the quiet row action.
 *   active         selected/current, e.g. the active nav item.
 *
 * Sizes (height token × type; --ctl-s/m/l = 24/32/40 on desktop, 32/44/48 on touch and below lg):
 *   xs       ctl-s text-xs - dense inline rows ONLY: table/list rows, toasts, chip trios.
 *   sm       ctl-m text-sm - THE standard control height. Every standalone primary,
 *            secondary and ghost button sits here (swap submit, wallet, page CTAs).
 *   default  ctl-l text-base - modal footer pairs only (confirm/cancel share it).
 *
 * A label is ONE line, always (nowrap): when the space runs out it truncates with an ellipsis and the icons stay.
 *
 * Rules: one primary height per context (sm, unless modal footer or hero); a
 * secondary button matches its primary neighbour's size; padding, gap, icon
 * offset, radius and typography all come from the SIZE_ tokens and BORDER_RADIUS -
 * never override padding or text-size classes on a call site; tune width with
 * min-w only.
 */
import { type ComponentChildren, Fragment } from 'preact';
import type { HTMLAttributes, Ref } from 'preact/compat';
import { forwardRef } from 'preact/compat';

/** THREE shapes; `danger` and `active` are axes (`tone`, `active`), not shapes. */
export type ButtonVariant = 'primary' | 'secondary' | 'ghost';

export interface ButtonProps extends Omit<HTMLAttributes<HTMLButtonElement>, 'className'> {
  type?: 'button' | 'submit' | 'reset';
  variant?: ButtonVariant;
  /** Colour family. Same geometry, never a second shape: `danger` is the red family,
   *  `primary` the orange one. Ignored on the primary shape, which is already that family. */
  tone?: 'default' | 'danger' | 'primary';
  /** Selected/current state, e.g. the active nav item. */
  active?: boolean;
  size?: Size;
  leftIcon?: ComponentChildren;
  rightIcon?: ComponentChildren;
  disabled?: boolean;
  /** Renders an anchor instead of a button, so cmd-click and middle-click still open a new tab.
   *  An anchor has no `:disabled`, so `disabled` is meaningless with `href`. */
  href?: string;
  className?: ClassValue;
  ref?: Ref<HTMLButtonElement>;
}

const buttonVariants = cva(
  'inline-flex min-w-0 max-w-full items-center justify-center whitespace-nowrap font-medium font-title transition-colors disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'border border-primary bg-primary text-black hover:brightness-110 font-semibold disabled:border-border disabled:bg-bg-3 disabled:text-fg-2 disabled:opacity-100',
        // bg-glass, not bg-bg-1/80: the palette has no alpha channel, so a slash-opacity colour
        // compiled to nothing. `--glass` is the translucent token. No blur: at 92% it is invisible.
        secondary:
          'border border-border bg-glass text-fg-1 hover:border-primary hover:bg-bg-primary',
        ghost: 'border border-transparent bg-transparent text-fg-2 hover:bg-bg-3 hover:text-fg-0',
      },
      size: SIZE_HEIGHTS,
    },
    defaultVariants: {
      variant: 'secondary',
      size: 'default',
    },
  },
);

/** Does a label mix text into its children (`{n} items`, text + an element, a fragment of those)? Then it is wrapped to truncate. */
const hasText = (c: ComponentChildren): boolean =>
  Array.isArray(c) ? c.some(hasText) : typeof c === 'string' || typeof c === 'number' || (typeof c === 'object' && c !== null && (c as { type?: unknown }).type === Fragment && hasText((c as { props: { children?: ComponentChildren } }).props.children));

/** `title` only while the pointer is over a label that is cut: measured on every hover, dropped on leave (never on focus: screen readers announce it), so it never goes stale. */
const titleIfCut = (e: Event) => {
  const btn = e.currentTarget as HTMLElement;
  if (btn.dataset.ownTitle) return;
  const label = btn.querySelector<HTMLElement>(':scope > [data-label]');
  if (e.type === 'mouseenter' && label && label.scrollWidth > label.clientWidth) btn.title = label.textContent ?? '';
  else btn.removeAttribute('title');
};

const PADDING_X = {
  xs: { base: 'px-2', left: 'pl-1.5', right: 'pr-1.5' },
  sm: { base: 'px-3', left: 'pl-2', right: 'pr-2' },
  default: { base: 'px-4', left: 'pl-3', right: 'pr-3' },
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'secondary',
      tone,
      active,
      size = 'default',
      leftIcon,
      rightIcon,
      href,
      children,
      ...props
    },
    ref,
  ) => {
    const isDanger = tone === 'danger';
    const isPrimaryTone = tone === 'primary' && variant !== 'primary';
    const isActive = active ?? false;

    // Optimization: Pre-calculate icon-only state
    const isIconOnly = !children && (!!leftIcon || !!rightIcon);

    // Compose dynamic classes. These reach cva as `className`, so they are the LAST word.
    const dynamicClasses = cn(
      // Axes layer ON TOP of the shape, so a destructive button is visibly the
      // same control as its neighbour and only its colour family differs.
      isDanger &&
        (variant === 'primary'
          ? 'border-red-solid bg-red-solid text-white hover:brightness-110'
          : 'border-red bg-glass text-red hover:bg-bg-red hover:border-red'),
      // The active nav item's colour and hover tint MINUS its resting fill: a row action repeated
      // down a table cannot carry a filled CTA's weight and still has to read as an action.
      isPrimaryTone && 'text-primary hover:bg-bg-primary hover:text-primary',
      isActive && 'bg-bg-primary text-primary hover:bg-bg-primary border-transparent',
      SIZE_TEXT[size],
      !isIconOnly && SIZE_GAPS[size],
      isIconOnly
        ? SIZE_ICON_WIDTHS[size]
        : [
            PADDING_X[size].base,
            leftIcon && PADDING_X[size].left,
            rightIcon && PADDING_X[size].right,
          ],
    );

    const classes = buttonVariants({
      variant,
      size,
      className: cn(BORDER_RADIUS, dynamicClasses, className),
    });

    // Hooks for the group rules (button-group.css): icon cells stay compact squares, the primary takes the spare width.
    const fit = (h?: (e: never) => void) => (e: Event) => { titleIfCut(e); (h as ((e: Event) => void) | undefined)?.(e); };
    const groupAttrs = {
      'data-own-title': props.title ? 'true' : undefined,
      onMouseEnter: fit(props.onMouseEnter as never),
      onMouseLeave: fit(props.onMouseLeave as never), 'data-icon-only': isIconOnly || undefined, 'data-primary': variant === 'primary' || undefined };

    const content = (
      <>
        {leftIcon && (
          <span className={cn('shrink-0', !isIconOnly && SIZE_LEADING_ICON_OFFSET[size])}>
            {leftIcon}
          </span>
        )}
        {hasText(children) ? <span data-label="" className="min-w-0 truncate">{children}</span> : children}
        {rightIcon && <span className="shrink-0 text-fg-3">{rightIcon}</span>}
      </>
    );

    if (href) {
      const { onClick, ...rest } = props as HTMLAttributes<HTMLAnchorElement>;
      return (
        <a
          href={href}
          className={classes}
          {...rest}
          {...groupAttrs}
          onClick={(e) => {
            onClick?.(e);
            // Same-origin paths route in-app (no reload); modified clicks and external URLs stay native anchors.
            if (e.defaultPrevented || !/^\/(?!\/)/.test(href)) return;
            if (
              e.metaKey ||
              e.ctrlKey ||
              e.shiftKey ||
              e.altKey ||
              e.button ||
              e.currentTarget.target
            )
              return;
            e.preventDefault();
            navigateTo(href);
          }}
        >
          {content}
        </a>
      );
    }

    return (
      <button ref={ref} className={classes} {...props} {...groupAttrs}>
        {content}
      </button>
    );
  },
);
