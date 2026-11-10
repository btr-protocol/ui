// Launching a wallet app from the connect modal: WalletConnect deep links, in-wallet browser links and
// (inside a Capacitor shell) native install detection. Moved from the btr.markets front.
import { WALLETS, type WalletDef, browseLink, isMobile, wcLinks } from '@btr-protocol/sdk/eth/wallets';

/** Launch-relevant slice of a catalog row. */
type LinkWallet = Pick<WalletDef, 'id' | 'android' | 'scheme' | 'universal' | 'browse'>;

/** Native `WalletLink` plugin of an app shell (the front's Kotlin Capacitor plugin). */
export interface WalletLinkApi {
  installed(o: { packages: string[] }): Promise<{ installed: string[] }>;
  open(o: { package?: string; uri: string }): Promise<{ opened: boolean }>;
}

/** Running inside a Capacitor app shell (live at call time). */
export const isNative = (): boolean =>
  !!(globalThis as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.();

// Boxed: a Capacitor plugin proxy is thenable, so a promise resolving to it directly never settles.
let loadNative: (() => Promise<{ api: WalletLinkApi }>) | undefined;
let plugin: Promise<{ api: WalletLinkApi }> | undefined;
/** App shells register their native plugin loader once (the kit never imports Capacitor). */
export function configureWalletLinks(o: { native?: () => Promise<{ api: WalletLinkApi }> }): void {
  loadNative = o.native;
  plugin = undefined;
}
const native = (): Promise<{ api: WalletLinkApi }> => {
  if (!loadNative) return Promise.reject(new Error('no native wallet link'));
  return (plugin ??= loadNative());
};
const nativeOn = (): boolean => isNative() && !!loadNative;

/** Wallets the modal can launch on a phone: catalog rows with a Play package. Browse-only rows are
 *  dropped inside an app shell, whose `https://localhost` origin a wallet's browser cannot open. */
export const mobileWallets = (): WalletDef[] => WALLETS.filter((w) => w.android && !(w.browse && isNative()));

/** Modal order: last-used, then installed, then the rest, each in catalog order. */
export function orderWallets<T extends LinkWallet>(
  catalog: readonly T[],
  last: string | undefined,
  installed: readonly string[],
): { mine: T[]; popular: T[] } {
  const mine = [
    ...catalog.filter((w) => w.id === last),
    ...catalog.filter((w) => w.id !== last && installed.includes(w.id)),
  ];
  return { mine, popular: catalog.filter((w) => !mine.includes(w)) };
}

/** Ids of `catalog` rows whose Play package is in `packages`. */
export const pickInstalled = (catalog: readonly LinkWallet[], packages: readonly string[]): string[] =>
  catalog.filter((w) => w.android && packages.includes(w.android)).map((w) => w.id);

/** Installed wallets, detected natively. A browser cannot see installs, so on the web: `[]`;
 *  a failed native query degrades to the same (rows just lose their "Detected" badge). */
export async function installedWallets(catalog: readonly LinkWallet[]): Promise<string[]> {
  if (!nativeOn()) return [];
  try {
    const packages = catalog.flatMap((w) => w.android ?? []);
    return pickInstalled(catalog, (await (await native()).api.installed({ packages })).installed);
  } catch {
    return [];
  }
}

/** `link` as a browser navigation. Android Chrome routes a bare custom scheme to a chooser, so with a
 *  package it becomes an explicit intent (no `S.browser_fallback_url`: that would navigate the SPA
 *  away and drop the live pairing). https links pass through. */
export function webHref(
  link: string,
  pkg?: string,
  android = /Android/i.test(globalThis.navigator?.userAgent ?? ''),
): string {
  const i = link.indexOf(':');
  if (!pkg || !android || /^https?:/i.test(link) || i < 0) return link;
  return `intent:${link.slice(i + 1)}#Intent;scheme=${link.slice(0, i)};package=${pkg};end`;
}

/** Anchor `href` for a wallet row: the first launch link for pairing `uri`. */
export const walletHref = (w: LinkWallet, uri: string): string => webHref(wcLinks(w, uri)[0] ?? uri, w.android);

/** Anchor `href` for a browse-only wallet row. */
export const browseHref = (w: LinkWallet): string | undefined => {
  const link = browseLink(w, location.href);
  return link && webHref(link, w.android);
};

/** Try `links` in order. Native reports whether an app took it; a web navigation is unobservable,
 *  so it only ever tries the first (later tries would lose the click's user activation). */
async function launch(w: LinkWallet, links: string[]): Promise<boolean> {
  const [first] = links;
  if (first === undefined) return false;
  if (!nativeOn()) {
    location.href = webHref(first, w.android);
    return true;
  }
  const { api } = await native();
  for (const uri of links) if ((await api.open({ package: w.android, uri })).opened) return true;
  return false;
}

/** Open the wallet on the WalletConnect pairing `uri`. Call synchronously from a click handler. */
export const openWallet = (w: LinkWallet, uri: string): Promise<boolean> => launch(w, wcLinks(w, uri));

/** Connected wallet's catalog row, if it has an app this device can foreground (phones only: a
 *  desktop browser cannot launch one). */
export const appWallet = (id?: string): WalletDef | undefined =>
  isNative() || isMobile() ? WALLETS.find((w) => w.id === id && (w.android || w.scheme || w.universal)) : undefined;

/** Foreground the wallet app with NO pairing (a pending signature is already in it): the bare
 *  scheme root (`metamask://`), else the universal link's origin. Call from a click handler. */
export const foregroundWallet = (w: LinkWallet): Promise<boolean> => {
  const link = w.scheme ? w.scheme.slice(0, w.scheme.indexOf('//') + 2) : w.universal && new URL(w.universal).origin;
  return link ? launch(w, [link]) : Promise.resolve(false);
};

/** Open this dapp inside the wallet's own browser (wallets with no WalletConnect pairing). */
export const openInWallet = (w: LinkWallet): Promise<boolean> => {
  const link = browseLink(w, location.href);
  return link ? launch(w, [link]) : Promise.resolve(false);
};
