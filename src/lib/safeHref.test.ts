import { expect, test } from 'bun:test';
import { safeHref } from './safeHref';

test('safeHref passes internal, anchor and http(s); drops javascript:/data:', () => {
  for (const h of ['/a', '#x', '?q=1', 'https://btr.markets', 'http://a.b']) expect(safeHref(h)).toBe(h);
  for (const h of ['javascript:alert(1)', 'data:text/html,x', ' javascript:1', undefined])
    expect(safeHref(h)).toBeUndefined();
});
