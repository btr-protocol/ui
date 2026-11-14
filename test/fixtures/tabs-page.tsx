// Page for test/tabs.browser.test.tsx: real tabs next to real ButtonGroups, rendered by Chromium.
import { render } from 'preact';
import { useState } from 'preact/hooks';
import { Button } from '../../src/ui/Button';
import { ButtonGroup } from '../../src/ui/ButtonGroup';
import { SegmentedControl } from '../../src/ui/SegmentedControl';

const L = (names: string[]) => names.map((n) => ({ value: n.toLowerCase(), label: n }));
const T3 = L(['Volume & Fees', 'Risk', 'Flow']);
const T7 = L(['Overview', 'Positions', 'Orders', 'History', 'Fees', 'Signers', 'Settings']);
const T6 = T7.slice(0, 6);
const FIT = L(['$', 'APR']);
const LONG = L(['Cross-chain settlement and reconciliation report', 'Risk', 'Flow']);

function Tabs({ opts, start, ...p }: { opts: { value: string; label: string }[]; start: string } & Record<string, unknown>) {
  const [v, setV] = useState(start);
  return <SegmentedControl aria-label="t" options={opts} value={v} onChange={setV} {...p}>{p.presentation ? <p>panel</p> : undefined}</SegmentedControl>;
}

render(
  <main style={{ padding: '16px', width: '100%' }}>
    <div id="cmp" style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
      <Tabs opts={T3} start="risk" />
      <ButtonGroup aria-label="g"><Button size="sm">Monad</Button><Button size="sm">All time</Button></ButtonGroup>
    </div>
    <div id="xs" style={{ display: 'flex', gap: '12px', marginTop: 12 }}>
      <Tabs opts={T3} start="risk" size="xs" />
      <ButtonGroup aria-label="g"><Button size="xs">Monad</Button><Button size="xs">All time</Button></ButtonGroup>
    </div>
    <div id="fit" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8, marginTop: 12 }}>
      {(['xs', 'sm', 'md'] as const).map((z) => (
        <div key={z} id={`fit-${z}`} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <Tabs opts={FIT} start="apr" size={z} />
          <Tabs opts={FIT} start="apr" size={z} presentation="attached" />
          <ButtonGroup aria-label="g"><Button size={z === 'xs' ? 'xs' : 'sm'}>$</Button><Button size={z === 'xs' ? 'xs' : 'sm'}>APR</Button></ButtonGroup>
        </div>
      ))}
    </div>
    <div id="over" style={{ marginTop: 12 }}><Tabs opts={T7} start="signers" /></div>
    <div id="att7" style={{ marginTop: 12 }}><Tabs opts={T7} start="settings" presentation="attached" /></div>
    <div id="att6" style={{ marginTop: 12 }}><Tabs opts={T6} start="fees" presentation="attached" /></div>
    <div id="attlong" style={{ marginTop: 12 }}><Tabs opts={LONG} start="risk" presentation="attached" /></div>
    <div id="manual" style={{ marginTop: 12 }}><Tabs opts={T3} start="volume & fees" activation="manual" /></div>
  </main>,
  document.body.appendChild(document.createElement('div')),
);
