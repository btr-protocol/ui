// The account / wrong-account strings, apart from the connect modal's: an app shell that only words a wrong-account toast imports
// these without the modal's ~1.5 kB of copy.

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

