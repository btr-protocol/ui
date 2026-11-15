import type { ComponentType } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { ImportFailure, guardedImport } from '../lib/importGuard';
import { Notice, NoticeAction } from '../ui/Feedback';
import type { WalletModalProps } from './WalletModal';
import { closeConnectModal, connectModalOpen } from './wallet';

/** THE app-wide connect modal, lazy: mount once; the modal chunk (wallet list, WalletConnect pairing, QR) is fetched on first
 *  open, never in the entry. Opens on the kit store (`openConnectModal`) unless `isOpen` is passed. A chunk that fails to load
 *  shows its plain message with a Reload (a failed module fetch is cached by the browser: only a reload retries), never a dead button. */
export function ConnectModalHost(props: WalletModalProps) {
  const isOpen = props.isOpen ?? connectModalOpen.value;
  const [Modal, setModal] = useState<ComponentType<WalletModalProps> | null>(null);
  const [failure, setFailure] = useState<Error | null>(null);
  useEffect(() => {
    if (!isOpen || Modal) return;
    let cancelled = false;
    guardedImport(() => import('./WalletModal')).then(
      (m) => {
        if (!cancelled) setModal(() => m.WalletModal);
      },
      (e: unknown) => {
        console.error('[connectModal] load failed', e);
        if (!cancelled) setFailure(e instanceof Error ? e : new Error(String(e)));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [isOpen, Modal]);
  if (!isOpen) return null;
  if (failure && !Modal) {
    const onClose = props.onClose ?? closeConnectModal;
    return (
      <div className="fixed inset-x-4 top-4 z-modal mx-auto max-w-md">
        <Notice
          tone="error"
          role="alert"
          action={
            <>
              <NoticeAction
                label={failure instanceof ImportFailure ? failure.actionLabel : 'Reload'}
                onClick={() => location.reload()}
              />
              <NoticeAction
                label="Close"
                onClick={() => {
                  setFailure(null);
                  onClose();
                }}
              />
            </>
          }
        >
          {failure instanceof ImportFailure ? failure.message : 'The wallet list could not be loaded. Reload the page.'}
        </Notice>
      </div>
    );
  }
  if (!Modal) return null;
  return <Modal {...props} isOpen onClose={props.onClose ?? closeConnectModal} />;
}
