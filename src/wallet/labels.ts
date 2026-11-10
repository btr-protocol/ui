// Every string the wallet modals render, with their English defaults. An app translates by key: `labelsFrom(WALLET_MODAL_LABELS, t)`
// walks the keys, so the app never mirrors the list by hand.

export interface WalletModalLabels {
  title: string;
  searchPlaceholder: string;
  installed: string;
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
  yourWallets: string;
  moreWallets: string;
  wallets: string;
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
  anotherDevice: string;
  anotherDeviceQr: string;
  scanWithMobile: string;
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
  installed: 'Installed',
  thisBrowser: 'This browser',
  connectInBrowser: 'Connect {name} (this browser)',
  empty: 'No browser wallet detected.',
  navigate: 'Navigate',
  select: 'Select',
  close: 'Close',
  connectMobile: 'Connect a mobile wallet',
  otherWallets: 'Other wallets',
  preparing: 'Preparing connection...',
  yourWallets: 'Your wallets',
  moreWallets: 'More wallets',
  wallets: 'Wallets',
  lastUsed: 'Last used',
  opensInApp: 'Opens this page in the app',
  waitingFor: 'Waiting for {name}...',
  approveThere: 'Approve the connection there, then come back here.',
  openAgain: 'Open again',
  showQr: 'Show QR',
  cancel: 'Cancel',
  getWallet: 'Not installed? Get {name}',
  anotherDevice: 'Another device',
  anotherDeviceQr: 'Another device (QR code)',
  scanWithMobile: 'Scan with a mobile wallet',
  qrAlt: 'WalletConnect QR code',
  qrFailed: 'Could not generate the QR code.',
  qrLoading: 'Generating QR code...',
  copyLink: 'Copy link',
  copied: 'Copied',
  tryAgain: 'Try again',
  couldNotOpen: 'Could not open {name}. Install it, or use another device.',
  connectedViaWc: 'Connected via WalletConnect',
};

export interface AccountLabels {
  wallet: string;
  disconnect: string;
  copied: string;
  accounts: string;
  active: string;
  signedIn: string;
  signer: string;
  /** Opens the wallet's account picker. */
  chooseInWallet: string;
  connectOther: string;
  /** `{active}` / `{session}` = short addresses. */
  mismatch: string;
  /** `{addr}`. */
  switchTo: string;
  /** `{addr}`. */
  useInstead: string;
  /** Row caption of an account the wallet does not expose to this site. */
  notExposed: string;
}

export const ACCOUNT_LABELS: AccountLabels = {
  wallet: 'Wallet',
  disconnect: 'Disconnect',
  copied: 'Copied wallet address',
  accounts: 'Accounts',
  active: 'In wallet',
  signedIn: 'Signed in',
  signer: 'Signer',
  chooseInWallet: 'Choose account in wallet',
  connectOther: 'Connect another wallet',
  mismatch: 'Your wallet is on {active}, but you are signed in as {session}. Signing now would fail.',
  switchTo: 'Switch wallet to {addr}',
  useInstead: 'Use {addr} instead',
  notExposed: 'Not shared with this site: pick it in the wallet',
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
