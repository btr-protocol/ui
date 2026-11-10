// THE connect modal of every BTR app (moved from btr.markets): installed wallets (EIP-6963 + legacy injected), a
// WalletConnect pairing (QR on desktop, deep links to the wallet apps on phones), the in-wallet-browser rows, and the
// "last used" / natively-detected ordering. The app decides what a connection means through `onConnect`.
import type { WalletDef } from '@btr-protocol/sdk/eth/wallets';
import { getDownloadUrl, isKnownWallet, isMobile } from '@btr-protocol/sdk/eth/wallets';
import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { copyText } from '../lib/clipboard';
import { addNotification } from '../lib/notifications';
import { useKeyboardNav } from '../lib/useKeyboardNav';
import { BaseModal, MODAL_PADDING, ModalSection } from '../ui/BaseModal';
import { Button } from '../ui/Button';
import { Notice, PageState } from '../ui/Feedback';
import { Icon } from '../ui/Icon';
import { TOOLTIP_LINK } from '../ui/InfoBox';
import { KeyboardShortcutGroup } from '../ui/KeyboardShortcut';
import { Spinner } from '../ui/Spinner';
import { WalletItemButton } from '../ui/WalletItemButton';
import { WalletGlyph } from './WalletGlyph';
import { connectError, useWalletConnection } from './connection';
import { type WalletInfo, useInjectedWallets } from './useInjectedWallets';
import {
  type Eip1193Provider,
  type ProviderEntry,
  closeConnectModal,
  connectModalOpen,
  connectWallet,
  walletChainId,
} from './wallet';
import { walletConnectEnabled } from './walletConnectShell';
import {
  browseHref,
  installedWallets,
  mobileWallets,
  openInWallet,
  openWallet,
  orderWallets,
  walletHref,
} from './walletLink';

export interface WalletModalLabels {
  title: string;
  searchPlaceholder: string;
  installed: string;
  thisBrowser: string;
  /** `{name}` = the wallet. */
  connectInBrowser: string;
  empty: string;
  navigate: string;
  select: string;
  close: string;
  connectMobile: string;
  otherWallets: string;
  preparing: string;
  yourWallets: string;
  moreWallets: string;
  wallets: string;
  lastUsed: string;
  opensInApp: string;
  /** `{name}` = the wallet. */
  waitingFor: string;
  approveThere: string;
  openAgain: string;
  showQr: string;
  cancel: string;
  /** `{name}` = the wallet. */
  getWallet: string;
  anotherDevice: string;
  anotherDeviceQr: string;
  scanWithMobile: string;
  qrAlt: string;
  qrFailed: string;
  qrLoading: string;
  copyLink: string;
  copied: string;
  tryAgain: string;
  /** `{name}` = the wallet. */
  couldNotOpen: string;
  connectedViaWc: string;
}

const LABELS: WalletModalLabels = {
  title: 'Connect wallet',
  searchPlaceholder: 'Search wallets...',
  installed: 'Installed',
  thisBrowser: 'This browser',
  connectInBrowser: 'Connect {name} (this browser)',
  empty: 'No browser wallet detected.',
  navigate: 'Navigate',
  select: 'Select',
  close: 'Close',
  connectMobile: 'Connect a mobile wallet',
  otherWallets: 'Other wallets',
  preparing: 'Preparing connection...',
  yourWallets: 'Your wallets',
  moreWallets: 'More wallets',
  wallets: 'Wallets',
  lastUsed: 'Last used',
  opensInApp: 'Opens this page in the app',
  waitingFor: 'Waiting for {name}...',
  approveThere: 'Approve the connection there, then come back here.',
  openAgain: 'Open again',
  showQr: 'Show QR',
  cancel: 'Cancel',
  getWallet: 'Not installed? Get {name}',
  anotherDevice: 'Another device',
  anotherDeviceQr: 'Another device (QR code)',
  scanWithMobile: 'Scan with a mobile wallet',
  qrAlt: 'WalletConnect QR code',
  qrFailed: 'Could not generate the QR code.',
  qrLoading: 'Generating QR code...',
  copyLink: 'Copy link',
  copied: 'Copied',
  tryAgain: 'Try again',
  couldNotOpen: 'Could not open {name}. Install it, or use another device.',
  connectedViaWc: 'Connected via WalletConnect',
};

/** What connected: catalog id (`metamask`, `walletconnect`, an rdns for an unknown wallet), name, announced icon. */
export interface ConnectedWallet {
  id: string;
  name: string;
  icon?: string;
  rdns?: string;
  /** `injected` = a provider in this page; `walletconnect` = a WalletConnect session. */
  via: 'injected' | 'walletconnect';
}

const LAST_WC_KEY = 'btr-last-wc-wallet';
const readLastWc = (): string | undefined => {
  try {
    return localStorage.getItem(LAST_WC_KEY) ?? undefined;
  } catch {
    return undefined;
  }
};

/** Default `onConnect`: the kit store (`walletAddress` / `walletEntry`, kept in sync with the wallet's events). */
const storeConnect = async (provider: Eip1193Provider, w: ConnectedWallet) => {
  const entry: ProviderEntry = { info: { uuid: w.rdns ?? w.id, name: w.name, icon: w.icon, rdns: w.rdns, id: w.via === 'walletconnect' ? 'walletconnect' : w.id }, provider };
  await connectWallet(entry);
};

export interface WalletModalProps {
  /** Defaults to the kit store (`connectModalOpen`, opened by `WalletButton` / `openConnectModal`). */
  isOpen?: boolean;
  onClose?: () => void;
  /** Adopt the connected provider. Default: the kit store (`connectWallet`). Throw to show the error in the modal. */
  onConnect?: (provider: Eip1193Provider, wallet: ConnectedWallet) => Promise<void>;
  /** Chain the WalletConnect session should open on. Default: the kit store's chain. */
  chainId?: number;
  /** Catalog id of the last wallet launched through WalletConnect (orders the phone list). Default: kept by the kit. */
  lastWallet?: string;
  onLastWallet?: (id: string) => void;
  labels?: Partial<WalletModalLabels>;
  /** Footer copy (terms, "get a wallet" link). */
  footer?: ComponentChildren;
  /** Extra sections below the wallet list. */
  extra?: ComponentChildren;
}

const fill = (s: string, name: string) => s.replace('{name}', name);

export function WalletModal({
  isOpen = connectModalOpen.value,
  onClose = closeConnectModal,
  onConnect = storeConnect,
  chainId = walletChainId.value,
  lastWallet: lastProp,
  onLastWallet,
  labels,
  footer,
  extra,
}: WalletModalProps) {
  const l = { ...LABELS, ...labels };
  const injected = useInjectedWallets();
  const [lastKept, setLastKept] = useState(readLastWc);
  const lastWallet = lastProp ?? lastKept;
  const mobile = isMobile();
  const wcOn = walletConnectEnabled();

  const [search, setSearch] = useState('');
  const [more, setMore] = useState(false); // opted into the pairing flow although a provider is injected
  const [qrOpen, setQrOpen] = useState(false); // mobile: QR is the secondary "another device" path
  const [waiting, setWaiting] = useState<WalletDef | null>(null);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const [copied, setCopied] = useState(false);
  const [detected, setDetected] = useState<string[]>([]);

  const keepLast = (id: string) => {
    if (onLastWallet) return onLastWallet(id);
    try {
      localStorage.setItem(LAST_WC_KEY, id);
    } catch {}
    setLastKept(id);
  };

  // Pair up front (mobile Chrome only launches an app from a live gesture, so the URI must exist
  // before the tap) unless a provider is injected: the wallet's own browser needs no pairing.
  const pairing = wcOn && isOpen && (injected.length === 0 || more);
  const showQr = pairing && (!mobile || qrOpen);
  const finish = async (provider: Eip1193Provider, w: ConnectedWallet) => {
    await onConnect(provider, w);
    if (isKnownWallet(w.id)) keepLast(w.id);
    onClose();
  };
  const {
    uri,
    qr,
    error: pairError,
    restart,
  } = useWalletConnection({
    enabled: pairing,
    wantQr: showQr,
    chainId,
    onConnected: async (p) => {
      await finish(p, { id: waiting?.id ?? 'walletconnect', name: waiting?.name ?? 'WalletConnect', via: 'walletconnect' });
      addNotification('success', l.connectedViaWc);
    },
  });

  useEffect(() => {
    void installedWallets(mobileWallets()).then(setDetected);
  }, []);

  const retry = () => {
    setErr('');
    setWaiting(null);
    restart();
  };

  const connectInjected = async (w: WalletInfo) => {
    setConnecting(w.id);
    setErr('');
    try {
      await finish(w.provider as Eip1193Provider, { id: w.id, name: w.name, icon: w.announcedIcon, rdns: w.rdns, via: 'injected' });
    } catch (e) {
      setErr(connectError(e));
    } finally {
      setConnecting(null);
    }
  };

  const launch = (w: WalletDef, e: Event) => {
    e.preventDefault();
    if (w.browse) return void openInWallet(w);
    if (!uri) return;
    setWaiting(w);
    setErr('');
    void openWallet(w, uri).then((ok) => {
      if (!ok) setErr(fill(l.couldNotOpen, w.name));
    });
  };

  const copy = () =>
    uri &&
    copyText(uri).then((ok) => {
      if (!ok) return;
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });

  const q = search.toLowerCase();
  const shown = injected.filter((w) => w.name.toLowerCase().includes(q));
  const searchable = !mobile && injected.length > 1;
  const { selectedIndex, handleKeyDown } = useKeyboardNav({
    items: shown,
    onSelect: connectInjected,
    isEnabled: isOpen && searchable && !connecting,
  });
  const { mine, popular } = orderWallets(mobileWallets(), lastWallet, detected);
  const error = err || pairError;
  const copyGlyph = <Icon name={copied ? 'check-circle' : 'copy'} className="w-4 h-4" />;

  const row = (w: WalletDef) => {
    const browse = !!w.browse;
    return (
      <WalletItemButton
        key={w.id}
        name={w.name}
        icon={<WalletGlyph id={w.id} name={w.name} size={28} />}
        caption={browse ? l.opensInApp : w.id === lastWallet ? l.lastUsed : undefined}
        variant={detected.includes(w.id) ? 'detected' : 'default'}
        href={browse ? browseHref(w) : uri ? walletHref(w, uri) : undefined}
        disabled={!browse && !uri}
        onClick={(e) => launch(w, e)}
      />
    );
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={(open) => !open && onClose()}
      title={l.title}
      headerType={searchable ? 'input' : 'title'}
      placeholder={l.searchPlaceholder}
      searchValue={search}
      onSearchChange={setSearch}
      onSearchKeyDown={searchable ? handleKeyDown : undefined}
      size="sm"
      footerNav={
        searchable ? (
          <KeyboardShortcutGroup
            shortcuts={[
              { keys: '↑↓', label: l.navigate },
              { keys: 'Enter', label: l.select },
              { keys: 'Esc', label: l.close },
            ]}
          />
        ) : undefined
      }
      footerContent={footer ? <div className="flex flex-col gap-1 text-center text-xs text-fg-2">{footer}</div> : undefined}
    >
      <>
        {error && (
          <div className="mx-4 mt-4">
            <Notice
              tone="error"
              role="alert"
              action={
                pairError ? (
                  <Button size="xs" onClick={retry}>
                    {l.tryAgain}
                  </Button>
                ) : undefined
              }
            >
              {error}
            </Notice>
          </div>
        )}

        {injected.length > 0 && (
          <ModalSection title={mobile ? l.thisBrowser : l.installed}>
            {shown.map((w, i) => (
              <WalletItemButton
                key={w.id}
                name={mobile ? fill(l.connectInBrowser, w.name) : w.name}
                icon={<WalletGlyph id={w.id} name={w.name} announcedIcon={w.announcedIcon} size={28} />}
                variant="detected"
                isConnecting={connecting === w.id}
                disabled={connecting !== null}
                isHighlighted={searchable && selectedIndex === i}
                onClick={() => connectInjected(w)}
              />
            ))}
          </ModalSection>
        )}

        {injected.length === 0 && !wcOn && <p className={`${MODAL_PADDING} py-3 text-sm text-fg-2`}>{l.empty}</p>}

        {wcOn && !pairing && (
          <div className={`${MODAL_PADDING} py-3`}>
            <Button onClick={() => setMore(true)}>{mobile ? l.otherWallets : l.connectMobile}</Button>
          </div>
        )}

        {pairing && mobile && !waiting && (
          <>
            {!uri && !pairError && <p className={`${MODAL_PADDING} pt-3 text-xs text-fg-2`}>{l.preparing}</p>}
            {mine.length > 0 && <ModalSection title={l.yourWallets}>{mine.map(row)}</ModalSection>}
            <ModalSection title={mine.length ? l.moreWallets : l.wallets}>{popular.map(row)}</ModalSection>
          </>
        )}

        {waiting && (
          <div className="flex flex-col gap-2 items-center px-4 py-6 text-center">
            <WalletGlyph id={waiting.id} name={waiting.name} size={48} />
            <p className="flex items-center gap-2 text-sm text-fg-0">
              <Spinner />
              {fill(l.waitingFor, waiting.name)}
            </p>
            <p className="text-xs text-fg-2">{l.approveThere}</p>
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="primary" onClick={() => uri && void openWallet(waiting, uri)}>
                {l.openAgain}
              </Button>
              <Button onClick={() => setQrOpen(true)}>{l.showQr}</Button>
              <Button variant="ghost" onClick={retry}>
                {l.cancel}
              </Button>
            </div>
            <a
              href={getDownloadUrl(waiting.id) ?? undefined}
              target="_blank"
              rel="noopener noreferrer"
              className={`text-xs ${TOOLTIP_LINK}`}
            >
              {fill(l.getWallet, waiting.name)}
            </a>
          </div>
        )}

        {pairing && mobile && !waiting && !qrOpen && (
          <div className={`${MODAL_PADDING} py-3`}>
            <Button onClick={() => setQrOpen(true)}>{l.anotherDeviceQr}</Button>
          </div>
        )}

        {showQr && (
          <ModalSection title={mobile ? l.anotherDevice : l.scanWithMobile}>
            <div className="flex flex-col gap-4 items-center px-4 py-4">
              {qr ? (
                <div className="bg-white p-2 rounded-lg">
                  <img src={qr} alt={l.qrAlt} className="w-full max-w-60 aspect-square" />
                </div>
              ) : qr === '' || pairError ? (
                <PageState kind="error" message={l.qrFailed} className="py-0" />
              ) : (
                <PageState kind="loading" message={l.qrLoading} className="py-8" />
              )}
              <Button
                disabled={!uri}
                onClick={copy}
                leftIcon={copyGlyph}
              >
                {copied ? l.copied : l.copyLink}
              </Button>
            </div>
          </ModalSection>
        )}
        {extra}
      </>
    </BaseModal>
  );
}
