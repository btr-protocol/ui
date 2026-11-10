// Wallet core: provider discovery, account request, personal_sign, a SIWE (EIP-4361) guard, the account-mismatch
// guard every signature goes through, and a small signal store for the connected wallet. The connect modal (EIP-6963 +
// legacy injected + WalletConnect) is `WalletModal`; an app that owns its own connection state passes `onConnect`.
import { signal } from '@preact/signals';
import type { Address, Hex } from '../lib/address';
import { WrongAccountError, accountList, readAccounts, requestAccountPicker, sameAddress } from './accounts';

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
  sameAddress,
} from './accounts';

/**
 * Re-read the wallet's live accounts and refuse unless its ACTIVE account is `expected`. Many wallets (Rabby, Ledger
 * Live, most WalletConnect peers) sign with the active account whatever `from` says, so this runs right before every
 * signature: a wrong-account signature is never produced. Syncs the store when `p` is the connected provider.
 */
export async function assertActiveAccount(p: Eip1193Provider, expected: string): Promise<Address> {
  const accounts = await readAccounts(p);
  if (walletEntry.value?.provider === p) adoptAccounts(accounts);
  const [active] = accounts;
  if (!active || !sameAddress(active, expected)) throw new WrongAccountError(expected, active);
  return active;
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

/** Make `target` the wallet's active account: already active -> true; else the wallet's picker, then re-check. */
export async function switchWalletAccount(p: Eip1193Provider, target: string): Promise<boolean> {
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
 * exactly what the operator authorises. The Host line is not asserted (a deployment's configured domain may differ).
 */
export function assertSiweMessage(
  message: string,
  wantAddress: string,
  { domain, statement, uri }: { domain: string; statement: string; uri: string },
): void {
  const head = `${domain} wants you to sign in with your Ethereum account:`;
  const lines = String(message || '').split('\n');
  if (lines[0] !== head) throw new Error('Refused to sign: foreign login message.');
  if ((lines[1] || '').toLowerCase() !== String(wantAddress).toLowerCase())
    throw new Error('Refused to sign: address mismatch.');
  if (!String(message).includes(statement)) throw new Error('Refused to sign: unknown statement.');
  if (lines.find((l) => l.startsWith('URI: ')) !== `URI: ${uri}`)
    throw new Error('Refused to sign: foreign URI.');
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
}

let detach: (() => void) | undefined;

function bind(entry: ProviderEntry, accounts: Address[]): void {
  detach?.();
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
  const onEnd = () => disconnectWallet();
  entry.provider.on?.('accountsChanged', onAccounts);
  entry.provider.on?.('chainChanged', onChain);
  entry.provider.on?.('disconnect', onEnd);
  detach = () => {
    entry.provider.removeListener?.('accountsChanged', onAccounts);
    entry.provider.removeListener?.('chainChanged', onChain);
    entry.provider.removeListener?.('disconnect', onEnd);
  };
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
  const last = lastWallet();
  if (!last) return undefined;
  if (last === 'walletconnect') {
    const { loadWc, store, WC_FLAG } = await import('./walletConnectShell');
    if (!store.get(WC_FLAG)) return undefined;
    const wc = await (await loadWc()).restoreWalletConnect().catch(() => null);
    if (!wc) return undefined;
    bind({ info: { uuid: 'walletconnect', name: 'WalletConnect', id: 'walletconnect' }, provider: wc.provider }, await readAccounts(wc.provider));
  } else {
    const list = entries ?? (await discoverProviders());
    const entry = list.find((e) => e.info.rdns === last || e.info.id === last);
    if (!entry) return undefined;
    const accounts = await readAccounts(entry.provider).catch((): Address[] => []);
    if (!accounts.length) return undefined;
    bind(entry, accounts);
  }
  const bound = walletEntry.peek();
  if (bound) walletChainId.value = await chainIdOf(bound.provider);
  return walletAddress.peek();
}

export function disconnectWallet(): void {
  const p = walletEntry.value?.provider;
  detach?.();
  detach = undefined;
  walletEntry.value = undefined;
  walletAccounts.value = [];
  walletAddress.value = undefined;
  walletChainId.value = undefined;
  if ((p as { isWalletConnect?: boolean } | undefined)?.isWalletConnect)
    void import('./walletConnectShell').then((m) => m.loadWc()).then((m) => m.disconnectWalletConnect());
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
