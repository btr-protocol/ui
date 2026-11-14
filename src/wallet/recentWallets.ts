// Wallets this browser connected with before: the "Recent" section of the connect modal. Per browser only (localStorage),
// no address, no secret: an id (EIP-6963 rdns, catalog id, or 'walletconnect'), the display name, a timestamp and a use
// count. Storage that is blocked or corrupt reads as empty and a failed write is dropped.
export const RECENT_KEY = 'btr-wallets-recent';
/** Rows kept in storage (the modal shows `RECENT_SHOWN`; the rest cover a wallet that is gone right now). */
export const RECENT_KEPT = 8;
export const RECENT_SHOWN = 3;
/** Stored ids are short rdns / catalog ids; a name is wallet-announced text, clamped on write and on read. */
const ID_RE = /^[a-z0-9._:-]{1,64}$/;
const NAME_MAX = 40;

export interface RecentWallet {
  /** EIP-6963 rdns when announced, else the catalog id, else 'walletconnect'. */
  id: string;
  name: string;
  via: 'injected' | 'walletconnect';
  /** Epoch ms of the last connection. */
  last: number;
  uses: number;
}

type Entry = Pick<RecentWallet, 'id' | 'name' | 'via'>;

/** Most recent first, ties by use count, then id (stable). */
export const rankRecent = (list: readonly RecentWallet[]): RecentWallet[] =>
  [...list].sort((a, b) => b.last - a.last || b.uses - a.uses || a.id.localeCompare(b.id));

/** `list` after one more connection with `w` at `now`: bumped or added, ranked, capped. Pure. */
export function noteUse(list: readonly RecentWallet[], w: Entry, now: number): RecentWallet[] {
  const id = w.id.toLowerCase(); // rdns is case-insensitive in practice
  if (!ID_RE.test(id)) return [...list];
  const prev = list.find((r) => r.id === id);
  const next: RecentWallet = { id, name: w.name.slice(0, NAME_MAX), via: w.via, last: now, uses: (prev?.uses ?? 0) + 1 };
  return rankRecent([...list.filter((r) => r.id !== id), next]).slice(0, RECENT_KEPT);
}

const isRecent = (r: unknown): r is RecentWallet => {
  const x = r as Partial<RecentWallet> | null;
  return (
    !!x &&
    typeof x.id === 'string' &&
    ID_RE.test(x.id) &&
    typeof x.name === 'string' &&
    (x.via === 'injected' || x.via === 'walletconnect') &&
    Number.isFinite(x.last) &&
    Number.isFinite(x.uses)
  );
};

/** Stored recents, ranked; `[]` when storage is blocked, empty or not ours. */
export function readRecent(): RecentWallet[] {
  try {
    const raw = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') as unknown;
    if (!Array.isArray(raw)) return [];
    const seen = new Set<string>();
    return rankRecent(
      raw.filter(isRecent).map((r) => ({ id: r.id, name: r.name.slice(0, NAME_MAX), via: r.via, last: r.last, uses: r.uses })),
    )
      .filter((r) => !seen.has(r.id) && !!seen.add(r.id))
      .slice(0, RECENT_KEPT);
  } catch {
    return [];
  }
}

const write = (list: RecentWallet[]) => {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch {}
};

/** Remember a connection; returns the new list (unchanged on a failed write the in-memory list still ranks right). */
export function recordRecent(w: Entry, now = Date.now()): RecentWallet[] {
  const next = noteUse(readRecent(), w, now);
  write(next);
  return next;
}

/** Forget one entry (the row's Remove button); returns the new list. */
export function removeRecent(id: string): RecentWallet[] {
  const next = readRecent().filter((r) => r.id !== id);
  write(next);
  return next;
}

/** The entry a connected wallet leaves behind: its rdns when it announced one, else its catalog id ('walletconnect' for a bare pairing). */
export const recentEntry = (w: { id: string; name: string; rdns?: string }, via: Entry['via']): Entry => ({
  id: w.rdns || w.id,
  name: w.name,
  via,
});

// Which wallet exposed which account to this site: lets a click on an account that lives in ANOTHER wallet find it. Per browser only
// (localStorage), exactly what the wallets already told this page via eth_accounts: address <-> wallet id, newest first, capped.
export const WALLET_ACCOUNTS_KEY = 'btr-wallet-accounts';
const ACCOUNTS_KEPT = 32;
const ADDR_RE = /^0x[0-9a-f]{40}$/;
type AccountOwner = [address: string, id: string];

const readOwners = (): AccountOwner[] => {
  try {
    const raw = JSON.parse(localStorage.getItem(WALLET_ACCOUNTS_KEY) ?? '[]') as unknown;
    return Array.isArray(raw)
      ? raw.filter((r): r is AccountOwner => Array.isArray(r) && typeof r[0] === 'string' && ADDR_RE.test(r[0]) && typeof r[1] === 'string' && ID_RE.test(r[1])).slice(0, ACCOUNTS_KEPT)
      : [];
  } catch {
    return [];
  }
};

/** Remember that wallet `id` (its rdns / catalog id) exposed `accounts`; a newer answer for an address replaces the older one. */
export function rememberAccounts(id: string | undefined, accounts: readonly string[]): void {
  const w = id?.toLowerCase();
  if (!w || !ID_RE.test(w)) return;
  const mine = accounts.map((a) => a.toLowerCase()).filter((a) => ADDR_RE.test(a));
  if (!mine.length) return;
  try {
    const next: AccountOwner[] = [...mine.map((a): AccountOwner => [a, w]), ...readOwners().filter(([a]) => !mine.includes(a))].slice(0, ACCOUNTS_KEPT);
    localStorage.setItem(WALLET_ACCOUNTS_KEY, JSON.stringify(next));
  } catch {}
}

/** The id of the wallet that last exposed `address`, if this browser saw one. */
export const walletOf = (address?: string | null): string | undefined =>
  address ? readOwners().find(([a]) => a === address.toLowerCase())?.[1] : undefined;
