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
