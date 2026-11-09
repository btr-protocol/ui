import { cn } from '../lib/cn';

export interface ProgressStepsProps {
  /** Steps done (clamped to `total`). */
  done: number;
  total: number;
  className?: string;
}

/** Above this many steps the bar is one continuous track (a segment would be thinner than its gap). */
const MAX_SEGMENTS = 12;

/** m-of-n progress (signatures 2/3, steps 1/4) as a readable bar: one segment per step, the first `done` filled green, the
 *  missing ones a moving shimmer (a loader: "still waiting"), then the count. One size everywhere (a list row and a card read
 *  the same). Reduced motion freezes the shimmer (global switch). The accessible name is "done/total". */
export function ProgressSteps({ done, total, className }: ProgressStepsProps) {
  const d = Math.max(0, Math.min(done, total));
  const segs = total > 0 && total <= MAX_SEGMENTS;
  return (
    <span className={cn('inline-flex items-center gap-2', className)} role="img" aria-label={`${d}/${total}`}>
      {total > 0 && (
        <span aria-hidden="true" className="flex h-2 w-24 shrink-0 gap-0.5 overflow-hidden rounded-full">
          {segs
            ? Array.from({ length: total }, (_, i) => (
                <span key={i} className={cn('h-full flex-1', i < d ? 'bg-green' : 'progress-pending')} style={i < d ? undefined : { animationDelay: `${(i - d) * 150}ms` }} />
              ))
            : (
                <>
                  {d > 0 && <span className="h-full bg-green" style={{ width: `${(d / total) * 100}%` }} />}
                  {d < total && <span className="progress-pending h-full flex-1" />}
                </>
              )}
        </span>
      )}
      <span className="font-numeric text-sm text-fg-1">
        {d}/{total}
      </span>
    </span>
  );
}
