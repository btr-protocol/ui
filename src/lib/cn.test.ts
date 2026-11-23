import { describe, expect, it } from 'bun:test';
import { cn } from './cn';

describe('cn', () => {
  it('keeps the clsx behaviours: conditionals, arrays, objects, falsy', () => {
    const off: boolean = false;
    expect(cn('a', off && 'b', null, undefined, 0, ['c', ['d']], { e: true, f: false })).toBe(
      'a c d e',
    );
    expect(cn()).toBe('');
  });

  it('conflicts custom background tokens', () => {
    expect(cn('bg-bg-1', 'bg-bg-2')).toBe('bg-bg-2');
    expect(cn('bg-bg-1', 'bg-glass')).toBe('bg-glass');
    expect(cn('bg-glass', 'bg-scrim')).toBe('bg-scrim');
    expect(cn('bg-bg-primary', 'bg-bg-red')).toBe('bg-bg-red');
    // A background never eats a border or a text colour.
    expect(cn('bg-glass text-fg-1 border-border', 'bg-bg-red')).toBe(
      'text-fg-1 border-border bg-bg-red',
    );
  });

  it('conflicts custom foreground and border tokens', () => {
    expect(cn('text-fg-1', 'text-fg-2')).toBe('text-fg-2');
    expect(cn('text-fg-1', 'text-red')).toBe('text-red');
    expect(cn('border-border', 'border-red')).toBe('border-red');
    // Colour and size are different groups: neither drops the other.
    expect(cn('text-fg-1', 'text-sm')).toBe('text-fg-1 text-sm');
    // Micro sizes (`text-2xs`) read as sizes, not colours.
    expect(cn('text-fg-1', 'text-2xs')).toBe('text-fg-1 text-2xs');
  });

  it('conflicts the custom layer scale', () => {
    expect(cn('z-header', 'z-toast')).toBe('z-toast');
  });

  it('keeps arbitrary values and lets them win', () => {
    expect(cn('min-w-[8rem]')).toBe('min-w-[8rem]');
    expect(cn('min-w-0', 'min-w-[8rem]')).toBe('min-w-[8rem]');
    expect(cn('h-8', 'h-[6px]')).toBe('h-[6px]');
  });

  it('does not eat unrelated layout utilities', () => {
    // SwapForm.tsx:699 - `w-full` on a Button whose base carries padding and height only.
    expect(cn('inline-flex items-center justify-center h-8 px-3', 'w-full mt-1.5')).toBe(
      'inline-flex items-center justify-center h-8 px-3 w-full mt-1.5',
    );
    // PoolsTable.tsx:286 - `shrink-0` survives an icon-only base.
    expect(cn('inline-flex items-center justify-center h-6 w-6', 'shrink-0')).toBe(
      'inline-flex items-center justify-center h-6 w-6 shrink-0',
    );
  });

  it('resolves the real call-site overrides in favour of the call site', () => {
    // FaucetPage.tsx ClaimButton - min-width beats the size-scale width so "Enable first" fits.
    expect(cn('h-6 w-6', 'min-w-[5.75rem] w-auto px-2')).toBe('h-6 min-w-[5.75rem] w-auto px-2');
    // SettingsModal.tsx:56 - `justify-between` beats the base `justify-center`.
    expect(cn('inline-flex items-center justify-center', 'min-w-[8rem] justify-between')).toBe(
      'inline-flex items-center min-w-[8rem] justify-between',
    );
    // PoolsTable.tsx:109-113 - `hidden` beats `inline-flex`, and the sm: variant is a separate group.
    expect(cn('inline-flex', 'hidden sm:flex shrink-0')).toBe('hidden sm:flex shrink-0');
    // Button padding: a call site that narrows the horizontal padding wins outright.
    expect(cn('px-4', 'px-2')).toBe('px-2');
    // ...but a one-sided override only trims its own side.
    expect(cn('px-4', 'pr-2')).toBe('px-4 pr-2');
  });

  it('keeps important overrides out of the unimportant groups', () => {
    expect(cn('text-fg-1', '!text-red')).toBe('text-fg-1 !text-red');
  });
});

describe('cn: tailwind-merge parity on the groups the kit merges', () => {
  it.each([
    ['px-3 p-4', 'p-4'],
    ['p-4 px-3', 'p-4 px-3'],
    ['leading-none text-sm', 'text-sm'],
    ['text-sm leading-none', 'text-sm leading-none'],
    ['font-title font-medium font-mono', 'font-medium font-mono'],
    ['border border-border border-t-2 border-t-primary', 'border border-border border-t-2 border-t-primary'],
    ['hover:bg-bg-3 hover:bg-bg-primary bg-transparent', 'hover:bg-bg-primary bg-transparent'],
    ['sm:hover:bg-bg-1 hover:sm:bg-bg-2', 'hover:sm:bg-bg-2'],
    ['inline-block grid', 'grid'],
    ['disabled:opacity-50 disabled:opacity-40', 'disabled:opacity-40'],
    ['a a b', 'a b'],
    ['text-fg-1 text-balance text-nowrap', 'text-fg-1 text-nowrap'],
    ['text-fg-1 text-ellipsis', 'text-fg-1 text-ellipsis'],
    ['bg-primary bg-clip-text bg-center bg-no-repeat bg-fixed', 'bg-primary bg-clip-text bg-center bg-no-repeat bg-fixed'],
    ['w-2 h-3 size-4', 'size-4'],
    ['rounded-t-lg rounded-tl-sm rounded-none', 'rounded-none'],
    ['rounded-tl-sm rounded-t-lg', 'rounded-t-lg'],
    ['border-t-2 border-x-4 border-0', 'border-0'],
    ['top-1 left-2 inset-0', 'inset-0'],
    ['top-1 top-2 inset-0 top-3', 'inset-0 top-3'],
  ])('%s', (input, want) => expect(cn(input)).toBe(want));
});
