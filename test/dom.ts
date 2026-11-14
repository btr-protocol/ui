// Shared happy-dom harness: register per test file (not globally in bunfig) so the string-render tests keep running without a DOM.
import { GlobalRegistrator } from '@happy-dom/global-registrator';
import { afterAll, beforeAll } from 'bun:test';
import { act } from 'preact/test-utils';
import { render } from 'preact';

export function useDom() {
  beforeAll(() => GlobalRegistrator.register({ url: 'http://localhost/' }));
  afterAll(() => GlobalRegistrator.unregister());
}
export function mount(vnode: preact.ComponentChild) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  act(() => render(vnode, host));
  return { host, unmount: () => act(() => render(null, host)) };
}
export { act };
export const key = (el: Element | Document, k: string) => act(() => { el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true })); });
export const click = (el: Element) => act(() => { (el as HTMLElement).click(); });
/** Poll until `cond` holds (history/popstate and debounced renders settle asynchronously); throws when it never does. */
export async function until(cond: () => boolean, ms = 1000) {
  const end = Date.now() + ms;
  while (!cond() && Date.now() < end) await act(async () => { await new Promise((r) => setTimeout(r, 10)); });
  if (!cond()) throw new Error(`until: condition not met within ${ms} ms`);
}
