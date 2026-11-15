import { BORDER_RADIUS, SIZE_TEXT } from '../lib/design';
import { navigateTo } from '../lib/nav';
import { type ClassValue, cn } from '../lib/cn';
import { cva } from '../lib/cva';
import { Spinner } from './Spinner';
/**
 * THE button: one component inside and outside bars, groups and cells (styles/button.css owns the geometry).
 *
 * Shapes - THREE, and only three:
 *   primary   filled CTA (orange). One per view where possible, the last (end) cell of a bar.
 *   secondary frosted glass + border. The default, and the app's "glass" look.
 *   ghost     tertiary / low-emphasis action (bars, rows).
 *
 * Axes, which compose with any shape rather than adding a fourth:
 *   tone="danger"  destructive, red family, same geometry.
 *   tone="primary" orange family, same geometry - the quiet row action.
 *   active         selected/current, e.g. the active nav item.
 *
 * Sizes (xs / sm / md; height = --ctl-s/m/l: 24/32/40 on desktop, 32/44/48 on touch and below lg):
 *   xs  dense inline rows ONLY: table/list rows, toasts, chip trios.
 *   sm  THE standard control height (swap submit, wallet, page CTAs, bar cells). Default is md (modal footer pairs, hero).
 *
 * Icons: `icon` + `iconPosition` ('start' default | 'end'). Three forms, ONE geometry: icon + label (start), label + icon
 * (end: direction or disclosure only), icon only (no children: a square, height x height, never shrinks). The Button owns the
 * glyph size (12 / 16 / 16, callers pass `<Icon name>` and no size) and the icon-side padding, which equals the icon-only inset,
 * so a prefix and a postfix trim the same and an icon-only cell has the inset of a labelled one. A label is ONE line, always
 * (nowrap, ellipsis); the icon stays.
 *
 * `aria-label` is REQUIRED (by type) when there are no children or `collapse` is set; it is the tooltip while the label is hidden.
 * `collapse` 1 | 2 | 3: inside a SectionBar the label drops to icon-only below that bar's width (1 first, 3 last; the primary has none).
 * `loading`: the kit Spinner replaces the icon (a text-only button gets it as a leading icon, label kept, dimmed: the Primer / Material
 * pattern), an icon button's width stays, `aria-busy`; it is
 * VISUAL ONLY and never feeds `disabled` (the call site's own disabled logic is untouched).
 *
 * Rules: one primary height per context; a secondary matches its primary neighbour's size; never override padding, height,
 * radius or text size from a call site; tune width with min-w only.
 */
import { type ComponentChildren, Fragment } from 'preact';
import type { HTMLAttributes, Ref } from 'preact/compat';
import { forwardRef } from 'preact/compat';

/** THREE shapes; `danger` and `active` are axes (`tone`, `active`), not shapes. */
export type ButtonVariant = 'primary' | 'secondary' | 'ghost';
export type ButtonSize = 'xs' | 'sm' | 'md';

interface ButtonBase extends Omit<HTMLAttributes<HTMLButtonElement>, 'className' | 'children' | 'aria-label'> {
  type?: 'button' | 'submit' | 'reset';
  variant?: ButtonVariant;
  /** Colour family. Same geometry, never a second shape: `danger` is the red family,
   *  `primary` the orange one. Ignored on the primary shape, which is already that family. */
  tone?: 'default' | 'danger' | 'primary';
  /** Selected/current state, e.g. the active nav item. */
  active?: boolean;
  size?: ButtonSize;
  /** The glyph: `<Icon name="download" />`, no size (the Button sizes it). */
  icon?: ComponentChildren;
  /** `start` (default) before the label; `end` after it: direction or disclosure only (chevron, external link, next). */
  iconPosition?: 'start' | 'end';
  /** @deprecated use `icon`. Kept only while an app still passes it; delete after the app migration. */
  leftIcon?: ComponentChildren;
  /** @deprecated use `icon` + `iconPosition="end"`. Kept only while an app still passes it; delete after the app migration. */
  rightIcon?: ComponentChildren;
  /** A pending user action: the kit Spinner replaces the icon, width is stable, `aria-busy`. Visual only: never disables. */
  loading?: boolean;
  disabled?: boolean;
  /** Renders an anchor instead of a button, so cmd-click and middle-click still open a new tab.
   *  An anchor has no `:disabled`, so `disabled` is meaningless with `href`. */
  href?: string;
  className?: ClassValue;
  ref?: Ref<HTMLButtonElement>;
}
/** A nameless icon button fails `tsc`: no children, or a collapsible label, needs an `aria-label`; `collapse` needs an `icon` (a text-only button has nothing to collapse to). */
type Named =
  | { children?: undefined; 'aria-label': string; collapse?: undefined | false }
  | { children: ComponentChildren; 'aria-label'?: string; collapse?: undefined | false }
  | { children: ComponentChildren; 'aria-label': string; collapse: 1 | 2 | 3; icon: ComponentChildren };
export type ButtonProps = ButtonBase & Named;
/** The props before the naming rule: for wrappers that always pass children (HoldButton). */
export type ButtonBaseProps = ButtonBase & { 'aria-label'?: string };

const buttonVariants = cva(
  'btn inline-flex min-w-0 max-w-full items-center justify-center whitespace-nowrap font-medium font-title transition-colors disabled:pointer-events-none disabled:opacity-50',
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
    },
    defaultVariants: {
      variant: 'secondary',
    },
  },
);

/** Does a label mix text into its children (`{n} items`, text + an element, a fragment of those)? Then it is wrapped to truncate. */
const hasText = (c: ComponentChildren): boolean =>
  Array.isArray(c) ? c.some(hasText) : typeof c === 'string' || typeof c === 'number' || (typeof c === 'object' && c !== null && (c as { type?: unknown }).type === Fragment && hasText((c as { props: { children?: ComponentChildren } }).props.children));

/** `title` only while the pointer is over a button whose label is cut or hidden (icon-only, collapsed): measured on every hover, dropped
 *  on leave (never on focus: screen readers announce it), so it never goes stale. A hidden label is named by `aria-label`. */
const titleIfCut = (e: Event) => {
  const btn = e.currentTarget as HTMLElement;
  if (btn.dataset.ownTitle) return;
  const label = btn.querySelector<HTMLElement>(':scope > [data-label]');
  const hidden = btn.hasAttribute('data-icon-only') || (!!label && getComputedStyle(label).display === 'none');
  const name = btn.getAttribute('aria-label');
  if (e.type !== 'mouseenter') btn.removeAttribute('title');
  else if (hidden && name) btn.title = name;
  else if (label && label.scrollWidth > label.clientWidth) btn.title = label.textContent ?? '';
};

const ButtonImpl = forwardRef<HTMLButtonElement, ButtonBase & { children?: ComponentChildren; 'aria-label'?: string; collapse?: 1 | 2 | 3 | false }>(
  (
    {
      className,
      variant = 'secondary',
      tone,
      active,
      size = 'md',
      icon,
      iconPosition = 'start',
      leftIcon,
      rightIcon,
      loading = false,
      collapse,
      href,
      children,
      ...props
    },
    ref,
  ) => {
    const isDanger = tone === 'danger';
    const isPrimaryTone = tone === 'primary' && variant !== 'primary';
    const isActive = active ?? false;

    // `leftIcon` / `rightIcon` (deprecated) fold into the one `icon` slot.
    const glyph = icon ?? leftIcon ?? rightIcon;
    const at = icon != null ? iconPosition : leftIcon != null ? 'start' : 'end';
    const isIconOnly = !children && (glyph != null || loading);

    const classes = buttonVariants({
      variant,
      className: cn(
        BORDER_RADIUS,
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
        SIZE_TEXT[size === 'md' ? 'default' : size],
        className,
      ),
    });

    // Hooks for the group rules (button-group.css) and the geometry (button.css).
    const fit = (h?: (e: never) => void) => (e: Event) => { titleIfCut(e); (h as ((e: Event) => void) | undefined)?.(e); };
    const slot = loading ? <Spinner /> : glyph; // loading: the spinner takes the icon slot; a text-only button gains a leading one, label kept (dimmed)
    const place = loading && glyph == null ? 'start' : at;
    const attrs = {
      'data-size': size,
      'data-own-title': props.title ? 'true' : undefined,
      onMouseEnter: fit(props.onMouseEnter as never),
      onMouseLeave: fit(props.onMouseLeave as never),
      'data-icon-only': isIconOnly || undefined,
      'data-icon-start': (!isIconOnly && slot != null && place === 'start') || undefined,
      'data-icon-end': (!isIconOnly && slot != null && place === 'end') || undefined,
      'data-collapse': (glyph != null && variant !== 'primary' && collapse) || undefined, // no icon, nothing to collapse to; a primary never collapses
      'data-loading': loading || undefined,
      'data-primary': variant === 'primary' || undefined,
      'aria-busy': loading || undefined,
    };

    const iconEl = slot != null && <span data-btn-icon="" className={cn('shrink-0', place === 'end' && !loading && 'text-fg-3')}>{slot}</span>;
    const labelEl = children != null && children !== false && (hasText(children) || collapse
      ? <span data-label="" className="btn-label min-w-0 truncate">{children}</span>
      : children);
    const content = (
      <>
        {place === 'start' && iconEl}
        {labelEl}
        {place === 'end' && iconEl}
      </>
    );

    if (href) {
      const { onClick, ...rest } = props as HTMLAttributes<HTMLAnchorElement>;
      return (
        <a
          href={href}
          className={classes}
          {...rest}
          {...attrs}
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
      <button ref={ref} className={classes} {...props} {...attrs}>
        {content}
      </button>
    );
  },
);

/** Typed as a plain component (not `forwardRef`'s, which makes `children` optional) so the `Named` union is enforced. */
export const Button = ButtonImpl as unknown as (props: ButtonProps) => ComponentChildren;
