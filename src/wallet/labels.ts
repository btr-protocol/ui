// Every string the wallet modals render, with their English defaults. An app translates by key: `labelsFrom(WALLET_MODAL_LABELS, t)`
// walks the keys, so the app never mirrors the list by hand. Account strings: ./accountLabels (light: an app shell imports them).

export interface WalletModalLabels {
  title: string;
  searchPlaceholder: string;
  /** Section headings. */
  recent: string;
  installed: string;
  walletConnect: string;
  other: string;
  /** Caption of an Other row; on a phone, where the row opens the wallet's app, `open`. */
  install: string;
  open: string;
  /** Heading of the list when nothing else can connect (no injected wallet, no WalletConnect). */
  installWallet: string;
  /** Appended to the accessible name of a link that opens a new tab. */
  newTab: string;
  /** Accessible name of a Recent row's remove button; `{name}` = the wallet. */
  removeRecent: string;
  /** Caption of a recent wallet reached through WalletConnect. */
  viaWalletConnect: string;
  qrCaption: string;
  appsCaption: string;
  thisBrowser: string;
  /** `{name}` = the wallet. */
  connectInBrowser: string;
  empty: string;
  navigate: string;
  select: string;
  close: string;
  connectMobile: string;
  otherWallets: string;
  preparing: string;
  lastUsed: string;
  opensInApp: string;
  /** `{name}` = the wallet. */
  waitingFor: string;
  approveThere: string;
  openAgain: string;
  showQr: string;
  cancel: string;
  /** `{name}` = the wallet. */
  getWallet: string;
  anotherDeviceQr: string;
  qrAlt: string;
  qrFailed: string;
  qrLoading: string;
  copyLink: string;
  copied: string;
  tryAgain: string;
  /** `{name}` = the wallet. */
  couldNotOpen: string;
  connectedViaWc: string;
}

export const WALLET_MODAL_LABELS: WalletModalLabels = {
  title: 'Connect wallet',
  searchPlaceholder: 'Search wallets...',
  recent: 'Recent',
  installed: 'Installed',
  walletConnect: 'WalletConnect',
  other: 'Other',
  install: 'Install',
  open: 'Open',
  installWallet: 'Install a wallet',
  newTab: '(opens in a new tab)',
  removeRecent: 'Remove {name} from recent wallets',
  viaWalletConnect: 'WalletConnect',
  qrCaption: 'Scan a QR code with your phone',
  appsCaption: 'Open a wallet app',
  thisBrowser: 'This browser',
  connectInBrowser: 'Connect {name} (this browser)',
  empty: 'No browser wallet detected.',
  navigate: 'Navigate',
  select: 'Select',
  close: 'Close',
  connectMobile: 'Mobile wallet',
  otherWallets: 'Wallet apps',
  preparing: 'Preparing connection...',
  lastUsed: 'Last used',
  opensInApp: 'Opens this page in the app',
  waitingFor: 'Waiting for {name}...',
  approveThere: 'Approve the connection there, then come back here.',
  openAgain: 'Open again',
  showQr: 'Show QR',
  cancel: 'Cancel',
  getWallet: 'Not installed? Get {name}',
  anotherDeviceQr: 'Another device (QR code)',
  qrAlt: 'WalletConnect QR code',
  qrFailed: 'Could not generate the QR code.',
  qrLoading: 'Generating QR code...',
  copyLink: 'Copy link',
  copied: 'Copied',
  tryAgain: 'Try again',
  couldNotOpen: 'Could not open {name}. Install it, or use another device.',
  connectedViaWc: 'Connected via WalletConnect',
};

/** `defaults` with each key passed through `t` (a missing translation = undefined keeps the default). */
export function labelsFrom<T extends object>(defaults: T, t: (key: keyof T & string) => string | undefined): T {
  const out = { ...defaults };
  for (const k of Object.keys(defaults) as (keyof T & string)[]) {
    const v = t(k);
    if (v) (out as Record<string, unknown>)[k] = v;
  }
  return out;
}

export { ACCOUNT_LABELS, type AccountLabels } from './accountLabels';
