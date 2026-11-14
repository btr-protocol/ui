// Account switching for the wallet/session modal and the wrong-account gate in front of a signature.
// "Active" = the account the wallet signs with right now; "session" = the account the app is signed in as (SIWE) or
// expects; "signer" = an owner of the Safe in view. The wallet only ever signs as its active account, so a switch is
// made IN the wallet (its account picker) and the app follows its `accountsChanged`.
import type { ComponentChildren } from 'preact';
import { shortAddr } from '../lib/address';
import { ModalSection } from '../ui/BaseModal';
import { Badge } from '../ui/Badge';
import { WalletItemButton } from '../ui/WalletItemButton';
import { WalletTile } from './WalletGlyph';
import { ACCOUNT_LABELS, type AccountLabels } from './accountLabels';
import { accountMismatch, sameAddress } from './wallet';

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
  onConnectOther?: () => void;
  busy?: string;
  labels?: Partial<AccountLabels>;
  /** `Notice size="row"` items listed above the accounts, in the same list. */
  notices?: ComponentChildren;
}

/** Every account of the connected wallet (plus the session's), one click each; badges say which is active, signed in, a signer. */
export function AccountList({ accounts, active, session, signers = [], onSelect, onConnectOther, busy, labels, notices }: AccountListProps) {
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
      {notices && <ul className="m-0 list-none p-0">{notices}</ul>}
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
            // The current account (or any row with nothing to do) is a plain row: no hover, pointer or focus stop. Busy = aria-disabled,
            // so focus never drops out of the list while a switch runs.
            inert={current || !onSelect}
            disabled={busy !== undefined}
            ariaDisabled
            onClick={() => busy === undefined && onSelect?.(a)}
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
      {onConnectOther && (
        <WalletItemButton
          name={l.connectOther}
          icon={<WalletTile icon="plus" />}
          disabled={busy !== undefined}
          ariaDisabled
          onClick={() => busy === undefined && onConnectOther()}
        />
      )}
      </div>
    </ModalSection>
  );
}
