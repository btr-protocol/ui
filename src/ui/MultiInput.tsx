import { cn } from '../lib/cn';
import { cva } from '../lib/cva';
import type { ComponentChildren } from 'preact';
import { useCallback, useRef } from 'preact/hooks';

export interface MultiInputProps {
  length?: number;
  separator?: ComponentChildren;
  value: string[];
  onChange: (values: string[]) => void;
  disabled?: boolean;
  className?: string;
  inputClassName?: string;
  error?: boolean;
  /** Group label for screen readers. */
  label?: string;
}

const multiInputVariants = cva(
  'inline-flex items-center justify-center font-medium font-title text-center transition-colors focus:outline-none',
  {
    variants: {
      error: {
        true: 'border-red focus:border-red',
        false: 'border-border focus:border-primary',
      },
    },
    defaultVariants: {
      error: 'false' as const,
    },
  },
);

export function MultiInput({
  length = 6,
  separator = <span className="text-fg-2">-</span>,
  value,
  onChange,
  disabled = false,
  className,
  inputClassName,
  error = false,
  label = 'Invite code',
}: MultiInputProps) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Typing and pasting: no `maxLength`, so a paste lands whole in one box and is spread here.
  const handleInputChange = useCallback(
    (index: number, inputValue: string) => {
      const cleaned = inputValue.replace(/[^A-Z0-9]/gi, '').toUpperCase();
      const next = [...value];
      for (let i = 0; i < cleaned.length && index + i < length; i++) {
        next[index + i] = cleaned[i];
      }
      onChange(next);
      const landed = Math.min(index + Math.max(cleaned.length, 1), length - 1);
      if (cleaned) inputRefs.current[landed]?.focus();
    },
    [length, onChange, value],
  );

  const handleKeyDown = useCallback(
    (index: number, event: KeyboardEvent) => {
      if (event.key === 'Backspace' && !value[index] && index > 0) {
        inputRefs.current[index - 1]?.focus();
      } else if (event.key === 'ArrowLeft' && index > 0) {
        inputRefs.current[index - 1]?.focus();
      } else if (event.key === 'ArrowRight' && index < length - 1) {
        inputRefs.current[index + 1]?.focus();
      }
    },
    [length, value],
  );

  return (
    <div
      className={cn('flex items-center gap-1 sm:gap-2', className)}
      role="group"
      aria-label={label}
    >
      {Array.from({ length }).map((_, index) => (
        <>
          <input
            key={index}
            ref={(element) => {
              inputRefs.current[index] = element;
            }}
            type="text"
            inputMode="text"
            autocapitalize="characters"
            autocorrect="off"
            spellcheck={false}
            autocomplete="off"
            // No maxLength / onPaste: cancelling paste fails Lighthouse's paste-preventing-inputs
            // audit and breaks on a clipboard that is not EXACTLY `length` characters.
            value={value[index] || ''}
            onInput={(event) =>
              handleInputChange(index, (event.currentTarget as HTMLInputElement).value)
            }
            onKeyDown={(event) => handleKeyDown(index, event)}
            onFocus={(event) => (event.currentTarget as HTMLInputElement).select()}
            disabled={disabled}
            aria-label={`${label} character ${index + 1} of ${length}`}
            aria-invalid={error}
            className={cn(
              multiInputVariants({ error: error ? 'true' : 'false' }),
              // Width tracks the viewport (28px @ 280 .. 48px @ 436+): six boxes + separator + gaps
              // stay inside 280px, and the box never outgrows sm's 4rem.
              'h-16 w-[clamp(1.75rem,11vw,3rem)] min-w-0 text-2xl sm:h-20 sm:w-16 sm:text-3xl rounded-sm border bg-bg-2 uppercase',
              disabled && 'pointer-events-none',
              inputClassName,
            )}
          />
          {separator && index === Math.floor(length / 2) - 1 && (
            <span className="mx-0.5 text-2xl sm:mx-3 sm:text-4xl text-fg-2">{separator}</span>
          )}
        </>
      ))}
    </div>
  );
}
