// Make an account the active one, wherever it lives. The connected wallet can only sign as ITS accounts, so an account that belongs
// to another installed wallet is reached by making that wallet the connected one. Generic: every announced EIP-6963 provider is
// probed with the prompt-free `eth_accounts`; a request (which may prompt) is only ever sent on a user's click, to one wallet.
// Nothing here trusts an address beyond display: the app's signature-based sign-in still proves who the user is.
import type { Address } from '../lib/address';
import { requestAccountPicker, sameAddress } from './accounts';
import { rememberAccounts, walletOf } from './recentWallets';
import { isWalletConnectProvider } from './walletConnectShell';
import {
  type Eip1193Provider,
  type ProviderEntry,
  type ProviderInfo,
  accountList,
  adoptWallet,
  discoverProviders,
  walletEntry,
} from './wallet';

/** `rejected`: the user closed the wallet's prompt; `not-shared`: the wallet answered but does not expose the account to this
 *  site; `none`: no wallet we can reach has it; `cancelled`: the caller aborted (modal closed), nothing to show. */
export type ActivateResult =
  | { ok: true; entry: ProviderEntry; accounts: Address[] }
  | { ok: false; reason: 'rejected' | 'not-shared' | 'none' | 'cancelled'; wallet?: ProviderInfo };

export interface ActivateOptions {
  /** Announced wallets to search (default: EIP-6963 discovery). */
  entries?: readonly ProviderEntry[];
  /** Aborts every wait; nothing is bound afterwards. */
  signal?: AbortSignal;
  /** Per-provider limit of the silent probe (default 3000 ms). */
  probeMs?: number;
}

const idOf = (e: ProviderEntry) => (e.info.rdns ?? e.info.id ?? '').toLowerCase();
const isRejection = (e: unknown) => (e as { code?: number })?.code === 4001;
const aborted = () => Object.assign(new Error('aborted'), { name: 'AbortError' });

/** `p` settled unless `signal` aborts first. */
const unlessAborted = <T>(p: Promise<T>, signal?: AbortSignal): Promise<T> =>
  signal
    ? new Promise<T>((res, rej) => {
        if (signal.aborted) return rej(aborted());
        const stop = () => rej(aborted());
        signal.addEventListener('abort', stop, { once: true });
        p.then(res, rej).finally(() => signal.removeEventListener('abort', stop));
      })
    : p;

/** The silent `eth_accounts` of one provider: its accounts, or null when it throws, never answers within `ms`, or aborts. */
async function probe(p: Eip1193Provider, ms: number, signal?: AbortSignal): Promise<Address[] | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const limit = new Promise<null>((res) => {
    timer = setTimeout(() => res(null), ms);
  });
  try {
    return await unlessAborted(Promise.race([p.request({ method: 'eth_accounts' }).then(accountList, () => null), limit]), signal);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Click on an account: find the wallet that holds `target` and make it, with that account, the connected wallet.
 *  1. Silent probe of the connected wallet and every other announced one, in parallel (a WalletConnect session is one provider: no probe).
 *  2. A wallet that already exposes it: becomes the connected wallet, no prompt. If it is not that wallet's active account, its own
 *     account picker opens (a wallet signs only as its active account; EIP-1193 has no silent "set active").
 *  3. None does: the remembered wallet of that address (else the only other wallet) is asked, `eth_requestAccounts` then its picker,
 *     so the user can share the account. With no other wallet the connected one's picker opens (multi-account wallets).
 *  4. Refused / still not shared / nobody to ask: a reason the panel shows as a row, never a silent no-op.
 */
export async function activateAccount(target: string, o: ActivateOptions = {}): Promise<ActivateResult> {
  const cur = walletEntry.peek();
  if (!cur) return { ok: false, reason: 'none' };
  const { signal } = o;
  try {
    const wc = isWalletConnectProvider(cur.provider);
    const ms = o.probeMs ?? 3000;
    // All probes run at once: the connected wallet's, and (once discovery answered) every other announced wallet's.
    let settled = false;
    const liveP = probe(cur.provider, ms, signal);
    const foundP: Promise<readonly ProviderEntry[]> = wc ? Promise.resolve([]) : o.entries ? Promise.resolve(o.entries) : unlessAborted(discoverProviders(), signal);
    const othersP = foundP.then(async (found): Promise<[ProviderEntry[], (Address[] | null)[]]> => {
      const others = found.filter((e) => e.provider !== cur.provider);
      return settled ? [[], []] : [others, await Promise.all(others.map((e) => probe(e.provider, ms, signal)))];
    });
    othersP.catch(() => {}); // an abort rejects both; the awaited one reports it
    // Already the connected wallet's ACTIVE account (live read): nothing to search, nothing to prompt.
    const live = await liveP;
    if (live && sameAddress(live[0], target) && !signal?.aborted) {
      settled = true;
      rememberAccounts(idOf(cur), live);
      await adoptWallet(cur, live);
      return { ok: true, entry: cur, accounts: live };
    }
    const [more, moreSeen] = await othersP;
    const all = [cur, ...more];
    const seen = [live, ...moreSeen];
    all.forEach((e, i) => seen[i] && rememberAccounts(idOf(e), seen[i]));
    const bind = async (entry: ProviderEntry, accounts: Address[]): Promise<ActivateResult> => {
      if (signal?.aborted) return { ok: false, reason: 'cancelled' };
      await adoptWallet(entry, accounts);
      return { ok: true, entry, accounts };
    };
    // Ask `entry` for the account: its authorised list first, then its picker; the account must end up ACTIVE.
    const ask = async (entry: ProviderEntry, list: Address[] | null): Promise<ActivateResult> => {
      try {
        let accounts = list ?? accountList(await unlessAborted(entry.provider.request({ method: 'eth_requestAccounts' }), signal));
        if (!sameAddress(accounts[0], target)) accounts = await unlessAborted(requestAccountPicker(entry.provider), signal);
        rememberAccounts(idOf(entry), accounts);
        return sameAddress(accounts[0], target) ? await bind(entry, accounts) : { ok: false, reason: 'not-shared', wallet: entry.info };
      } catch (e) {
        if ((e as Error)?.name === 'AbortError') throw e;
        return { ok: false, reason: isRejection(e) ? 'rejected' : 'not-shared', wallet: entry.info };
      }
    };

    const holds = all.map((_, i) => !!seen[i]?.some((a) => sameAddress(a, target)));
    const hit = all.findIndex((_, i) => holds[i] && sameAddress(seen[i]?.[0], target));
    const any = hit >= 0 ? hit : holds.indexOf(true);
    if (any >= 0) return await ask(all[any], seen[any]);

    const others = all.filter((e) => e !== cur);
    const remembered = walletOf(target);
    const likely = (remembered && all.find((e) => idOf(e) === remembered)) || (others.length === 1 ? others[0] : undefined);
    if (likely) return await ask(likely, null);
    if (others.length === 0) return await ask(cur, null);
    return { ok: false, reason: 'none' };
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') return { ok: false, reason: 'cancelled' };
    return { ok: false, reason: 'none' };
  }
}
