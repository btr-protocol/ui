/** The shared swatch palette: the 12 chart series tokens (legible on dark and light). A swatch is its index. */
export const SWATCH_NAMES = ['Orange', 'Blue', 'Green', 'Pink', 'Violet', 'Teal', 'Red', 'Sky', 'Lime', 'Brown', 'Slate', 'Rose'] as const;
export const SWATCH_COUNT = SWATCH_NAMES.length;
/** CSS colour of swatch `i` (wraps, so any integer is valid). */
export const swatchColor = (i: number): string => `var(--series-${((Math.trunc(i) % SWATCH_COUNT) + SWATCH_COUNT) % SWATCH_COUNT + 1})`;
