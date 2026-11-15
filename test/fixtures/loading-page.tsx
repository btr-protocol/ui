// Page for test/loading.browser.test.tsx: every loader primitive and every Figure state, in a table, a card and a button.
// ?v=bare (no Tailwind: the loaders stylesheet alone) | all (default) | swap (ValuePlaceholder <-> value, window.__flip()) | busy (200 loading rows in Busy, window.__busy(bool)).
import { render } from 'preact';
import { useState } from 'preact/hooks';
import type { Cell } from '../../src/lib/cell';
import { Busy, Button, Figure, Hairline, Skeleton, Spinner, ValuePlaceholder } from '../../src/ui';

const v = new URLSearchParams(location.search).get('v') ?? 'all';
const fmt = (n: number) => n.toFixed(2);
const now = Date.now();
const STATES: [string, Cell<number>][] = [
  ['value', { s: 'value', v: 1234.5 }],
  ['value (measured zero)', { s: 'value', v: 0 }],
  ['stale', { s: 'stale', v: 1234.5, asOf: now - 5 * 60_000 }],
  ['loading', { s: 'loading', since: Date.now() }],
  ['measuring', { s: 'measuring', note: 'depth' }],
  ['unavailable (error, retry)', { s: 'unavailable', reason: 'error', retry: () => {} }],
  ['unavailable (unfillable)', { s: 'unavailable', reason: 'unfillable', detail: 'no depth' }],
  ['unavailable (timeout)', { s: 'unavailable', reason: 'timeout' }],
  ['unavailable (rate-limited)', { s: 'unavailable', reason: 'rate-limited' }],
  ['na', { s: 'na', why: 'No fees booked in this window' }],
];

function App() {
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(true);
  (window as unknown as { __flip: () => void }).__flip = () => setLoaded((x) => !x);
  (window as unknown as { __busy: (b: boolean) => void }).__busy = setBusy;
  if (v === 'swap')
    return <div className="p-4"><span id="fig" className="text-sm"><Figure ch={10} cell={loaded ? { s: 'value', v: 42 } : { s: 'loading', since: Date.now() }} format={fmt} /></span></div>;
  if (v === 'bare')
    return (
      <div id="bare">
        <Spinner />
        <Spinner size="md" />
        <span id="sk" className="sk" style="display:block;width:80px;height:12px" />
      </div>
    );
  if (v === 'busy')
    return (
      <Busy busy={busy} label="Loading pools">
        <table><tbody>{Array.from({ length: 200 }, (_, i) => <tr key={i}><td>Pool {i}</td><td><Figure ch={8} cell={busy ? { s: 'loading', since: Date.now() } : { s: 'value', v: i }} format={fmt} /></td></tr>)}</tbody></table>
      </Busy>
    );
  return (
    <div className="flex flex-col gap-6 p-4 text-sm">
      <Busy busy label="Loading the states">
        <table className="w-full max-w-xl text-left">
          <thead><tr><th>State</th><th>Figure</th></tr></thead>
          <tbody>{STATES.map(([n, c]) => <tr key={n}><td className="py-1 pr-4 text-fg-2">{n}</td><td><Figure ch={8} cell={c} format={fmt} /></td></tr>)}</tbody>
        </table>
      </Busy>
      <div className="relative max-w-xs rounded-md border border-border bg-bg-1 p-4">
        <Hairline />
        <div className="mb-3 text-fg-2">Card: refreshing in the background</div>
        <Skeleton lines={3} />
        <div className="mt-3 flex items-center gap-2"><span>TVL</span><ValuePlaceholder ch={8} /><span id="cascade"><Spinner className="hidden text-warning bg-bg-3" /></span><span id="plain"><Spinner /></span><span id="solo"><Figure ch={6} cell={{ s: 'loading', since: Date.now() }} format={fmt} /></span></div>
      </div>
      <div className="flex items-center gap-4">
        <Button variant="primary" size="sm" leftIcon={<Spinner />}>Signing</Button>
        <Button size="sm" disabled leftIcon={<Spinner />}>Waiting</Button>
        <Spinner size="md" />
        <Skeleton className="h-24 w-40" />
      </div>
    </div>
  );
}
render(<App />, document.body.appendChild(document.createElement('div')));
