import type { ComponentType } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import type { WalletModalProps } from './WalletModal';
import { closeConnectModal, connectModalOpen } from './wallet';

/** THE app-wide connect modal, lazy: mount once; the modal chunk (wallet list, WalletConnect pairing, QR) is fetched on first
 *  open, never in the entry. Opens on the kit store (`openConnectModal`) unless `isOpen` is passed. */
export function ConnectModalHost(props: WalletModalProps) {
  const isOpen = props.isOpen ?? connectModalOpen.value;
  const [Modal, setModal] = useState<ComponentType<WalletModalProps> | null>(null);
  useEffect(() => {
    if (!isOpen || Modal) return;
    let cancelled = false;
    void import('./WalletModal').then((m) => {
      if (!cancelled) setModal(() => m.WalletModal);
    });
    return () => {
      cancelled = true;
    };
  }, [isOpen, Modal]);
  if (!isOpen || !Modal) return null;
  return <Modal {...props} isOpen onClose={props.onClose ?? closeConnectModal} />;
}
