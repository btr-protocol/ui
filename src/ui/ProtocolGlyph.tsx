import { useEffect, useState } from 'preact/hooks';
import { cn } from '../lib/cn';
import { protocolIcon } from '../lib/protocolIcon';
import { Icon } from './Icon';

/** Circular protocol mark. `Wallet` (plain balances) is a wallet glyph; a known protocol is its bundled mark, then `src` (an icon the host
 *  stores), then a monogram disc. Same circle and ring as TokenGlyph. */
export function ProtocolGlyph({ name, src, size = 20, className }: { name: string; src?: string | null; size?: number; className?: string }) {
  const sources = [protocolIcon(name), src ?? undefined].filter((x): x is string => !!x);
  const [stage, setStage] = useState(0);
  useEffect(() => setStage(0), [name, src]);
  const dim = { width: `${size / 16}rem`, height: `${size / 16}rem` };
  const cls = cn('shrink-0 rounded-full ring-1 ring-bg-0 align-middle', className);
  if (/^wallet$/i.test(name.trim())) {
    return (
      <span aria-hidden="true" style={dim} className={cn(cls, 'inline-flex items-center justify-center bg-bg-3 text-fg-1')}>
        <Icon name="wallet" size={Math.round(size * 0.6)} />
      </span>
    );
  }
  const cur = sources[stage];
  if (cur) return <img src={cur} alt="" aria-hidden="true" style={dim} className={cn(cls, 'bg-bg-2 object-cover')} loading="lazy" decoding="async" onError={() => setStage(stage + 1)} />;
  return (
    <span aria-hidden="true" style={dim} className={cn(cls, 'inline-flex items-center justify-center bg-bg-3 font-title font-medium text-fg-1')}>
      <span style={{ fontSize: `${size * 0.032}rem` }}>{name.trim().slice(0, 2).toUpperCase()}</span>
    </span>
  );
}
