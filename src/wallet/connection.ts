// The connect modal's WalletConnect pairing hook and its user-facing error copy (moved from the front).
import { isProviderDisconnected } from '@btr-protocol/sdk/eth';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { Eip1193Provider } from './wallet';
import { loadWc } from './walletConnectShell';

/** User-facing copy for a failed connect, injected or WalletConnect. */
export function connectError(e: unknown): string {
  const { code, message = '' } = (typeof e === 'object' && e !== null ? e : {}) as {
    code?: unknown;
    message?: string;
  };
  // "Extension context invalidated": the injected provider's port is dead until the page reloads.
  if (isProviderDisconnected(e))
    return 'Wallet extension reloaded. Refresh this page to reconnect.';
  if (code === 4001 || /reject|denied|cancel/i.test(message))
    return 'Connection cancelled in your wallet. Try again when ready.';
  if (code === 4100) return 'Wallet refused the request. Unlock it, then connect again.';
  if (code === 4902) return 'This network is not in your wallet. Add it, then connect again.';
  if (/Project ID/i.test(message))
    return 'WalletConnect is not configured here. Use an installed wallet.';
  if (/expired|time-?d? ?out/i.test(message))
    return 'Your wallet did not answer. Open it and try again.';
  return message || 'Could not connect. Try again, or pick another wallet.';
}

/**
 * The WalletConnect pairing behind the connect modal. Starts as soon as `enabled` (a phone can only
 * launch a wallet from a live user gesture, so the URI must exist before the tap); aborts on
 * unmount, `restart()` and `enabled` dropping. `qr` = data URL, built only while `wantQr`; `''` = render failed.
 */
export function useWalletConnection(o: {
  enabled: boolean;
  wantQr: boolean;
  chainId?: number;
  onConnected: (provider: Eip1193Provider) => Promise<void>;
}) {
  const { enabled, wantQr } = o;
  const [uri, setUri] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const latest = useRef(o);
  latest.current = o;

  useEffect(() => {
    setUri(null);
    setError('');
    if (!enabled) return;
    const ac = new AbortController();
    loadWc()
      .then((m) =>
        m.connectWithWalletConnect(setUri, { signal: ac.signal, chainId: latest.current.chainId }),
      )
      .then((wc) => latest.current.onConnected(wc.provider))
      .catch((e: unknown) => {
        if (ac.signal.aborted) return;
        console.error('[walletModal] connect failed', e);
        setUri(null); // a dead pairing must not stay tappable
        setError(connectError(e));
      });
    return () => ac.abort();
  }, [enabled, attempt]);

  useEffect(() => {
    setQr(null);
    if (!uri || !wantQr) return;
    let live = true;
    loadWc()
      .then((m) => m.generateQrCode(uri))
      .then((q) => live && setQr(q))
      .catch(() => live && setQr(''));
    return () => {
      live = false;
    };
  }, [uri, wantQr]);

  return { uri, qr, error, restart: () => setAttempt((n) => n + 1) };
}
