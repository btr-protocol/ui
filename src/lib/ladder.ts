/**
 * Ladder sliders: fixed clean stops + slider position <-> value mapping. The thumb walks stop
 * indices, so every reachable value is a rounded stop, never raw interpolation like 0.005731%.
 * Pure arithmetic, no DOM.
 */

export type Ladder = readonly number[];

/** 1-2-5 per decade from `min` up to and including `max`. Both bounds should sit on the
 *  progression; off-progression bounds are simply not emitted (the nearest stop inside wins). */
export function geometricLadder(min: number, max: number): Ladder {
  if (!(max >= min) || min <= 0) return [];
  const stops: number[] = [];
  for (let exp = Math.floor(Math.log10(min)); ; exp++) {
    for (const m of [1, 2, 5]) {
      const v = Number((m * 10 ** exp).toPrecision(12));
      if (v < min) continue;
      if (v > max) return stops;
      stops.push(v);
    }
  }
}

/** Arithmetic ladder `min..max` in `step` increments (the linear slider's stops). */
export function linearLadder(min: number, max: number, step: number): Ladder {
  const stops: number[] = [];
  for (let v = min; v <= max + step / 2 && stops.length < 1000; v += step)
    stops.push(Number(v.toFixed(10)));
  return stops;
}

/** Snap `value` to the nearest stop (ties round down); clamps to the end stops. Non-finite
 *  input lands on the first stop. */
export function snapToLadder(value: number, ladder: Ladder): number {
  const top = ladder.length - 1;
  if (top < 0) return value;
  const v = Number.isFinite(value) ? value : ladder[0];
  if (v <= ladder[0]) return ladder[0];
  if (v >= ladder[top]) return ladder[top];
  let i = 0;
  while (i + 1 < top && ladder[i + 1] <= v) i++;
  return v - ladder[i] <= ladder[i + 1] - v ? ladder[i] : ladder[i + 1];
}

/** Index of the stop nearest `value` - the slider thumb position for that value. */
export function ladderIndexOf(value: number, ladder: Ladder): number {
  return ladder.indexOf(snapToLadder(value, ladder));
}
