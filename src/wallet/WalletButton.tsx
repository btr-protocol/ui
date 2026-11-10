import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import { shortenAddress } from '../lib/address';
import { chainIcon } from '../lib/chainIcon';
import { connectError } from './connection';
import { CopyAddressButton, ExplorerButton } from '../ui/AddrActions';
import { MODAL_PADDING } from '../ui/BaseModal';
import { Button } from '../ui/Button';
import { type ChainItem, ChainSelectModal } from '../ui/ChainSelect';
import { Notice } from '../ui/Feedback';
import { Tooltip } from '../ui/FloatingPanel';
import { Icon } from '../ui/Icon';
import { FormRow } from '../ui/Primitives';
import { type AccountLabels, AccountList, WrongAccountNotice, accountGate } from './AccountPanel';
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
  const [busy, setBusy] = useState<string>();
  const [err, setErr] = useState('');

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
  const expected = sessionAddress ?? address;
  const gate = accountGate(activeAddress, sessionAddress);

  const run = async (key: string, fn: () => unknown) => {
    setBusy(key);
    setErr('');
    try {
      return await fn();
    } catch (e) {
      setErr(connectError(e));
    } finally {
      setBusy(undefined);
    }
  };
  const pick = (a: string) =>
    void run(a, async () => {
      if ((await onSwitchAccount(a)) !== false) setShowAccountModal(false);
    });
  const close = () => {
    setShowAccountModal(false);
    setErr('');
  };

  const identity: ComponentChildren = (
    <FormRow
      gap="md"
      className={`${MODAL_PADDING} border-b border-border py-2`}
      label={
        <div className="flex items-center gap-2 min-w-0">
          {wallet ? <WalletGlyph id={wallet.id} name={wallet.name} announcedIcon={wallet.icon} size={16} /> : <Icon name="wallet" className="w-4 h-4 text-fg-2 shrink-0" />}
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
                close();
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

  const header = (
    <>
      {identity}
      {err && (
        <div className={`${MODAL_PADDING} py-2`}>
          <Notice tone="error" role="alert">
            {err}
          </Notice>
        </div>
      )}
      {gate.mismatch && gate.active && gate.expected && (
        <div className={`${MODAL_PADDING} py-2`}>
          <WrongAccountNotice
            active={gate.active}
            expected={gate.expected}
            busy={busy !== undefined}
            labels={labels}
            onSwitch={() => pick(expected)}
            onUseActive={() => gate.active && pick(gate.active)}
          />
        </div>
      )}
      {(accounts.length > 0 || !!sessionAddress) && (
        <AccountList
          accounts={accounts}
          active={activeAddress}
          session={sessionAddress}
          signers={signers}
          busy={busy}
          labels={labels}
          onSelect={pick}
          onChooseInWallet={() => void run('', onChooseAccount)}
          onConnectOther={() => {
            close();
            onConnectOther();
          }}
        />
      )}
    </>
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

      <ChainSelectModal
        isOpen={showAccountModal}
        onClose={close}
        title={labels.wallet}
        size="md"
        chains={chains ?? []}
        value={chainId ?? null}
        onSelect={(next) => {
          void Promise.resolve(onSwitchChain(next));
        }}
        listHeader={header}
      />
    </>
  );
}
