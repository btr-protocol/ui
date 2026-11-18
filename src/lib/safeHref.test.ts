import { expect, test } from 'bun:test';
import { safeHref, safeInternalHref } from './safeHref';

const BAD = ['javascript:alert(1)', 'data:text/html,x', 'vbscript:x', 'blob:https://a/b', '//evil.com', '/\\evil.com', ' javascript:1', 'java\tscript:1', 'java\nscript:1', '/a\u0000b', '\u0001https://a.b', undefined];

test('safeHref passes internal, anchor and http(s); drops the rest', () => {
  for (const h of ['/a', '#x', '?q=1', 'https://btr.markets', 'http://a.b']) expect(safeHref(h)).toBe(h);
  for (const h of BAD) expect(safeHref(h)).toBeUndefined();
});

test('safeInternalHref rejects //host and any scheme', () => {
  for (const h of ['/a', '#x', '?q=1']) expect(safeInternalHref(h)).toBe(h);
  for (const h of [...BAD, 'https://btr.markets', 'http://a.b']) expect(safeInternalHref(h)).toBeUndefined();
});
