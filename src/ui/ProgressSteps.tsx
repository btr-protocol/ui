import { cn } from '../lib/cn';

export interface ProgressStepsProps {
  /** Steps done (clamped to `total`). */
  done: number;
  total: number;
  className?: string;
}

/** m-of-n progress (signatures 2/3, steps 1/4): `total` short segments, the first `done` filled, then the count.
 *  Beyond 8 segments it falls back to the plain count. The accessible name is "done/total". */
export function ProgressSteps({ done, total, className }: ProgressStepsProps) {
  const d = Math.max(0, Math.min(done, total));
  return (
    <span className={cn('inline-flex items-center gap-1.5', className)} role="img" aria-label={`${d}/${total}`}>
      {total > 0 && total <= 8 && (
        <span aria-hidden="true" className="inline-flex gap-0.5">
          {Array.from({ length: total }, (_, i) => (
            <span key={i} className={cn('h-1.5 w-3 rounded-full', i < d ? 'bg-green' : 'bg-line')} />
          ))}
        </span>
      )}
      <span className="font-numeric text-xs text-fg-1">
        {d}/{total}
      </span>
    </span>
  );
}
