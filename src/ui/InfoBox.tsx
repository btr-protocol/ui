import { cn } from '../lib/cn';
import type { ComponentChildren } from 'preact';
import { FloatingPanel } from './FloatingPanel';
import { Icon, type IconName } from './Icon';

/** Dotted underline is the affordance: this is a link. Always on; hover shifts color only. */
export const LINK =
  'underline decoration-dotted underline-offset-2 decoration-current transition-colors hover:text-fg-0';

/** Body copy inside a tooltip / info box: the panel itself is unstyled prose. */
export const TIP_BODY = 'whitespace-normal text-xs font-normal leading-snug text-fg-2';

/** Links inside tooltips / info boxes - same dotted rule, one fg rung up from the body. */
export const TOOLTIP_LINK = `text-fg-1 ${LINK}`;

/** Label as one hover block; `hideIcon` for tight rows (routing). */
export function RecapHint({
  title,
  content,
  children,
  hideIcon = false,
}: {
  title: string;
  content: ComponentChildren;
  children: ComponentChildren;
  hideIcon?: boolean;
}) {
  return (
    <InfoBox label={title} content={content} hideIcon={hideIcon}>
      <span className={LINK}>{children}</span>
    </InfoBox>
  );
}

/**
 * ⓘ button for CLICKABLE content (glossary links): hover opens it, the panel bridges the gap so the
 * pointer can travel in and click a link, and a click toggles it. Outside press / Escape / Back close it.
 */
export function InfoBox({
  content,
  label,
  side = 'bottom',
  maxWidth = '280px',
  iconClassName = 'w-3 h-3',
  icon = 'info',
  hideIcon = false,
  children,
  className,
}: {
  content: ComponentChildren;
  /** Accessible name. Say what it explains ("About paid spread"), not "info". */
  label: string;
  /** Trigger body when hideIcon is set (the caller's row/label IS the affordance). */
  children?: ComponentChildren;
  side?: 'top' | 'bottom' | 'left' | 'right';
  maxWidth?: string;
  iconClassName?: string;
  /** Glyph in the ⓘ slot: a status (warning, closed) swaps the glyph, never the slot or size. */
  icon?: IconName;
  /** Render no ⓘ glyph: the caller's own content IS the trigger (a whole row, say). */
  hideIcon?: boolean;
  /** Classes on the TRIGGER wrapper - responsive visibility, not styling. */
  className?: string;
}) {
  return (
    <FloatingPanel
      mode="both"
      tooltipMode
      interactive
      arrow={false}
      delay={100}
      side={side}
      maxWidth={maxWidth}
      wrapClass={cn('inline-flex p-2 -m-2 align-middle', className)}
      content={<div className={TIP_BODY}>{content}</div>}
    >
      {(open) => (
        <button
          type="button"
          // No `text-sm`: the trigger INHERITS its caller's type size.
          className="inline-flex cursor-pointer items-center gap-1 text-inherit transition-colors hover:text-fg-1"
          aria-label={label}
          aria-expanded={open}
        >
          {children}
          {!hideIcon && <Icon name={icon} className={iconClassName} />}
        </button>
      )}
    </FloatingPanel>
  );
}
