// Page for test/section-bar.browser.test.tsx and the proposal screenshots: every SectionBar variant above a small sample
// table, a BEFORE row with today's inconsistent headers, and the bars in a card section without a table.
import { render, type ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import { Button } from '../../src/ui/Button';
import { Icon } from '../../src/ui/Icon';
import { PanelHeader, PanelTitle } from '../../src/ui/Panel';
import { SearchField } from '../../src/ui/SearchField';
import { SearchInput } from '../../src/ui/SearchInput';
import { SectionBar, SectionBarCell, SectionBarText } from '../../src/ui/SectionBar';
import { SegmentedControl } from '../../src/ui/SegmentedControl';
import { SelectModal, MultiSelectModal } from '../../src/ui/SelectModal';
import { Table } from '../../src/ui/Table';

const ROWS = [
  { id: 'a', pool: 'WBTC / USDC', chain: 'Monad', tvl: '$1.20M' },
  { id: 'b', pool: 'cbBTC / WBTC', chain: 'Base', tvl: '$640K' },
  { id: 'c', pool: 'ETH / USDC', chain: 'Monad', tvl: '$2.40M' },
];
const COLS = [
  { key: 'pool', label: 'Pool' },
  { key: 'chain', label: 'Chain' },
  { key: 'tvl', label: 'TVL', align: 'right' as const },
];
const CHAINS = [{ value: 'monad', label: 'Monad' }, { value: 'base', label: 'Base' }];

const Frame = ({ id, before, className = '', children }: { id: string; before?: boolean; className?: string; children: ComponentChildren }) => (
  <section id={id} data-before={before || undefined} className={`${className} surface bg-bg-1 border border-border rounded-lg shadow-sm overflow-hidden`}>{children}</section>
);
const Sample = () => (
  <table className="w-full text-sm">
    <thead><tr className="border-b border-border bg-bg-2 text-xs uppercase text-fg-1">{COLS.map((c) => <th key={c.key} className={`px-3 py-1.5 font-medium ${c.align === 'right' ? 'text-right' : 'text-left'}`}>{c.label}</th>)}</tr></thead>
    <tbody>{ROWS.map((r) => <tr key={r.id} className="border-b border-border last:border-0"><td className="px-3 py-2">{r.pool}</td><td className="px-3 py-2">{r.chain}</td><td className="px-3 py-2 text-right">{r.tvl}</td></tr>)}</tbody>
  </table>
);
const Card = () => <p className="px-3 py-3 text-sm text-fg-2">Card body without a table: the bar is the same top edge.</p>;
const Label = ({ children }: { children: string }) => <h3 className="mb-1 mt-4 text-xs font-semibold uppercase tracking-wide text-fg-3">{children}</h3>;

const TABS = [{ value: 'all', label: 'All' }, { value: 'open', label: 'Open' }, { value: 'done', label: 'Done' }];
const RANGE = [{ value: '1d', label: '1D' }, { value: '1w', label: '1W' }, { value: '1m', label: '1M' }];

function Bars({ body }: { body: 'table' | 'card' }) {
  const [q1, setQ1] = useState('');
  const [q2, setQ2] = useState('');
  const [q5, setQ5] = useState('');
  const [tab, setTab] = useState('all');
  const [range, setRange] = useState('1w');
  const [chain, setChain] = useState('monad');
  const [chains, setChains] = useState<string[]>(['monad']);
  const B = body === 'table' ? <Sample /> : <Card />;
  const p = body;
  return (
    <>
      <Label>1. Title left, search right</Label>
      {body === 'table' ? (
        <div id="v1" data-variant="1"><Table bar={{ title: 'Pools' }} searchPlaceholder="Search pools" columns={COLS} data={ROWS} rowKey={(r) => r.id} /></div>
      ) : (
        <Frame id={`v1-${p}`}><SectionBar title="Pools" search={{ value: q1, onChange: setQ1, placeholder: 'Search pools' }} />{B}</Frame>
      )}
      <Label>2. Search left, filters right</Label>
      <Frame id={`v2-${p}`}>
        <SectionBar label="Filters" searchSide="left" search={{ value: q2, onChange: setQ2, placeholder: 'Search pools' }}
          end={<>
            <SectionBarCell><SelectModal routeKey={`chain-${p}`} label="Chain" items={CHAINS} value={chain} onChange={setChain} /></SectionBarCell>
            <SectionBarCell><MultiSelectModal routeKey={`chains-${p}`} label="Legs" items={CHAINS} value={chains} onChange={setChains} /></SectionBarCell>
          </>} />
        {B}
      </Frame>
      <Label>3. Title, tab strip, actions, no search</Label>
      <Frame id={`v3-${p}`}>
        <SectionBar title="Orders" label="Orders view"
          start={<SectionBarCell><SegmentedControl size="sm" aria-label="Status" options={TABS} value={tab} onChange={setTab} /></SectionBarCell>}
          end={<>
            <SectionBarCell><Button variant="ghost" size="sm" aria-label="Refresh" leftIcon={<Icon name="refresh-cw" className="h-4 w-4" />} /></SectionBarCell>
            <SectionBarCell><Button variant="ghost" size="sm">Export</Button></SectionBarCell>
          </>} />
        {B}
      </Frame>
      <Label>4. Title only</Label>
      <Frame id={`v4-${p}`}><SectionBar title="Signers" />{B}</Frame>
      <Label>5. Filters, count, search right, primary action</Label>
      <Frame id={`v5-${p}`}>
        <SectionBar label="Pool controls" search={{ value: q5, onChange: setQ5, placeholder: 'Search pools' }}
          start={<>
            <SectionBarCell><SegmentedControl size="sm" aria-label="Range" options={RANGE} value={range} onChange={setRange} /></SectionBarCell>
            <SectionBarText>{ROWS.length} pools</SectionBarText>
          </>}
          end={<SectionBarCell><Button variant="primary" size="sm">New pool</Button></SectionBarCell>} />
        {B}
      </Frame>
    </>
  );
}

function SearchVariants() {
  const [b, setB] = useState('');
  const [m, setM] = useState('');
  const [r, setR] = useState('');
  const [d, setD] = useState('');
  const [legacy, setLegacy] = useState('');
  return (
    <>
      <Label>Search: one core, three presentations (bar, modal, boxed)</Label>
      <div id="sv" className="grid gap-3 sm:grid-cols-2">
        <Frame id="sv-bar" className="sm:col-span-2"><SectionBar title="bar" search={{ value: b, onChange: setB, placeholder: 'Search pools' }} /><p className="px-3 py-2 text-xs text-fg-2">A cell of the bar: the bar supplies box, corner, divider.</p></Frame>
        <Frame id="sv-modal"><div className="h-12 border-b border-border bg-bg-1 px-3 flex items-center"><SearchField variant="modal" value={m} onChange={setM} placeholder="Search pools" /></div><p className="px-3 py-2 text-xs text-fg-2">A modal / list header: no box.</p></Frame>
        <Frame id="sv-boxed"><div className="p-3"><SearchField variant="boxed" value={r} onChange={setR} placeholder="Search pools" busy={r === 'busy'} /></div><p className="px-3 pb-2 text-xs text-fg-2">Standalone: its own box.</p></Frame>
      </div>
      <div id="sv-extra" className="mt-2 grid gap-2 sm:grid-cols-2">
        <SearchField variant="boxed" value={d} onChange={(v) => { setD(v); (window as unknown as { __deb: string[] }).__deb = [...((window as unknown as { __deb?: string[] }).__deb ?? []), v]; }} debounce={200} placeholder="Debounced" className="sv-deb" />
        <SearchInput variant="boxed" value={legacy} onChange={setLegacy} placeholder="SearchInput (boxed, kept export)" className="sv-legacy" />
      </div>
    </>
  );
}

function Before() {
  const [a, setA] = useState('');
  const [tab, setTab] = useState('all');
  return (
    <>
      <Label>BEFORE: title only (PanelHeader)</Label>
      <Frame id="b1" before><PanelHeader><PanelTitle>Pools</PanelTitle></PanelHeader><Sample /></Frame>
      <Label>BEFORE: title + boxed search (Table title)</Label>
      <Frame id="b2" before><PanelHeader><PanelTitle>Pools</PanelTitle><div className="flex items-center gap-3 flex-wrap justify-end"><SearchInput value={a} onChange={setA} placeholder="Search pools" className="w-full sm:w-64" /></div></PanelHeader><Sample /></Frame>
      <Label>BEFORE: title + meta + tabs</Label>
      <Frame id="b3" before><PanelHeader><PanelTitle>Orders</PanelTitle><div className="flex items-center gap-2 flex-wrap"><span className="text-xs text-fg-2">3 rows</span><SegmentedControl size="sm" aria-label="Status" options={TABS} value={tab} onChange={setTab} /></div></PanelHeader><Sample /></Frame>
      <Label>BEFORE: chart-style toolbar strip (h-8)</Label>
      <Frame id="b4" before><div className="flex items-center min-h-8 border-b border-border"><span className="px-2 text-xs font-medium text-fg-1 border-r border-border h-8 flex items-center">Pools</span><button type="button" className="px-2 h-8 text-sm text-fg-2">Export</button></div><Sample /></Frame>
    </>
  );
}

document.head.append(Object.assign(document.createElement('style'), { textContent: 'html,body{height:auto;overflow:visible}' })); // the kit pins the app shell to the viewport; the proposal page is a long document
render(
  <main style={{ padding: '16px', width: '100%', maxWidth: 960, margin: '0 auto' }}>
    <h1 className="text-lg font-semibold text-fg-0">SectionBar proposal</h1>
    <div id="before"><Before /></div>
    <SearchVariants />
    <div id="after-table"><Bars body="table" /></div>
    <h2 className="mt-8 text-base font-semibold text-fg-0">In a card section, no table</h2>
    <div id="after-card"><Bars body="card" /></div>
  </main>,
  document.body,
);
