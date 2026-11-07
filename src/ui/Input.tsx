import {
  AMOUNT_TEXT,
  type AmountSize,
  BORDER_RADIUS,
  SIZE_HEIGHTS,
  SIZE_PADDINGS,
  SIZE_TEXT,
  type Size,
} from '../lib/design';
import { cn } from '../lib/cn';
import { cva } from '../lib/cva';
import { forwardRef } from 'preact/compat';
import type { HTMLAttributes, Ref } from 'preact/compat';

export type InputVariant = 'default' | 'amount' | 'address' | 'number' | 'bare';

export interface InputProps extends Omit<HTMLAttributes<HTMLInputElement>, 'size'> {
  variant?: InputVariant;
  size?: Size | AmountSize;
  type?: string;
  ref?: Ref<HTMLInputElement>;
  value?: string | number;
  placeholder?: string;
  onChange?: (e: Event) => void;
  disabled?: boolean;
  readOnly?: boolean;
  min?: number | string;
  max?: number | string;
  step?: number | string;
}

// The boxed chrome, written once. The border is a class, not the `style={{ border: 'var(--border)' }}`
// this carried since the first commit: an inline declaration outranks every selector, so
// `focus:border-primary` and `input[aria-invalid='true']`'s red could never paint over it.
const BOXED = `bg-bg-2 border border-border focus:border-primary focus-visible:outline-offset-0 ${BORDER_RADIUS}`;

// `amount` and `bare` are unboxed: no border, no fill, and no height/padding off the size scale.
// They sit in a rail the caller already sized (a token row, a modal header, a swatch), so the
// scale contributes type only and the caller keeps its own box.
const UNBOXED = 'bg-transparent border-0 outline-none';

export const inputVariants = cva('transition-colors font-medium font-title', {
  variants: {
    variant: {
      default: `w-full ${BOXED}`,
      address: `w-full ${BOXED} font-mono`,
      number: `w-20 ${BOXED} text-right font-title tabular-nums`,
      // Alignment and width stay with the caller: three of four amount rails are right-aligned,
      // the vault one is not, and each supplies its own flex/width.
      amount: `${UNBOXED} p-0 m-0 font-title tabular-nums text-fg-0 placeholder:text-fg-2 focus:ring-0`,
      bare: UNBOXED,
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

/** The size lane: the whole box when the field has one, the type scale alone when it does not,
 *  plus the compact numeric stepper. Emitted after the variant so `cn`'s merge settles it that
 *  way. Shared with `Select`, which is this same chrome on a `<select>`. */
export const fieldSizing = (variant: InputVariant, size: Size | AmountSize) => {
  if (size === 'xl' || size === 'compact-xl') return AMOUNT_TEXT[size];
  if (variant === 'amount') return SIZE_TEXT[size];
  // Fields are 16px on touch (no focus-zoom); `amount` keeps the caller's display size.
  const text = cn(SIZE_TEXT[size], 'coarse:text-base');
  if (variant === 'bare') return text;
  // A stepper is compact wherever it lands: two digits and a spinner, never a full form row.
  const s = variant === 'number' ? 'sm' : size;
  return cn(SIZE_HEIGHTS[s], SIZE_PADDINGS[s], SIZE_TEXT[s], 'coarse:text-base');
};

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, variant = 'default', size = 'default', type, ...props }, ref) => (
    <input
      type={type}
      className={inputVariants({
        variant,
        className: cn(
          fieldSizing(variant, size),
          typeof className === 'string' ? className : undefined,
        ),
      })}
      lang="en-US"
      inputMode={type === 'number' ? 'decimal' : undefined}
      ref={ref}
      {...props}
    />
  ),
);
