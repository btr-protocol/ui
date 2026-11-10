// Account switching for the wallet/session modal and the wrong-account gate in front of a signature.
// "Active" = the account the wallet signs with right now; "session" = the account the app is signed in as (SIWE) or
// expects; "signer" = an owner of the Safe in view. The wallet only ever signs as its active account, so a switch is
// made IN the wallet (its account picker) and the app follows its `accountsChanged`.
import { shortAddr } from '../lib/address';
import { MODAL_PADDING, ModalSection } from '../ui/BaseModal';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Notice } from '../ui/Feedback';
import { WalletItemButton } from '../ui/WalletItemButton';
import { ACCOUNT_LABELS, type AccountLabels } from './labels';
import { accountMismatch, sameAddress } from './wallet';

const fill = (s: string, v: Record<string, string>) => s.replace(/\{(\w+)\}/g, (_, k: string) => v[k] ?? '');

/** The one account picture both the modal and a signing card read: who signs vs who is expected. */
export interface AccountGate {
  /** Wallet's active account, undefined = no wallet connected (yet). */
  active?: string;
  /** The account the app expects (the session). */
  expected?: string;
  mismatch: boolean;
}
export const accountGate = (active?: string | null, expected?: string | null): AccountGate => ({
  active: active ?? undefined,
  expected: expected ?? undefined,
  mismatch: accountMismatch(active, expected),
});

/** The wrong-account banner: the primary action brings the wallet to the expected account, the secondary re-auths as the active one. */
export function WrongAccountNotice({
  active,
  expected,
  onSwitch,
  onUseActive,
  busy,
  labels,
  className,
}: {
  active: string;
  expected: string;
  onSwitch: () => void;
  onUseActive?: () => void;
  busy?: boolean;
  labels?: Partial<AccountLabels>;
  className?: string;
}) {
  const l = { ...ACCOUNT_LABELS, ...labels };
  return (
    <Notice tone="warning" role="alert" className={className}>
      <span className="block">{fill(l.mismatch, { active: shortAddr(active), session: shortAddr(expected) })}</span>
      <span className="mt-2 flex flex-wrap gap-2">
        <Button size="sm" variant="primary" disabled={busy} onClick={onSwitch}>
          {fill(l.switchTo, { addr: shortAddr(expected) })}
        </Button>
        {onUseActive && (
          <Button size="sm" disabled={busy} onClick={onUseActive}>
            {fill(l.useInstead, { addr: shortAddr(active) })}
          </Button>
        )}
      </span>
    </Notice>
  );
}

export interface AccountListProps {
  /** Accounts the wallet exposes, active first. */
  accounts: readonly string[];
  active?: string;
  /** The signed-in / expected account; listed even when the wallet does not expose it. */
  session?: string;
  /** Owners of the Safe in view: their rows carry a "Signer" badge. */
  signers?: readonly string[];
  /** One click: make this the account (switch in the wallet, then re-auth when it is not the session). */
  onSelect?: (address: string) => void;
  onChooseInWallet?: () => void;
  onConnectOther?: () => void;
  busy?: string;
  labels?: Partial<AccountLabels>;
}

/** Every account of the connected wallet (plus the session's), one click each; badges say which is active, signed in, a signer. */
export function AccountList({ accounts, active, session, signers = [], onSelect, onChooseInWallet, onConnectOther, busy, labels }: AccountListProps) {
  const l = { ...ACCOUNT_LABELS, ...labels };
  const rows = [...accounts];
  if (session && !rows.some((a) => sameAddress(a, session))) rows.push(session);
  // ↑↓ / Home / End move focus between the account rows (same keys as useKeyboardNav); the rows stay focusable while busy.
  const onKeyDown = (e: KeyboardEvent) => {
    const list = [...(e.currentTarget as HTMLElement).querySelectorAll<HTMLElement>(':scope > button')];
    const i = list.indexOf(document.activeElement as HTMLElement);
    const next = e.key === 'ArrowDown' ? i + 1 : e.key === 'ArrowUp' ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? list.length - 1 : null;
    if (next === null || !list.length) return;
    e.preventDefault();
    e.stopPropagation();
    list[(next + list.length) % list.length]?.focus();
  };
  return (
    <ModalSection title={l.accounts}>
      <div onKeyDown={onKeyDown}>
      {rows.map((a) => {
        const isActive = sameAddress(a, active);
        const isSession = sameAddress(a, session);
        const exposed = accounts.some((x) => sameAddress(x, a));
        const current = isActive && (!session || isSession);
        return (
          <WalletItemButton
            key={a.toLowerCase()}
            name={shortAddr(a)}
            caption={exposed ? undefined : l.notExposed}
            isSelected={current}
            isConnecting={busy !== undefined && sameAddress(busy, a)}
            // The current account stays at full contrast (selected, not disabled); clicking it is a no-op. Busy = aria-disabled,
            // so focus never drops out of the list while a switch runs.
            disabled={!onSelect || busy !== undefined}
            ariaDisabled
            onClick={() => !current && busy === undefined && onSelect?.(a)}
            rightIcon={
              <span className="flex shrink-0 items-center gap-1">
                {signers.some((s) => sameAddress(s, a)) && <Badge variant="secondary">{l.signer}</Badge>}
                {isSession && <Badge variant="primary">{l.signedIn}</Badge>}
                {isActive && <Badge variant="positive">{l.active}</Badge>}
              </span>
            }
          />
        );
      })}
      </div>
      {(onChooseInWallet || onConnectOther) && (
        <div className={`${MODAL_PADDING} flex flex-wrap gap-2 py-3`}>
          {onChooseInWallet && (
            <Button size="sm" disabled={busy !== undefined} onClick={onChooseInWallet}>
              {l.chooseInWallet}
            </Button>
          )}
          {onConnectOther && (
            <Button size="sm" variant="ghost" disabled={busy !== undefined} onClick={onConnectOther}>
              {l.connectOther}
            </Button>
          )}
        </div>
      )}
    </ModalSection>
  );
}
