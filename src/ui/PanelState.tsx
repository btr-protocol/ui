import { cn } from '../lib/cn';
import type { MetricPhase } from '../lib/metricPhase';
import { Empty, PageState } from './Feedback';

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
