import { expect, test } from 'bun:test';
import { BaseModal, ConfirmSheet, MODAL_PADDING } from '../src';
import { mount, useDom } from './dom';

useDom();
const bad = /(^|\s)(-?m?x-4|p-4|px-5|px-6|-mx-4)(\s|$)/;
const hz = (el: Element) => [...el.classList].filter((c) => /^(px|p|-mx|mx)-/.test(c));

test('modal header, body and footer take their gutter from MODAL_PADDING; nothing re-adds one', () => {
  const { unmount } = mount(
    <BaseModal isOpen onClose={() => {}} title="Core" headerType="title" footer={<span>foot</span>}>
      <p>body</p>
    </BaseModal>,
  );
  const d = document.querySelector('[role=dialog]')!;
  expect(d).not.toBeNull();
  const gutters = [...d.querySelectorAll('*')].filter((e) => e.classList.contains(MODAL_PADDING));
  expect(gutters.length).toBeGreaterThanOrEqual(2); // header row + footer
  const title = [...d.querySelectorAll('*')].filter((e) => e.children.length === 0 && e.textContent === 'Core').pop()!;
  const header = title.closest(`.${MODAL_PADDING}`);
  const foot = [...d.querySelectorAll('span')].find((e) => e.textContent === 'foot')!.closest(`.${MODAL_PADDING}`);
  const body = [...d.querySelectorAll('p')].find((e) => e.textContent === 'body')!;
  expect(header).not.toBeNull();
  expect(foot).not.toBeNull();
  expect(foot).not.toBe(header);
  // The body owns no gutter (each section takes MODAL_PADDING itself): no ancestor up to the dialog adds a horizontal one.
  for (let e: Element | null = body; e && e !== d; e = e.parentElement) expect(hz(e).filter((c) => c !== MODAL_PADDING)).toEqual([]);
  for (const e of d.querySelectorAll('*')) expect(bad.test(e.getAttribute('class') ?? '')).toBe(false);
  expect(MODAL_PADDING).toBe('px-3');
  expect(hz(d)).toEqual([]);
  unmount();
});

test('ConfirmSheet uses MODAL_PADDING and no px-4/p-4', () => {
  const { unmount } = mount(<ConfirmSheet open title="Sure" onClose={() => {}} onConfirm={() => {}} confirmLabel="Go" />);
  const d = document.querySelector('[role=dialog]')!;
  expect([...d.querySelectorAll('*')].some((e) => e.classList.contains(MODAL_PADDING))).toBe(true);
  for (const e of d.querySelectorAll('*')) expect(bad.test(e.getAttribute('class') ?? '')).toBe(false);
  unmount();
});
