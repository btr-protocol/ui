import { describe, expect, test } from 'bun:test';
import { reorderTabs } from '../ui/TabStrip';

const t = (id: string, pinned = false) => ({ id, label: id, pinned });
describe('reorderTabs', () => {
  const tabs = [t('p1', true), t('p2', true), t('a'), t('b'), t('c')];
  test('moves a tab onto another within its group', () => {
    expect(reorderTabs(tabs, 'c', 'a')).toEqual(['p1', 'p2', 'c', 'a', 'b']);
    expect(reorderTabs(tabs, 'a', 'c')).toEqual(['p1', 'p2', 'b', 'c', 'a']);
    expect(reorderTabs(tabs, 'p2', 'p1')).toEqual(['p2', 'p1', 'a', 'b', 'c']);
  });
  test('never crosses the pinned boundary', () => {
    expect(reorderTabs(tabs, 'a', 'p1')).toEqual(['p1', 'p2', 'a', 'b', 'c']);
  });
});

import { fmtRatioFloor } from '../lib/metricFormat';
describe('fmtRatioFloor', () => {
  test('tiny ratios read as a floor, not the subscript form', () => {
    expect(fmtRatioFloor(0.0000739)).toBe('<0.01%');
    expect(fmtRatioFloor(-0.00001)).toBe('-<0.01%');
    expect(fmtRatioFloor(0)).toBe('0.00%');
    expect(fmtRatioFloor(0.0123)).not.toContain('<');
  });
});
