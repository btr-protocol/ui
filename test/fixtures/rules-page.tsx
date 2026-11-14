// Page for test/rules.browser.test.tsx: the button/menu/select rules in a real browser. ?v=group|menu|select|dropdown opens one.
import { render } from 'preact';
import { Button, ButtonGroup, ClickMenu, ConfirmSheet, Dropdown, Icon, SegmentedControl, SelectModal } from '../../src/ui';

const q = new URLSearchParams(location.search);
const v = q.get('v');
const long = 'Switch the connected wallet to Ethereum Mainnet to continue signing';
const items = [
  { value: 'a', label: 'Server' },
  { value: 'b', label: 'Server + browser' },
  { value: 'c', label: 'Browser only' },
];
const many = Array.from({ length: 9 }, (_, i) => ({ value: `v${i}`, label: `Option ${i}` }));

const sized = q.get('size') as 'xs' | 'sm' | 'default' | null;

function App() {
  if (v === 'confirm') return <ConfirmSheet open title="Confirm" onClose={() => {}} onConfirm={() => {}} confirmLabel="Confirm and sign" />;
  if (v === 'sort')
    return (
      <SelectModal routeKey="sort" label="Token" value="a" onChange={() => {}} searchable
        sortColumns={[{ key: 'bal', label: 'Balance', fmt: (x) => String(x ?? '') }]}
        items={items.map((i, n) => ({ ...i, data: { bal: 100 * (n + 1) + 0.5 } }))} />
    );
  if (v === 'strip')
    return (
      <div id="strip" style={{ width: 200 }}>
        <SegmentedControl aria-label="Range" value="a" onChange={() => {}} options={[{ value: 'a', label: 'Short' }, { value: 'b', label: 'A tab label much wider than the strip' }]} />
      </div>
    );
  if (v === 'flex')
    return (
      <div id="row" style={{ display: 'flex', width: 130 }} className="p-2">
        <Button size="sm" id="count">{12} items selected in the list</Button>
        <Button size="sm" id="mixed">Pick <b>all</b> of them now</Button>
        <Button size="sm" id="fits" className="shrink-0">OK</Button>
      </div>
    );
  if (v === 'dropdown' && sized) return <div className="p-4"><Dropdown size={sized} value="a" onChange={() => {}} items={items} /></div>;
  if (v === 'group')
    return (
      <div id="host" style={{ width: q.get('w') ? `${q.get('w')}px` : '100%' }} className="p-2">
        <div id="lone" className="flex"><Button size="sm" className="w-full">{long}</Button></div>
        <ButtonGroup aria-label="Signing" wrap className="w-full">
          <Button size="sm" aria-label="Copy" leftIcon={<Icon name="copy" size={16} />} />
          <Button size="sm" aria-label="Cancel" leftIcon={<Icon name="x" size={16} />} />
          <Button size="sm">Reject</Button>
          <Button size="sm" variant="primary">{long}</Button>
        </ButtonGroup>
      </div>
    );
  if (v === 'menu')
    return (
      <div className="p-4"><ClickMenu side="bottom" trigger={<button type="button" id="trg">Menu</button>} items={[{ id: 'a', label: 'Server', selected: true }, { id: 'b', label: 'Server + browser', selected: false }, { id: 'c', label: 'Remove', tone: 'danger' }]} /></div>
    );
  if (v === 'select')
    return (
      <div className="p-4">
        <SelectModal routeKey="r" label="Mode" value="a" onChange={() => {}} items={items} triggerPrefix={<><Icon name="check-circle" size={16} /><span>Simulated ·</span></>} />
        <SelectModal routeKey="r2" label="Many" value="" onChange={() => {}} items={many} />
      </div>
    );
  return (
    <div className="p-4"><Dropdown value="a" onChange={() => {}} items={items} /></div>
  );
}
render(<App />, document.body.appendChild(document.createElement('div')));
