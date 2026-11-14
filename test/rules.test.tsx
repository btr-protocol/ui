import { expect, test } from 'bun:test';
import { render } from 'preact-render-to-string';
import { Button, ButtonGroup, Icon, SelectedCheck, SelectModal } from '../src';
import { click, mount, useDom } from './dom';

useDom();

test('Button: label is nowrap and truncates; icon-only and primary carry the group hooks', () => {
  const text = render(<Button size="sm" leftIcon={<Icon name="copy" />}>A long label</Button>);
  expect(text).toContain('whitespace-nowrap');
  expect(text).toContain('<span class="min-w-0 truncate">A long label</span>');
  expect(text).not.toContain('data-icon-only');
  const icon = render(<Button aria-label="Copy" leftIcon={<Icon name="copy" />} />);
  expect(icon).toContain('data-icon-only');
  expect(render(<Button variant="primary">Go</Button>)).toContain('data-primary');
  expect(render(<Button>Go</Button>)).not.toContain('data-primary');
});

test('button-group.css: icon cells do not stretch, the primary takes the spare width', async () => {
  const css = await Bun.file(new URL('../src/styles/button-group.css', import.meta.url)).text();
  expect(css).toMatch(/\[data-icon-only\][^{]*\{\s*flex: none;/);
  expect(css).toMatch(/\[data-primary\][^{]*\{\s*flex: 100 1 auto;/);
  expect(render(<ButtonGroup aria-label="x" wrap><Button>A</Button></ButtonGroup>)).toContain('btn-group-wrap');
});

test('menu panels are flush: no panel padding, rows own it', async () => {
  const preset = await Bun.file(new URL('../src/styles/tailwind.preset.js', import.meta.url)).text();
  expect(preset).toMatch(/'\.floating-panel\.floating-flush': \{\s*padding: '0'/);
  const menu = await Bun.file(new URL('../src/ui/ClickMenu.tsx', import.meta.url)).text();
  expect(menu).toContain('flush');
  expect(menu).not.toContain('py-1"');
});

test('SelectedCheck: the check icon, 16 px, primary', () => {
  const html = render(<SelectedCheck />);
  expect(html).toContain('data-selected-check');
  expect(html).toContain('h-4 w-4');
  expect(html).toContain('text-primary');
});

test('every selected-row component uses SelectedCheck, no private check icon', async () => {
  for (const f of ['Select.tsx', 'selectionView.tsx', 'ClickMenu.tsx']) {
    const src = await Bun.file(new URL(`../src/ui/${f}`, import.meta.url)).text();
    expect(src).toContain('SelectedCheck');
    expect(src).not.toContain('name="check"');
    expect(src).not.toContain("'check'");
  }
});

const opts = (n: number) => Array.from({ length: n }, (_, i) => ({ value: `v${i}`, label: `Opt ${i}` }));
const searchBox = () => document.querySelector('[role=dialog] input');

test('SelectModal: search hidden at 6 options or fewer, shown above, forced by searchable', () => {
  for (const [n, forced, shown] of [[6, undefined, false], [7, undefined, true], [3, true, true], [9, false, false]] as const) {
    const { host, unmount } = mount(<SelectModal routeKey={`s-${n}-${forced}`} label="X" items={opts(n)} value="v0" onChange={() => {}} searchable={forced} />);
    click(host.querySelector('button')!);
    expect(!!searchBox()).toBe(shown);
    unmount();
  }
});

test('SelectModal: the picked row shows the trailing check; triggerPrefix leads the label in the one button', () => {
  const { host, unmount } = mount(<SelectModal routeKey="s-pre" label="X" items={opts(3)} value="v1" onChange={() => {}} triggerPrefix={<span>Simulated ·</span>} />);
  const trg = host.querySelector('button')!;
  expect(host.querySelectorAll('button').length).toBe(1);
  expect(trg.textContent).toContain('Simulated ·');
  expect(trg.textContent!.indexOf('Simulated')).toBeLessThan(trg.textContent!.indexOf('Opt 1'));
  click(trg);
  const marks = document.querySelectorAll('[role=dialog] [data-selected-check]');
  expect(marks.length).toBe(1);
  expect(marks[0]!.closest('button')!.textContent).toContain('Opt 1');
  unmount();
});
