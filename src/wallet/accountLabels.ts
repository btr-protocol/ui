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
  /** Row hints after a click on an account that could not be activated. `{addr}` = short address, `{wallet}` = the wallet's announced
   *  name (named once), `{action}` = the `connectOther` label. */
  hintRejected: string;
  hintNotShared: string;
  hintAmbiguous: string;
  /** The app's own step after the switch failed; the previous wallet is back. */
  hintFailed: string;
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
  hintRejected: 'Request cancelled in {wallet}. Select {addr} there, share it with this site, then try again.',
  hintNotShared: '{wallet} does not share {addr} with this site. Select it there, then try again.',
  hintAmbiguous: '{addr} may be in another installed wallet. Choose that wallet with "{action}", then select the account.',
  hintFailed: 'Could not switch to {addr}. The previous wallet is back. Try again.',
};

