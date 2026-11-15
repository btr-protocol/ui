import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { ImportFailure, registerFailureNotice } from '../lib/importGuard';
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

/** A modal chunk (connect / account) that failed to load: the plain message in a normal modal body (the modal layer, under no header) with a
 *  Reload (the browser caches a failed module fetch, so only a reload retries). The modal's own close button dismisses it. */
export function ImportFailureModal({ failure, onClose, title = 'Wallet' }: { failure: Error; onClose: () => void; title?: string }) {
  const online = useOnline();
  const noticeRef = useFailureNotice();
  const f = failure instanceof ImportFailure ? failure : null;
  return (
    <BaseModal isOpen onClose={onClose} title={title} headerType="title" size="sm">
      <div ref={noticeRef} className="p-4">
        <Notice
          tone="error"
          role="alert"
          action={canReload(failure, online) ? <NoticeAction label={f?.actionLabel ?? 'Reload'} onClick={() => location.reload()} /> : undefined}
        >
          {f ? f.message : 'This part of the app could not be loaded. Reload the page.'}
        </Notice>
      </div>
    </BaseModal>
  );
}
