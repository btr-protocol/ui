// The wallet / session modal: identity row (copy, explorer, disconnect), the wrong-account banner, every account with one-click
// switching and signer badges, and the app's chain list (THE kit ChainSelectModal, same rows as every chain picker).
import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { CopyAddressButton, ExplorerButton } from '../ui/AddrActions';
import { MODAL_PADDING } from '../ui/BaseModal';
import type { ChainItem } from '../ui/ChainSelect';
import { ChainSelectModal } from '../ui/ChainSelectModal';
import { Button } from '../ui/Button';
import { Tooltip } from '../ui/FloatingPanel';
import { Icon } from '../ui/Icon';
import { FormRow } from '../ui/Primitives';
import { AccountList, AccountNoticeRow, accountGate } from './AccountPanel';
import { shortAddr } from '../lib/address';
import { type ActivateResult, activateAccount } from './accountSwitch';
import { walletOf } from './recentWallets';
import { useProviders } from './useProviders';
import { sameAddress, walletAddress, walletEntry } from './wallet';
import { ACCOUNT_LABELS, type AccountLabels } from './accountLabels';
import { WalletGlyph } from './WalletGlyph';
import { connectError } from './connection';

const fill = (s: string, v: Record<string, string>) => s.replace(/\{(\w+)\}/g, (_, k: string) => v[k] ?? '');

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
  wallet?: { id?: string; name: string; icon?: string; rdns?: string };
  explorerHref?: (address: string) => string | undefined;
  /** Replaces the default explorer button (an app with its own explorer resolution). */
  explorer?: ComponentChildren;
  onDisconnect: () => void;
  onSwitchChain: (chainId: number) => unknown;
  /** Resolve false to keep the modal open. */
  onSwitchAccount: (address: string) => boolean | Promise<boolean>;
  onConnectOther?: () => void;
  labels?: Partial<AccountLabels>;
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
  onConnectOther,
  labels = {},
}: AccountModalProps) {
  const [busy, setBusy] = useState<string>();
  const [err, setErr] = useState('');
  const l = { ...ACCOUNT_LABELS, ...labels };
  const [hint, setHint] = useState<{ address: string; reason: 'rejected' | 'not-shared' | 'none'; wallet?: string }>();
  const announced = useProviders();
  const abort = useRef<AbortController>();
  const gate = accountGate(activeAddress, sessionAddress);
  // The glyph is the wallet that HOLDS the address shown: the connected wallet's, or (the session account lives elsewhere) the
  // remembered wallet's when it is announced, else the generic wallet icon, never another wallet's mark.
  const holder = !activeAddress || sameAddress(address, activeAddress) ? wallet : announced.find((e) => (e.info.rdns ?? e.info.id)?.toLowerCase() === walletOf(address))?.info;
  useEffect(() => () => abort.current?.abort(), []);
  const close = () => {
    abort.current?.abort();
    setErr('');
    setHint(undefined);
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
  // One click on an account: the kit finds the wallet that holds it and makes that wallet the connected one (no-op when it already is),
  // THEN the app's own step runs (e.g. its sign-in as that account). A failed lookup is a row in the list, never a silent no-op.
  const pick = (a: string) =>
    void run(a, async () => {
      setHint(undefined);
      if (walletEntry.value && !sameAddress(a, walletAddress.value)) {
        abort.current = new AbortController();
        const r: ActivateResult = await activateAccount(a, { entries: announced.length ? announced : undefined, signal: abort.current.signal });
        if (!r.ok) return r.reason === 'cancelled' ? undefined : setHint({ address: a, reason: r.reason, wallet: r.wallet?.name });
      }
      if ((await onSwitchAccount(a)) !== false) close();
    });
  const hintText = hint && fill(l[hint.reason === 'rejected' ? 'hintRejected' : hint.reason === 'none' ? 'hintNone' : 'hintNotShared'], { addr: shortAddr(hint.address), wallet: hint.wallet ?? l.wallet });
  const busyNow = busy !== undefined;
  const notices = (
    <>
      {err && (
        <AccountNoticeRow tone="error" role="alert">
          {err}
        </AccountNoticeRow>
      )}
      {hintText && (
        <AccountNoticeRow tone="warning" role="alert">
          {hintText}
        </AccountNoticeRow>
      )}
      {gate.mismatch && gate.active && gate.expected && (
        <AccountNoticeRow
          tone="warning"
          role="alert"
          actions={
            <>
              <Button size="sm" variant="primary" disabled={busyNow} onClick={() => gate.expected && pick(gate.expected)}>
                {fill(l.switchTo, { addr: shortAddr(gate.expected) })}
              </Button>
              <Button size="sm" disabled={busyNow} onClick={() => gate.active && pick(gate.active)}>
                {fill(l.useInstead, { addr: shortAddr(gate.active) })}
              </Button>
            </>
          }
        >
          {fill(l.mismatch, { active: shortAddr(gate.active), session: shortAddr(gate.expected) })}
        </AccountNoticeRow>
      )}
    </>
  );

  const header = (
    <>
      <FormRow
        gap="md"
        className={`${MODAL_PADDING} border-b border-border py-2`}
        label={
          <div className="flex items-center gap-2 min-w-0">
            {holder ? (
              <WalletGlyph info={holder} size={16} />
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
      {(accounts.length > 0 || !!sessionAddress || !!err || !!hint) && (
        <AccountList
          accounts={accounts}
          active={activeAddress}
          session={sessionAddress}
          signers={signers}
          busy={busy}
          labels={labels}
          notices={notices}
          onSelect={pick}
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
