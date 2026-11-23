import { expect, test } from 'bun:test';
import { FloatingPanel } from '../src/ui/FloatingPanel';
import { act, mount, useDom } from './dom';

useDom();
const ev = (el: Element, type: string, k: string) =>
  act(() => { el.dispatchEvent(new KeyboardEvent(type, { key: k, bubbles: true, cancelable: true })); });

test('Enter opens on release, focus moves in, native click eaten, Escape hands back', async () => {
  let clicks = 0;
  const { host, unmount } = mount(
    <div onClick={() => clicks++}>
      <FloatingPanel interactive content={<a href="/x">link</a>}>
        <button type="button">i</button>
      </FloatingPanel>
    </div>,
  );
  const btn = host.querySelector('button')!;
  btn.focus();
  const down = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
  act(() => { btn.dispatchEvent(down); });
  expect(down.defaultPrevented).toBe(true); // no native click generated
  expect(document.querySelector('.floating-panel')).toBeNull(); // acts on release
  ev(btn, 'keyup', 'Enter');
  await act(async () => {});
  const link = document.querySelector('.floating-panel a')!;
  expect(document.activeElement).toBe(link);
  expect(clicks).toBe(0);
  ev(link, 'keydown', 'Escape');
  await act(async () => {});
  expect(document.querySelector('.floating-panel')).toBeNull();
  expect(document.activeElement).toBe(btn);
  unmount();
});

test('a stray keyup without its keydown does nothing', async () => {
  const { host, unmount } = mount(
    <FloatingPanel interactive content={<a href="/x">link</a>}>
      <button type="button">i</button>
    </FloatingPanel>,
  );
  ev(host.querySelector('button')!, 'keyup', 'Enter');
  await act(async () => {});
  expect(document.querySelector('.floating-panel')).toBeNull();
  unmount();
});
