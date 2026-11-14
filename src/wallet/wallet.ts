// Wallet core: provider discovery, account request, personal_sign, a SIWE (EIP-4361) guard, the account-mismatch
// guard every signature goes through, and a small signal store for the connected wallet. The connect modal (EIP-6963 +
// legacy injected + WalletConnect) is `WalletModal`; an app that owns its own connection state passes `onConnect`.
import { signal } from '@preact/signals';
import type { Address, Hex } from '../lib/address';
import { WrongAccountError, accountList, readAccounts, requestAccountPicker, requireActiveAccount, sameAddress } from './accounts';
import { rememberAccounts } from './recentWallets';

export interface Eip1193Provider {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
  on?(event: string, listener: (...args: unknown[]) => void): void;
  removeListener?(event: string, listener: (...args: unknown[]) => void): void;
}

export interface ProviderInfo {
  uuid: string;
  name: string;
  /** Data URI announced by the wallet. */
  icon?: string;
  rdns?: string;
  /** SDK catalog id (`metamask`, `rabby`, `walletconnect`, …): picks the bundled raster. */
  id?: string;
}

/** One EIP-6963 announcement (or any EIP-1193 provider with a name: legacy injected, WalletConnect). */
export interface ProviderEntry {
  info: ProviderInfo;
  provider: Eip1193Provider;
}

/** EIP-6963 discovery: provider objects stay local. */
export function discoverProviders(timeoutMs = 400): Promise<ProviderEntry[]> {
  return new Promise((resolve) => {
    const found = new Map<string, ProviderEntry>();
    const announce = (event: Event) => {
      const detail = ((event as CustomEvent).detail || {}) as Partial<ProviderEntry>;
      const { info, provider } = detail;
      if (
        typeof info?.uuid === 'string' &&
        typeof info?.name === 'string' &&
        typeof provider?.request === 'function'
      ) {
        found.set(info.uuid || info.name, detail as ProviderEntry);
      }
    };
    window.addEventListener('eip6963:announceProvider', announce);
    window.dispatchEvent(new Event('eip6963:requestProvider'));
    setTimeout(() => {
      window.removeEventListener('eip6963:announceProvider', announce);
      resolve([...found.values()]);
    }, timeoutMs);
  });
}

const chainIdOf = async (p: Eip1193Provider): Promise<number | undefined> => {
  try {
    const n = BigInt(String(await p.request({ method: 'eth_chainId' })));
    return n > BigInt(Number.MAX_SAFE_INTEGER) ? undefined : Number(n);
  } catch {
    return undefined;
  }
};

// ─── accounts (store-synced) ──────────────────────────────────────────────────────────────

export {
  WrongAccountError,
  accountList,
  accountMismatch,
  readAccounts,
  requestAccountPicker,
  requestAccountSwitch,
  requireActiveAccount,
  sameAddress,
} from './accounts';

/**
 * Re-read the wallet's live accounts and refuse unless its ACTIVE account is `expected`. Many wallets (Rabby, Ledger
 * Live, most WalletConnect peers) sign with the active account whatever `from` says, so this runs right before every
 * signature: a wrong-account signature is never produced. Syncs the store when `p` is the connected provider.
 */
export async function assertActiveAccount(p: Eip1193Provider, expected: string): Promise<Address> {
  try {
    const accounts = await requireActiveAccount(p, expected);
    if (walletEntry.value?.provider === p) adoptAccounts(accounts);
    return accounts[0] as Address;
  } catch (e) {
    if (e instanceof WrongAccountError && walletEntry.value?.provider === p) adoptAccounts(await readAccounts(p));
    throw e;
  }
}

/**
 * Open the wallet's own account picker (`wallet_requestPermissions`, MetaMask / Rabby and most extensions) and return
 * the accounts it then exposes, active first. A wallet without that method (WalletConnect peers) falls back to
 * `eth_requestAccounts`, which only re-reads: the user switches inside the wallet app and `accountsChanged` follows.
 */
export async function pickWalletAccount(p: Eip1193Provider): Promise<Address[]> {
  const accounts = await requestAccountPicker(p);
  if (walletEntry.value?.provider === p) adoptAccounts(accounts);
  return accounts;
}

/** Make `target` the wallet's active account: already active -> true; else the wallet's picker, then re-check. For the CONNECTED
 *  provider the account may live in another installed wallet: that wallet becomes the connected one (`activateAccount`). */
export async function switchWalletAccount(p: Eip1193Provider, target: string): Promise<boolean> {
  if (walletEntry.peek()?.provider === p) return (await (await import('./accountSwitch')).activateAccount(target)).ok;
  if (sameAddress((await readAccounts(p))[0], target)) return true;
  return sameAddress((await pickWalletAccount(p))[0], target);
}

export async function connectProvider(
  entry: ProviderEntry,
): Promise<{ entry: ProviderEntry; address: Address; accounts: Address[] }> {
  const accounts = accountList(await entry.provider.request({ method: 'eth_requestAccounts' }));
  const [address] = accounts;
  if (!address) throw new Error('no account authorized in the wallet');
  return { entry, address, accounts };
}

/** personal_sign as `address`, refused unless it is the wallet's active account (see `assertActiveAccount`). */
export async function personalSign(entry: ProviderEntry, address: string, message: string): Promise<Hex> {
  await assertActiveAccount(entry.provider, address);
  const hexMsg = message.startsWith('0x')
    ? message
    : `0x${Array.from(new TextEncoder().encode(message), (b) => b.toString(16).padStart(2, '0')).join('')}`;
  return entry.provider.request({ method: 'personal_sign', params: [hexMsg, address] }) as Promise<Hex>;
}

/**
 * Refuse to sign a server-provided SIWE (EIP-4361) message that does not name this login: the wallet must display
 * exactly what the operator authorises. Exact structural parse, line by line: domain line, address, blank, statement,
 * blank, URI, Version 1, Chain ID, Nonce, Issued At, optional Expiration Time; anything else (extra, reordered or
 * unknown lines, a statement merely CONTAINED in a longer one) is refused. `chainId` pins the chain when given.
 */
export function assertSiweMessage(
  message: string,
  wantAddress: string,
  { domain, statement, uri, chainId }: { domain: string; statement: string; uri: string; chainId?: number },
): void {
  const refuse = (why: string): never => {
    throw new Error(`Refused to sign: ${why}.`);
  };
  const lines = String(message || '').split('\n');
  if (lines.length < 10 || lines.length > 11) refuse('unexpected message shape');
  if (lines[0] !== `${domain} wants you to sign in with your Ethereum account:`) refuse('foreign login message');
  if ((lines[1] || '').toLowerCase() !== String(wantAddress).toLowerCase()) refuse('address mismatch');
  if (lines[2] !== '' || lines[4] !== '') refuse('unexpected message shape');
  if (lines[3] !== statement.trim()) refuse('unknown statement');
  if (lines[5] !== `URI: ${uri}`) refuse('foreign URI');
  if (lines[6] !== 'Version: 1') refuse('unknown version');
  const chain = /^Chain ID: ([1-9]\d*)$/.exec(lines[7]);
  if (!chain || (chainId !== undefined && Number(chain[1]) !== chainId)) refuse('unexpected chain');
  if (!/^Nonce: [A-Za-z0-9]{8,}$/.test(lines[8])) refuse('invalid nonce');
  const iso = /^(Issued At|Expiration Time): (\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d))$/;
  const issued = iso.exec(lines[9]);
  if (!issued || issued[1] !== 'Issued At' || Number.isNaN(Date.parse(issued[2]))) refuse('invalid issue time');
  if (lines.length === 11) {
    const exp = iso.exec(lines[10]);
    if (!exp || exp[1] !== 'Expiration Time' || Number.isNaN(Date.parse(exp[2]))) refuse('invalid expiry');
  }
}

// ─── connected-wallet store ───────────────────────────────────────────────────────────────

/** The wallet's ACTIVE account (what it signs with), live through `accountsChanged`. */
export const walletAddress = signal<Address | undefined>(undefined);
/** Every account the wallet exposes to this site, active first. */
export const walletAccounts = signal<Address[]>([]);
export const walletChainId = signal<number | undefined>(undefined);
export const walletEntry = signal<ProviderEntry | undefined>(undefined);
export const connectModalOpen = signal(false);

export const openConnectModal = () => {
  connectModalOpen.value = true;
};
export const closeConnectModal = () => {
  connectModalOpen.value = false;
};

/** localStorage key of the last wallet used (catalog id or rdns): orders the modal and drives `restoreWallet`. */
export const LAST_WALLET_KEY = 'btr-last-wallet';
const remember = (v?: string) => {
  try {
    if (v) localStorage.setItem(LAST_WALLET_KEY, v);
  } catch {}
};
export const lastWallet = (): string | undefined => {
  try {
    return localStorage.getItem(LAST_WALLET_KEY) ?? undefined;
  } catch {
    return undefined;
  }
};

function adoptAccounts(accounts: Address[]): void {
  walletAccounts.value = accounts;
  walletAddress.value = accounts[0];
  const e = walletEntry.peek();
  if (e) rememberAccounts(e.info.rdns ?? e.info.id, accounts);
}

let detach: (() => void) | undefined;
/** Bumped by every connect / disconnect: a `restoreWallet` that started before one never binds over it. */
let generation = 0;

type WcLike = Eip1193Provider & { isWalletConnect?: boolean; wcDisconnect?: () => Promise<void> };
const isWc = (p?: Eip1193Provider): p is WcLike => (p as WcLike | undefined)?.isWalletConnect === true;
/** End exactly `p`'s session (bound to its topic), never "whatever is live now". */
const endWc = (p: WcLike) => p.wcDisconnect?.().catch(() => {});

function bind(entry: ProviderEntry, accounts: Address[]): void {
  // A different wallet replaces a WalletConnect one: end that session on the relay too (a new WalletConnect session already
  // replaced the old one in the glue, so only a non-WC provider triggers this; the live one must survive).
  // The previous session's own disconnect, captured now: a WalletConnect session built since must survive.
  const prev = walletEntry.peek()?.provider;
  if (prev && prev !== entry.provider && isWc(prev) && !isWc(entry.provider)) void endWc(prev);
  detach?.();
  generation++;
  walletEntry.value = entry;
  adoptAccounts(accounts);
  const onAccounts = (...a: unknown[]) => {
    const next = accountList(a[0]);
    if (next.length) adoptAccounts(next);
    else disconnectWallet();
  };
  const onChain = (...a: unknown[]) => {
    try {
      walletChainId.value = Number(BigInt(String(a[0])));
    } catch {}
  };
  // EIP-1193 `disconnect`: 4900 (provider disconnected) / 4901 (chain disconnected), and WalletConnect teardown (4900), log
  // out. Anything else (a transient 1013 "try again later" from a reconnecting socket) is re-checked against the wallet first.
  const onEnd = (...a: unknown[]) => {
    if (walletEntry.peek() !== entry) return;
    const code = (a[0] as { code?: number } | undefined)?.code;
    if (code === 4900 || code === 4901) return disconnectWallet();
    void readAccounts(entry.provider)
      .then((l) => {
        if (!l.length && walletEntry.peek() === entry) disconnectWallet();
      })
      .catch(() => {});
  };
  entry.provider.on?.('accountsChanged', onAccounts);
  entry.provider.on?.('chainChanged', onChain);
  entry.provider.on?.('disconnect', onEnd);
  detach = () => {
    entry.provider.removeListener?.('accountsChanged', onAccounts);
    entry.provider.removeListener?.('chainChanged', onChain);
    entry.provider.removeListener?.('disconnect', onEnd);
  };
}

/** Make an already-authorised provider THE connected wallet (no prompt): the account switch that lands in another wallet. */
export async function adoptWallet(entry: ProviderEntry, accounts: Address[]): Promise<void> {
  bind(entry, accounts);
  walletChainId.value = await chainIdOf(entry.provider);
  remember(entry.info.rdns ?? entry.info.id);
}

/** Connect an EIP-1193 provider and keep the store in sync with its account / chain events. */
export async function connectWallet(entry: ProviderEntry): Promise<Address> {
  const { address, accounts } = await connectProvider(entry);
  bind(entry, accounts);
  walletChainId.value = await chainIdOf(entry.provider);
  remember(entry.info.rdns ?? entry.info.id);
  return address;
}

/**
 * Re-adopt the last wallet without a prompt (`eth_accounts`): the injected wallet named by `LAST_WALLET_KEY` among
 * `entries` (default: EIP-6963 discovery), else a persisted WalletConnect session. Resolves the active account or undefined.
 */
export async function restoreWallet(entries?: ProviderEntry[]): Promise<Address | undefined> {
  if (walletEntry.value) return walletAddress.value;
  const g = generation;
  // A manual connect (or disconnect) while this was awaiting wins: never bind over it.
  const stale = () => g !== generation || !!walletEntry.peek();
  const last = lastWallet();
  if (!last) return undefined;
  if (last === 'walletconnect') {
    const { loadWc, store, WC_FLAG } = await import('./walletConnectShell');
    if (!store.get(WC_FLAG)) return undefined;
    const wc = await (await loadWc()).restoreWalletConnect().catch(() => null);
    if (!wc) return walletAddress.peek();
    // A manual connect won while this restored: the restored session is not adopted, so it is ended, not left on the relay.
    if (stale()) return void (await wc.disconnect().catch(() => {})), walletAddress.peek();
    const accounts = await readAccounts(wc.provider);
    if (stale()) return void (await wc.disconnect().catch(() => {})), walletAddress.peek();
    bind({ info: { uuid: 'walletconnect', name: 'WalletConnect', id: 'walletconnect' }, provider: wc.provider }, accounts);
  } else {
    const list = entries ?? (await discoverProviders());
    const hits = list.filter((e) => e.info.rdns === last || e.info.id === last);
    // Two announcements claiming one rdns: nothing says which the user used, so nothing is bound silently.
    const entry = hits.length === 1 ? hits[0] : undefined;
    if (!entry || stale()) return walletAddress.peek();
    const accounts = await readAccounts(entry.provider).catch((): Address[] => []);
    if (!accounts.length || stale()) return walletAddress.peek();
    bind(entry, accounts);
  }
  const bound = walletEntry.peek();
  const id = bound && (await chainIdOf(bound.provider));
  if (bound && walletEntry.peek() === bound) walletChainId.value = id;
  return walletAddress.peek();
}

export function disconnectWallet(): void {
  const p = walletEntry.value?.provider;
  generation++;
  detach?.();
  detach = undefined;
  walletEntry.value = undefined;
  walletAccounts.value = [];
  walletAddress.value = undefined;
  walletChainId.value = undefined;
  if (isWc(p)) void endWc(p);
}

/** Ask the wallet to switch chain; resolves false when it refuses or is not connected. */
export async function switchWalletChain(chainId: number): Promise<boolean> {
  const p = walletEntry.value?.provider;
  if (!p) return false;
  try {
    await p.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: `0x${chainId.toString(16)}` }],
    });
    walletChainId.value = chainId;
    return true;
  } catch {
    return false;
  }
}

/** @deprecated use `connectError` (the btr.markets copy). */
export function connectErrorMessage(e: unknown): string {
  const err = e as { code?: number; message?: string };
  if (err?.code === 4001) return 'Connection request rejected in the wallet.';
  return err?.message || 'Could not connect the wallet.';
}
