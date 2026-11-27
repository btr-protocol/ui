// Virtual body: day separators join the height model, and resetKey clears the viewport.
import { expect, test } from 'bun:test';
import { useState } from 'preact/hooks';
import { Table } from '../src';
import { itemOffsets, virtualWindow } from '../src/lib/virtualWindow';
import { act, mount, useDom } from './dom';

useDom();

type Row = { name: string; ts: number };
const HOUR = 3_600_000;

/** `days` local days, `per` rows each (noon plus an hour, so every row is that day). */
const rows = (days: number, per: number): Row[] =>
  Array.from({ length: days }, (_, d) =>
    Array.from({ length: per }, (_, i) => ({
      name: `r${d * per + i}`,
      ts: new Date(2024, 0, 1 + d, 12).getTime() + i * HOUR,
    })),
  ).flat();
const localDay = (r: Row) => new Date(r.ts).toDateString();
const dayLabel = (d: string | number) => String(d);
const isoDay = (d: string | number) => new Date(String(d)).toISOString().slice(0, 10);
const groupByDay = { key: 'ts', dayOf: localDay, label: dayLabel, dateTime: isoDay };
const cols = [
  { key: 'name', label: 'Name', sortable: true },
  { key: 'ts', label: 'Time', sortable: true },
];
/** Day separators are visual rows (`aria-hidden`), never column headers. Spacers have no text. */
const seps = (host: HTMLElement) =>
  [...host.querySelectorAll<HTMLElement>('tbody tr[aria-hidden="true"]')].filter((tr) => tr.textContent);

test('day separators: one per local day under the time sort, none under another or no sort', () => {
  const at = (props: { initialSort?: { key: string; dir: 'asc' | 'desc' } }) =>
    mount(
      <Table
        columns={cols}
        data={rows(3, 3)}
        rowKey={(r) => r.name}
        virtual={{ overscan: 0 }}
        groupByDay={groupByDay}
        {...props}
      />,
    );
  const sorted = at({ initialSort: { key: 'ts', dir: 'asc' } });
  const days = seps(sorted.host);
  expect(days.map((tr) => tr.textContent)).toEqual(
    [0, 1, 2].map((d) => new Date(2024, 0, 1 + d, 12).toDateString()),
  );
  // The human label stays in `<time>`; dateTime (when given) is its machine-readable date.
  expect(days.map((tr) => tr.querySelector('time')!.getAttribute('datetime'))).toEqual(
    [0, 1, 2].map((d) => isoDay(new Date(2024, 0, 1 + d, 12).toDateString())),
  );
  expect(sorted.host.querySelectorAll('tbody th[scope=colgroup]')).toHaveLength(0);
  // Each separator precedes the first data row of its day (sorted, not raw, order), which points
  // at the separator's id: the day reaches AT without a false column header.
  expect(days.map((tr) => tr.nextElementSibling!.querySelector('td')!.textContent)).toEqual(['r0', 'r3', 'r6']);
  expect(days.map((tr) => tr.nextElementSibling!.getAttribute('aria-describedby'))).toEqual(
    days.map((tr) => tr.id),
  );
  sorted.unmount();

  const byName = at({ initialSort: { key: 'name', dir: 'asc' } });
  expect(seps(byName.host)).toHaveLength(0);
  byName.unmount();

  const unsorted = at({});
  expect(seps(unsorted.host)).toHaveLength(0);
  unsorted.unmount();

  // Without dateTime the label is a plain span (a <time> with no datetime would be invalid).
  const plainTime = mount(
    <Table
      columns={cols}
      data={rows(3, 3)}
      rowKey={(r) => r.name}
      virtual={{ overscan: 0 }}
      initialSort={{ key: 'ts', dir: 'asc' }}
      groupByDay={{ key: 'ts', dayOf: localDay, label: dayLabel }}
    />,
  );
  const day = seps(plainTime.host)[0]!;
  expect(day.querySelector('time')).toBeNull();
  expect(day.querySelector('span')!.textContent).toBe(new Date(2024, 0, 1, 12).toDateString());
  plainTime.unmount();
});

test('virtual window: day rows share the height model, offsets stay exact at a scroll offset', () => {
  const keys = new Map<string, number>();
  const { host, unmount } = mount(
    <Table
      title="Activity"
      columns={cols}
      data={rows(3, 10)}
      rowKey={(r, i) => {
        keys.set(r.name, i);
        return r.name;
      }}
      initialSort={{ key: 'ts', dir: 'asc' }}
      virtual={{ overscan: 0, maxHeight: 420 }}
      groupByDay={groupByDay}
    />,
  );
  const body = host.querySelector<HTMLElement>('div.overflow-y-auto')!;
  act(() => {
    body.scrollTop = 200;
    body.dispatchEvent(new Event('scroll'));
  });
  const tbody = host.querySelector('tbody')!;
  const dataRows = [...tbody.querySelectorAll('tr')].filter((tr) => tr.querySelector('td:not([colspan])'));
  // Window [200, 620) over heights 24 (day) + 32 (row): items 6..19, data rows 5..17.
  expect(dataRows[0]!.querySelector('td')!.textContent).toBe('r5');
  expect(dataRows[dataRows.length - 1]!.querySelector('td')!.textContent).toBe('r17');
  expect(keys.get('r5')).toBe(5); // rowKey still receives the DATA index
  expect(keys.get('r17')).toBe(17);
  const day1 = seps(host);
  expect(day1).toHaveLength(1); // only day 1 intersects the window
  const r10 = dataRows.find((tr) => tr.querySelector('td')!.textContent === 'r10')!;
  expect(r10.getAttribute('aria-describedby')).toBe(day1[0]!.id);
  expect(document.getElementById(day1[0]!.id)).toBe(day1[0]!);
  expect((tbody.firstElementChild as HTMLElement).style.height).toBe('184px'); // padTop = offsets[6]
  expect((tbody.lastElementChild as HTMLElement).style.height).toBe('408px'); // padBottom = 1032 - 624
  unmount();
});

test('resetKey resets the scroll position, the body scrollTop and the load-more latch', () => {
  let setKey: (k: string) => void = () => {};
  const loads: number[] = [];
  const data = rows(3, 10);
  function Harness() {
    const [k, set] = useState('a');
    setKey = set;
    return (
      <Table
        title="Activity"
        resetKey={k}
        columns={cols}
        data={data}
        rowKey={(r) => r.name}
        virtual={{ overscan: 0, maxHeight: 420, hasMore: true, onLoadMore: () => loads.push(1) }}
      />
    );
  }
  const { host, unmount } = mount(<Harness />);
  const body = host.querySelector<HTMLElement>('div.overflow-y-auto')!;
  const scrollToBottom = () =>
    act(() => {
      body.scrollTop = 1000;
      body.dispatchEvent(new Event('scroll'));
    });
  scrollToBottom();
  expect(loads).toHaveLength(1);
  scrollToBottom(); // the latch holds while the page is in flight
  expect(loads).toHaveLength(1);

  act(() => setKey('b'));
  expect(body.scrollTop).toBe(0); // the DOM scroller opened at the top again
  expect(host.querySelector('tbody')!.firstElementChild!.querySelector('td')!.textContent).toBe('r0');
  scrollToBottom();
  expect(loads).toHaveLength(2); // the latch was cleared
  unmount();
});

test('resetKey: the reset render windows from the top, never the old offset for a frame', () => {
  let setKey: (k: string) => void = () => {};
  const seen: string[] = [];
  const data = rows(3, 10);
  const columns = [
    {
      key: 'name',
      label: 'Name',
      sortable: true,
      render: (r: Row) => {
        seen.push(r.name);
        return r.name;
      },
    },
    { key: 'ts', label: 'Time', sortable: true },
  ];
  function Harness() {
    const [k, set] = useState('a');
    setKey = set;
    return (
      <Table
        title="Activity"
        resetKey={k}
        columns={columns}
        data={data}
        rowKey={(r) => r.name}
        virtual={{ overscan: 0, maxHeight: 420 }}
      />
    );
  }
  const { host, unmount } = mount(<Harness />);
  const body = host.querySelector<HTMLElement>('div.overflow-y-auto')!;
  act(() => {
    body.scrollTop = 1000;
    body.dispatchEvent(new Event('scroll'));
  });
  seen.length = 0;
  act(() => setKey('b'));
  expect(seen[0]).toBe('r0'); // the first paint of the new segment is already at the top
  unmount();
});

test('virtualWindow numeric overload preserves the published fixed-height math', () => {
  const fixed = virtualWindow(64, 100, 100, 32, 2);
  expect(fixed).toEqual({ start: 0, end: 8, padTop: 0, padBottom: 2944 });
  // Prefix offsets with a uniform height compute the same window, never NaN.
  expect(virtualWindow(64, 100, itemOffsets(Array(100).fill(32)), 2)).toEqual(fixed);
});
