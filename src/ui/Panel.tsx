// Canonical Panel: the one card. Family contract shared with Table/ChartShell - `title` +
// `meta` header at the PanelHeader scale, body at PanelBody scale, block states via PanelState
// (PageState/Empty); MetricState is the inline-cell counterpart, not a second block path.
import { cn } from '../lib/cn';
import { type ComponentChildren, createContext } from 'preact';
import type { Ref } from 'preact';
import type { HTMLAttributes } from 'preact/compat';

export type PanelVariant = 'default' | 'plain';

export interface PanelProps extends Omit<HTMLAttributes<HTMLDivElement>, 'className' | 'title'> {
  title?: ComponentChildren;
  meta?: ComponentChildren;
  variant?: PanelVariant;
  className?: string;
  ref?: Ref<HTMLDivElement>;
}

/**
 * True inside a framed Panel: the container already draws the border and the rounded edge, so a
 * Table placed in it goes flush (`frame` defaults off) instead of drawing a second border and its
 * own rounded corner inside the first. A `plain` Panel draws no frame and resets it.
 */
export const InFrame = createContext(false);

export function Panel({
  title,
  meta,
  variant = 'default',
  className,
  ref,
  children,
  ...props
}: PanelProps) {
  return (
    <div
      ref={ref}
      className={cn(
        variant === 'default' && 'surface bg-bg-1 border border-border rounded-lg shadow-sm',
        className,
      )}
      {...props}
    >
      {(title || meta) && (
        <PanelHeader>
          {title ? <PanelTitle>{title}</PanelTitle> : <span />}
          {meta}
        </PanelHeader>
      )}
      <InFrame.Provider value={variant === 'default'}>{children}</InFrame.Provider>
    </div>
  );
}

/** One header scale for every card: Panel title/meta, Table title bar, SignerRoster head. */
const PANEL_HEADER = 'px-3 py-2 flex items-center justify-between gap-3 flex-wrap';
const PANEL_HEADER_RULE = 'border-b border-border';
const PANEL_TITLE = 'text-sm font-semibold text-fg-0';
export const PANEL_BODY = 'px-3 py-3';

export function PanelHeader(
  props: Omit<HTMLAttributes<HTMLDivElement>, 'className'> & {
    className?: string;
    ref?: Ref<HTMLDivElement>;
    rule?: boolean;
  },
) {
  const { className, rule = true, ...rest } = props;
  return <div className={cn(PANEL_HEADER, rule && PANEL_HEADER_RULE, className)} {...rest} />;
}

export function PanelTitle(
  props: Omit<HTMLAttributes<HTMLHeadingElement>, 'className'> & {
    className?: string;
    ref?: Ref<HTMLHeadingElement>;
  },
) {
  const { className, ...rest } = props;
  return <h2 className={cn(PANEL_TITLE, className)} {...rest} />;
}

export function PanelBody(
  props: Omit<HTMLAttributes<HTMLDivElement>, 'className'> & {
    className?: string;
    ref?: Ref<HTMLDivElement>;
  },
) {
  const { className, ...rest } = props;
  return <div className={cn(PANEL_BODY, className)} {...rest} />;
}
