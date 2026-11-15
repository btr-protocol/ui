import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { ImportFailure, importTexts, registerFailureNotice } from '../lib/importGuard';
import { Notice, NoticeAction } from './Feedback';

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

/** Reload is offered only while the browser is online, whatever the failure kind (offline there is nothing to reload into; it appears when the connection returns). */
export const canReload = (_e: unknown, online: boolean): boolean => online;

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
