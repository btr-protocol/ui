import { expect, test } from 'bun:test';
import { render } from 'preact-render-to-string';
import { type Cell, DASH, Figure, NA_GLYPH, assertNever, expireLoading } from '../src';

const f = (cell: Cell<number>) => render(<Figure cell={cell} format={(n) => n.toFixed(2)} />);

test('expireLoading: an overdue loading cell becomes unavailable(timeout); others are untouched', () => {
  const loading: Cell<number> = { s: 'loading', since: 1000 };
  expect(expireLoading(loading, 1000 + 14999)).toBe(loading);
  expect(expireLoading(loading, 1000 + 15000)).toEqual({ s: 'unavailable', reason: 'timeout' });
  expect(expireLoading(loading, 1000 + 5000, 3000)).toEqual({ s: 'unavailable', reason: 'timeout' });
  const open: Cell<number> = { s: 'loading' };
  expect(expireLoading(open, 1e12)).toBe(open);
  const v: Cell<number> = { s: 'value', v: 1 };
  expect(expireLoading(v, 1e12)).toBe(v);
});

test('Figure: a measured zero prints as zero, never the n/a glyph; every state is distinct', () => {
  expect(f({ s: 'value', v: 0 })).toContain('0.00');
  expect(f({ s: 'value', v: 0 })).not.toContain('>-<');
  const states: Cell<number>[] = [{ s: 'value', v: 0 }, { s: 'stale', v: 1, asOf: 0 }, { s: 'loading' }, { s: 'measuring' }, { s: 'unavailable', reason: 'error' }, { s: 'na', why: 'x' }];
  expect(new Set(states.map(f)).size).toBe(states.length);
  expect(f({ s: 'stale', v: 5, asOf: 0 })).toContain('5.00'); // stale keeps its value, never a dash
  expect(f({ s: 'stale', v: 5, asOf: 0 })).toContain('stale ');
});

test('one n/a glyph, a hyphen: no em dash in the kit constants', () => {
  expect(NA_GLYPH).toBe(DASH);
  expect(NA_GLYPH).toBe('-');
});

test('the Cell switch is exhaustive: a state missing from it fails to compile (tsc)', () => {
  const name = (c: Cell<number>): string => {
    switch (c.s) {
      case 'value': case 'stale': case 'loading': case 'measuring': case 'unavailable': case 'na': return c.s;
      default: return assertNever(c);
    }
  };
  expect(name({ s: 'na', why: '' })).toBe('na');
  expect(() => assertNever('x' as never)).toThrow();
});
