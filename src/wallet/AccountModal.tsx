// The wallet / session modal: identity row (copy, explorer, disconnect), the wrong-account banner, every account with one-click
// switching and signer badges, and the app's chain list (THE kit ChainSelectModal, same rows as every chain picker).
import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import { CopyAddressButton, ExplorerButton } from '../ui/AddrActions';
import { MODAL_PADDING } from '../ui/BaseModal';
import { type ChainItem, ChainSelectModal } from '../ui/ChainSelect';
import { Notice } from '../ui/Feedback';
import { Tooltip } from '../ui/FloatingPanel';
import { Icon } from '../ui/Icon';
import { FormRow } from '../ui/Primitives';
import { type AccountLabels, AccountList, WrongAccountNotice, accountGate } from './AccountPanel';
import { WalletGlyph } from './WalletGlyph';
import { connectError } from './connection';

export interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Identity shown (the session account when the app has one, else the wallet's). */
  address: string;
  chainId?: number;
  chains?: readonly ChainItem[];
  /** The wallet's active account (what it signs with). */
  activeAddress?: string;
  /** Accounts the wallet exposes, active first. */
  accounts: readonly string[];
  /** Signed-in (SIWE) account, when the app has a session distinct from the wallet connection. */
  sessionAddress?: string;
  /** Owners of the Safe in view. */
  signers?: readonly string[];
  wallet?: { id?: string; name: string; icon?: string };
  explorerHref?: (address: string) => string | undefined;
  /** Replaces the default explorer button (an app with its own explorer resolution). */
  explorer?: ComponentChildren;
  onDisconnect: () => void;
  onSwitchChain: (chainId: number) => unknown;
  /** Resolve false to keep the modal open. */
  onSwitchAccount: (address: string) => boolean | Promise<boolean>;
  onChooseAccount?: () => unknown;
  onConnectOther?: () => void;
  labels?: { wallet?: string; disconnect?: string; copied?: string } & Partial<AccountLabels>;
}

export function AccountModal({
  isOpen,
  onClose,
  address,
  chainId,
  chains = [],
  activeAddress,
  accounts,
  sessionAddress,
  signers,
  wallet,
  explorerHref,
  explorer,
  onDisconnect,
  onSwitchChain,
  onSwitchAccount,
  onChooseAccount,
  onConnectOther,
  labels = {},
}: AccountModalProps) {
  const [busy, setBusy] = useState<string>();
  const [err, setErr] = useState('');
  const l = { wallet: 'Wallet', disconnect: 'Disconnect', copied: 'Copied wallet address', ...labels };
  const gate = accountGate(activeAddress, sessionAddress);
  const close = () => {
    setErr('');
    onClose();
  };
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
      if ((await onSwitchAccount(a)) !== false) close();
    });

  const header = (
    <>
      <FormRow
        gap="md"
        className={`${MODAL_PADDING} border-b border-border py-2`}
        label={
          <div className="flex items-center gap-2 min-w-0">
            {wallet ? (
              <WalletGlyph id={wallet.id} name={wallet.name} announcedIcon={wallet.icon} size={16} />
            ) : (
              <Icon name="wallet" className="w-4 h-4 text-fg-2 shrink-0" />
            )}
            <span className="font-numeric text-xs text-fg-0 truncate" title={address}>
              {address}
            </span>
          </div>
        }
        value={
          <div className="flex items-center gap-3">
            <CopyAddressButton value={address} copiedMessage={l.copied} />
            {explorer ?? <ExplorerButton href={explorerHref?.(address)} />}
            <Tooltip content={l.disconnect} side="bottom">
              <button
                type="button"
                onClick={() => {
                  onDisconnect();
                  close();
                }}
                aria-label={l.disconnect}
                className="p-1.5 hover:text-primary transition-colors"
              >
                <Icon name="sign-out" className="w-4 h-4 text-fg-3" />
              </button>
            </Tooltip>
          </div>
        }
      />
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
            onSwitch={() => gate.expected && pick(gate.expected)}
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
          onChooseInWallet={onChooseAccount && (() => void run('', onChooseAccount))}
          onConnectOther={
            onConnectOther &&
            (() => {
              close();
              onConnectOther();
            })
          }
        />
      )}
    </>
  );

  return (
    <ChainSelectModal
      isOpen={isOpen}
      onClose={close}
      title={l.wallet}
      // `md`: the identity row carries the FULL address, which a `sm` modal truncates.
      size="md"
      chains={chains}
      value={chainId ?? null}
      onSelect={(next) => void Promise.resolve(onSwitchChain(next))}
      listHeader={header}
    />
  );
}
