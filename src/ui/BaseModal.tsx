import { Icon } from './Icon';
import { Panel } from './Panel';
import { VisuallyHidden } from './VisuallyHidden';
import { popBack, useBack } from '../lib/backStack';
import { cn } from '../lib/cn';
import type { ComponentChildren, JSX } from 'preact';
import { createPortal } from 'preact/compat';
import { useEffect, useId, useRef, useState } from 'preact/hooks';
import { Button, type ButtonVariant } from './Button';
import { ButtonGroup } from './ButtonGroup';
import { CloseButton } from './CloseButton';
import type { InputProps } from './Input';
import { ScrollPane } from './ScrollPane';
import { SearchInput } from './SearchInput';

/** Body scroll lock is shared: refcounted, because swapping one dialog for another (search ->
 *  settings) unmounts the old one after the new one mounted, and a per-dialog save/restore would
 *  hand the lock back to the closing dialog. */
let scrollLocks = 0;
let preLockOverflow = '';

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/** THE horizontal padding of every modal header, body and footer: the app header's `px-3`. No per-modal override. */
export const MODAL_PADDING = 'px-3';
/** Negative margin that cancels MODAL_PADDING (a full-bleed row inside a modal body). */
export const MODAL_BLEED = '-mx-3';
/** Page gutter var pinned to MODAL_PADDING for page content mounted inside a modal. */
export const MODAL_PAGE_X = '[--page-x:0.75rem]';

/** The modal width scale. Nothing outside this set: a one-off max-w-* or a pixel
 *  value is what made every dialog a different width. */
export type ModalSize = 'sm' | 'md' | 'lg' | 'xl';
const EXIT_MS = 300;
const MODAL_WIDTH: Record<ModalSize, string> = {
  sm: 'sm:max-w-sm',
  // 27rem, not Tailwind's max-w-md (28rem): the action modals (swap, deposit, withdraw) hold one
  // in-flight animation and a column of rows, and a 16px trim reads tighter around the run without
  // costing a row its column. Scaled once here, so no call site carries a width of its own.
  md: 'sm:max-w-[27rem]',
  lg: 'sm:max-w-2xl',
  xl: 'sm:max-w-3xl',
};

export interface BaseModalProps {
  isOpen: boolean;
  onClose: (open: boolean) => void;
  title: string;
  headerType: 'input' | 'title';
  /** Icon to display left of title (headerType='title' only) */
  headerIcon?: ComponentChildren;
  /** Extra classes for the title text (e.g. font-numeric for addresses). */
  titleClassName?: string;
  headerRight?: ComponentChildren;
  /** Pinned above the scrolling body: column labels, an identity row, a consent gate. It sits
   *  OUTSIDE the scroller, so the scrollbar runs beside the body alone. */
  bodyHeader?: ComponentChildren;
  children: ComponentChildren;
  /** Simple footer content */
  footer?: ComponentChildren;
  /** Navigation shortcuts (top of footer, same bg as body) */
  footerNav?: ComponentChildren;
  /** Custom content (middle of footer) */
  footerContent?: ComponentChildren;
  /** Control buttons (bottom of footer, aligned right) */
  footerControls?: ComponentChildren;
  /** One width scale for every modal. Full-bleed below `sm` regardless. */
  size?: ModalSize;
  /** For headerType='input': placeholder text */
  placeholder?: string;
  /** For headerType='input': controlled value */
  searchValue?: string;
  /** For headerType='input': onChange handler */
  onSearchChange?: (value: string) => void;
  /** For headerType='input': onKeyDown handler */
  onSearchKeyDown?: (e: JSX.TargetedKeyboardEvent<HTMLInputElement>) => void;
  /** For headerType='input': extra attributes (combobox ARIA) spread on the input. */
  inputProps?: JSX.IntrinsicElements['input'];
  /** For headerType='input': content rendered left of the input (scope chip). */
  inputPrefix?: ComponentChildren;
  /** Use lighter bg for header/footer vs body (default: true) */
  contrastHeader?: boolean;
  /** `top`: the card's top edge is fixed, so a body that grows or shrinks (tabs, optional rows)
   *  extends downward instead of jumping about the centre line. */
  anchor?: 'center' | 'top';
  /** False while the owner of the outcome cannot let go (a wallet prompt): the header X is not
   *  drawn, so nothing focusable or announced promises a close that `onClose` would ignore. */
  closable?: boolean;
}

export function BaseModal({
  isOpen,
  onClose,
  title,
  headerType,
  headerIcon,
  titleClassName,
  headerRight,
  bodyHeader,
  children,
  footer,
  footerNav,
  footerContent,
  footerControls,
  size = 'lg',
  placeholder,
  searchValue,
  onSearchChange,
  onSearchKeyDown,
  inputProps,
  inputPrefix,
  contrastHeader = true,
  anchor = 'center',
  closable = true,
}: BaseModalProps) {
  const headerBg = contrastHeader ? 'bg-bg-2' : 'bg-bg-1';
  const footerBg = headerBg;
  const inputRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const isSearch = headerType === 'input';

  // Stay mounted through the exit animation (`modal-out` / `sheet-out`, index.css).
  const [mounted, setMounted] = useState(isOpen);
  const closing = mounted && !isOpen;
  useEffect(() => {
    if (isOpen) setMounted(true);
    else if (mounted) {
      const t = setTimeout(() => setMounted(false), EXIT_MS);
      return () => clearTimeout(t);
    }
  }, [isOpen, mounted]);

  const cardRef = useRef<HTMLDivElement>(null);

  // Focus goes back to whatever opened the dialog.
  useEffect(() => {
    if (!mounted) return;
    const opener = document.activeElement as HTMLElement | null;
    return () => {
      const a = document.activeElement;
      if (opener?.isConnected && (!a || a === document.body || cardRef.current?.contains(a)))
        opener.focus({ preventScroll: true });
    };
  }, [mounted]);

  useBack(mounted, () => onClose(false));

  // Focus trap, Escape, body scroll lock.
  useEffect(() => {
    const card = cardRef.current;
    if (!mounted || !card) return;
    const focusables = () => Array.from(card.querySelectorAll<HTMLElement>(FOCUSABLE));

    // Focus the first element only while focus is still outside: refocusing would yank the caret
    // out of a search input mid-typing. Touch: never open the keyboard unasked; the card takes it.
    const first = focusables()[0];
    if (first && !card.contains(document.activeElement)) {
      const target =
        first.matches('input,textarea') && matchMedia('(pointer:coarse)').matches ? card : first;
      setTimeout(() => {
        if (!card.contains(document.activeElement)) target.focus();
      }, 0);
    }

    // Capture: the search field stops keydown propagation, which would let Shift+Tab leave.
    const onTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      e.preventDefault();
      const els = focusables();
      if (!els.length) return;
      const i = els.indexOf(document.activeElement as HTMLElement) + (e.shiftKey ? -1 : 1);
      els[i < 0 ? els.length - 1 : i >= els.length ? 0 : i].focus();
    };
    // Escape closes whatever is topmost in the back stack (a dropdown, a drill level, else a dialog).
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && popBack()) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    };
    card.addEventListener('keydown', onTab, true);
    document.addEventListener('keydown', onEscape, true);
    if (scrollLocks++ === 0) {
      preLockOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    return () => {
      if (--scrollLocks === 0) document.body.style.overflow = preLockOverflow;
      card.removeEventListener('keydown', onTab, true);
      document.removeEventListener('keydown', onEscape, true);
    };
  }, [mounted]);

  // Focus input when modal opens, with priority for nested modals. On touch that raises the
  // keyboard, so it is only worth it when the list needs searching (the body overflows).
  useEffect(() => {
    if (!isOpen || !isSearch) return;
    const t = setTimeout(() => {
      const input = inputRef.current;
      if (!input || document.activeElement === input) return;
      const body = input.closest('[role=dialog]')?.querySelector('.overflow-y-auto');
      if (matchMedia('(pointer:coarse)').matches && body && body.scrollHeight <= body.clientHeight)
        return;
      input.focus();
    }, 50);
    return () => clearTimeout(t);
  }, [isOpen, isSearch]);

  // Bottom sheet below `sm`: drag the title bar / handle down to dismiss. Past 80px or 0.5px/ms it
  // calls onClose, and `sheet-out` continues from the dragged offset; otherwise it springs back.
  const drag = useRef<{ y: number; t: number; card: HTMLElement } | null>(null);
  const dragStart = (e: PointerEvent) => {
    const bar = e.currentTarget as HTMLElement;
    const card = cardRef.current;
    if (isSearch || !card || !matchMedia('(max-width:639.98px)').matches) return;
    if ((e.target as Element).closest('button,a,input')) return;
    drag.current = { y: e.clientY, t: e.timeStamp, card };
    bar.setPointerCapture(e.pointerId);
    card.style.transition = 'none';
  };
  const dragMove = (e: PointerEvent) => {
    const d = drag.current;
    if (d) d.card.style.transform = `translateY(${Math.max(0, e.clientY - d.y)}px)`;
  };
  const dragEnd = (e: PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    const dy = e.clientY - d.y;
    if (e.type === 'pointerup' && dy > 0 && (dy > 80 || dy / (e.timeStamp - d.t) > 0.5)) {
      onClose(false);
      return;
    }
    d.card.style.transition = 'transform var(--dur-2) var(--ease)';
    d.card.style.transform = '';
  };

  const handleInputKeyDown = (e: JSX.TargetedKeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Escape') {
      e.stopPropagation();
    }
    onSearchKeyDown?.(e);
  };

  const hasFooter = !!(footer || footerNav || footerContent || footerControls);
  const simpleFooter = footer && !footerNav && !footerContent && !footerControls;

  if (!mounted) return null;

  return createPortal(
    <>
      <div
        data-closing={closing || undefined}
        className="modal-scrim fixed inset-0 z-modal bg-scrim backdrop-blur-sm"
        onPointerDown={(e) => e.target === e.currentTarget && onClose(false)}
      />
      <div
        ref={cardRef}
        data-closing={closing || undefined}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          'modal-card z-modal outline-none',
          'surface fixed left-1/2 top-1/2 grid w-full -translate-x-1/2 -translate-y-1/2 border bg-bg-1 shadow-lg sm:rounded-lg',
          MODAL_WIDTH[size],
          anchor === 'top' && 'sm:top-16 sm:translate-y-0',
          'flex flex-col max-h-[min(50rem,calc(80*var(--dvh)))] overflow-hidden font-title',
          // Below `sm`: bottom sheet (search: full-height, top-anchored so the keyboard never
          // clips the field). `--sat`/`--sab` keep it clear of the status bar / gesture bar.
          'max-sm:left-0 max-sm:translate-x-0 max-sm:translate-y-0 max-sm:border-x-0 max-sm:border-b-0',
          isSearch
            ? 'max-sm:top-0 max-sm:h-[calc(100*var(--dvh))] max-sm:max-h-none max-sm:rounded-none max-sm:border-t-0 max-sm:pt-[var(--sat)]'
            : 'max-sm:top-auto max-sm:bottom-0 max-sm:max-h-[calc(90*var(--dvh))] max-sm:rounded-t-[inherit]',
          !hasFooter && 'max-sm:pb-[var(--sab)]',
        )}
      >
        {/* Visually hidden title for accessibility */}
        <VisuallyHidden>
          <h2 id={titleId} className="text-xl font-semibold leading-none tracking-tight">
            {title}
          </h2>
        </VisuallyHidden>

        {/* Header: also the drag surface of the sheet (touch-none; buttons/inputs opt out). */}
        <div
          className={cn(
            'relative shrink-0 border-b border-border rounded-t-[inherit]',
            headerBg,
            !isSearch && 'max-sm:touch-none',
            isSearch && 'max-sm:rounded-none',
          )}
          onPointerDown={dragStart}
          onPointerMove={dragMove}
          onPointerUp={dragEnd}
          onPointerCancel={dragEnd}
        >
          {/* Absolute: the grab handle floats in the row's top gap and adds no height of its own. */}
          {!isSearch && (
            <div className="sm:hidden absolute left-1/2 top-1 h-1 w-9 -translate-x-1/2 rounded-full bg-line" />
          )}
          <div className={cn('flex items-center gap-2 sm:gap-3 h-12', MODAL_PADDING)}>
            {headerType === 'input' ? (
              <>
                {inputPrefix}
                <SearchInput
                  variant="bare"
                  className="flex-1"
                  value={searchValue || ''}
                  onChange={(v) => onSearchChange?.(v)}
                  onKeyDown={handleInputKeyDown}
                  inputRef={inputRef}
                  stopPropagation
                  placeholder={placeholder || 'Search...'}
                  inputProps={inputProps as Partial<InputProps>}
                />
              </>
            ) : (
              <h2 className="text-sm font-semibold flex-1 min-w-0 flex items-center gap-2 text-fg-0">
                {headerIcon && <span className="text-fg-0 shrink-0">{headerIcon}</span>}
                <span className={cn('truncate', titleClassName)}>{title}</span>
              </h2>
            )}

            <div className="flex items-center shrink-0">
              {headerRight}
              {/* Decorative rule; below `sm` its 17px is width the search field needs. */}
              {headerRight && <div className="w-px h-6 bg-border mx-2 max-sm:hidden" />}
              {closable && (
                <CloseButton
                  onClick={() => onClose(false)}
                  size={18}
                  aria-label={`Close ${title}`}
                />
              )}
            </div>
          </div>
        </div>

        {/* Scrollable Body - max-h lives on the card; min-h-0 lets Confirm scroll into
              view. `bodyHeader` is a SIBLING above the scroller, never a sticky block inside it:
              see `ScrollPane`. The wrapper carries the body's own surface (`bg-bg-1`) so
              the reserved scrollbar gutter beside the header is not a notch. */}
        <ScrollPane header={bodyHeader} headerClassName="bg-bg-1">
          {children}
        </ScrollPane>

        {/* Footer */}
        {hasFooter &&
          (simpleFooter ? (
            <div
              className={`shrink-0 flex flex-col border-t border-border ${footerBg} max-sm:pb-[var(--sab)]`}
            >
              <div className={`${MODAL_PADDING} py-3 flex items-center gap-2`}>{footer}</div>
            </div>
          ) : (
            <div
              className={`modal-footer shrink-0 flex flex-col border-t border-border ${footerBg} max-sm:pb-[var(--sab)]`}
            >
              {footerNav && (
                <div
                  className={`modal-footer-nav bg-bg-1 ${MODAL_PADDING} py-1.5 flex justify-center ${!footerContent && !footerControls ? 'sm:rounded-b-[inherit]' : ''}`}
                >
                  {footerNav}
                </div>
              )}
              {footerContent && (
                <div
                  className={`${footerBg} ${MODAL_PADDING} py-2.5 ${footerNav ? 'border-t border-border' : ''} ${!footerControls ? 'sm:rounded-b-[inherit]' : ''}`}
                >
                  {footerContent}
                </div>
              )}
              {footerControls && (
                <div
                  className={`${footerBg} ${MODAL_PADDING} py-2.5 flex justify-end gap-2 ${footerNav || footerContent ? 'border-t border-border' : ''} sm:rounded-b-[inherit]`}
                >
                  {footerControls}
                </div>
              )}
            </div>
          ))}
      </div>
    </>,
    document.body,
  );
}

/**
 * ModalSection - labeled grouping inside a modal body.
 * Hover on children highlights the label.
 */
interface ModalSectionProps {
  title: string;
  icon?: string;
  children: ComponentChildren;
  /** Set inside a listbox: makes the section an ARIA group labelled by its heading. */
  groupId?: string;
}

export function ModalSection({ title, icon, children, groupId }: ModalSectionProps) {
  const [isChildHovered, setIsChildHovered] = useState(false);
  const labelId = groupId ? `${groupId}-label` : undefined;
  return (
    <Panel variant="plain">
      <div role={groupId ? 'group' : undefined} aria-labelledby={labelId}>
        <div
          id={labelId}
          className={`text-xs uppercase tracking-wider px-3 py-2 transition-colors flex items-center gap-2 ${
            isChildHovered ? 'text-primary' : 'text-fg-2'
          }`}
        >
          {icon && <Icon name={icon} className="w-3.5 h-3.5" />}
          {title}
        </div>
        <div
          onMouseEnter={() => setIsChildHovered(true)}
          onMouseLeave={() => setIsChildHovered(false)}
        >
          {children}
        </div>
      </div>
    </Panel>
  );
}

/**
 * ModalActions - Cancel/Confirm button row for modal footers.
 */
interface ModalActionsProps {
  onCancel?: () => void;
  onConfirm?: () => void;
  cancelLabel?: string;
  confirmLabel?: string;
  confirmDisabled?: boolean;
  confirmVariant?: ButtonVariant;
  className?: string;
  reverseOrder?: boolean;
}

export function ModalActions({
  onCancel,
  onConfirm,
  cancelLabel = 'Cancel',
  confirmLabel = 'Confirm',
  confirmDisabled = false,
  confirmVariant = 'primary',
  className,
  reverseOrder = false,
}: ModalActionsProps) {
  const cancelButton = onCancel && <Button onClick={onCancel}>{cancelLabel}</Button>;
  const confirmButton = onConfirm && (
    <Button variant={confirmVariant} onClick={onConfirm} disabled={confirmDisabled}>
      {confirmLabel}
    </Button>
  );
  return (
    <div className={cn('flex justify-end', className)}>
      <ButtonGroup aria-label="Actions">{reverseOrder ? [confirmButton, cancelButton] : [cancelButton, confirmButton]}</ButtonGroup>
    </div>
  );
}
