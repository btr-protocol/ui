import { cn } from '../lib/cn';
import { formatQtyStr } from '../lib/format';
import { TokenGlyph } from './TokenGlyph';

/** An amount of a token: its icon, the auto-formatted quantity (>=1000: 0 dp, >=1: 2, >=0.01: 4, else 6) and the symbol.
 *  `amount` is a decimal string ("149.950130446265320681") or a number. THE way a token amount is shown. */
export function TokenAmount({ symbol, amount, src, size = 16, className }: { symbol: string; amount: string | number; src?: string | null; size?: number; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 whitespace-nowrap align-middle', className)}>
      <TokenGlyph symbol={symbol} src={src} size={size} />
      <span className="font-numeric tabular-nums">{formatQtyStr(String(amount))}</span>
      <span>{symbol}</span>
    </span>
  );
}
