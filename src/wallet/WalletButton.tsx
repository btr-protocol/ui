import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import { shortenAddress } from '../lib/address';
import { CopyAddressButton, ExplorerButton } from '../ui/AddrActions';
import { MODAL_PADDING } from '../ui/BaseModal';
import { Button } from '../ui/Button';
import { Tooltip } from '../ui/FloatingPanel';
import { Icon } from '../ui/Icon';
import { FormRow } from '../ui/Primitives';
import { SelectionModal } from '../ui/Select';
import { WalletGlyph } from './WalletGlyph';
import {
  disconnectWallet,
  openConnectModal,
  switchWalletChain,
  walletAddress,
  walletChainId,
  walletEntry,
} from './wallet';

export interface WalletChain {
  id: number;
  name: string;
  /** Mono glyph URL, tinted primary on the button. */
  icon?: string;
}

interface WalletButtonProps {
  className?: string;
  /** Chains offered in the account modal; omit for a plain identity modal. */
  chains?: WalletChain[];
  /** Explorer URL of the connected address. */
  explorerHref?: (address: string) => string | undefined;
  /** Label of the connect CTA. */
  connectLabel?: string;
  /** Defaults to the kit store. */
  address?: string;
  chainId?: number;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onSwitchChain?: (chainId: number) => boolean | Promise<boolean>;
  labels?: { wallet: string; disconnect: string; copied: string };
}

export function WalletButton({
  className,
  chains,
  explorerHref,
  connectLabel = 'Connect',
  address = walletAddress.value,
  chainId = walletChainId.value,
  onConnect = openConnectModal,
  onDisconnect = disconnectWallet,
  onSwitchChain = switchWalletChain,
  labels = { wallet: 'Wallet', disconnect: 'Disconnect', copied: 'Copied wallet address' },
}: WalletButtonProps) {
  const [showAccountModal, setShowAccountModal] = useState(false);
  const info = walletEntry.value?.info;

  if (!address) {
    return (
      <Button
        onClick={onConnect}
        variant="primary"
        size="sm"
        className={className}
        aria-label="Connect wallet"
      >
        {/* Icon-only at <=300px: with logo + burger there is no room for the word. */}
        <Icon name="wallet" className="w-4 h-4 hidden max-[300px]:block" />
        <span className="max-[300px]:hidden">{connectLabel}</span>
      </Button>
    );
  }

  const chain = chains?.find((c) => c.id === chainId);
  const chainName = chain?.name ?? (chainId ? `Chain ${chainId}` : 'No network');

  const identity: ComponentChildren = (
    <FormRow
      gap="md"
      className={`${MODAL_PADDING} border-b border-border py-2`}
      label={
        <div className="flex items-center gap-2 min-w-0">
          {info ? <WalletGlyph info={info} size={16} /> : <Icon name="wallet" className="w-4 h-4 text-fg-2 shrink-0" />}
          <span className="font-numeric text-xs text-fg-0 truncate" title={address}>
            {address}
          </span>
        </div>
      }
      value={
        <div className="flex items-center gap-3">
          <CopyAddressButton value={address} copiedMessage={labels.copied} />
          <ExplorerButton href={explorerHref?.(address)} />
          <Tooltip content={labels.disconnect} side="bottom">
            <button
              type="button"
              onClick={() => {
                onDisconnect();
                setShowAccountModal(false);
              }}
              aria-label={labels.disconnect}
              className="p-1.5 hover:text-primary transition-colors"
            >
              <Icon name="sign-out" className="w-4 h-4 text-fg-3" />
            </button>
          </Tooltip>
        </div>
      }
    />
  );

  // A connected wallet reads as an ACTIVE nav item - primary text on the low-opacity primary fill.
  return (
    <>
      <Tooltip content={`${chainName} · chain id ${chainId ?? '?'} · connected`} side="bottom">
        <Button
          variant="ghost"
          active
          size="sm"
          className={className}
          onClick={() => setShowAccountModal(true)}
          aria-label={`Wallet ${shortenAddress(address)} on ${chainName}, open account`}
          leftIcon={
            info ? (
              <WalletGlyph info={info} size={16} />
            ) : chain?.icon ? (
              <img src={chain.icon} alt="" className="w-4 h-4 shrink-0 icon-tint-primary" />
            ) : (
              <Icon name="wallet" className="w-4 h-4 shrink-0" />
            )
          }
        >
          {/* Below `sm` the glyph alone carries "connected"; the full address is in the account modal. */}
          <span className="max-sm:hidden">{shortenAddress(address)}</span>
        </Button>
      </Tooltip>

      <SelectionModal
        isOpen={showAccountModal}
        onClose={() => setShowAccountModal(false)}
        title={labels.wallet}
        size="md"
        items={(chains ?? []).map((c) => ({ id: String(c.id), label: c.name, icon: c.icon }))}
        selectedIds={chainId != null ? [String(chainId)] : []}
        onSelect={(id) => {
          const next = Number(Array.isArray(id) ? id[0] : id);
          void Promise.resolve(onSwitchChain(next)).then((ok) => ok && setShowAccountModal(false));
        }}
        listHeader={identity}
      />
    </>
  );
}
