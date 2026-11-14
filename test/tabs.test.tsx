import { beforeEach, expect, test } from 'bun:test';
import { render as ssr } from 'preact-render-to-string';
import { useState } from 'preact/hooks';
import { SegmentedControl } from '../src';
import { act, click, key, mount, useDom } from './dom';

useDom();
beforeEach(() => { document.body.innerHTML = ''; });

const O = [{ value: 'a', label: 'A' }, { value: 'b', label: 'B', disabled: true, title: 'off' }, { value: 'c', label: 'C' }, { value: 'd', label: 'D' }];
const tabs = (h: Element) => [...h.querySelectorAll<HTMLElement>('[role=tab]')];

test('group: the tablist is a ButtonGroup and every tab a Button, with tab semantics', () => {
  const { host } = mount(<SegmentedControl aria-label="Sections" options={O} value="c" onChange={() => {}} />);
  const list = host.querySelector('[role=tablist]')!;
  expect(list.classList.contains('btn-group')).toBe(true);
  expect(list.getAttribute('aria-label')).toBe('Sections');
  const t = tabs(host);
  expect(t.map((x) => x.getAttribute('aria-selected'))).toEqual(['false', 'false', 'true', 'false']);
  expect(t.map((x) => x.tabIndex)).toEqual([-1, -1, 0, -1]);
  expect(t[0]!.className).toContain('h-[var(--ctl-m)]'); // Button sm: the ButtonGroup height
  expect(t[1]!.getAttribute('aria-disabled')).toBe('true');
  expect(t[1]!.getAttribute('title')).toBe('off');
  expect(host.querySelector('[role=tabpanel]')).toBeNull();
  expect(t.some((x) => x.hasAttribute('aria-controls'))).toBe(false);
});

test('click selects; a disabled tab never does', () => {
  const got: string[] = [];
  const { host } = mount(<SegmentedControl aria-label="S" options={O} value="a" onChange={(v) => got.push(v)} />);
  click(tabs(host)[1]!);
  click(tabs(host)[2]!);
  expect(got).toEqual(['c']);
});

test('keys: arrows skip disabled and wrap, Home / End jump, focus follows selection', () => {
  const got: string[] = [];
  const Host = () => {
    const [v, setV] = useState('a');
    return <SegmentedControl aria-label="S" options={O} value={v} onChange={(x) => { got.push(x); setV(x); }} />;
  };
  const { host } = mount(<Host />);
  const list = host.querySelector('[role=tablist]')!;
  tabs(host)[0]!.focus();
  key(list, 'ArrowRight');
  expect(got).toEqual(['c']); // b is disabled
  expect(document.activeElement).toBe(tabs(host)[2]!);
  key(list, 'End');
  expect(got.at(-1)).toBe('d');
  key(list, 'ArrowRight');
  expect(got.at(-1)).toBe('a'); // wraps
  key(list, 'ArrowLeft');
  expect(got.at(-1)).toBe('d');
  key(list, 'Home');
  expect(got.at(-1)).toBe('a');
  expect(tabs(host)[0]!.tabIndex).toBe(0);
});

test('attached: strip on the panel, panel named by the active tab, tabs control it', () => {
  const { host } = mount(<SegmentedControl presentation="attached" aria-label="S" options={O} value="c" onChange={() => {}}>body</SegmentedControl>);
  const panel = host.querySelector('[role=tabpanel]')!;
  const active = tabs(host)[2]!;
  expect(panel.textContent).toBe('body');
  expect(panel.classList.contains('tabs-panel')).toBe(true);
  expect(panel.getAttribute('aria-labelledby')).toBe(active.id);
  for (const t of tabs(host)) expect(t.getAttribute('aria-controls')).toBe(panel.id);
  const list = host.querySelector('[role=tablist]')!;
  expect(list.classList.contains('btn-group')).toBe(true);
  expect(list.classList.contains('btn-group-attached')).toBe(true);
  expect(list.classList.contains('btn-group-accent')).toBe(true); // accent is the attached default
  expect(host.querySelector('.tabs-attached-bar')!.contains(list)).toBe(true);
});

test('attached: accent={false} is flush; a caller-owned panel id with no children renders no panel', () => {
  const html = ssr(<SegmentedControl aria-label="S" presentation="attached" accent={false} panelId="mine" options={O} value="a" onChange={() => {}} />);
  expect(html).not.toContain('btn-group-accent');
  expect(html).toContain('aria-controls="mine"');
  expect(html).not.toContain('role="tabpanel"');
});

test('panelId + children: ONE id, the built-in panel carries it and every tab points at it', () => {
  const { host } = mount(<SegmentedControl presentation="attached" aria-label="S" panelId="mine" options={O} value="a" onChange={() => {}}>body</SegmentedControl>);
  const panel = host.querySelector('[role=tabpanel]')!;
  expect(panel.id).toBe('mine');
  for (const t of tabs(host)) expect(t.getAttribute('aria-controls')).toBe('mine');
  expect(panel.getAttribute('aria-labelledby')).toBe(tabs(host)[0]!.id);
});

test('tabpanel is a tab stop only when it has nothing focusable inside', () => {
  const a = mount(<SegmentedControl presentation="attached" aria-label="S" options={O} value="a" onChange={() => {}}>text</SegmentedControl>);
  expect(a.host.querySelector('[role=tabpanel]')!.getAttribute('tabindex')).toBe('0');
  const b = mount(<SegmentedControl presentation="attached" aria-label="S" options={O} value="a" onChange={() => {}}><button type="button">go</button></SegmentedControl>);
  expect(b.host.querySelector('[role=tabpanel]')!.hasAttribute('tabindex')).toBe(false);
});

test('href tabs are real anchors with tab semantics; a plain click selects without navigating, a modified click is native', () => {
  const got: string[] = [];
  const { host } = mount(<SegmentedControl aria-label="S" options={[{ value: 'a', label: 'A', href: '/x/a' }, { value: 'b', label: 'B', href: '/x/b' }]} value="a" onChange={(v) => got.push(v)} />);
  const [, b] = tabs(host);
  expect(b!.tagName).toBe('A');
  expect(b!.getAttribute('href')).toBe('/x/b');
  expect(b!.getAttribute('role')).toBe('tab');
  const plain = new MouseEvent('click', { bubbles: true, cancelable: true });
  act(() => { b!.dispatchEvent(plain); });
  expect(plain.defaultPrevented).toBe(true);
  expect(got).toEqual(['b']);
  const meta = new MouseEvent('click', { bubbles: true, cancelable: true, metaKey: true });
  act(() => { b!.dispatchEvent(meta); });
  expect(meta.defaultPrevented).toBe(false);
  expect(got).toEqual(['b']);
});

test('xs rides Button xs height; sm and md ride Button sm', () => {
  const h = (size: 'xs' | 'sm' | 'md') => ssr(<SegmentedControl aria-label="S" size={size} options={O} value="a" onChange={() => {}} />);
  expect(h('xs')).toContain('h-[var(--ctl-s)]');
  expect(h('sm')).toContain('h-[var(--ctl-m)]');
  expect(h('md')).toContain('h-[var(--ctl-m)]');
});

test('manual activation: arrows only move focus, Enter / click selects', () => {
  const got: string[] = [];
  const { host } = mount(<SegmentedControl aria-label="S" activation="manual" options={O} value="a" onChange={(v) => got.push(v)} />);
  const list = host.querySelector('[role=tablist]')!;
  tabs(host)[0]!.focus();
  key(list, 'ArrowRight');
  expect(document.activeElement).toBe(tabs(host)[2]!);
  expect(got).toEqual([]);
  click(document.activeElement!);
  expect(got).toEqual(['c']);
});

test('arrows step from the focused tab, not the selected value (async consumers lag)', () => {
  const got: string[] = [];
  const { host } = mount(<SegmentedControl aria-label="S" options={O} value="a" onChange={(v) => got.push(v)} />);
  const list = host.querySelector('[role=tablist]')!;
  tabs(host)[0]!.focus();
  key(list, 'ArrowRight'); // value stays "a": the consumer has not committed yet
  key(list, 'ArrowRight');
  expect(got).toEqual(['c', 'd']);
});


test('no selected value: the first enabled tab is the one tab stop', () => {
  const { host } = mount(<SegmentedControl aria-label="S" options={O} value={'zz' as 'a'} onChange={() => {}} />);
  expect(tabs(host).map((x) => x.tabIndex)).toEqual([0, -1, -1, -1]);
});


test('a tablist must be named: aria-label or aria-labelledby is required by the types', () => {
  const noop = () => {};
  // @ts-expect-error no accessible name
  ssr(<SegmentedControl options={O} value="a" onChange={noop} />);
  const html = ssr(<SegmentedControl aria-labelledby="h" options={O} value="a" onChange={noop} />);
  expect(html).toContain('aria-labelledby="h"');
});
