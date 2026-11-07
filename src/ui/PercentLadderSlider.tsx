import { type Ladder, ladderIndexOf, snapToLadder } from '../lib/ladder';
import { cn } from '../lib/cn';
import { useState } from 'preact/hooks';
import { Input } from './Input';
import { Slider } from './Slider';

interface PercentLadderSliderProps {
  /** Clean stops (see ../lib/ladder). Thumb position = stop index; committed values are stops. */
  stops: Ladder;
  value: number;
  onChange: (v: number) => void;
  /** Render a stop as input text. Default `String` - ladder stops are already clean numbers. */
  format?: (v: number) => string;
  className?: string;
  ariaLabel?: string;
}

/**
 * Percent control shared by every "slider + number input on clean steps" row.
 *
 * Two-way binding over a LADDER (../lib/ladder): dragging the thumb emits the stop at that
 * position; typing a percentage snaps it to the nearest stop and moves the thumb to match.
 * While the field holds focus its raw text wins - typing "0.0" must not be clobbered by the
 * snapped commit - and blur re-renders the committed stop. The stored setting is therefore
 * always a rounded ladder value, never raw interpolation.
 */
export function PercentLadderSlider({
  stops,
  value,
  onChange,
  format = String,
  className,
  ariaLabel,
}: PercentLadderSliderProps) {
  const [draft, setDraft] = useState<string | null>(null);

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <span className="inline-flex w-24 items-center">
        <Slider
          value={[ladderIndexOf(value, stops)]}
          min={0}
          max={stops.length - 1}
          step={1}
          showValue={false}
          onValueChange={(v: number[]) => onChange(stops[v[0]])}
        />
      </span>
      <Input
        variant="number"
        type="number"
        aria-label={ariaLabel}
        value={draft ?? format(value)}
        min={stops[0]}
        max={stops[stops.length - 1]}
        step="any"
        onFocus={() => setDraft(format(value))}
        onInput={(e: Event) => {
          const text = (e.target as HTMLInputElement).value;
          setDraft(text);
          const n = parseFloat(text);
          if (Number.isFinite(n)) onChange(snapToLadder(n, stops));
        }}
        // Enter commits like blur so keyboard entry lands on the formatted stop too.
        onKeyDown={(e: KeyboardEvent) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
        onBlur={() => setDraft(null)}
      />
      <span className="text-xs text-fg-2">%</span>
    </div>
  );
}
