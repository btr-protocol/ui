// Page for test/table-header.browser.test.tsx: a Table header with title + freshness + segments + search.
import { render } from 'preact';
import { useState } from 'preact/hooks';
import { SegmentedControl } from '../../src/ui/SegmentedControl';
import { Table } from '../../src/ui/Table';

const KINDS = ['All', 'Swap', 'Deposit', 'Withdraw'].map((l) => ({ value: l.toLowerCase(), label: l }));
const rows = Array.from({ length: 5 }, (_, i) => ({ id: `r${i}`, name: `Row ${i}`, v: i }));

function Page() {
  const [k, setK] = useState('all');
  return (
    <>
      <div id="t" style={{ padding: 16 }}>
        <Table
          title="Recent activity"
          resetKey={k}
          meta={
            <div className="flex items-center gap-2 flex-wrap">
              <span id="fresh" className="text-xs">1s ago</span>
              <SegmentedControl size="xs" aria-label="Action kind" options={KINDS} value={k} onChange={setK} />
            </div>
          }
          columns={[{ key: 'name', label: 'Name' }, { key: 'v', label: 'Value', align: 'right' }]}
          data={rows}
          rowKey={(r) => r.id}
          searchPlaceholder="Filter tx, action, payer, receiver, token"
        />
      </div>
      <div id="x" style={{ padding: 16 }}>
        <Table
          title="Expandable"
          columns={[{ key: 'name', label: 'Name' }]}
          data={rows}
          rowKey={(r) => r.id}
          searchable={false}
          expand={{ href: 'https://example.test/activity' }}
        />
      </div>
    </>
  );
}
render(<Page />, document.body.appendChild(document.createElement('div')));
