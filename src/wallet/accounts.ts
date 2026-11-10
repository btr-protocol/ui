// Account primitives, store-free (the kit store in ./wallet syncs on top of them): an app with its own wallet state imports these alone.
import type { Address } from '../lib/address';
import type { Eip1193Provider } from './wallet';

// Local, not lib/address: that module pulls a keccak implementation into every entry that only needs these.
const isAddress = (v: string): v is Address => /^0x[a-fA-F0-9]{40}$/.test(v);

export const sameAddress = (a?: string | null, b?: string | null): boolean =>
  !!a && !!b && a.toLowerCase() === b.toLowerCase();

/** Valid, deduped addresses of an `eth_accounts`-shaped answer; the wallet's ACTIVE account is first. */
export function accountList(v: unknown): Address[] {
  const out: Address[] = [];
  for (const a of Array.isArray(v) ? v : [])
    if (typeof a === 'string' && isAddress(a) && !out.some((x) => sameAddress(x, a))) out.push(a);
  return out;
}

/** The accounts this site may use, active first (`eth_accounts`: never prompts). */
export async function readAccounts(p: Eip1193Provider): Promise<Address[]> {
  return accountList(await p.request({ method: 'eth_accounts' }));
}

/** True when the wallet's active account is known and is not `expected` (the session / the signer the app asked for). */
export const accountMismatch = (active?: string | null, expected?: string | null): boolean =>
  !!active && !!expected && !sameAddress(active, expected);

/** The wallet would sign as `active`, not `expected`: refused before the wallet is ever asked. */
export class WrongAccountError extends Error {
  readonly active?: Address;
  readonly expected: string;
  constructor(expected: string, active?: Address) {
    super(
      active
        ? `Your wallet is on ${active}, not ${expected}. Switch the account in your wallet, then try again.`
        : `Your wallet exposes no account. Unlock it and select ${expected}.`,
    );
    this.name = 'WrongAccountError';
    this.expected = expected;
    this.active = active;
  }
}

/** Open the wallet's own account picker (`wallet_requestPermissions`, MetaMask / Rabby and most extensions) and return the accounts it
 *  then exposes, active first. A wallet without that method (WalletConnect peers) falls back to `eth_requestAccounts`, which only
 *  re-reads: the user switches inside the wallet app and `accountsChanged` follows. */
export async function requestAccountPicker(p: Eip1193Provider): Promise<Address[]> {
  try {
    await p.request({ method: 'wallet_requestPermissions', params: [{ eth_accounts: {} }] });
  } catch (e) {
    if ((e as { code?: number })?.code === 4001) throw e; // the user closed the picker
  }
  return accountList(await p.request({ method: 'eth_requestAccounts' }));
}

/** Make `target` the wallet's active account: already active -> true; else the wallet's picker, then re-check. */
export async function requestAccountSwitch(p: Eip1193Provider, target: string): Promise<boolean> {
  if (sameAddress((await readAccounts(p))[0], target)) return true;
  return sameAddress((await requestAccountPicker(p))[0], target);
}
