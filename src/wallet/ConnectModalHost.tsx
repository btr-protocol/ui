import type { ComponentType } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { guardedImport } from '../lib/importGuard';
import { ImportFailureModal } from './ImportFailureModal';
import type { WalletModalProps } from './WalletModal';
import { closeConnectModal, connectModalOpen } from './wallet';

/** THE app-wide connect modal, lazy: mount once; the modal chunk (wallet list, WalletConnect pairing, QR) is fetched on first
 *  open, never in the entry. Opens on the kit store (`openConnectModal`) unless `isOpen` is passed. A chunk that fails to load
 *  shows its plain message with a Reload in a modal (never a dead button). */
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
        if (!cancelled) setFailure(e as Error);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [isOpen, Modal]);
  const onClose = props.onClose ?? closeConnectModal;
  if (!isOpen) return null;
  if (failure && !Modal) {
    return (
      <ImportFailureModal
        failure={failure}
        onClose={() => {
          setFailure(null);
          onClose();
        }}
      />
    );
  }
  if (!Modal) return null;
  return <Modal {...props} isOpen onClose={onClose} />;
}
