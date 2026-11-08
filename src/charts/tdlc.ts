// TDLC = TradingView Lightweight Charts. One module cache + shared teardown
// for every host (price engine, metric charts, docs LineChart).
import type { IChartApi } from 'lightweight-charts';
import { useLayoutEffect, useRef } from 'preact/hooks';

let tdlcCache: typeof import('lightweight-charts') | null = null;

export function getTDLC() {
  if (tdlcCache) return Promise.resolve(tdlcCache);
  return import('lightweight-charts').then((m) => {
    tdlcCache = m;
    return m;
  });
}

/** `chart.remove()` throws if already gone; TDLC also rAFs after it. */
export function removeChart(chart: IChartApi | null | undefined): void {
  if (!chart) return;
  try {
    chart.remove();
  } catch {
    /* already disposed */
  }
}

/**
 * Drop an instance created after the host unmounted mid-`getTDLC()`.
 * Call immediately after `createChart` - assigning into a ref first leaks it.
 */
export function adoptChart(cancelled: boolean, chart: IChartApi): IChartApi | null {
  if (!cancelled) return chart;
  removeChart(chart);
  return null;
}

/**
 * True once this component's layout teardown starts - before every `useEffect`
 * cleanup. Series mutations (`removePriceLine`, `detachPrimitive`, `removeSeries`)
 * must no-op: they schedule a TDLC rAF that throws "Object is disposed" after
 * `chart.remove()`. `chart.remove()` itself still runs in the create-effect cleanup.
 */
export function useChartDisposed(): { current: boolean } {
  const disposedRef = useRef(false);
  useLayoutEffect(() => {
    disposedRef.current = false;
    return () => {
      disposedRef.current = true;
    };
  }, []);
  return disposedRef;
}

export function ifChartAlive(disposed: { current: boolean }, fn: () => void): void {
  if (disposed.current) return;
  try {
    fn();
  } catch {
    /* series/chart already disposed */
  }
}

/**
 * Resolve once the host has a real box. `createChart` on a 0×0 node never paints,
 * and a mount-only effect that saw `host === null` never retries.
 */
export function whenHostReady(
  host: () => HTMLElement | null,
  cancelled: () => boolean,
  minPx = 8,
): Promise<HTMLElement | null> {
  return new Promise((resolve) => {
    const tick = () => {
      if (cancelled()) {
        resolve(null);
        return;
      }
      const el = host();
      if (el && el.clientWidth >= minPx && el.clientHeight >= minPx) {
        resolve(el);
        return;
      }
      requestAnimationFrame(tick);
    };
    tick();
  });
}
