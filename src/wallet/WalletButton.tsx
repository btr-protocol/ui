import { useState } from 'preact/hooks';
import { shortenAddress } from '../lib/address';
import { chainIcon } from '../lib/chainIcon';
import { Button } from '../ui/Button';
import type { ChainItem } from '../ui/ChainSelect';
import { Tooltip } from '../ui/FloatingPanel';
import { Icon } from '../ui/Icon';
import { type AccountLabels, accountGate } from './AccountPanel';
import { AccountModal } from './AccountModal';
import { WalletGlyph } from './WalletGlyph';
import {
  disconnectWallet,
  openConnectModal,
  pickWalletAccount,
  switchWalletAccount,
  switchWalletChain,
  walletAccounts,
  walletAddress,
  walletChainId,
  walletEntry,
} from './wallet';

/** @deprecated `ChainItem` (the kit chain list: rounded-square icon, name, chain id). */
export type WalletChain = ChainItem;

interface WalletButtonProps {
  className?: string;
  /** The app's chain list (the same `ChainItem[]` its ChainSelect uses). Omit for an identity-only modal. */
  chains?: readonly ChainItem[];
  /** Explorer URL of the connected address. */
  explorerHref?: (address: string) => string | undefined;
  /** Label of the connect CTA. */
  connectLabel?: string;
  /** Identity shown on the button: the session account when the app has one, else the wallet's. Default: the kit store. */
  address?: string;
  chainId?: number;
  /** The wallet's active account (what it signs with). Default: the kit store. */
  activeAddress?: string;
  /** Accounts the wallet exposes, active first. Default: the kit store. */
  accounts?: readonly string[];
  /** Signed-in (SIWE) account; set when the app has a session distinct from the wallet connection. */
  sessionAddress?: string;
  /** Owners of the Safe in view (their rows read "Signer"). */
  signers?: readonly string[];
  /** Connected wallet's glyph (catalog id / name / announced icon). Default: the kit store. */
  wallet?: { id?: string; name: string; icon?: string };
  onConnect?: () => void;
  /** "Connect another wallet" in the account modal. Default: `onConnect`. */
  onConnectOther?: () => void;
  onDisconnect?: () => void;
  onSwitchChain?: (chainId: number) => boolean | Promise<boolean>;
  /** One click on an account row. Default: make it the wallet's active account (the wallet's picker when needed).
   *  An app with a session re-auths here when the account is not the session's. Resolve false to keep the modal open. */
  onSwitchAccount?: (address: string) => boolean | Promise<boolean>;
  /** "Choose account in wallet". Default: the wallet's account picker. */
  onChooseAccount?: () => void | Promise<unknown>;
  labels?: { wallet: string; disconnect: string; copied: string } & Partial<AccountLabels>;
}

const storeSwitch = async (a: string) => {
  const p = walletEntry.value?.provider;
  return !!p && (await switchWalletAccount(p, a));
};
const storePick = async () => {
  const p = walletEntry.value?.provider;
  if (p) await pickWalletAccount(p);
};

export function WalletButton({
  className,
  chains,
  explorerHref,
  connectLabel = 'Connect',
  address = walletAddress.value,
  chainId = walletChainId.value,
  activeAddress = walletAddress.value,
  accounts = walletAccounts.value,
  sessionAddress,
  signers,
  wallet = walletEntry.value?.info,
  onConnect = openConnectModal,
  onConnectOther = onConnect,
  onDisconnect = disconnectWallet,
  onSwitchChain = switchWalletChain,
  onSwitchAccount = storeSwitch,
  onChooseAccount = storePick,
  labels = { wallet: 'Wallet', disconnect: 'Disconnect', copied: 'Copied wallet address' },
}: WalletButtonProps) {
  const [showAccountModal, setShowAccountModal] = useState(false);

  if (!address) {
    return (
      <Button onClick={onConnect} variant="primary" size="sm" className={className} aria-label="Connect wallet">
        {/* Icon-only at <=300px: with logo + burger there is no room for the word. */}
        <Icon name="wallet" className="w-4 h-4 hidden max-[300px]:block" />
        <span className="max-[300px]:hidden">{connectLabel}</span>
      </Button>
    );
  }

  const chain = chains?.find((c) => c.id === chainId);
  const chainName = chain?.name ?? (chainId ? `Chain ${chainId}` : 'No network');
  const gate = accountGate(activeAddress, sessionAddress);

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
            gate.mismatch ? (
              <Icon name="warning" className="w-4 h-4 shrink-0 text-warning" />
            ) : wallet ? (
              <WalletGlyph id={wallet.id} name={wallet.name} announcedIcon={wallet.icon} size={16} />
            ) : chainId && chainIcon(chainId, { mono: true }) ? (
              <img src={chainIcon(chainId, { mono: true })} alt="" className="w-4 h-4 shrink-0 icon-tint-primary" />
            ) : (
              <Icon name="wallet" className="w-4 h-4 shrink-0" />
            )
          }
        >
          {/* Below `sm` the glyph alone carries "connected"; the full address is in the account modal. */}
          <span className="max-sm:hidden">{shortenAddress(address)}</span>
        </Button>
      </Tooltip>

      <AccountModal
        isOpen={showAccountModal}
        onClose={() => setShowAccountModal(false)}
        address={address}
        chainId={chainId}
        chains={chains}
        activeAddress={activeAddress}
        accounts={accounts}
        sessionAddress={sessionAddress}
        signers={signers}
        wallet={wallet}
        explorerHref={explorerHref}
        onDisconnect={onDisconnect}
        onSwitchChain={onSwitchChain}
        onSwitchAccount={onSwitchAccount}
        onChooseAccount={onChooseAccount}
        onConnectOther={onConnectOther}
        labels={labels}
      />
    </>
  );
}
