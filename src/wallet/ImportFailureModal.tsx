import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { ImportFailure, importTexts, registerFailureNotice } from '../lib/importGuard';
import { BaseModal } from '../ui/BaseModal';
import { Notice, NoticeAction } from '../ui/Feedback';

/** True while the browser reports a connection (re-evaluated on the `online` / `offline` events). */
export function useOnline(): boolean {
  const [on, setOn] = useState(typeof navigator === 'undefined' || navigator.onLine !== false);
  useEffect(() => {
    const up = () => setOn(true);
    const down = () => setOn(false);
    addEventListener('online', up);
    addEventListener('offline', down);
    return () => {
      removeEventListener('online', up);
      removeEventListener('offline', down);
    };
  }, []);
  return on;
}

/** The Reload action of a failed chunk is offered unless the failure is 'offline' and the connection has not returned. */
export const canReload = (e: unknown, online: boolean): boolean => !(e instanceof ImportFailure && e.kind === 'offline' && !online);

/** Callback ref: while the element is mounted it is registered as a visible failure notice with the app (see `configureImportGuard`). */
export function useFailureNotice() {
  const undo = useRef<(() => void) | undefined>(undefined);
  return useCallback((el: HTMLElement | null) => {
    undo.current?.();
    undo.current = el ? registerFailureNotice(el) : undefined;
  }, []);
}

/** The failure notice itself (registered with the app while mounted): the plain message and, unless offline, a Reload (the browser caches a failed
 *  module fetch, so only a reload retries). Shared by the modal fallback and the chart panel. */
export function ImportFailureNotice({ failure, className }: { failure: Error; className?: string }) {
  const online = useOnline();
  const noticeRef = useFailureNotice();
  const f = failure instanceof ImportFailure ? failure : null;
  return (
    <div ref={noticeRef} className={className}>
      <Notice
        tone="error"
        role="alert"
        action={canReload(failure, online) ? <NoticeAction label={f?.actionLabel ?? importTexts().action} onClick={() => location.reload()} /> : undefined}
      >
        {f ? f.message : importTexts().message}
      </Notice>
    </div>
  );
}

/** A modal chunk (connect / account) that failed to load: the notice in a normal modal body. The modal's own close button dismisses it. */
export function ImportFailureModal({ failure, onClose, title = importTexts().title }: { failure: Error; onClose: () => void; title?: string }) {
  return (
    <BaseModal isOpen onClose={onClose} title={title} headerType="title" size="sm">
      <ImportFailureNotice failure={failure} className="p-4" />
    </BaseModal>
  );
}
