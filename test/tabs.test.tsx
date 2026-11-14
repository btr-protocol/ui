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
  const { host } = mount(<SegmentedControl options={O} value="a" onChange={(v) => got.push(v)} />);
  click(tabs(host)[1]!);
  click(tabs(host)[2]!);
  expect(got).toEqual(['c']);
});

test('keys: arrows skip disabled and wrap, Home / End jump, focus follows selection', () => {
  const got: string[] = [];
  const Host = () => {
    const [v, setV] = useState('a');
    return <SegmentedControl options={O} value={v} onChange={(x) => { got.push(x); setV(x); }} />;
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
  expect(list.classList.contains('btn-group-accent')).toBe(false);
  expect(host.querySelector('.tabs-attached-bar')!.contains(list)).toBe(true);
});

test('attached accent variant and a caller-owned panel id', () => {
  const html = ssr(<SegmentedControl presentation="attached" accent panelId="mine" options={O} value="a" onChange={() => {}} />);
  expect(html).toContain('btn-group-accent');
  expect(html).toContain('aria-controls="mine"');
  expect(html).not.toContain('role="tabpanel"');
});

test('no selected value: the first enabled tab is the one tab stop', () => {
  const { host } = mount(<SegmentedControl options={O} value={'zz' as 'a'} onChange={() => {}} />);
  expect(tabs(host).map((x) => x.tabIndex)).toEqual([0, -1, -1, -1]);
});

test('css: attached merges the active tab into the panel and keeps the group metrics', async () => {
  const css = await Bun.file(new URL('../src/styles/button-group.css', import.meta.url)).text();
  expect(css).toContain("[aria-selected='true']");
  expect(css).toContain('margin-bottom: -1px');
  expect(css).toContain('border-start-start-radius: 0'); // panel corner under the strip
  expect(css).not.toMatch(/\.btn-group-attached[^{]*\{[^}]*(?:\n\s*)height:\s*calc/); // no height of its own: ButtonGroup's
});
