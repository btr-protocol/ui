import type { ComponentChildren } from 'preact';
import { SEVERITY_COLOR, SEVERITY_ICON } from '../lib/severity';
import { cn } from '../lib/cn';
import { Button } from './Button';
import { Icon } from './Icon';
import { PANEL_BODY } from './Panel';
import { Spinner } from './Spinner';

export type StateNoticeVariant = 'error' | 'warning' | 'info' | 'loading' | 'empty';

export interface StateNoticeProps {
  variant?: StateNoticeVariant;
  /** Short heading; the sentence goes in `children`. */
  title?: string;
  children?: ComponentChildren;
  /** A retry / sign-in, offered on error and warning. */
  action?: { label: string; onClick: () => void };
  /** `fill`: centred block that takes the space of its panel (order book, depth); `inline`: left-aligned strip. */
  layout?: 'fill' | 'inline';
  className?: string;
}

/**
 * The ONE in-panel state: error / warning / info / loading / empty ("cbBTC price feed is stale: swaps are
 * blocked until it updates."). Side padding is the panel body's (`PANEL_BODY`), so the text never touches the
 * panel edge. Page-level states stay `PageState`; a metric phase stays `PanelState`.
 * Errors announce as `alert`, everything else as `status`.
 */
export function StateNotice({ variant = 'info', title, children, action, layout = 'fill', className }: StateNoticeProps) {
  const color = variant === 'error' || variant === 'warning' ? SEVERITY_COLOR[variant] : undefined;
  const glyph = variant === 'error' || variant === 'warning' || variant === 'info' ? SEVERITY_ICON[variant] : null;
  const fill = layout === 'fill';
  return (
    <div
      role={variant === 'error' ? 'alert' : 'status'}
      data-state={variant}
      className={cn(
        PANEL_BODY,
        'flex w-full min-w-0 gap-2 text-sm',
        fill ? 'flex-col items-center justify-center text-center' : 'items-start',
        variant === 'empty' || variant === 'loading' || variant === 'info' ? 'text-fg-3' : 'text-fg-1',
        className,
      )}
    >
      {variant === 'loading' && <Spinner className="shrink-0" />}
      {glyph && <Icon name={glyph} className="mt-0.5 h-4 w-4 shrink-0" style={color ? { color } : undefined} />}
      <div className="min-w-0 break-words">
        {title && <div className="font-medium text-fg-0">{title}</div>}
        {children != null && children !== false && <div>{children}</div>}
      </div>
      {action && (variant === 'error' || variant === 'warning') && (
        <Button size="sm" variant="secondary" className="shrink-0" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}
