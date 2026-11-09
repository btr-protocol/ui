import type { ComponentChildren } from 'preact';
import { cn } from '../lib/cn';
import { Tooltip } from './FloatingPanel';

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
  /** Hover/focus tooltip listing every item (icon + label), not just the native title. */
  list?: boolean;
  /** `square` for chain marks (rounded squares, see ChainGlyph / ChainStack); `circle` (default) for tokens, protocols, people. */
  shape?: 'circle' | 'square';
  className?: string;
}

const DIM = { sm: 'h-4 w-4 text-2xs', md: 'h-6 w-6 text-xs' } as const;

/** Overlapping icon row with a "+N" overflow chip. One accessible name lists every item, the
 *  glyphs themselves are decorative. Every icon is clipped to ONE shape: circle (tokens) or rounded square (chains). */
export function StackedIcons({ items, max = 3, size = 'md', list = false, shape = 'circle', className }: StackedIconsProps) {
  const r = shape === 'square' ? 'rounded-xs' : 'rounded-full';
  const child = shape === 'square' ? '[&>*]:rounded-xs' : '[&>*]:rounded-full';
  const shown = items.slice(0, Math.max(0, max));
  const rest = items.length - shown.length;
  const cell = cn('shrink-0 overflow-hidden object-cover', r, 'ring-2 ring-bg-1 -ml-1.5 first:ml-0', DIM[size]);
  const names = items.map((i) => i.label).join(', ');
  const row = (
    <span
      role="img"
      aria-label={names}
      title={list ? undefined : names}
      tabIndex={list && items.length > 1 ? 0 : undefined}
      className={cn('inline-flex items-center rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring', className)}
    >
      {shown.map((i) =>
        typeof i.icon === 'string' ? (
          <img key={i.id} src={i.icon} alt="" aria-hidden="true" className={cell} />
        ) : (
          // a rendered glyph keeps its OWN shape (a ChainGlyph stays a rounded square even in a default stack); the ring moves onto it
          <span key={i.id} aria-hidden="true" className={cn('-ml-1.5 inline-flex shrink-0 items-center justify-center first:ml-0 [&>*]:h-full [&>*]:w-full [&>*]:ring-2 [&>*]:ring-bg-1', DIM[size], shape === 'square' && child)}>
            {i.icon}
          </span>
        ),
      )}
      {rest > 0 && (
        <span
          aria-hidden="true"
          className={cn(cell, 'inline-flex items-center justify-center bg-bg-3 font-title font-semibold text-fg-1')}
          style={{ width: 'auto', minWidth: size === 'sm' ? '1rem' : '1.5rem', paddingInline: '0.25rem', borderRadius: '9999px' }}
        >
          +{rest}
        </span>
      )}
    </span>
  );
  if (!list || items.length < 2) return row;
  return (
    <Tooltip
      maxWidth="16rem"
      content={
        <ul className="space-y-1 py-0.5 text-left">
          {items.map((i) => (
            <li key={i.id} className="flex items-center gap-2 whitespace-nowrap">
              <span className={cn('inline-flex h-4 w-4 shrink-0 items-center justify-center overflow-hidden [&>*]:h-full [&>*]:w-full [&>*]:ring-0', r, child)}>
                {typeof i.icon === 'string' ? <img src={i.icon} alt="" className="h-full w-full object-cover" /> : i.icon}
              </span>
              {i.label}
            </li>
          ))}
        </ul>
      }
    >
      {row}
    </Tooltip>
  );
}
