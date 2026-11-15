export type Haptic = 'tap' | 'medium' | 'ok' | 'warn' | 'err';

const PATTERN: Record<Haptic, number | number[]> = {
  tap: 8,
  medium: 20,
  ok: [12, 40, 12],
  warn: 30,
  err: [40, 60, 40],
};
const GAP_MS = 150;
let last = -GAP_MS;
let enabled: () => boolean = () => true;

/** The app's "haptics off" setting: `haptic()` is a no-op while `enabled()` is false. Call once at boot (default: on). */
export function configureHaptic(next: { enabled: () => boolean }): void {
  enabled = next.enabled;
}

/** Vibrates where the platform can (Android/WebView; iOS Safari has no API). One buzz per gesture: a
 *  toast right after the action's own buzz is swallowed. Chrome blocks (and logs) vibrate before the
 *  first user gesture. */
export function haptic(kind: Haptic, now = Date.now()): void {
  if (typeof navigator === 'undefined' || !navigator.vibrate || now - last < GAP_MS) return;
  if (!enabled()) return;
  if (navigator.userActivation?.hasBeenActive === false) return;
  last = now;
  navigator.vibrate(PATTERN[kind]);
}
