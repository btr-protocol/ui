// Canonical Panel: the one card. Family contract shared with Table/ChartShell - `title` +
// `meta` header via HeaderBar (the only header; PanelHeader/PanelTitle stay internal), body at PanelBody scale, block states via PanelState
// (PageState/Empty); MetricState is the inline-cell counterpart, not a second block path.
import { cn } from '../lib/cn';
import { type ComponentChildren, createContext } from 'preact';
import type { Ref } from 'preact';
import type { HTMLAttributes } from 'preact/compat';
import { HEADER_TITLE, InHeader } from './toolbar';

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
      {(title || meta) && <HeaderBar title={title} meta={meta} />}
      <InFrame.Provider value={variant === 'default'}>{children}</InFrame.Provider>
    </div>
  );
}

/** One header scale for every card: Panel title/meta, Table title bar, SignerRoster head. */
const PANEL_HEADER = 'px-3 py-2 flex items-center justify-between gap-3 flex-wrap';
const PANEL_HEADER_RULE = 'border-b border-border';
/** THE section header row (HeaderBar; ChartPanel's header reads it too). */
export const HEADER_BAR = 'p-0 gap-0 flex-nowrap items-stretch min-h-8 bg-bg-1 leading-5';
export const PANEL_BODY = 'px-3 py-3';

function PanelHeader(
  props: Omit<HTMLAttributes<HTMLDivElement>, 'className'> & {
    className?: string;
    ref?: Ref<HTMLDivElement>;
    rule?: boolean;
  },
) {
  const { className, rule = true, ...rest } = props;
  return <div className={cn(PANEL_HEADER, rule && PANEL_HEADER_RULE, className)} {...rest} />;
}

function PanelTitle(
  props: Omit<HTMLAttributes<HTMLHeadingElement>, 'className'> & {
    className?: string;
    ref?: Ref<HTMLHeadingElement>;
  },
) {
  const { className, ...rest } = props;
  return <h2 className={cn(HEADER_TITLE, className)} {...rest} />;
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

/**
 * THE card header (Panel, Table): the title cell, then each `meta` child as a flush toolbar cell
 * (border-l dividers, h-8, text-xs: the chart toolbar grid), then `search` flush at the end. Controls
 * inside read `InHeader` and drop their own box. One row on every breakpoint: the title truncates,
 * the cells scroll sideways, the header search folds to its glyph on phones and opens on focus.
 * One spec for every table and chart section: bg-bg-1, min-h-8, leading-5.
 */
export function HeaderBar({ title, meta, search }: { title?: ComponentChildren; meta?: ComponentChildren; search?: ComponentChildren }) {
  return (
    <PanelHeader className={HEADER_BAR}>
      <div className="flex flex-1 min-w-0 items-center px-3 py-1.5 has-[button]:py-0">{title ? <PanelTitle className="min-w-0 truncate leading-5">{title}</PanelTitle> : null}</div>
      {meta ? (
        <InHeader.Provider value={true}>
          <div
            className={cn(
              'flex items-stretch min-w-0 shrink scroll-x text-xs text-fg-2',
              '[&>*]:flex [&>*]:shrink-0 [&>*]:items-center [&>*]:border-border [&>*]:border-l',
            )}
          >
            {meta}
          </div>
        </InHeader.Provider>
      ) : null}
      {search}
    </PanelHeader>
  );
}
