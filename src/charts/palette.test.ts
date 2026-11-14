import { describe, expect, test } from 'bun:test';
import { type PaletteItem, rank, score } from '../ui/CommandPalette';

const it = (id: string, title: string, group = 'strategy', sub = ''): PaletteItem => ({ id, title, group, sub, run: () => {} });
describe('palette ranking', () => {
  test('equal > prefix > substring > fuzzy', () => {
    expect(score('grid', 'grid')).toBe(100);
    expect(score('gri', 'grid gate')).toBe(80);
    expect(score('gate', 'grid gate')).toBe(60);
    expect(score('gridd', 'grid')).toBeGreaterThan(0);
    expect(score('zzz', 'grid')).toBe(0);
  });
  test('an unrelated query matches nothing, not everything (the old app boosted categories past the cut-off)', () => {
    const items = [it('a', 'Export CSV', 'action'), it('b', 'Overview', 'view')];
    expect(rank(items, 'zzzz')).toEqual([]);
  });
  test('every token must match; best first; empty query keeps order', () => {
    const items = [it('a', 'follow stood60', 'strategy', 'Breakout · long · SOL'), it('b', 'book2', 'strategy', 'Scalp · long · 5 coins')];
    expect(rank(items, 'stood sol').map((x) => x.id)).toEqual(['a']);
    expect(rank(items, '').map((x) => x.id)).toEqual(['a', 'b']);
  });
});
