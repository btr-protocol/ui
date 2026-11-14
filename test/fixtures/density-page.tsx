// Page for test/density.browser.test.tsx and its render sheet: the controls, tab strips, modal select and click menu a phone sees.
// ?v=form (inputs, buttons s/m/l, button group with icon cells, tab strips) | select (8-row modal select, trigger #pick) | menu (click menu, trigger #trg).
import { render } from 'preact';
import { useState } from 'preact/hooks';
import { Button, ButtonGroup, ClickMenu, Icon, Input, SegmentedControl, SelectModal } from '../../src/ui';

const v = new URLSearchParams(location.search).get('v') ?? 'form';
const pairs = ['WETH / USDC', 'WBTC / USDC', 'cbBTC / WBTC', 'wstETH / WETH', 'MON / USDC', 'SOL / USDC', 'HYPE / USDC', 'ZEC / USDC'];
const tabs = ['1D', '1W', '1M', '1Y'].map((x) => ({ value: x, label: x }));

function Form() {
  const [a, setA] = useState('1W');
  const [b, setB] = useState('1M');
  const [pair, setPair] = useState('p0');
  return (
    <main className="mx-auto flex max-w-sm flex-col gap-3 p-4">
      <label className="text-xs text-fg-2">Amount</label>
      <Input id="in-l" placeholder="0.0" />
      <SelectModal routeKey="pair" label="Pair" value={pair} onChange={setPair} items={pairs.map((p, i) => ({ value: `p${i}`, label: p }))} />
      <div className="flex flex-wrap items-center gap-2">
        <Button id="b-s" size="xs">Small</Button>
        <Button id="b-m" size="sm">Medium</Button>
        <Button id="b-l" size="default" variant="primary">Large</Button>
      </div>
      <ButtonGroup aria-label="Signing" wrap className="w-full">
        <Button id="g-copy" size="sm" aria-label="Copy" leftIcon={<Icon name="copy" size={16} />} />
        <Button size="sm" aria-label="Cancel" leftIcon={<Icon name="x" size={16} />} />
        <Button size="sm">Reject</Button>
        <Button size="sm" variant="primary">Sign</Button>
      </ButtonGroup>
      <ButtonGroup aria-label="Plain">
        <Button id="g-plain" size="sm" aria-label="Copy" leftIcon={<Icon name="copy" size={16} />} />
        <Button size="sm">Reject</Button>
      </ButtonGroup>
      <div id="tabs-group"><SegmentedControl aria-label="Range" options={tabs} value={a} onChange={setA} size="sm" /></div>
      <div id="tabs-xs"><SegmentedControl aria-label="Range xs" options={tabs} value={a} onChange={setA} size="xs" /></div>
      <div id="tabs-att"><SegmentedControl aria-label="Range attached" options={tabs} value={b} onChange={setB} presentation="attached"><p className="p-3 text-sm text-fg-2">Panel</p></SegmentedControl></div>
    </main>
  );
}

function App() {
  if (v === 'select') return <div className="p-4"><SelectModal routeKey="pick" label="Pair" value="p1" onChange={() => {}} items={pairs.map((p, i) => ({ value: `p${i}`, label: p }))} searchable /></div>;
  if (v === 'menu')
    return (
      <div className="p-4"><ClickMenu side="bottom" trigger={<Button id="trg" size="sm">Menu</Button>} items={[{ id: 'a', label: 'Server', selected: true }, { id: 'b', label: 'Server + browser' }, { id: 'c', label: 'Browser only' }, { id: 'd', label: 'Remove', tone: 'danger' }]} /></div>
    );
  return <Form />;
}
render(<App />, document.body.appendChild(document.createElement('div')));
