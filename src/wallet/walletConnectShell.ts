// ONE WalletConnect session per origin: connecting or restoring ends every other session in sign-client's store, which is shared by
// every tab of the origin, so a second tab's session is ended too (that tab sees `disconnect` and asks to reconnect).
// Shell half of WalletConnect: config, the session flag and the peer name, everything an entry graph needs
// without the session glue. The glue (`./walletConnect`) is reached ONLY through `loadWc`, so a build with a
// project id weighs the same as one without until the user opens the pairing path.
import type { Eip1193Provider } from './wallet';

export interface WalletConnectConfig {
  /** Reown (WalletConnect Cloud) project id: a public client id baked into the build, '' = WalletConnect off. */
  projectId: string;
  metadata: {
    name: string;
    description: string;
    /** The app's canonical origin. Never `location.origin`: it is https://localhost inside an app shell. */
    url: string;
    icons: string[];
    redirect?: { native?: string; universal?: string };
  };
  /** Chains proposed as OPTIONAL namespaces (a required chain fails pairing on wallets that lack it). */
  chains: (preferred?: number) => number[];
  /** The provider answering every NON-signing method on `chainId` (the wallet only signs). Throw with the
   *  user-facing reason when the chain cannot be read. Unset = every read refuses. */
  reader?: (chainId: number, method: string) => Eip1193Provider;
  /** `() => import('@walletconnect/sign-client')`: the app owns the dependency and its chunking. */
  loadSignClient: () => Promise<{ default: { init(opts: unknown): Promise<unknown> } }>;
}

let config: WalletConnectConfig | undefined;
/** Call once at boot. Without it (or with an empty project id) the modal offers installed wallets only. */
export function configureWalletConnect(c: WalletConnectConfig): void {
  config = c;
}
export const walletConnectConfig = (): WalletConnectConfig | undefined => config;
export const walletConnectEnabled = (): boolean => !!config?.projectId;

export const loadWc = () => import('./walletConnect');

/** localStorage flag of a live session (value = its chain): set/cleared by the glue, gates every load. */
export const WC_FLAG = 'btr-wc-session';

/** The name the peer announced for itself, live session only: a display name, never metadata (no
 *  icon, URL or description), canonicalised through the SDK alias map before it goes anywhere. */
let peerName: string | null = null;
export const setWalletPeer = (name: string | null): void => {
  peerName = name?.trim().slice(0, 64) || null;
};
export const walletPeer = (): string | null => peerName;

export type WalletConnectProvider = Eip1193Provider & {
  isWalletConnect: true;
  /** Methods the wallet approved for this session. */
  wcMethods: () => readonly string[];
  /** Ends THIS session (its topic), whatever session is live by the time it runs. */
  wcDisconnect: () => Promise<void>;
};
export const isWalletConnectProvider = (p?: Eip1193Provider): p is WalletConnectProvider =>
  (p as WalletConnectProvider | undefined)?.isWalletConnect === true;

/** The app's only localStorage accessors here: blocked storage throws from the accessor. */
export const store = {
  get(k: string): string | null {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set(k: string, v: string): void {
    try {
      localStorage.setItem(k, v);
    } catch {}
  },
  remove(k: string): void {
    try {
      localStorage.removeItem(k);
    } catch {}
  },
};
