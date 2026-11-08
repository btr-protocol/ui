/** One import for every number formatter the btr.markets front uses.
 *  - SDK core (canonical): compact / number / price / currency / percent / yield / units.
 *  - Metric strings (`fmtUsd`, `fmtApr`, ...): `./metricFormat`, dash for missing.
 *  - Amount ladder (`formatBalance`, `parseAmountInput`, ...): `./amount`.
 *  `shortenAddress` stays in `./address` (identical). */
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
