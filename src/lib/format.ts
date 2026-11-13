/** One import for every number formatter the btr.markets front uses.
 *  - SDK core (canonical): compact / number / price / currency / percent / yield / units.
 *  - Metric strings (`fmtUsd`, `fmtApr`, ...): `./metricFormat`, dash for missing.
 *  - Amount ladder (`formatBalance`, `parseAmountInput`, ...): `./amount`.
 *  `shortenAddress` stays in `./address` (identical). */
import { DASH } from './metricPhase';
export {
  capitalize,
  formatAxisLabel,
  formatCompact,
  formatCurrency,
  formatCurrencyCompact,
  formatNumber,
  formatPercent,
  formatPercentSig,
  formatPrice,
  formatYield,
  formatUnits,
  parseUnits,
  toUnits,
  toInputValue,
  subscriptZeros,
} from '@btr-protocol/sdk/utils/format';
export * from './metricFormat';
export * from './amount';

/** USD, auto by magnitude: whole dollars from $100 up, cents below. */
export function formatUsd(v: number, locale = 'en-US'): string {
  const d = Math.abs(v) >= 100 ? 0 : 2;
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  }).format(v);
}

/** Quantity, auto by magnitude: >=1000 whole, >=1 2dp, >=0.01 4dp, else 6dp; trailing zeros trimmed. */
export function formatQty(v: number, locale?: string): string {
  const a = Math.abs(v);
  const d = a >= 1000 ? 0 : a >= 1 ? 2 : a >= 0.01 ? 4 : 6;
  return new Intl.NumberFormat(locale, { maximumFractionDigits: d }).format(v);
}

const DECIMAL = /^-?\d+(?:\.\d+)?$/;
/** `formatQty` for a decimal string as the chain scan gives it ("149.950130446265320681"). Anything that is not a plain decimal
 *  (empty, hex, NaN text) is "-", never a guess; non-zero dust below the 6-dp floor is "<0.000001"; never "-0". */
export function formatQtyStr(human: string, locale?: string): string {
  const h = human.trim();
  if (!DECIMAL.test(h)) return DASH;
  const n = Number(h);
  if (!Number.isFinite(n)) return DASH;
  if (n === 0) return '0';
  if (Math.abs(n) < 0.0000005) return n > 0 ? '<0.000001' : '>-0.000001';
  const out = formatQty(n, locale);
  return out === '-0' ? '0' : out;
}
