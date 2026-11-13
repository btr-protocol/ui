// Canonical Panel: the one card. Family contract shared with Table/ChartShell - `title` +
// `meta` header at the PanelHeader scale, body at PanelBody scale, block states via PanelState
// (PageState/Empty); MetricState is the inline-cell counterpart, not a second block path.
import { Empty, PageState } from './Feedback';
import type { MetricPhase } from '../lib/metricPhase';
import { cn } from '../lib/cn';
import type { ComponentChildren } from 'preact';
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
      {children}
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

/** Block-level MetricPhase renderer. Delegates to PageState/Empty, so a panel and a page
 *  never invent a second loading/empty look; MetricState is the inline-cell counterpart. */
export function PanelState({
  phase,
  message,
  className,
  action,
}: {
  phase: MetricPhase;
  message: string;
  className?: string;
  /** Offered on the error card (a retry). */
  action?: { label: string; onClick: () => void };
}) {
  if (phase === 'loading') {
    return <PageState kind="loading" message={message} className={className} />;
  }
  if (phase === 'empty') {
    return <Empty className={className}>{message}</Empty>;
  }
  if (phase === 'live') return null;
  return (
    <PageState
      kind="error"
      message={message}
      action={action}
      className={cn(phase !== 'error' && 'text-warning', className)}
    />
  );
}
