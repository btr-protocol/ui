import { BORDER_RADIUS } from '../lib/design';
import { cn } from '../lib/cn';
import { cva } from '../lib/cva';
import { type ComponentChildren, type JSX, type Ref, cloneElement, isValidElement } from 'preact';
import type { HTMLAttributes } from 'preact/compat';

export interface ButtonGroupProps extends HTMLAttributes<HTMLDivElement> {
  direction?: 'horizontal' | 'vertical';
  variant?: 'default' | 'compact' | 'outlined';
  ref?: Ref<HTMLDivElement>;
}

const buttonGroupVariants = cva(`flex overflow-hidden ${BORDER_RADIUS}`, {
  variants: {
    direction: {
      horizontal: 'items-center',
      vertical: 'flex-col',
    },
    variant: {
      default: '',
      compact: 'bg-bg-2',
      outlined: 'border border-border',
    },
  },
  defaultVariants: {
    direction: 'horizontal',
    variant: 'default',
  },
});

export function ButtonGroup({
  className,
  direction = 'horizontal',
  variant = 'default',
  children,
  ...props
}: ButtonGroupProps) {
  const childrenArray: ComponentChildren[] = Array.isArray(children) ? children : [children];
  const classNameValue = typeof className === 'string' ? className : undefined;

  // Explicit map, not `rounded-l-${size}`: Tailwind cannot see a template
  // string, so those classes only ever survived because the literals happened
  // to appear elsewhere in the codebase. The vertical pair never did, which is
  // why a vertical ButtonGroup renders unrounded today.
  const ROUND = {
    horizontal: { first: 'rounded-l-sm rounded-r-none', last: 'rounded-r-sm rounded-l-none' },
    vertical: { first: 'rounded-t-sm rounded-b-none', last: 'rounded-b-sm rounded-t-none' },
  } as const;

  return (
    <div
      className={buttonGroupVariants({ direction, variant, className: classNameValue })}
      {...props}
    >
      {childrenArray.map((child, index: number) => {
        if (!isValidElement(child)) return child;

        const isFirst = index === 0;
        const isLast = index === childrenArray.length - 1;

        // The GROUP owns the dividers: zero each child's border, then paint one edge with a
        // side-scoped colour. `border-border` alone paints all four sides (Button's ghost carries a
        // 1px border on all four), drawing a second rounded rectangle inside the group's own border.
        const borderClass = isLast
          ? 'border-0'
          : direction === 'vertical'
            ? 'border-0 border-b border-b-border'
            : 'border-0 border-r border-r-border';

        // Build rounding classes using the shared radius size
        const round = ROUND[direction];
        const roundingClass = isFirst
          ? isLast
            ? '' // a lone child keeps the group's own radius
            : round.first
          : isLast
            ? round.last
            : 'rounded-none';

        const childProps = (child as JSX.Element).props as {
          className?: string;
          children?: ComponentChildren;
        };
        const existingClassName = childProps.className;
        return cloneElement(child as JSX.Element, {
          className: cn(
            typeof existingClassName === 'string' ? existingClassName : undefined,
            borderClass,
            roundingClass,
          ),
        });
      })}
    </div>
  );
}
