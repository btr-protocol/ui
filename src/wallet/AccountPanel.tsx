// Account switching for the wallet/session modal and the wrong-account gate in front of a signature.
// "Active" = the account the wallet signs with right now; "session" = the account the app is signed in as (SIWE) or
// expects; "signer" = an owner of the Safe in view. The wallet only ever signs as its active account, so a switch is
// made IN the wallet (its account picker) and the app follows its `accountsChanged`.
import type { ComponentChildren } from 'preact';
import { shortAddr } from '../lib/address';
import { SEVERITY_COLOR, SEVERITY_ICON } from '../lib/severity';
import { ModalSection } from '../ui/BaseModal';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { Notice } from '../ui/Feedback';
import { WalletItemButton } from '../ui/WalletItemButton';
import { WalletTile } from './WalletGlyph';
import { ACCOUNT_LABELS, type AccountLabels } from './accountLabels';
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

/** A message as a ROW of the account list: the surface, edges, padding and divider of an account row, the tone's glyph in the icon
 *  column, wrapping text, and the row's actions below the text (kit `Button`s). Tone = the kit's semantic colour. */
export function AccountNoticeRow({
  tone,
  role,
  children,
  actions,
}: {
  tone: 'warning' | 'error' | 'info';
  role?: 'alert' | 'status';
  children: ComponentChildren;
  actions?: ComponentChildren;
}) {
  const color = SEVERITY_COLOR[tone];
  return (
    <div
      className="flex w-full items-start gap-3 border-b border-border bg-bg-2 px-3 py-3 font-title text-sm leading-5 text-fg-1"
      style={{ backgroundColor: `color-mix(in srgb, ${color} 8%, var(--bg-2))` }}
    >
      <Icon name={SEVERITY_ICON[tone]} className="h-5 w-5 shrink-0" style={{ color }} />
      <div className="min-w-0 flex-1">
        <div role={role}>{children}</div>
        {actions && <div className="mt-2 flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
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
  onConnectOther?: () => void;
  busy?: string;
  labels?: Partial<AccountLabels>;
  /** Rows (`AccountNoticeRow`) listed above the accounts, in the same list. */
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
      {notices}
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
