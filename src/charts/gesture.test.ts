import { expect, test } from 'bun:test';
import { createGesture } from './gesture';

function clock() {
  const q: { at: number; fn: () => void; id: number }[] = [];
  let now = 0;
  let n = 0;
  return {
    schedule: (fn: () => void, ms: number) => (q.push({ at: now + ms, fn, id: ++n }), n),
    cancel: (h: unknown) => {
      const i = q.findIndex((x) => x.id === h);
      if (i >= 0) q.splice(i, 1);
    },
    tick(ms: number) {
      now += ms;
      for (const x of q.filter((e) => e.at <= now)) {
        q.splice(q.indexOf(x), 1);
        x.fn();
      }
    },
  };
}

test('a wheel pulse is a gesture only until the tail passes', () => {
  const c = clock();
  const g = createGesture(300, c.schedule, c.cancel);
  expect(g.active).toBe(false);
  g.pulse();
  expect(g.active).toBe(true);
  c.tick(200);
  g.pulse();
  c.tick(200);
  expect(g.active).toBe(true);
  c.tick(150);
  expect(g.active).toBe(false);
});

test('a pressed pointer stays a gesture until release, then drops after the tail', () => {
  const c = clock();
  const g = createGesture(300, c.schedule, c.cancel);
  g.press();
  c.tick(5000);
  expect(g.active).toBe(true);
  g.release();
  c.tick(299);
  expect(g.active).toBe(true);
  c.tick(2);
  expect(g.active).toBe(false);
});

test('dispose drops the flag and the pending timer', () => {
  const c = clock();
  const g = createGesture(300, c.schedule, c.cancel);
  g.press();
  g.dispose();
  expect(g.active).toBe(false);
});
