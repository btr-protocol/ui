// Make an account the active one, wherever it lives. The connected wallet can only sign as ITS accounts, so an account that belongs
// to another installed wallet is reached by making that wallet the connected one. Generic: every announced EIP-6963 provider is probed
// with the prompt-free `eth_accounts`; a request (which may prompt) only ever goes out on a user's click, to ONE wallet, and only when
// the choice is unambiguous. Nothing here trusts an address beyond display: the app's signature-based sign-in still proves who the user is.
import type { Address } from '../lib/address';
import { requestAccountPicker, sameAddress } from './accounts';
import { readRecent } from './recentWallets';
import { isWalletConnectProvider } from './walletConnectShell';
import {
  type Eip1193Provider,
  type ProviderEntry,
  type ProviderInfo,
  accountList,
  adoptWallet,
  disconnectWallet,
  discoverProviders,
  lastWallet,
  restoreLastWallet,
  walletAccounts,
  walletEntry,
  walletGeneration,
} from './wallet';

/** `rejected`: the user closed the wallet's prompt; `not-shared`: the wallet answered but does not expose the account to this site (or
 *  did not keep it); `ambiguous`: no single wallet can be chosen, so none is bound (the user picks one in "Add or switch wallet");
 *  `failed`: the wallet could not be confirmed after binding (no answer to the re-read), so the previous wallet was put back;
 *  `cancelled`: superseded, aborted or the wallet state changed under us, nothing was bound and there is nothing to show. */
export type ActivateFailure = 'rejected' | 'not-shared' | 'ambiguous' | 'failed' | 'cancelled';
export type ActivateResult =
  | {
      ok: true;
      entry: ProviderEntry;
      accounts: Address[];
      /** Put the previous connected wallet back (the app's own step after the switch failed). A no-op unless this activation is still the
       *  connected wallet, and for an account change inside the same wallet (the wallet itself holds that state). */
      undo: () => Promise<void>;
    }
  | { ok: false; reason: ActivateFailure; wallet?: ProviderInfo };

export interface ActivateOptions {
  /** Announced wallets to search (default: EIP-6963 discovery). */
  entries?: readonly ProviderEntry[];
  /** Aborts every wait; nothing is bound afterwards. */
  signal?: AbortSignal;
  /** Per-provider limit of the silent probe (default 3000 ms). */
  probeMs?: number;
}

const keyOf = (e: ProviderEntry) => (e.info.rdns || e.info.id || e.info.uuid || '').toLowerCase();
const isRejection = (e: unknown) => (e as { code?: number })?.code === 4001;
const aborted = () => Object.assign(new Error('aborted'), { name: 'AbortError' });
const isAbort = (e: unknown) => (e as Error)?.name === 'AbortError';

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

/** The newest activation wins: an older one that is still awaiting binds nothing. */
let latest = 0;

/**
 * Click on an account: find the wallet that holds `target` and make it, with that account, the connected wallet.
 *  1. Already the connected wallet's ACTIVE account (live read): done, nothing else is touched.
 *  2. Silent probe of every other announced wallet, in parallel (a WalletConnect session is one provider: no search).
 *  3. Exactly ONE wallet exposes it (and its rdns is announced once): that wallet. Several do, a rdns is announced twice, or the
 *     candidates cannot be told apart: nothing is bound (`ambiguous`), never the first match. If it is authorised but not that wallet's
 *     active account, its own picker opens (EIP-1193 has no silent "set active").
 *  4. Nobody exposes it: with no other wallet the connected one's picker opens (multi-account wallets); with exactly one other wallet it
 *     gets `eth_requestAccounts`, then its picker; with several, `ambiguous`.
 *  5. Bind only if nothing changed meanwhile (disconnect, `accountsChanged`, a newer click, abort); then re-read `eth_accounts` on the
 *     bound provider: its first account must be `target`, else the previous wallet is restored (`not-shared`). That re-read is the
 *     last step before the caller's own step.
 */
export async function activateAccount(target: string, o: ActivateOptions = {}): Promise<ActivateResult> {
  const cur = walletEntry.peek();
  if (!cur) return { ok: false, reason: 'not-shared' };
  const { signal } = o;
  const ms = o.probeMs ?? 3000;
  const mine = ++latest;
  const gen = walletGeneration();
  const before = { entry: cur, accounts: [...walletAccounts.peek()] };
  const stale = (sameWallet = false) =>
    mine !== latest ||
    !!signal?.aborted ||
    walletEntry.peek() !== cur ||
    walletGeneration() !== gen ||
    (!sameWallet && walletAccounts.peek().join() !== before.accounts.join());
  const lastBefore = lastWallet();
  // Back to the wallet that was connected, but only while the one we bound is still the connected one (a user's own change stays). The
  // old wallet's accounts are READ again (it may have changed meanwhile), within the probe limit `ms`; if it no longer answers (hung,
  // throws, none), nothing stale is bound: disconnected. No abort signal here: an aborted click must still roll back.
  const restoreFrom = (bound: ProviderEntry) => async () => {
    if (bound === cur || walletEntry.peek() !== bound) return;
    const fresh = await probe(before.entry.provider, ms);
    if (walletEntry.peek() !== bound) return;
    if (fresh?.length) await adoptWallet(before.entry, fresh, false);
    else disconnectWallet();
    restoreLastWallet(lastBefore);
  };
  try {
    const wc = isWalletConnectProvider(cur.provider);
    // The connected wallet's live read and (once discovery answered) every other wallet's run at once.
    let settled = false;
    const liveP = probe(cur.provider, ms, signal);
    const foundP: Promise<readonly ProviderEntry[]> = wc ? Promise.resolve([]) : o.entries ? Promise.resolve(o.entries) : unlessAborted(discoverProviders(), signal);
    // Only wallets the user connected here through the connect modal (the recent list) are ever probed, bound or asked anything: a page
    // can announce any provider, and it must not get a request, let alone the session, from a click on an address.
    // RESIDUAL RISK, accepted: a provider announcing a previously connected rdns while the real wallet is not announced passes this gate.
    // That is the baseline of `restoreWallet` (it re-adopts by the `LAST_WALLET_KEY` rdns on load when one announcement matches), and
    // `eth_requestAccounts` to such a provider is answered by the provider itself, so the extra request adds nothing.
    const trusted = new Set(readRecent().map((r) => r.id));
    const othersP = foundP.then(async (found): Promise<[ProviderEntry[], ProviderEntry[], (Address[] | null)[]]> => {
      const others = found.filter((e) => e.provider !== cur.provider);
      const known = others.filter((e) => trusted.has(keyOf(e)));
      return settled ? [[], [], []] : [others, known, await Promise.all(known.map((e) => probe(e.provider, ms, signal)))];
    });
    othersP.catch(() => {}); // an abort rejects both; the awaited one reports it
    const live = await liveP;
    if (live && sameAddress(live[0], target) && !stale(true)) {
      settled = true;
      return { ok: true, entry: cur, accounts: live, undo: async () => {} };
    }
    const [others, known, seen] = await othersP;
    if (signal?.aborted) return { ok: false, reason: 'cancelled' };
    const all = [cur, ...known];
    const lists = [live, ...seen];
    const keys = [cur, ...others].map(keyOf);
    const duplicated = (i: number) => keys.filter((k) => k === keyOf(all[i])).length > 1;
    const claims = all.map((_, i) => i).filter((i) => lists[i]?.some((a) => sameAddress(a, target)));

    let pick = -1;
    let list: Address[] | null = null;
    if (claims.length > 1) return { ok: false, reason: 'ambiguous' };
    if (claims.length === 1) {
      pick = claims[0];
      list = lists[pick];
    } else if (others.length === 0) pick = 0;
    else if (others.length === 1 && known.length === 1) pick = 1;
    else return { ok: false, reason: 'ambiguous' };
    if (duplicated(pick)) return { ok: false, reason: 'ambiguous' };
    const entry = all[pick];

    // Ask the chosen wallet for the account: its authorised list first, then its picker; the account must end up ACTIVE.
    let accounts: Address[];
    try {
      accounts = list ?? accountList(await unlessAborted(entry.provider.request({ method: 'eth_requestAccounts' }), signal));
      if (!sameAddress(accounts[0], target)) accounts = await unlessAborted(requestAccountPicker(entry.provider), signal);
    } catch (e) {
      if (isAbort(e)) throw e;
      return { ok: false, reason: isRejection(e) ? 'rejected' : 'not-shared', wallet: entry.info };
    }
    if (!sameAddress(accounts[0], target)) return { ok: false, reason: 'not-shared', wallet: entry.info };

    if (stale(entry === cur)) return { ok: false, reason: 'cancelled' };
    const bound = await adoptWallet(entry, accounts);
    // Re-verify on the bound provider: what the wallet says NOW, not what it said a moment ago.
    const again = await probe(entry.provider, ms, signal);
    if (mine !== latest || signal?.aborted || walletEntry.peek() !== entry || walletGeneration() !== bound) {
      await restoreFrom(entry)(); // a no-op when the user disconnected or switched meanwhile
      return { ok: false, reason: 'cancelled' };
    }
    if (!again || !sameAddress(again[0], target)) {
      await restoreFrom(entry)();
      return { ok: false, reason: again ? 'not-shared' : 'failed', wallet: entry.info };
    }
    return { ok: true, entry, accounts: again, undo: restoreFrom(entry) };
  } catch (e) {
    if (isAbort(e)) return { ok: false, reason: 'cancelled' };
    return { ok: false, reason: 'not-shared' };
  }
}
