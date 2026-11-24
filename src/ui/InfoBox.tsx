import { cn } from '../lib/cn';
import { type ComponentChildren, createContext } from 'preact';
import { useContext } from 'preact/hooks';
import { FloatingPanel } from './FloatingPanel';
import { InHeader } from './toolbar';
import { Icon, type IconName } from './Icon';

/** Dotted underline is the affordance: this is a link. Always on; hover shifts color only. */
export const LINK =
  'underline decoration-dotted underline-offset-2 decoration-current transition-colors hover:text-fg-0';

/** Body copy inside a tooltip / info box: the panel itself is unstyled prose. */
export const TIP_BODY = 'whitespace-normal text-xs font-normal leading-snug text-fg-2';

/** Links inside tooltips / info boxes - same dotted rule, one fg rung up from the body. */
export const TOOLTIP_LINK = `text-fg-1 ${LINK}`;

/** True inside an InfoTip's panel: a glossary term there is plain text (the tip ends with its one link). */
export const InTip = createContext(false);

/**
 * THE infotip (the only `cursor-help` in the app). Trigger: `children` as a term label (dotted
 * underline, no glyph) or, without children, the ⓘ glyph. Panel, fixed order: `content` (the
 * definition), optional `context` (a live line), then `more` (the single "Learn more ->" link).
 * Hover/focus opens it, the panel bridges the gap so the pointer can reach the link, a click
 * toggles it. Outside press / Escape / Back close it.
 */
export function InfoTip({
  content,
  context,
  more,
  label,
  side = 'bottom',
  maxWidth = '280px',
  iconClassName = 'w-3 h-3',
  icon = 'info',
  hideIcon,
  children,
  className,
}: {
  content?: ComponentChildren;
  /** Second line: live context (the selected window, say). */
  context?: ComponentChildren;
  /** Last line: the one "Learn more" link. */
  more?: ComponentChildren;
  /** Accessible name. Say what it explains ("About paid spread"), not "info". */
  label: string;
  /** Term label: the trigger is this text with a dotted underline. */
  children?: ComponentChildren;
  side?: 'top' | 'bottom' | 'left' | 'right';
  maxWidth?: string;
  iconClassName?: string;
  /** Glyph in the ⓘ slot: a status (warning, closed) swaps the glyph, never the slot or size. */
  icon?: IconName;
  /** Glyph beside the label; defaults to on without children, off with them. */
  hideIcon?: boolean;
  /** Classes on the TRIGGER wrapper - responsive visibility, not styling. */
  className?: string;
}) {
  const inHeader = useContext(InHeader);
  const glyph = !(hideIcon ?? children != null);
  return (
    <FloatingPanel
      mode="both"
      tooltipMode
      interactive
      arrow={false}
      delay={100}
      side={side}
      maxWidth={maxWidth}
      wrapClass={cn(inHeader ? 'inline-flex' : 'inline-flex p-2 -m-2 align-middle', className)}
      content={
        <InTip.Provider value={true}>
          <div className={TIP_BODY}>
            {content}
            {context != null && <span className="mt-1 block">{context}</span>}
            {more != null && <span className="mt-1 block">{more}</span>}
          </div>
        </InTip.Provider>
      }
    >
      {(open) => (
        <button
          type="button"
          // No `text-sm`: the trigger INHERITS its caller's type size.
          className="inline-flex cursor-help items-center gap-1 text-inherit transition-colors hover:text-fg-1"
          aria-label={label}
          aria-expanded={open}
        >
          {children != null && <span className={glyph ? undefined : LINK}>{children}</span>}
          {glyph && <Icon name={icon} className={iconClassName} />}
        </button>
      )}
    </FloatingPanel>
  );
}
