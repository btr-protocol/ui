/** The shared swatch palette: chart series tokens (legible on dark and light), WITHOUT the primary orange (series-1: it is the
 *  active / awaiting-signature colour) and without a near-duplicate pink. A swatch is its index here. */
const SERIES = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11] as const;
export const SWATCH_NAMES = ['Blue', 'Green', 'Pink', 'Violet', 'Teal', 'Red', 'Sky', 'Lime', 'Brown', 'Slate'] as const;
export const SWATCH_COUNT = SWATCH_NAMES.length;
/** CSS colour of swatch `i` (wraps, so any integer is valid). */
export const swatchColor = (i: number): string => `var(--series-${SERIES[((Math.trunc(i) % SWATCH_COUNT) + SWATCH_COUNT) % SWATCH_COUNT]})`;
