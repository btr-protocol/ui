import { expect, test } from 'bun:test';
import { FloatingPanel } from '../src/ui/FloatingPanel';
import { act, mount, useDom } from './dom';

useDom();
const ev = (el: Element, type: string, k: string) =>
  act(() => { el.dispatchEvent(new KeyboardEvent(type, { key: k, bubbles: true, cancelable: true })); });

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
