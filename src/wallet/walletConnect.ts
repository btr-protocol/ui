// WalletConnect session glue (sign-client), moved from the btr.markets front. Reached only via `loadWc()`;
// the app configures it once with `configureWalletConnect` (project id, metadata, chains, reader).
import { type AccountClass, accountClass, resolveWallet } from '@btr-protocol/sdk/eth/wallets';
import type { Address } from '../lib/address';
import {
  WC_FLAG,
  type WalletConnectProvider,
  setWalletPeer,
  store,
  walletConnectConfig,
  walletConnectEnabled,
} from './walletConnectShell';

export { isWalletConnectProvider, walletPeer } from './walletConnectShell';

const wcLog = { warn: (msg: string, e?: unknown) => console.warn(`[walletConnect] ${msg}`, e) };
const chainHex = (id: number): string => `0x${id.toString(16)}`;

export type WcSession = {
  topic: string;
  /** Unix seconds. */
  expiry: number;
  namespaces: { eip155: { accounts: string[]; methods?: string[]; chains?: string[] } };
  peer?: { metadata?: { name?: string } };
};
export type WcClient = {
  connect: (opts: unknown) => Promise<{ uri?: string; approval: () => Promise<WcSession> }>;
  request: (opts: unknown) => Promise<unknown>;
  disconnect: (opts: { topic: string; reason: { code: number; message: string } }) => Promise<void>;
  on: (ev: string, cb: (data: unknown) => void) => void;
  session: { getAll: () => WcSession[] };
  core: {
    relayer: { restartTransport: () => Promise<void> };
    pairing: { disconnect: (opts: { topic: string }) => Promise<void> };
  };
};
type WcEvent = {
  topic?: string;
  params?: {
    chainId?: string;
    event?: { name?: string; data?: unknown };
    namespaces?: WcSession['namespaces'];
  };
};

/** Methods the wallet signs; every other JSON-RPC method is a read. */
const SIGN_METHODS = [
  'eth_sendTransaction',
  'eth_signTransaction',
  'eth_sign',
  'personal_sign',
  'eth_signTypedData',
  'eth_signTypedData_v4',
];
/** Proposed as OPTIONAL: a required method fails pairing on wallets that lack it (Safe has no
 *  personal_sign, Ledger no wallet_switchEthereumChain). */
export const WC_METHODS = [
  ...SIGN_METHODS,
  'wallet_switchEthereumChain',
  'wallet_addEthereumChain',
  'wallet_watchAsset',
  'wallet_getCapabilities',
  'wallet_sendCalls',
  'wallet_getCallsStatus',
  'wallet_showCallsStatus',
];
const WC_EVENTS = ['accountsChanged', 'chainChanged'];
/** sign-client refuses methods outside the session namespace, so only these ride the session. */
export const routesToWallet = (method: string): boolean =>
  method.startsWith('wallet_') || SIGN_METHODS.includes(method);

/** Multi-owner wallets (Safe, other contract accounts) collect signatures for days and outlive
 *  sign-client's 5 min default. Everyone else keeps it, so a stale unsigned request cannot sit in a
 *  normal wallet for a week. */
export const needsLongExpiry = (peerId: string, klass?: AccountClass): boolean =>
  peerId === 'safe' || klass === 'contract';
const LONG_EXPIRY_METHODS = ['eth_sendTransaction', 'wallet_sendCalls'];
const LONG_EXPIRY_S = 604_800;

/** Hidden shorter than this keeps its relay socket. */
const RESUME_AFTER_MS = 5_000;
const USER_DISCONNECTED = { code: 6000, message: 'User disconnected' };

/** The configured chains plus `preferred`, as CAIP-2. */
export const wcChains = (preferred?: number): string[] =>
  [...new Set([...(walletConnectConfig()?.chains(preferred) ?? []), ...(preferred ? [preferred] : [])])].map(
    (id) => `eip155:${id}`,
  );

/** `eip155:5115`, `0x13fb`, `5115` - WalletConnect wallets send all three shapes. */
export const parseWcChain = (v: unknown): number | undefined => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  if (typeof v !== 'string') return undefined;
  const raw = v.startsWith('eip155:') ? v.slice(7) : v;
  const n = raw.startsWith('0x') ? Number.parseInt(raw, 16) : Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : undefined;
};

/** CAIP-10 `eip155:56:0xabc…` or a bare address → the address. */
export const wcAddress = (v: unknown): string | undefined =>
  typeof v === 'string' ? v.split(':').at(-1) || undefined : undefined;

const wcAddresses = (v: unknown): string[] =>
  Array.isArray(v) ? [...new Set(v.map(wcAddress).filter((a): a is string => !!a))] : [];

/** The chain a session opens on: `preferred` when the wallet approved it, else the first approved
 *  account's chain, else the first approved chain. */
export const pickSessionChain = (session: WcSession, preferred?: number): number | undefined => {
  const { accounts, chains } = session.namespaces.eip155;
  const approved = [...accounts.map((a) => a.split(':').slice(0, 2).join(':')), ...(chains ?? [])]
    .map(parseWcChain)
    .filter((c): c is number => c !== undefined);
  return preferred !== undefined && approved.includes(preferred) ? preferred : approved[0];
};

/** The session this app stored, if still unexpired. Never "the newest": the client persists every session in IndexedDB,
 *  including another tab's or a wallet's stale one, and the account must be the one the user connected here. */
export const pickLiveSession = (sessions: WcSession[], nowSec: number, topic: string): WcSession | undefined =>
  sessions.find((s) => s.topic === topic && s.expiry > nowSec);

/** `WC_FLAG` value: the live session's topic and current chain. Anything else (a pre-topic flag) restores nothing. */
export const wcFlag = (topic: string, chain: number): string => JSON.stringify({ topic, chain });
export function readWcFlag(v: string | null): { topic: string; chain?: number } | undefined {
  try {
    const f = JSON.parse(v ?? '') as { topic?: unknown; chain?: unknown };
    return typeof f?.topic === 'string' && f.topic
      ? { topic: f.topic, chain: typeof f.chain === 'number' ? f.chain : undefined }
      : undefined;
  } catch {
    return undefined;
  }
}

/** Pairing topic of a `wc:<topic>@2?…` URI. */
export const pairingTopic = (uri: string): string | undefined => /^wc:([^@?]+)@/.exec(uri)?.[1];

/** The session's current chain (a wallet can switch after connect, announced as a `chainChanged`
 *  session event). `eth_chainId` must not answer from the connect-time value: safety re-reads use it. */
export const wcChainTracker = (initial: number, topic: string) => {
  let chain = initial;
  return {
    current: () => chain,
    /** A `session_event` from the SignClient. Ignores other topics and other event names. */
    onSessionEvent: (ev: unknown): void => {
      const e = ev as WcEvent;
      if (e?.topic !== topic || e.params?.event?.name !== 'chainChanged') return;
      const next = parseWcChain(e.params.event.data) ?? parseWcChain(e.params.chainId);
      if (next !== undefined) chain = next;
    },
    /** A wallet that honours `wallet_switchEthereumChain` but emits no `chainChanged` would
     *  otherwise leave the provider answering with the chain it just left. */
    afterRequest: (method: string, params?: unknown[]): void => {
      if (method !== 'wallet_switchEthereumChain') return;
      const next = parseWcChain((params?.[0] as { chainId?: string } | undefined)?.chainId);
      if (next !== undefined) chain = next;
    },
  };
};

interface WalletConnectResult {
  provider: WalletConnectProvider;
  address: Address;
  disconnect: () => Promise<void>;
}

// One session at a time; the client's events are bound once and fan out through `sessionHandler`.
let signClient: WcClient | null = null;
let sessionHandler: ((name: string, ev: WcEvent) => void) | null = null;
let liveDisconnect: (() => Promise<void>) | null = null;
const bound = new WeakSet<WcClient>();
const CLIENT_EVENTS = [
  'session_event',
  'session_update',
  'session_delete',
  'session_expire',
  'session_request_expire',
];

/** Subscribes the client's lifecycle events exactly once, however many sessions follow. */
export function bindClientEvents(client: WcClient): void {
  if (bound.has(client)) return;
  bound.add(client);
  for (const name of CLIENT_EVENTS) client.on(name, (ev) => sessionHandler?.(name, ev as WcEvent));
}

/** Wallet context calls this to release any live WC session. */
export async function disconnectWalletConnect(): Promise<void> {
  const fn = liveDisconnect;
  liveDisconnect = null;
  await fn?.().catch(() => {});
}

/** Foreground recovery: a backgrounded mobile webview loses its relay socket, so wallet replies
 *  never arrive. `hiddenMs` omitted = always restart (native resume hooks). */
export async function resumeWalletConnect(hiddenMs?: number): Promise<void> {
  if (!signClient || (hiddenMs !== undefined && hiddenMs <= RESUME_AFTER_MS)) return;
  try {
    await signClient.core.relayer.restartTransport();
  } catch (e) {
    wcLog.warn('relay restart failed', e);
  }
}

async function getSignClient(): Promise<WcClient> {
  const cfg = walletConnectConfig();
  if (!cfg?.projectId) throw new Error('WalletConnect Project ID not configured.');
  if (!signClient) {
    const SignClient = (await cfg.loadSignClient()).default;
    const client = (await SignClient.init({ projectId: cfg.projectId, metadata: cfg.metadata })) as unknown as WcClient;
    bindClientEvents(client);
    signClient = client;
  }
  return signClient;
}

type WalletConnectCallbacks = {
  onUri: (uri: string) => void;
  onConnected?: () => void;
  onError?: (error: Error) => void;
};
type ConnectOpts = { signal?: AbortSignal; chainId?: number };

const abortError = () =>
  Object.assign(new Error('WalletConnect connection cancelled'), { name: 'AbortError' });

/**
 * Propose a session and wait for the wallet's approval. On abort the pending approval rejects, the
 * pairing this call created is dropped, and a session the wallet approves after that is torn down
 * instead of adopted.
 */
export async function approveSession(
  client: WcClient,
  params: unknown,
  onUri: (uri: string) => void,
  signal?: AbortSignal,
): Promise<WcSession> {
  if (signal?.aborted) throw abortError();
  const { uri, approval } = await client.connect(params);
  const pending = approval();
  const drop = () => {
    pending.then(
      (s) => client.disconnect({ topic: s.topic, reason: USER_DISCONNECTED }).catch(() => {}),
      () => {},
    );
    const topic = uri && pairingTopic(uri);
    if (topic) client.core.pairing.disconnect({ topic }).catch(() => {});
  };
  if (signal?.aborted) {
    drop();
    throw abortError();
  }
  if (uri) onUri(uri);
  let off = () => {};
  const aborted = new Promise<never>((_, reject) => {
    if (!signal) return;
    const on = () => reject(abortError());
    signal.addEventListener('abort', on, { once: true });
    off = () => signal.removeEventListener('abort', on);
  });
  try {
    const session = await Promise.race([pending, aborted]);
    if (signal?.aborted) throw abortError(); // `drop` below tears the just-approved session down
    return session;
  } catch (e) {
    if (signal?.aborted) drop();
    throw e;
  } finally {
    off();
  }
}

/**
 * EIP-1193 provider over a live session. Signing and `wallet_*` go to the wallet; every read goes
 * to the public RPC of the session's current chain, because sign-client refuses methods the
 * session did not approve (eth_call, receipts, eth_blockNumber, ...).
 */
export function buildWcProvider(
  client: WcClient,
  session: WcSession,
  preferredChainId?: number,
): WalletConnectResult {
  void liveDisconnect?.(); // a new session replaces the old one; never leave it alive on the relay
  const { topic } = session;
  let ns = session.namespaces.eip155;
  let accounts = wcAddresses(ns.accounts);
  const first = accounts[0];
  const initial = pickSessionChain(session, preferredChainId);
  if (!first || initial === undefined) throw new Error('No account returned from WalletConnect');

  const chain = wcChainTracker(initial, topic);
  const remember = () => store.set(WC_FLAG, wcFlag(topic, chain.current()));
  remember();
  // The peer's own name is the only thing that says WHICH wallet approved: a WC provider carries
  // no injected flags and announces no EIP-6963 rdns.
  setWalletPeer(session.peer?.metadata?.name ?? null);
  const peerId = resolveWallet({ peerName: session.peer?.metadata?.name }).id;
  let contractAccount: Promise<boolean> | undefined;
  /** Peer name settles Safe with no RPC; anything else is asked once, and a failed read stays short. */
  const asyncSigners = async (): Promise<boolean> =>
    needsLongExpiry(peerId) ||
    (contractAccount ??= accountClass(provider, first as Address).then((c) =>
      needsLongExpiry(peerId, c),
    ));

  const bus = new Map<string, Set<(...args: unknown[]) => void>>();
  const emit = (name: string, arg?: unknown) => {
    for (const l of bus.get(name) ?? []) l(arg);
  };

  // Only the LIVE session clears the shared glue state; the flag only while it still names this topic (another tab, or a
  // newer session in this one, may own it by now).
  const teardown = (notify: boolean) => {
    if (liveDisconnect === disconnect) {
      liveDisconnect = null;
      sessionHandler = null;
      setWalletPeer(null);
    }
    if (readWcFlag(store.get(WC_FLAG))?.topic === topic) store.remove(WC_FLAG);
    if (notify) emit('disconnect', { code: 4900, message: 'WalletConnect session ended' });
  };

  const handler = (name: string, ev: WcEvent) => {
    if (name === 'session_request_expire') return wcLog.warn('wallet request expired', ev);
    if (ev.topic !== topic) return;
    if (name === 'session_delete' || name === 'session_expire') return teardown(true);
    if (name === 'session_update') {
      ns = ev.params?.namespaces?.eip155 ?? ns;
      const next = wcAddresses(ns.accounts);
      if (next.join() !== accounts.join()) {
        accounts = next;
        emit('accountsChanged', accounts);
      }
      return;
    }
    const data = ev.params?.event?.data;
    if (ev.params?.event?.name === 'accountsChanged') {
      accounts = wcAddresses(data);
      emit('accountsChanged', accounts);
    } else if (ev.params?.event?.name === 'chainChanged') {
      const before = chain.current();
      chain.onSessionEvent(ev);
      if (chain.current() === before) return;
      remember();
      emit('chainChanged', chainHex(chain.current()));
    }
  };

  const provider: WalletConnectProvider = {
    isWalletConnect: true,
    wcMethods: () => ns.methods ?? [],
    wcDisconnect: async () => {}, // replaced below by this session's own disconnect
    async request({ method, params }: { method: string; params?: unknown[] }): Promise<unknown> {
      if (method === 'eth_accounts' || method === 'eth_requestAccounts') return accounts;
      if (method === 'eth_chainId') return chainHex(chain.current());
      if (!routesToWallet(method)) {
        // The wallet only signs: every read goes to the app's reader for the session's current chain.
        const id = chain.current();
        const read = walletConnectConfig()?.reader;
        if (!read) throw new Error(`Chain ${id} is unavailable`);
        return read(id, method).request({ method, params });
      }
      const res = await client.request({
        topic,
        chainId: `eip155:${chain.current()}`,
        request: { method, params: params ?? [] },
        ...(LONG_EXPIRY_METHODS.includes(method) && (await asyncSigners())
          ? { expiry: LONG_EXPIRY_S }
          : {}),
      });
      chain.afterRequest(method, params);
      return res;
    },
    on(event, listener) {
      if (!bus.has(event)) bus.set(event, new Set());
      bus.get(event)?.add(listener);
    },
    removeListener(event, listener) {
      bus.get(event)?.delete(listener);
    },
  };

  const disconnect = async () => {
    teardown(false);
    try {
      await client.disconnect({ topic, reason: USER_DISCONNECTED });
    } catch (e) {
      wcLog.warn('WalletConnect disconnect error', e);
    }
  };

  sessionHandler = handler;
  liveDisconnect = disconnect;
  provider.wcDisconnect = disconnect;
  // One session at a time: orphans (an offline switch, a reload then a fresh connect) are ended on the relay too.
  for (const s of client.session.getAll())
    if (s.topic !== topic) client.disconnect({ topic: s.topic, reason: USER_DISCONNECTED }).catch(() => {});
  return { provider, address: first as Address, disconnect };
}

/** Connect via sign-client; the provider behaves like an injected wallet. */
export async function connectWithWalletConnect(
  onUri: ((uri: string) => void) | WalletConnectCallbacks,
  opts: ConnectOpts | number = {}, // number = legacy `preferredChainId`
): Promise<WalletConnectResult> {
  if (!walletConnectEnabled()) throw new Error('WalletConnect Project ID not configured.');
  const cb = typeof onUri === 'function' ? { onUri } : onUri;
  const { signal, chainId } = typeof opts === 'number' ? { chainId: opts } : opts;
  const client = await getSignClient();
  const session = await approveSession(
    client,
    // Optional only: a required method or chain fails pairing on wallets that lack it.
    {
      optionalNamespaces: {
        eip155: { methods: WC_METHODS, chains: wcChains(chainId), events: WC_EVENTS },
      },
    },
    cb.onUri,
    signal,
  );
  const res = buildWcProvider(client, session, chainId);
  cb.onConnected?.();
  return res;
}

/** Re-adopt THIS app's session (by its stored topic) after a reload or process kill; null when it is gone. */
export async function restoreWalletConnect(): Promise<WalletConnectResult | null> {
  const flag = store.get(WC_FLAG);
  if (!walletConnectEnabled() || !flag) return null; // no flag: never pay for the sign-client chunk
  const last = readWcFlag(flag);
  if (!last) {
    store.remove(WC_FLAG);
    return null;
  }
  const client = await getSignClient();
  if (liveDisconnect) return null; // a session connected meanwhile: never replace it with the restored one
  const session = pickLiveSession(client.session.getAll(), Date.now() / 1000, last.topic);
  if (!session) {
    store.remove(WC_FLAG);
    return null;
  }
  return buildWcProvider(client, session, last.chain);
}

/** WalletConnect URI -> QR SVG data URL. */
export async function generateQrCode(uri: string): Promise<string> {
  const { createQr } = await import('./qrcode');
  const svg = createQr(uri);
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}
