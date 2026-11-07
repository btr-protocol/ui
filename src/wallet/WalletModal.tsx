import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import { useKeyboardNav } from '../lib/useKeyboardNav';
import { BaseModal, MODAL_PADDING, ModalSection } from '../ui/BaseModal';
import { Notice } from '../ui/Feedback';
import { KeyboardShortcutGroup } from '../ui/KeyboardShortcut';
import { WalletItemButton } from '../ui/WalletItemButton';
import { WalletGlyph } from './WalletGlyph';
import { useProviders } from './useProviders';
import {
  type ProviderEntry,
  closeConnectModal,
  connectErrorMessage,
  connectModalOpen,
  connectWallet,
} from './wallet';

export interface WalletModalLabels {
  title: string;
  searchPlaceholder: string;
  installed: string;
  empty: string;
  navigate: string;
  select: string;
  close: string;
}

const LABELS: WalletModalLabels = {
  title: 'Connect wallet',
  searchPlaceholder: 'Search wallets...',
  installed: 'Installed',
  empty: 'No browser wallet detected.',
  navigate: 'Navigate',
  select: 'Select',
  close: 'Close',
};

export interface WalletModalProps {
  /** Defaults to the kit store (`connectModalOpen`, opened by `WalletButton` / `openConnectModal`). */
  isOpen?: boolean;
  onClose?: () => void;
  /** Called with the chosen wallet instead of `connectWallet` (the app owns connection state). */
  onSelect?: (entry: ProviderEntry) => void | Promise<void>;
  /** Override the EIP-6963 list. */
  providers?: ProviderEntry[];
  labels?: Partial<WalletModalLabels>;
  /** Footer copy (terms, "get a wallet" link). */
  footer?: ComponentChildren;
  /** Extra sections below the wallet list (an app-owned WalletConnect entry, say). */
  extra?: ComponentChildren;
}

export function WalletModal({
  isOpen = connectModalOpen.value,
  onClose = closeConnectModal,
  onSelect,
  providers,
  labels,
  footer,
  extra,
}: WalletModalProps) {
  const l = { ...LABELS, ...labels };
  const discovered = useProviders();
  const list = providers ?? discovered;
  const [search, setSearch] = useState('');
  const [connecting, setConnecting] = useState<string | null>(null);
  const [err, setErr] = useState('');

  const connect = async (w: ProviderEntry) => {
    setConnecting(w.info.uuid);
    setErr('');
    try {
      await (onSelect ? onSelect(w) : connectWallet(w));
      onClose();
    } catch (e) {
      setErr(connectErrorMessage(e));
    } finally {
      setConnecting(null);
    }
  };

  const q = search.toLowerCase();
  const shown = list.filter((w) => w.info.name.toLowerCase().includes(q));
  const searchable = list.length > 1;
  const { selectedIndex, handleKeyDown } = useKeyboardNav({
    items: shown,
    onSelect: connect,
    isEnabled: isOpen && searchable && !connecting,
  });

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={(open) => !open && onClose()}
      title={l.title}
      headerType={searchable ? 'input' : 'title'}
      placeholder={l.searchPlaceholder}
      searchValue={search}
      onSearchChange={setSearch}
      onSearchKeyDown={searchable ? handleKeyDown : undefined}
      size="sm"
      footerNav={
        searchable ? (
          <KeyboardShortcutGroup
            shortcuts={[
              { keys: '↑↓', label: l.navigate },
              { keys: 'Enter', label: l.select },
              { keys: 'Esc', label: l.close },
            ]}
          />
        ) : undefined
      }
      footerContent={
        footer ? <div className="flex flex-col gap-1 text-center text-xs text-fg-2">{footer}</div> : undefined
      }
    >
      <>
        {err && (
          <div className="mx-4 mt-4">
            <Notice tone="error" role="alert">
              {err}
            </Notice>
          </div>
        )}

        {list.length > 0 ? (
          <ModalSection title={l.installed}>
            {shown.map((w, i) => (
              <WalletItemButton
                key={w.info.uuid}
                name={w.info.name}
                icon={<WalletGlyph info={w.info} />}
                variant="detected"
                isConnecting={connecting === w.info.uuid}
                disabled={connecting !== null}
                isHighlighted={searchable && selectedIndex === i}
                onClick={() => connect(w)}
              />
            ))}
          </ModalSection>
        ) : (
          <p className={`${MODAL_PADDING} py-3 text-sm text-fg-2`}>{l.empty}</p>
        )}
        {extra}
      </>
    </BaseModal>
  );
}
