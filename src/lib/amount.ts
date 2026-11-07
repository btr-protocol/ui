// Amount-input parsing/formatting/validation shared by swap and vault deposit/withdraw.

import { DASH } from './metricPhase';
import {
  formatCompact,
  formatNumber,
  formatPrice,
  formatUnits,
  parseUnits,
} from '@btr-protocol/sdk/utils/format';
import { useLayoutEffect, useRef } from 'preact/hooks';

/**
 * Floor `v` to the finest increment the ladder prints at that magnitude, so the display is never
 * larger than the holding (a balance that reads high is entered in full and reverts).
 * Quanta mirror the printed ladder: compact K/M/B/T = 2 decimals of the scaled value; >= 1 = 2
 * decimals (4 in full mode); < 1 = `formatPrice`'s rung, 5 digits past the leading zeros.
 */
function floorToLadder(v: number, full: boolean): number {
  if (v >= 1_000) {
    if (full) return Number(weiFlooredInput(v, 4));
    const q = v >= 1e12 ? 1e10 : v >= 1e9 ? 1e7 : v >= 1e6 ? 1e4 : 10;
    return Math.floor(v / q) * q;
  }
  if (v < 1) {
    const zeros = Math.max(0, -Math.floor(Math.log10(v)) - 1);
    return Number(weiFlooredInput(v, zeros + 5));
  }
  return Number(weiFlooredInput(v, full ? 4 : 2));
}

/** Fraction digits the ladder keeps, read off the decimal string; mirrors `floorToLadder` full mode. */
function ladderDecimals(int: string, frac: string): number {
  if (!/^0*$/.test(int)) return 4;
  return /^0*/.exec(frac)![0].length + 5;
}

/**
 * Truncate an exact decimal string onto the finest rung the ladder prints. Must be string work:
 * `Number("0.999999999999999999")` is exactly 1, so an f64 is already above the holding.
 * The result has few enough digits that `toString` round-trips it through a double.
 */
function floorLadderString(exact: string): string {
  const dot = exact.indexOf('.');
  if (dot === -1) return exact;
  const int = exact.slice(0, dot);
  const frac = exact.slice(dot + 1);
  const decimals = ladderDecimals(int, frac);
  if (frac.length <= decimals) return exact;
  const kept = frac.slice(0, decimals).replace(/0+$/, '');
  return kept ? `${int}.${kept}` : int || '0';
}

/** Shortened display for an exact decimal string, or `null` when it already fits the ladder. Cut points mirror `formatBalance` full mode. */
export function shortAmount(exact: string): string | null {
  const cut = floorLadderString(exact);
  // Dropped trailing zeros leave the value unchanged: not a truncation.
  const bare = exact.includes('.') ? exact.replace(/0+$/, '').replace(/\.$/, '') : exact;
  return cut === bare ? null : cut;
}

/**
 * Shortened display for an amount field, or `null` to render `amount` verbatim.
 * Only a seeded value (MAX chip, "adjust down": wei-exact, up to 18 fraction digits) is shortened;
 * the parent keeps the full string, so the submitted value is unchanged. A typed value must render
 * back verbatim, else no precision stays hidden behind an edited display.
 * `lastTyped` = last string this field emitted; anything else came from outside.
 */
export function seededShortAmount(amount: string, lastTyped: string | null): string | null {
  return amount === lastTyped ? null : shortAmount(amount);
}

/** Display formatter for base-unit bigint amounts, behind every balance drawn; `formatBalance` is the same ladder for scaled numbers. */
export function formatAmount(
  value: bigint,
  decimals: number,
  opts: { compact?: boolean; suffix?: string } = {},
): string {
  // Floor as a string first: `Number(formatUnits(...))` rounds 0.999999999999999999 up to 1 (chip above the wallet).
  return formatBalance(Number(floorLadderString(formatUnits(value, decimals))), opts);
}

/** Balance ladder from an already-scaled number (f64 LP positions, pool ceilings).
 *  - compact (default): K/M/B, 2 decimals.
 *  - full: thousands-grouped, up to 4 decimals.
 *  Sub-1 values keep five significant digits in both modes. Rounds down at every magnitude
 *  (`floorToLadder`); zero/absent renders `DASH`, never "0.00". */
export function formatBalance(
  value: number | null | undefined,
  opts: { compact?: boolean; suffix?: string } = {},
): string {
  if (value == null || !isFinite(value) || value <= 0) return DASH;
  const full = opts.compact === false;
  const f = floorToLadder(value, full);
  const txt = f < 1 ? formatPrice(f) : full ? formatNumber(f, 4) : formatCompact(f);
  return opts.suffix ? `${txt} ${opts.suffix}` : txt;
}

/** Amount field digit caps: 18 fraction digits = widest ERC-20 scale. The cap keeps a pasted long
 *  string from overflowing the unboxed input and pushing the USD preview past 1e21 (exponent notation). */
const MAX_INT_DIGITS = 18;
const MAX_FRAC_DIGITS = 18;

/** Sanitize keystrokes to digits + a single dot; strips grouping commas so callers store a parseable decimal. Empty stays empty. */
export function parseAmountInput(raw: string): string {
  const cleaned = raw.replace(/[^0-9.]/g, '');
  const firstDot = cleaned.indexOf('.');
  const int = (firstDot === -1 ? cleaned : cleaned.slice(0, firstDot)).slice(0, MAX_INT_DIGITS);
  if (firstDot === -1) return int;
  const frac = cleaned
    .slice(firstDot + 1)
    .replace(/\./g, '')
    .slice(0, MAX_FRAC_DIGITS);
  return `${int}.${frac}`;
}

/** en-US thousands grouping (matches `formatNumber`), preserving a trailing `.` and fraction so typing is not disrupted. Expects a raw decimal (no commas). */
export function formatAmountDisplay(raw: string): string {
  if (!raw) return '';
  const dot = raw.indexOf('.');
  const intPart = dot === -1 ? raw : raw.slice(0, dot);
  const frac = dot === -1 ? undefined : raw.slice(dot + 1);
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return frac !== undefined ? `${grouped}.${frac}` : grouped;
}

/** Map the caret onto the next display string by counting digits and `.` before it, so grouping commas do not jump the cursor. */
function caretAfterAmountFormat(prevDisplay: string, caret: number, nextDisplay: string): number {
  const significantBefore = prevDisplay.slice(0, caret).replace(/[^0-9.]/g, '').length;
  let pos = 0;
  let count = 0;
  while (pos < nextDisplay.length && count < significantBefore) {
    if (/[0-9.]/.test(nextDisplay[pos]!)) count++;
    pos++;
  }
  return pos;
}

/** Change handler for `Input variant="amount"`: sanitizes, hands the parent a raw decimal, restores the caret after grouping.
 *  The node is taken off the event, not a ref, so it works whether or not the field forwards one. */
export function useAmountInput(onAmountChange: (value: string) => void) {
  const el = useRef<HTMLInputElement | null>(null);
  const caret = useRef<number | null>(null);

  useLayoutEffect(() => {
    if (caret.current == null || !el.current) return;
    el.current.setSelectionRange(caret.current, caret.current);
    caret.current = null;
  });

  return (e: Event) => {
    const input = e.target as HTMLInputElement;
    el.current = input;
    const pos = input.selectionStart ?? input.value.length;
    const raw = parseAmountInput(input.value);
    caret.current = caretAfterAmountFormat(input.value, pos, formatAmountDisplay(raw));
    onAmountChange(raw);
  };
}

/** Decimal string to base-unit bigint; 0n for empty/NaN/overflow so callers can branch on `=== 0n`. */
export function parseAmountToBig(amount: string, decimals: number): bigint {
  if (!amount || isNaN(parseFloat(amount))) return 0n;
  try {
    return parseUnits(amount, decimals);
  } catch {
    return 0n;
  }
}

/** Full-precision input prefill (Max button) from base units. */
export function formatAmountInput(value: bigint, decimals: number): string {
  return formatUnits(value, decimals);
}

/** Wei-floored Max prefill from a human-units number (LP withdraw ceiling through f64): truncated,
 *  never rounded, at `decimals` places so it cannot exceed what the pool honours. Plain decimal
 *  notation only: the sanitizer strips `1e+21` to "121". */
export function weiFlooredInput(v: number, decimals: number): string {
  if (!isFinite(v) || v <= 0) return '';
  let s = v.toString();
  const exp = /[eE]([+-]?\d+)$/.exec(s);
  if (exp) {
    // "2.5e+21" → "2500000000000000000000"
    s = s.slice(0, exp.index);
    const neg = s.startsWith('-');
    if (neg) s = s.slice(1);
    const dot = s.indexOf('.');
    const digits = dot === -1 ? s : s.slice(0, dot) + s.slice(dot + 1);
    const point = (dot === -1 ? s.length : dot) + parseInt(exp[1], 10);
    s =
      point <= 0
        ? '0.' + '0'.repeat(-point) + digits
        : point >= digits.length
          ? digits + '0'.repeat(point - digits.length)
          : digits.slice(0, point) + '.' + digits.slice(point);
    if (neg) s = `-${s}`;
  }
  const cut = s.indexOf('.');
  if (cut === -1) return s;
  // Truncate at the wei boundary; trim fraction zeros, an integer keeps its zeros.
  return s.slice(0, cut + 1 + Math.max(decimals, 0)).replace(/\.?0+$/, '') || '0';
}
