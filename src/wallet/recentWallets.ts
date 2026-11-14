// Wallets this browser connected with before: the "Recent" section of the connect modal. Per browser only (localStorage),
// no address, no secret: an id (EIP-6963 rdns, catalog id, or 'walletconnect'), the display name, the announced icon, a
// timestamp and a use count. Storage that is blocked or corrupt reads as empty and a failed write is dropped.
export const RECENT_KEY = 'btr-wallets-recent';
/** Rows kept in storage (the modal shows `RECENT_SHOWN`; the rest cover a wallet that is gone right now). */
export const RECENT_KEPT = 8;
export const RECENT_SHOWN = 3;
/** A wallet's announced icon is a data URI of unbounded size: stored only when small. */
const ICON_MAX = 4096;

export interface RecentWallet {
  /** EIP-6963 rdns when announced, else the catalog id, else 'walletconnect'. */
  id: string;
  name: string;
  icon?: string;
  via: 'injected' | 'walletconnect';
  /** Epoch ms of the last connection. */
  last: number;
  uses: number;
}

type Entry = Pick<RecentWallet, 'id' | 'name' | 'icon' | 'via'>;

/** Most recent first, ties by use count, then id (stable). */
export const rankRecent = (list: readonly RecentWallet[]): RecentWallet[] =>
  [...list].sort((a, b) => b.last - a.last || b.uses - a.uses || a.id.localeCompare(b.id));

/** `list` after one more connection with `w` at `now`: bumped or added, ranked, capped. Pure. */
export function noteUse(list: readonly RecentWallet[], w: Entry, now: number): RecentWallet[] {
  const prev = list.find((r) => r.id === w.id);
  const icon = w.icon && w.icon.length <= ICON_MAX ? w.icon : undefined;
  const next: RecentWallet = { ...w, icon, last: now, uses: (prev?.uses ?? 0) + 1 };
  return rankRecent([...list.filter((r) => r.id !== w.id), next]).slice(0, RECENT_KEPT);
}

const isRecent = (r: unknown): r is RecentWallet => {
  const x = r as Partial<RecentWallet> | null;
  return (
    !!x &&
    typeof x.id === 'string' &&
    x.id.length > 0 &&
    typeof x.name === 'string' &&
    (x.via === 'injected' || x.via === 'walletconnect') &&
    Number.isFinite(x.last) &&
    Number.isFinite(x.uses) &&
    (x.icon === undefined || typeof x.icon === 'string')
  );
};

/** Stored recents, ranked; `[]` when storage is blocked, empty or not ours. */
export function readRecent(): RecentWallet[] {
  try {
    const raw = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') as unknown;
    return Array.isArray(raw) ? rankRecent(raw.filter(isRecent)).slice(0, RECENT_KEPT) : [];
  } catch {
    return [];
  }
}

/** Remember a connection; returns the new list (unchanged on a failed write the in-memory list still ranks right). */
export function recordRecent(w: Entry, now = Date.now()): RecentWallet[] {
  const next = noteUse(readRecent(), w, now);
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {}
  return next;
}

/** The entry a connected wallet leaves behind: its rdns when it announced one, else its catalog id ('walletconnect' for a bare pairing). */
export const recentEntry = (w: { id: string; name: string; rdns?: string; icon?: string }, via: Entry['via']): Entry => ({
  id: w.rdns || w.id,
  name: w.name,
  icon: w.icon,
  via,
});
