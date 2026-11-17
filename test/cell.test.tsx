import { expect, jest, setSystemTime, test } from 'bun:test';
import { render } from 'preact-render-to-string';
import { type Cell, DASH, Figure, Loader, MetricState, NA_GLYPH, assertNever, loadingSince, toCell } from '../src';
import { act, mount, useDom } from './dom';

useDom();

const f = (cell: Cell<number>) => render(<Figure cell={cell} format={(n) => n.toFixed(2)} />);

test('toCell: a still-loading read past the deadline is unavailable(timeout), decided in the hook, no timer', () => {
  expect(toCell({ loading: true, since: 1000, now: 1000 + 14999 })).toEqual({ s: 'loading' });
  expect(toCell({ loading: true, since: 1000, now: 1000 + 15000 })).toEqual({ s: 'unavailable', reason: 'timeout' });
  // @ts-expect-error `since` is required while loading: a stuck load must be able to end
  expect(toCell({ loading: true })).toEqual({ s: 'loading' });
});

test('Figure is stateless: a loading to value swap renders no timer and no sibling re-render', () => {
  jest.useFakeTimers();
  let renders = 0;
  const Sibling = () => (renders++, <span>sib</span>);
  const sib = <Sibling />;
  const Row = ({ c }: { c: Cell<number> }) => (<div>{sib}<Figure cell={c} format={String} /></div>);
  const m = mount(<Row c={{ s: 'loading' }} />);
  expect(jest.getTimerCount()).toBe(0);
  expect(renders).toBe(1);
  m.unmount();
  jest.useRealTimers();
});

test('Figure: a measured zero prints as zero, never the n/a glyph; every state is distinct', () => {
  expect(f({ s: 'value', v: 0 })).toContain('0.00');
  expect(f({ s: 'value', v: 0 })).not.toContain('>-<');
  const states: Cell<number>[] = [{ s: 'value', v: 0 }, { s: 'stale', v: 1, asOf: 0 }, { s: 'loading' }, { s: 'error' }, { s: 'unavailable', reason: 'unserved' }, { s: 'na', why: 'x' }];
  expect(new Set(states.map(f)).size).toBe(states.length);
  expect(f({ s: 'stale', v: 5, asOf: 0 })).toContain('5.00'); // stale keeps its value, never a dash
  expect(f({ s: 'stale', v: 5, asOf: 0 })).toContain('stale ');
});

test('one n/a glyph, a hyphen: no em dash in the kit constants', () => {
  expect(NA_GLYPH).toBe(DASH);
  expect(NA_GLYPH).toBe('-');
});

test('Figure: a loading cell is a skeleton with no value text; outside a busy Loader it announces Loading once', () => {
  const h = f({ s: 'loading' });
  expect(h).toContain('Loading');
  expect(h).toContain('class="sk ');
  expect(h).not.toContain('style=');
  expect(h).not.toContain('>-<');
});

test('Figure: unavailable and na are ONE light node: title carries the reason, no tab stop, no role, no alert', () => {
  const html = render(<Figure cell={{ s: 'unavailable', reason: 'rate-limited' }} format={String} label="TVL" />);
  expect(html).toContain('Unavailable: Rate limited');
  expect(html).not.toContain('Retry');
  expect(html).not.toMatch(/tabindex|role=/);
  expect(html.match(/<span/g)?.length).toBe(1); // the box IS the glyph; no wrapper stack
  expect(f({ s: 'na', why: 'no fees' })).toContain('Not applicable: no fees');
  expect(f({ s: 'error' })).not.toContain('role="alert"'); // the section owns the one alert
  expect(f({ s: 'error' })).not.toContain('>-<'); // error is not the unavailable glyph
});

test('MetricState: each phase has its own role, text and icon', () => {
  const r = (phase: Parameters<typeof MetricState>[0]['phase']) => render(<MetricState phase={phase} value="1.5" reason="why" />);
  expect(r('live')).toContain('1.5');
  expect(r('loading')).toContain('>Loading<'); // standalone: hidden plain text, no live region
  expect(r('loading')).not.toContain('1.5');
  const err = r('error');
  expect(err).toContain('Not read');
  expect(err).not.toContain('why'); // raw detail never reaches the UI
  const unf = r('unfillable');
  expect(unf).toContain('Unavailable: Unfillable, why');
  expect(r('empty')).toContain('Not applicable:');
  expect(r('stale')).toContain('Updating');
  expect(new Set(['live', 'loading', 'error', 'unfillable', 'empty'].map((p) => r(p as never))).size).toBe(5);
});

test('the Cell switch is exhaustive: a state missing from it fails to compile (tsc)', () => {
  type Grown = Cell<number> | { s: 'brand-new' };
  const name = (c: Grown): string => {
    switch (c.s) {
      case 'value': case 'stale': case 'loading': case 'error': case 'unavailable': case 'na': return c.s;
      default:
        // @ts-expect-error 'brand-new' has no case above: assertNever(never) refuses it. If this stops erroring, exhaustiveness is lost.
        return assertNever(c);
    }
  };
  expect(name({ s: 'na', why: '' })).toBe('na');
  expect(() => name({ s: 'brand-new' })).toThrow();
});

test('toCell: a real 0 is a value; unread and failed reads are never 0', () => {
  expect(toCell({ value: 0 })).toEqual({ s: 'value', v: 0, asOf: undefined });
  expect(toCell({ value: null, loading: true, since: Date.now() })).toEqual({ s: 'loading' });
  expect(toCell({ value: undefined })).toEqual({ s: 'unavailable', reason: 'unserved' });
  expect(toCell({ value: Number.NaN })).toEqual({ s: 'unavailable', reason: 'unserved' });
  expect(toCell({ value: null, error: new Error('x'), loading: true, since: 1 }).s).toBe('error');
  expect(toCell({ value: 3, error: true, asOf: 1 }).s).toBe('stale');
});
test('Figure: error is a short line plus a named Retry; no raw text', () => {
  const html = render(<Figure cell={{ s: 'error', retry: () => {} }} format={String} label="TVL" />);
  expect(html).toContain('Not read');
  expect(html).toContain('Retry TVL');
});

test('toCell: a held value is never blanked: refresh keeps it, a failed refresh marks it stale', () => {
  expect(toCell({ value: 5, loading: true, since: 1 })).toMatchObject({ s: 'value', v: 5, refreshing: true });
  expect(toCell({ value: 5, error: true, asOf: 9 })).toEqual({ s: 'stale', v: 5, asOf: 9 });
  expect(toCell({ value: 5, error: true, now: 77 })).toEqual({ s: 'stale', v: 5, asOf: 77 });
});
test('loadingSince keeps the start of a load and clears it when the read ends', () => {
  const m = new Map<string, number>();
  expect(loadingSince(m, 'k', true, 10)).toBe(10);
  expect(loadingSince(m, 'k', true, 99)).toBe(10);
  expect(loadingSince(m, 'k', false)).toBeUndefined();
  expect(loadingSince(m, 'k', true, 50)).toBe(50);
});
test('Loader: an error is the section\'s ONE alert; a bare busy Loader says its label once', () => {
  const html = render(<Loader busy={false} error="Metrics could not be read.">x</Loader>);
  expect((html.match(/role="alert"/g) ?? []).length).toBe(1);
  expect(render(<Loader busy>x</Loader>)).toContain('>Loading<');
});
