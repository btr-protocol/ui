import { describe, expect, test } from 'bun:test';
import { renderToString } from 'preact-render-to-string';
import { Badge, PriceWithWarning, StateNotice } from '../src';

describe('StateNotice', () => {
  test('error is an alert with panel side padding and the message', () => {
    const html = renderToString(<StateNotice variant="error">cbBTC price feed is stale: swaps are blocked until it updates.</StateNotice>);
    expect(html).toContain('role="alert"');
    expect(html).toContain('px-3');
    expect(html).toContain('swaps are blocked until it updates.');
  });
  test.each(['warning', 'info', 'loading', 'empty'] as const)('%s is a status', (variant) => {
    const html = renderToString(<StateNotice variant={variant} title="T">body</StateNotice>);
    expect(html).toContain('role="status"');
    expect(html).toContain(`data-state="${variant}"`);
  });
  test('loading without text has an sr-only default and aria-live polite', () => {
    const html = renderToString(<StateNotice variant="loading" />);
    expect(html).toContain('sr-only');
    expect(html).toContain('aria-live="polite"');
    expect(html).not.toContain('aria-busy');
  });
  test('variant classes, layout and action', () => {
    const a = { label: 'Retry', onClick: () => {} };
    const err = renderToString(<StateNotice variant="error" action={a}>x</StateNotice>);
    expect(err).toContain('text-error');
    expect(err).toContain('flex-col items-center');
    expect(renderToString(<StateNotice variant="warning">x</StateNotice>)).toContain('text-warning');
    const inline = renderToString(<StateNotice variant="warning" layout="inline" action={a}>x</StateNotice>);
    expect(inline).toContain('items-start');
    expect(inline).not.toContain('flex-col');
    expect(inline).toContain('Retry');
  });
  test('action only on error / warning', () => {
    const a = { label: 'Retry', onClick: () => {} };
    expect(renderToString(<StateNotice variant="error" action={a} />)).toContain('Retry');
    expect(renderToString(<StateNotice variant="empty" action={a} />)).not.toContain('Retry');
  });
});

test('PriceWithWarning reserves the icon slot whether or not it warns', () => {
  const off = renderToString(<PriceWithWarning>1.23</PriceWithWarning>);
  const on = renderToString(<PriceWithWarning warn label="stale">1.23</PriceWithWarning>);
  expect(off).toContain('w-[1.25em]');
  expect(on).toContain('w-[1.25em]');
  expect(on).toContain('aria-label="stale"');
  expect(on).toContain('1.1em');
  expect(off).not.toContain('<svg');
  expect(renderToString(<PriceWithWarning anchor="end">1</PriceWithWarning>)).toContain('flex-row-reverse');
});

test('Badge label variant is transparent, never a dark fill', () => {
  const html = renderToString(<Badge variant="label">Oracle reference price</Badge>);
  expect(html).toContain('bg-transparent');
  expect(html).not.toMatch(/bg-bg-0|bg-black/);
});
