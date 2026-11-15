import { expect, jest, setSystemTime, test } from 'bun:test';
import { render } from 'preact-render-to-string';
import { type Cell, DASH, Figure, MetricState, NA_GLYPH, assertNever, expireLoading, useCellDeadline } from '../src';
import { act, mount, useDom } from './dom';

useDom();

const f = (cell: Cell<number>) => render(<Figure cell={cell} format={(n) => n.toFixed(2)} />);

test('expireLoading: an overdue loading cell becomes unavailable(timeout); others are untouched', () => {
  const loading: Cell<number> = { s: 'loading', since: 1000 };
  expect(expireLoading(loading, 1000 + 14999)).toBe(loading);
  expect(expireLoading(loading, 1000 + 15000)).toEqual({ s: 'unavailable', reason: 'timeout' });
  expect(expireLoading(loading, 1000 + 5000, 3000)).toEqual({ s: 'unavailable', reason: 'timeout' });
  const v: Cell<number> = { s: 'value', v: 1 };
  expect(expireLoading(v, 1e12)).toBe(v);
});

test('useCellDeadline: ONE timer; a loading cell becomes unavailable(timeout) when its deadline passes (fake timers)', async () => {
  jest.useFakeTimers();
  setSystemTime(new Date(1_000_000));
  const seen: string[] = [];
  const Probe = ({ cell }: { cell: Cell<number> }) => (seen.push(useCellDeadline(cell, 5000).s), null);
  const m = mount(<Probe cell={{ s: 'loading', since: 1_000_000 }} />);
  expect(seen.at(-1)).toBe('loading');
  expect(jest.getTimerCount()).toBe(1);
  setSystemTime(new Date(1_005_000));
  await act(async () => { jest.advanceTimersByTime(5000); });
  expect(seen.at(-1)).toBe('unavailable');
  m.unmount();
  expect(jest.getTimerCount()).toBe(0);
  jest.useRealTimers();
  setSystemTime();
});

test('Figure: a measured zero prints as zero, never the n/a glyph; every state is distinct', () => {
  expect(f({ s: 'value', v: 0 })).toContain('0.00');
  expect(f({ s: 'value', v: 0 })).not.toContain('>-<');
  const states: Cell<number>[] = [{ s: 'value', v: 0 }, { s: 'stale', v: 1, asOf: 0 }, { s: 'loading', since: 0 }, { s: 'measuring' }, { s: 'unavailable', reason: 'error' }, { s: 'na', why: 'x' }];
  expect(new Set(states.map(f)).size).toBe(states.length);
  expect(f({ s: 'stale', v: 5, asOf: 0 })).toContain('5.00'); // stale keeps its value, never a dash
  expect(f({ s: 'stale', v: 5, asOf: 0 })).toContain('stale ');
});

test('one n/a glyph, a hyphen: no em dash in the kit constants', () => {
  expect(NA_GLYPH).toBe(DASH);
  expect(NA_GLYPH).toBe('-');
});

test('Figure: a loading cell past its deadline renders as unavailable(timeout); outside a Busy it announces Loading', () => {
  expect(f({ s: 'loading', since: Date.now() })).toContain('Loading');
  const html = render(<Figure cell={{ s: 'loading', since: Date.now() - 20000 }} format={String} />);
  expect(html).toContain('Unavailable: Timed out');
  expect(html).not.toContain('Loading');
});

test('Figure: unavailable and na carry real text, a focusable tooltip trigger, and a named Retry', () => {
  const html = render(<Figure cell={{ s: 'unavailable', reason: 'rate-limited', retry: () => {} }} format={String} label="TVL" />);
  expect(html).toContain('Unavailable: Rate limited');
  expect(html).toContain('tabindex="0"');
  expect(html).toContain('aria-label="Retry TVL"');
  expect(f({ s: 'na', why: 'no fees' })).toContain('Not applicable: no fees');
});

test('MetricState: each phase has its own role, text and icon', () => {
  const r = (phase: Parameters<typeof MetricState>[0]['phase']) => render(<MetricState phase={phase} value="1.5" reason="why" />);
  expect(r('live')).toContain('1.5');
  expect(r('loading')).toContain('role="status"'); // standalone: announces itself
  expect(r('loading')).not.toContain('1.5');
  const err = r('error');
  expect(err).toContain('Unavailable: Could not load, why');
  expect(err).toContain('lucide-triangle-alert');
  const unf = r('unfillable');
  expect(unf).toContain('Unavailable: Unfillable, why');
  expect(unf).toContain('lucide-circle-x');
  expect(r('empty')).toContain('Not applicable:');
  expect(r('stale')).toContain('Updating');
  expect(new Set(['live', 'loading', 'error', 'unfillable', 'empty'].map((p) => r(p as never))).size).toBe(5);
});

test('the Cell switch is exhaustive: a state missing from it fails to compile (tsc)', () => {
  type Grown = Cell<number> | { s: 'brand-new' };
  const name = (c: Grown): string => {
    switch (c.s) {
      case 'value': case 'stale': case 'loading': case 'measuring': case 'unavailable': case 'na': return c.s;
      default:
        // @ts-expect-error 'brand-new' has no case above: assertNever(never) refuses it. If this stops erroring, exhaustiveness is lost.
        return assertNever(c);
    }
  };
  expect(name({ s: 'na', why: '' })).toBe('na');
  expect(() => name({ s: 'brand-new' })).toThrow();
});
