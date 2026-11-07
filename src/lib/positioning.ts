import type { JSX } from 'preact';

export type Position = 'top' | 'bottom' | 'left' | 'right';

const OPPOSITE: Record<Position, Position> = {
  top: 'bottom',
  bottom: 'top',
  left: 'right',
  right: 'left',
};

const MIN_H = 64;

export interface Placement {
  left: number;
  top: number;
  /** Side actually used: flipped when the asked one lacks room. */
  side: Position;
  /** Set when neither side fits the panel: the panel scrolls instead of covering the trigger. */
  maxHeight?: number;
}

/**
 * Place a MEASURED panel next to its trigger: flip to the opposite side when the asked one lacks
 * room (never slide over the trigger), then shift along the cross axis to stay on screen.
 * Left/right fall back to bottom/top when neither fits horizontally.
 */
export function placePanel(
  trigger: DOMRect,
  size: { w: number; h: number },
  side: Position,
  gap: number,
  pad = 8,
): Placement {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const room = (s: Position) =>
    s === 'top'
      ? trigger.top - pad
      : s === 'bottom'
        ? vh - trigger.bottom - pad
        : s === 'left'
          ? trigger.left - pad
          : vw - trigger.right - pad;
  const need = (s: Position) => (s === 'top' || s === 'bottom' ? size.h : size.w) + gap;
  let used = side;
  if (room(used) < need(used) && room(OPPOSITE[used]) > room(used)) used = OPPOSITE[used];
  if (room(used) < need(used) && (used === 'left' || used === 'right')) {
    used = room('bottom') >= room('top') ? 'bottom' : 'top';
  }
  const vertical = used === 'top' || used === 'bottom';
  const avail = room(used) - gap;
  // Floor keeps a squeezed panel scrollable instead of collapsing to nothing; side panels are
  // bounded by the viewport height.
  const h = Math.min(size.h, Math.max(vertical ? avail : vh - 2 * pad, MIN_H));
  const clamp = (v: number, span: number, vmax: number) =>
    Math.max(pad, Math.min(v, vmax - span - pad));
  let left: number;
  let top: number;
  if (vertical) {
    left = clamp(trigger.left + trigger.width / 2 - size.w / 2, size.w, vw);
    top = used === 'top' ? trigger.top - gap - h : trigger.bottom + gap;
  } else {
    top = clamp(trigger.top + trigger.height / 2 - h / 2, h, vh);
    left = used === 'left' ? trigger.left - gap - size.w : trigger.right + gap;
  }
  return { left, top, side: used, maxHeight: h < size.h ? h : undefined };
}

export function getArrowStyles(pos: Position, useBorder = true): JSX.CSSProperties {
  const baseStyle: JSX.CSSProperties = {
    position: 'absolute',
    width: '8px',
    height: '8px',
  };

  if (!useBorder) {
    return { ...baseStyle, borderStyle: 'solid' };
  }

  const arrow = {
    top: { bottom: '-5px', left: '50%', marginLeft: '-4px', borderTop: 'none', borderLeft: 'none' },
    bottom: {
      top: '-5px',
      left: '50%',
      marginLeft: '-4px',
      borderBottom: 'none',
      borderRight: 'none',
    },
    left: {
      right: '-5px',
      top: '50%',
      marginTop: '-4px',
      borderBottom: 'none',
      borderLeft: 'none',
    },
    right: { left: '-5px', top: '50%', marginTop: '-4px', borderTop: 'none', borderRight: 'none' },
  };

  return { ...baseStyle, ...arrow[pos] };
}
