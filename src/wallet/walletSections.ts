// What the disconnected connect modal lists and in which order: Recent, Installed, (WalletConnect), Other. Pure: the modal
// feeds it the detected wallets and the stored recents, so ordering and dedup are testable without a DOM.
import { WALLETS, type WalletDef, browseLink, walletId } from '@btr-protocol/sdk/eth/wallets';
import { type RecentWallet, RECENT_SHOWN, rankRecent } from './recentWallets';

/** Popular wallets offered for install, in this order (the btr.markets "Discover" list), none that this browser already has. */
export const OTHER_IDS = ['metamask', 'rabby', 'base', 'rainbow', 'trust', 'phantom', 'okx'] as const;
export const OTHER_MAX = 5;

interface Detected {
  id: string;
  rdns?: string;
}

/** Does the stored recent id (an rdns or a catalog id) name this detected wallet? */
export const isSameWallet = (recentId: string, w: Detected): boolean => recentId === w.rdns || recentId === w.id;

const catalogOf = (id: string): WalletDef | undefined => {
  const cid = walletId(id);
  return WALLETS.find((w) => w.id === id || w.id === cid || w.rdns === id);
};

export interface RecentRow<W extends Detected> {
  recent: RecentWallet;
  /** The live wallet to connect with, or undefined for a WalletConnect recent. */
  wallet?: W;
}

export interface WalletSections<W extends Detected> {
  /** Max RECENT_SHOWN, each reachable now: detected here, or a WalletConnect session path (`wcOn`). */
  recent: RecentRow<W>[];
  /** Detected wallets not under Recent. */
  installed: W[];
  /** Install rows, max OTHER_MAX: recents that can no longer be reached first, then popular wallets this browser lacks. */
  other: WalletDef[];
}

export function sectionWallets<W extends Detected>(o: {
  injected: readonly W[];
  recents: readonly RecentWallet[];
  /** WalletConnect is configured: a WalletConnect recent can be reached. */
  wcOn: boolean;
  /** Catalog ids of apps installed on this device (native shells), never offered for install. */
  nativeIds?: readonly string[];
}): WalletSections<W> {
  const { injected, wcOn, nativeIds = [] } = o;
  const recent: RecentRow<W>[] = [];
  const lost: WalletDef[] = [];
  for (const r of rankRecent(o.recents)) {
    const wallet = injected.find((w) => isSameWallet(r.id, w));
    if (wallet || (r.via === 'walletconnect' && wcOn)) {
      if (recent.length < RECENT_SHOWN && !(wallet && recent.some((x) => x.wallet === wallet))) recent.push({ recent: r, wallet });
    } else {
      const def = catalogOf(r.id);
      if (def && !lost.includes(def)) lost.push(def);
    }
  }
  const listed = new Set(recent.flatMap((x) => (x.wallet ? [x.wallet] : [])));
  const installed = injected.filter((w) => !listed.has(w));
  const have = (d: WalletDef) => nativeIds.includes(d.id) || injected.some((w) => w.id === d.id || (!!d.rdns && w.rdns === d.rdns));
  const popular = OTHER_IDS.flatMap((id) => WALLETS.find((w) => w.id === id) ?? []);
  const other = [...lost, ...popular.filter((d) => !lost.includes(d))].filter((d) => !have(d)).slice(0, OTHER_MAX);
  return { recent, installed, other };
}

/** Where an "Other" row goes: the wallet's official page; on a phone its universal link (opens the app, else the store) or in-app browser. */
export function otherHref(w: WalletDef, mobile: boolean, page: string): { href: string; deepLink: boolean } {
  if (mobile) {
    const link = browseLink(w, page) ?? (w.universal && new URL(w.universal).origin);
    if (link) return { href: link, deepLink: true };
  }
  return { href: w.url, deepLink: false };
}
