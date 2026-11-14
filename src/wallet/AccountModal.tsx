// The wallet / session modal: identity row (copy, explorer, disconnect), the wrong-account banner, every account with one-click
// switching and signer badges, and the app's chain list (THE kit ChainSelectModal, same rows as every chain picker).
import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { CopyAddressButton, ExplorerButton } from '../ui/AddrActions';
import { MODAL_PADDING } from '../ui/BaseModal';
import type { ChainItem } from '../ui/ChainSelect';
import { ChainSelectModal } from '../ui/ChainSelectModal';
import { Button } from '../ui/Button';
import { Notice } from '../ui/Feedback';
import { Tooltip } from '../ui/FloatingPanel';
import { Icon } from '../ui/Icon';
import { FormRow } from '../ui/Primitives';
import { AccountList, accountGate } from './AccountPanel';
import { shortAddr } from '../lib/address';
import { activateAccount } from './accountSwitch';
import { useProviders } from './useProviders';
import { sameAddress, walletAddress, walletEntry } from './wallet';
import { ACCOUNT_LABELS, type AccountLabels } from './accountLabels';
import { WalletGlyph } from './WalletGlyph';
import { connectError } from './connection';

const fill = (s: string, v: Record<string, string>) => s.replace(/\{(\w+)\}/g, (_, k: string) => v[k] ?? '');
/** `fill` for running text: the values named in `whole` (addresses) stay one unbreakable piece, never split across lines. */
const fillNodes = (s: string, v: Record<string, string>, whole: readonly string[]) =>
  s.split(/(\{\w+\})/).map((part, i) => {
    const k = /^\{(\w+)\}$/.exec(part)?.[1];
    if (k === undefined) return part;
    return whole.includes(k) ? <span key={i} className="whitespace-nowrap">{v[k] ?? ''}</span> : (v[k] ?? '');
  });

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
  const [hint, setHint] = useState<{ address: string; kind: 'rejected' | 'not-shared' | 'ambiguous' | 'failed'; wallet?: string }>();
  const announced = useProviders();
  const abort = useRef<AbortController>();
  const gate = accountGate(activeAddress, sessionAddress);
  // The connected wallet's mark only while it exposes the address shown; otherwise the generic wallet icon (never another wallet's mark).
  const holder = !activeAddress || sameAddress(address, activeAddress) || accounts.some((a) => sameAddress(a, address)) ? wallet : undefined;
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
  // One click on an account. 1) The kit makes the wallet that holds it the connected one (nothing to do when it already is; a miss or an
  // ambiguity is a row, never a silent no-op). 2) THEN the app's own step (e.g. its sign-in as that account), never after the modal closed
  // or a newer click. 3) If that step fails, the previous wallet is put back and a row says so.
  const pick = (a: string) =>
    void run(a, async () => {
      setHint(undefined);
      abort.current?.abort();
      const ac = (abort.current = new AbortController());
      let undo: (() => Promise<void>) | undefined;
      if (walletEntry.value && !sameAddress(a, walletAddress.value)) {
        const r = await activateAccount(a, { entries: announced.length ? announced : undefined, signal: ac.signal });
        if (!r.ok) return r.reason === 'cancelled' ? undefined : setHint({ address: a, kind: r.reason, wallet: r.wallet?.name });
        undo = r.undo;
      }
      if (ac.signal.aborted) return void (await undo?.());
      let done = false;
      try {
        done = (await onSwitchAccount(a)) !== false;
      } catch {}
      // A failed app step puts the previous wallet back even when the modal was closed or a newer click took over meanwhile.
      if (done) return ac.signal.aborted ? undefined : close();
      await undo?.();
      if (!ac.signal.aborted) setHint({ address: a, kind: 'failed' });
    });
  const hintKey = { rejected: 'hintRejected', 'not-shared': 'hintNotShared', ambiguous: 'hintAmbiguous', failed: 'hintFailed' } as const;
  const hintText = hint && fillNodes(l[hintKey[hint.kind]], { addr: shortAddr(hint.address), wallet: hint.wallet ?? l.wallet, action: l.connectOther }, ['addr']);
  const busyNow = busy !== undefined;
  const hasNotices = !!err || !!hintText || (gate.mismatch && !!gate.active && !!gate.expected);
  // The visible label (address middle-truncated, never split) leads the accessible name, which adds the full address.
  const named = (tpl: string, addr: string) => {
    const label = fill(tpl, { addr: shortAddr(addr) });
    return { 'aria-label': `${label} (${addr})` };
  };
  const notices = (
    <>
      {err && (
        <Notice size="row" tone="error" role="alert">
          {err}
        </Notice>
      )}
      {hintText && (
        <Notice size="row" tone="warning" role="alert">
          {hintText}
        </Notice>
      )}
      {gate.mismatch && gate.active && gate.expected && (
        <Notice
          size="row"
          tone="warning"
          role="alert"
          action={
            <span className="flex min-w-0 flex-wrap gap-2">
              <Button size="sm" variant="primary" className="whitespace-nowrap" {...named(l.switchTo, gate.expected)} disabled={busyNow} onClick={() => gate.expected && pick(gate.expected)}>
                {fill(l.switchTo, { addr: shortAddr(gate.expected) })}
              </Button>
              <Button size="sm" className="whitespace-nowrap" {...named(l.useInstead, gate.active)} disabled={busyNow} onClick={() => gate.active && pick(gate.active)}>
                {fill(l.useInstead, { addr: shortAddr(gate.active) })}
              </Button>
            </span>
          }
        >
          {fillNodes(l.mismatch, { active: shortAddr(gate.active), session: shortAddr(gate.expected) }, ['active', 'session'])}
        </Notice>
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
              <Button
                variant="ghost"
                size="sm"
                aria-label={l.disconnect}
                leftIcon={<Icon name="sign-out" />}
                onClick={() => {
                  onDisconnect();
                  close();
                }}
              />
            </Tooltip>
          </div>
        }
      />
      {(accounts.length > 0 || !!sessionAddress || hasNotices) && (
        <AccountList
          accounts={accounts}
          active={activeAddress}
          session={sessionAddress}
          signers={signers}
          busy={busy}
          labels={labels}
          notices={hasNotices ? notices : undefined}
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
