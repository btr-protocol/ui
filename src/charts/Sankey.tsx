// Sankey: two columns of nodes joined by value-weighted ribbons. HTML/SVG labels, SVG ribbons;
// both columns share one px-per-value scale, so a source bar and a sink bar mean the same money.
// Unpriced links are counted by the caller's table, never drawn as a zero-width ribbon.
import { useState } from 'preact/hooks';
import { cn } from '../lib/cn';
import { type SankeyLink, type SankeyNodeBox, type SankeySide, sankeyLayout } from './sankeyMath';

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
  const active = hover ?? selected;
  const g = sankeyLayout(left, right, links, width, height);
  const hot = active == null ? null : active;
  const clear = () => {
    setHover(null);
    onHover?.(null);
  };
  return (
    <div className={cn('relative min-h-0 w-full', className)} style={{ height }}>
      <svg
        role="img"
        aria-label={label}
        width={width}
        height={height}
        className="overflow-visible"
        onMouseLeave={clear}
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
            {placeLabels(side, height).map(({ id, x, y, label }) => (
              <text
                key={id}
                x={i === 0 ? x - 6 : x + 6}
                y={y}
                dominant-baseline="middle"
                text-anchor={i === 0 ? 'end' : 'start'}
                className="fill-current text-2xs text-fg-2"
              >
                {label}
              </text>
            ))}
          </g>
        ))}
      </svg>
    </div>
  );
}

const LABEL_LINE = 11;

/**
 * One line per label, never two on top of each other: the tail of a rail is a run of 1 px nodes,
 * so each label sits on its own node where it can and slides down to the next free line where it
 * cannot. A label that would leave the plot is dropped, not clipped.
 */
function placeLabels(
  side: readonly SankeyNodeBox[],
  height: number,
): { id: string; label: string; x: number; y: number }[] {
  const out: { id: string; label: string; x: number; y: number }[] = [];
  let floor = -Infinity;
  for (const n of side) {
    const want = n.y + Math.min(n.height, LABEL_LINE) / 2;
    const y = Math.max(want, floor + LABEL_LINE);
    if (y > height - LABEL_LINE / 2) continue;
    floor = y;
    out.push({ id: n.id, label: n.label, x: n.x + n.width, y });
  }
  return out;
}
