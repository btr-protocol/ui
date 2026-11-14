import { expect, test } from 'bun:test';
import { render } from 'preact-render-to-string';
import { Button, ButtonGroup } from '../src';

test('ButtonGroup: group role, label, joined class', () => {
  const html = render(
    <ButtonGroup aria-label="Tools">
      <Button>A</Button>
      <Button>B</Button>
    </ButtonGroup>,
  );
  expect(html).toContain('role="group"');
  expect(html).toContain('aria-label="Tools"');
  expect(html).toContain('btn-group');
  expect(html).not.toContain('btn-group-wrap');
});

test('ButtonGroup wrap adds the wrapping variant', () => {
  expect(render(<ButtonGroup aria-label="F" wrap><Button>A</Button><Button>B</Button></ButtonGroup>)).toContain('btn-group-wrap');
});

test('the divider rule skips hidden children, so a [hidden] child leaves no stray line', async () => {
  const css = await Bun.file(new URL('../src/styles/button-group.css', import.meta.url)).text();
  expect(css).toContain('> :not([hidden]) ~ :not([hidden])');
  expect(css).toContain('var(--radius-sm, calc(var(--r, 16px) * 0.5))');
  const html = render(
    <ButtonGroup aria-label="T">
      <Button hidden>H</Button>
      <Button>V</Button>
    </ButtonGroup>,
  );
  expect(html).toContain('hidden');
});

test('primary Button: disabled reads as disabled, never as an accent CTA', () => {
  const html = render(<Button variant="primary" disabled>Go</Button>);
  for (const c of ['disabled:bg-bg-3', 'disabled:text-fg-2', 'disabled:opacity-100']) expect(html).toContain(c);
});
