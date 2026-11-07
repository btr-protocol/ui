import { useEffect, useState } from 'preact/hooks';
import { cn } from '../lib/cn';
import { tokenIcon } from '../lib/tokenIcon';

/** Circular token mark. Precedence, never sideways: the kit's bundled mark for the ticker, then `src`
 *  (an icon the host stores, e.g. a session-gated backend URL), then a monogram tile. */
export function TokenGlyph({
  symbol,
  src,
  size = 28,
  className,
}: {
  symbol: string;
  src?: string | null;
  /** Diameter in px at the default 16px root. */
  size?: number;
  className?: string;
}) {
  const sources = [tokenIcon(symbol), src ?? undefined].filter((x): x is string => !!x);
  const [stage, setStage] = useState(0);
  useEffect(() => setStage(0), [symbol, src]);
  const dim = { width: `${size / 16}rem`, height: `${size / 16}rem` };
  const cls = cn('shrink-0 rounded-full ring-1 ring-bg-0 align-middle', className);
  const cur = sources[stage];
  if (cur) {
    return <img src={cur} alt="" aria-hidden="true" style={dim} className={cn(cls, 'bg-bg-2 object-contain')} loading="lazy" decoding="async" onError={() => setStage(stage + 1)} />;
  }
  return (
    <div aria-hidden="true" style={dim} className={cn(cls, 'flex items-center justify-center bg-bg-3 font-title font-medium text-fg-1')}>
      <span style={{ fontSize: `${size * 0.032}rem` }}>{symbol.replace(/^(BC|LP)[- ]/i, '').slice(0, 3).toUpperCase()}</span>
    </div>
  );
}
