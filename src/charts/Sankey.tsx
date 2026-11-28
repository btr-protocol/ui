// Sankey: two columns of nodes joined by value-weighted ribbons. SVG bars/ribbons, SVG labels;
// both columns share one px-per-value scale, so a source bar and a sink bar mean the same money.
// Unpriced links are counted by the caller's table, never drawn as a zero-width ribbon.
import { useState } from 'preact/hooks';
import { cn } from '../lib/cn';
import {
  type SankeyLink,
  type SankeySide,
  placeLabels,
  sankeyLayout,
} from './sankeyMath';

export interface SankeyProps {
  left: readonly SankeySide[];
  right: readonly SankeySide[];
  links: readonly SankeyLink[];
  /** Height of the plot in px; width follows the container (use a measured wrapper). */
  width: number;
  height: number;
  /** Ribbon fill from the source node (a theme colour, not a literal). */
  ribbonColor: (link: SankeyLink) => string;
  /** Hover / click identity of a ribbon, so a side table can follow it. */
  onHover?: (id: string | null) => void;
  onSelect?: (id: string) => void;
  selected?: string | null;
  /** Accessible summary: what the two columns and the ribbons are. */
  label: string;
  className?: string;
}

const OPACITY = { idle: 0.32, hover: 0.7, dim: 0.08 } as const;

export function Sankey({
  left,
  right,
  links,
  width,
  height,
  ribbonColor,
  onHover,
  onSelect,
  selected = null,
  label,
  className,
}: SankeyProps) {
  const [hover, setHover] = useState<string | null>(null);
  // A poll can replace the links under the pointer: an id that no longer exists must not dim the
  // whole chart or leave the caller's table describing a vanished pair.
  const [walk, setWalk] = useState<number | null>(null);
  const g = sankeyLayout(left, right, links, width, height);
  const ids = g.ribbons.map((r) => r.id);
  const known = (id: string | null): id is string => id != null && ids.includes(id);
  const active = known(hover) ? hover : known(selected) ? selected : null;
  const walked = walk != null && ids.length > 0 ? ids[((walk % ids.length) + ids.length) % ids.length]! : null;
  const hot = active ?? walked;
  const clear = () => {
    setHover(null);
    setWalk(null);
    onHover?.(null);
  };
  const step = (d: number) => {
    const next = walk == null ? (d > 0 ? 0 : ids.length - 1) : walk + d;
    setWalk(next);
    onHover?.(ids[((next % ids.length) + ids.length) % ids.length]!);
  };
  const canWalk = ids.length > 0 && (!!onHover || !!onSelect);
  return (
    <div className={cn('relative min-h-0 w-full', className)} style={{ height }}>
      <svg
        role="group"
        aria-label={`${label}. ${
          canWalk ? 'Use the arrow keys to step through the flows, Enter to pin one.' : ''
        }`}
        width={width}
        height={height}
        className="overflow-visible focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        tabIndex={canWalk ? 0 : undefined}
        onMouseLeave={clear}
        onBlur={clear}
        onKeyDown={(e) => {
          if (!canWalk) return;
          if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
            e.preventDefault();
            step(1);
          } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
            e.preventDefault();
            step(-1);
          } else if ((e.key === 'Enter' || e.key === ' ') && walked) {
            e.preventDefault();
            onSelect?.(walked);
          } else if (e.key === 'Escape') {
            clear();
          }
        }}
      >
        <g>
          {g.ribbons.map((r) => {
            const on = hot == null || hot === r.id;
            return (
              <path
                key={r.id}
                d={r.d}
                fill={ribbonColor({ id: r.id, from: r.from, to: r.to, value: r.value })}
                fillOpacity={hot === r.id ? OPACITY.hover : on ? OPACITY.idle : OPACITY.dim}
                className="cursor-pointer transition-[fill-opacity]"
                onMouseEnter={() => {
                  setHover(r.id);
                  onHover?.(r.id);
                }}
                onClick={() => onSelect?.(r.id)}
              />
            );
          })}
        </g>
        {[g.left, g.right].map((side, i) => (
          <g key={i}>
            {side.map((n) => (
              <rect
                key={n.id}
                x={n.x}
                y={n.y}
                width={n.width}
                height={n.height}
                rx={1.5}
                fill={n.color ?? 'currentColor'}
                className="text-fg-2"
              />
            ))}
            {placeLabels(side, height, i === 0 ? 'left' : 'right').map(({ id, x, y, label: text }) => (
              <text
                key={id}
                x={i === 0 ? x - 6 : x + 6}
                y={y}
                dominant-baseline="middle"
                text-anchor={i === 0 ? 'end' : 'start'}
                className="fill-current text-2xs text-fg-2"
              >
                {text}
              </text>
            ))}
          </g>
        ))}
      </svg>
    </div>
  );
}
