// Wallet core: EIP-6963 provider discovery, account request, personal_sign, a SIWE (EIP-4361) guard,
// and a small signal store for the connected account. The legacy `window.ethereum` global is never
// read. WalletConnect is not bundled: an app that wants it renders its own entry via WalletModal's
// `extra` slot and calls `connectWallet` with the resulting EIP-1193 provider.
import { signal } from '@preact/signals';
import { type Address, type Hex, isAddress } from '../lib/address';

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
}

/** One EIP-6963 announcement. */
export interface ProviderEntry {
  info: ProviderInfo;
  provider: Eip1193Provider;
}

/** EIP-6963 discovery only: provider objects stay local and `window.ethereum` is never read. */
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

export async function connectProvider(
  entry: ProviderEntry,
): Promise<{ entry: ProviderEntry; address: Address }> {
  const accounts = (await entry.provider.request({ method: 'eth_requestAccounts' })) as unknown;
  const address = (Array.isArray(accounts) ? accounts : []).find(
    (a): a is Address => typeof a === 'string' && isAddress(a),
  );
  if (!address) throw new Error('no account authorized in the wallet');
  return { entry, address };
}

export function personalSign(entry: ProviderEntry, address: string, message: string): Promise<Hex> {
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

// ─── connected-account store ──────────────────────────────────────────────────────────────

export const walletAddress = signal<Address | undefined>(undefined);
export const walletChainId = signal<number | undefined>(undefined);
export const walletEntry = signal<ProviderEntry | undefined>(undefined);
export const connectModalOpen = signal(false);

export const openConnectModal = () => {
  connectModalOpen.value = true;
};
export const closeConnectModal = () => {
  connectModalOpen.value = false;
};

let detach: (() => void) | undefined;

/** Connect an EIP-1193 provider and keep the store in sync with its account / chain events. */
export async function connectWallet(entry: ProviderEntry): Promise<Address> {
  const { address } = await connectProvider(entry);
  detach?.();
  walletEntry.value = entry;
  walletAddress.value = address;
  walletChainId.value = await chainIdOf(entry.provider);
  const onAccounts = (...a: unknown[]) => {
    const next = (a[0] as string[] | undefined)?.find(isAddress);
    if (next) walletAddress.value = next;
    else disconnectWallet();
  };
  const onChain = (...a: unknown[]) => {
    try {
      walletChainId.value = Number(BigInt(String(a[0])));
    } catch {}
  };
  entry.provider.on?.('accountsChanged', onAccounts);
  entry.provider.on?.('chainChanged', onChain);
  detach = () => {
    entry.provider.removeListener?.('accountsChanged', onAccounts);
    entry.provider.removeListener?.('chainChanged', onChain);
  };
  return address;
}

export function disconnectWallet(): void {
  detach?.();
  detach = undefined;
  walletEntry.value = undefined;
  walletAddress.value = undefined;
  walletChainId.value = undefined;
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

export function connectErrorMessage(e: unknown): string {
  const err = e as { code?: number; message?: string };
  if (err?.code === 4001) return 'Connection request rejected in the wallet.';
  return err?.message || 'Could not connect the wallet.';
}
