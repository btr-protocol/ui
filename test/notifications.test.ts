import { describe, expect, jest, test } from 'bun:test';
import { addNotification, peekToasts, removeNotification } from '../src/lib/notifications';

describe('toast dedupe', () => {
  test('a repeat id is dropped while the first is on screen', () => {
    addNotification('info', 'one', { id: 't1' });
    addNotification('info', 'two', { id: 't1' });
    expect(
      peekToasts()
        .filter((n) => n.id === 't1')
        .map((n) => n.message),
    ).toEqual(['one']);
    removeNotification('t1');
  });
  test('a sticky toast never auto-closes and updates in place', () => {
    addNotification('info', 'pending', { id: 't2', sticky: true });
    addNotification('success', 'done', { id: 't2', sticky: true });
    const rows = peekToasts().filter((n) => n.id === 't2');
    expect(rows.length).toBe(1);
    expect(rows[0].message).toBe('done');
    expect(rows[0].type).toBe('success');
    expect(rows[0].duration).toBe(0);
    removeNotification('t2');
    expect(peekToasts().some((n) => n.id === 't2')).toBe(false);
  });
  test('a locked sticky toast has no X; an unlocked one keeps it', () => {
    addNotification('info', 'a', { id: 't3', sticky: true, locked: true });
    addNotification('info', 'b', { id: 't4', sticky: true });
    expect(peekToasts().find((n) => n.id === 't3')?.locked).toBe(true);
    expect(peekToasts().find((n) => n.id === 't4')?.locked).toBeFalsy();
    removeNotification('t3');
    removeNotification('t4');
  });
  test('an old timer cannot remove a newer toast that reused the id', () => {
    jest.useFakeTimers();
    addNotification('info', 'old', { id: 't5' });
    removeNotification('t5');
    addNotification('info', 'new', { id: 't5', sticky: true });
    jest.advanceTimersByTime(20_000);
    expect(peekToasts().find((n) => n.id === 't5')?.message).toBe('new');
    removeNotification('t5');
    jest.useRealTimers();
  });
});
