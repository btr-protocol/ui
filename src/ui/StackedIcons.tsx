import type { ComponentChildren } from 'preact';
import { cn } from '../lib/cn';

export interface StackedIcon {
  id: string | number;
  label: string;
  /** Image URL, or a rendered node (e.g. `<ChainGlyph role="trigger" />`). */
  icon: string | ComponentChildren;
}

export interface StackedIconsProps {
  items: readonly StackedIcon[];
  /** Icons shown before the "+N" chip. Default 3. */
  max?: number;
  size?: 'sm' | 'md';
  className?: string;
}

const DIM = { sm: 'h-4 w-4 text-2xs', md: 'h-6 w-6 text-xs' } as const;

/** Overlapping icon row with a "+N" overflow chip. One accessible name lists every item, the
 *  glyphs themselves are decorative. Radius by nesting: icons are rounded-xs squares like ChainGlyph. */
export function StackedIcons({ items, max = 3, size = 'md', className }: StackedIconsProps) {
  const shown = items.slice(0, Math.max(0, max));
  const rest = items.length - shown.length;
  const cell = cn('shrink-0 rounded-xs ring-2 ring-bg-1 -ml-1.5 first:ml-0', DIM[size]);
  return (
    <span
      role="img"
      aria-label={items.map((i) => i.label).join(', ')}
      title={items.map((i) => i.label).join(', ')}
      className={cn('inline-flex items-center', className)}
    >
      {shown.map((i) =>
        typeof i.icon === 'string' ? (
          <img key={i.id} src={i.icon} alt="" aria-hidden="true" className={cell} />
        ) : (
          <span key={i.id} aria-hidden="true" className={cn(cell, 'inline-flex items-center justify-center overflow-hidden')}>
            {i.icon}
          </span>
        ),
      )}
      {rest > 0 && (
        <span
          aria-hidden="true"
          className={cn(cell, 'inline-flex items-center justify-center bg-bg-3 font-title font-semibold text-fg-1')}
          style={{ width: 'auto', minWidth: size === 'sm' ? '1rem' : '1.5rem', paddingInline: '0.25rem' }}
        >
          +{rest}
        </span>
      )}
    </span>
  );
}
