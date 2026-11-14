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
  /** Row that opens the connect list to add or switch to another wallet. */
  connectOther: string;
  /** `{active}` / `{session}` = short addresses. */
  mismatch: string;
  /** `{addr}`. */
  switchTo: string;
  /** `{addr}`. */
  useInstead: string;
  /** Row caption of an account the wallet does not expose to this site. */
  notExposed: string;
  /** Row hints after a click on an account that could not be activated. `{addr}` = short address, `{wallet}` = wallet name. */
  hintRejected: string;
  hintNotShared: string;
  hintNone: string;
}

export const ACCOUNT_LABELS: AccountLabels = {
  wallet: 'Wallet',
  disconnect: 'Disconnect',
  copied: 'Copied wallet address',
  accounts: 'Accounts',
  active: 'In wallet',
  signedIn: 'Signed in',
  signer: 'Signer',
  connectOther: 'Add or switch wallet',
  mismatch: 'Your wallet is on {active}, but you are signed in as {session}. Signing now would fail.',
  switchTo: 'Switch wallet to {addr}',
  useInstead: 'Use {addr} instead',
  notExposed: 'Not in the connected wallet: select it to look for it',
  hintRejected: 'Request cancelled in {wallet}. Open it, select {addr} and share it with this site, then try again.',
  hintNotShared: '{addr} is not shared with this site. Open {wallet}, share it here, then try again.',
  hintNone: '{addr} is not available in any connected wallet. Open the wallet that holds it and connect it here.',
};

