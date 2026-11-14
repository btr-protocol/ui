// THE connect modal of every BTR app (moved from btr.markets). Sections, empty ones not rendered: Recent (wallets this browser
// connected with, max 3), Installed (EIP-6963 + legacy injected), WalletConnect (QR on desktop, deep links to the wallet apps
// on phones; needs a project id), Other (popular wallets this browser lacks, each an install link). The app decides what a
// connection means through `onConnect`.
import type { WalletDef } from '@btr-protocol/sdk/eth/wallets';
import { WALLETS, getDownloadUrl, isKnownWallet, isMobile } from '@btr-protocol/sdk/eth/wallets';
import type { ComponentChildren } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { copyText } from '../lib/clipboard';
import { addNotification } from '../lib/notifications';
import { useKeyboardNav } from '../lib/useKeyboardNav';
import { BaseModal, MODAL_PADDING, ModalSection } from '../ui/BaseModal';
import { Button } from '../ui/Button';
import { CloseButton } from '../ui/CloseButton';
import { Notice, PageState } from '../ui/Feedback';
import { Icon } from '../ui/Icon';
import { TOOLTIP_LINK } from '../ui/InfoBox';
import { KeyboardShortcutGroup } from '../ui/KeyboardShortcut';
import { Spinner } from '../ui/Spinner';
import { WalletItemButton } from '../ui/WalletItemButton';
import { WalletGlyph, WalletTile } from './WalletGlyph';
import { WALLET_MODAL_LABELS, type WalletModalLabels } from './labels';
import { connectError, useWalletConnection } from './connection';
import { type InjectedWallet as WalletInfo, useInjectedWallets } from './useInjectedWallets';
import {
  type Eip1193Provider,
  type ProviderEntry,
  closeConnectModal,
  connectModalOpen,
  connectWallet,
  walletChainId,
} from './wallet';
import { OTHER_IDS, OTHER_MAX, type RecentRow, otherHref, sectionWallets } from './walletSections';
import { readRecent, recentEntry, recordRecent, removeRecent } from './recentWallets';
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
  const l = { ...WALLET_MODAL_LABELS, ...labels };
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
  const [recents, setRecents] = useState(readRecent);
  const qrRef = useRef<HTMLDivElement>(null);

  const keepLast = (id: string) => {
    if (onLastWallet) return onLastWallet(id);
    try {
      localStorage.setItem(LAST_WC_KEY, id);
    } catch {}
    setLastKept(id);
  };

  // Pair up front (mobile Chrome only launches an app from a live gesture, so the URI must exist
  // before the tap) unless a provider is injected: the wallet's own browser needs no pairing.
  const pairing = wcOn && isOpen && (more || (mobile && injected.length === 0));
  const showQr = pairing && (!mobile || qrOpen);
  const finish = async (provider: Eip1193Provider, w: ConnectedWallet) => {
    await onConnect(provider, w);
    if (isKnownWallet(w.id)) keepLast(w.id);
    // A wallet that shares its rdns with another announcement cannot be told apart next time: it is not remembered.
    const shared = w.via === 'injected' && injected.some((x) => x.provider === provider && sections.ambiguous.has(x));
    if (!shared) setRecents(recordRecent(recentEntry(w, w.via)));
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
    if (isOpen) setRecents(readRecent());
  }, [isOpen]);

  // The "Another device" button unmounts on click: keyboard focus moves to the QR block it opened.
  useEffect(() => {
    if (showQr && mobile) qrRef.current?.focus();
  }, [showQr, mobile]);

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
  const has = (name: string) => name.toLowerCase().includes(q);
  const sections = sectionWallets({ injected, recents, wcOn, nativeIds: detected });
  const recentRows = sections.recent.filter((r) => has(r.recent.name));
  const installedRows = sections.installed.filter((w) => has(w.name));
  const empty = injected.length === 0 && !wcOn;
  // On a phone with WalletConnect, Other would repeat the wallet apps behind the WalletConnect row.
  const appIds = mobile && wcOn ? mobileWallets().map((w) => w.id) : [];
  // Nothing to connect with and nothing to install from: the popular wallets anyway, never an empty modal.
  const popularDefs = OTHER_IDS.flatMap((id) => WALLETS.find((w) => w.id === id) ?? []).slice(0, OTHER_MAX);
  const otherRows = empty && sections.other.length === 0 ? popularDefs : sections.other.filter((w) => has(w.name) && !appIds.includes(w.id));
  const otherShown = otherRows.length > 0 && !waiting && !(pairing && mobile);
  const wcRowShown = wcOn && !(pairing && mobile) && !waiting;
  const wKey = (w: WalletInfo) => w.uuid ?? w.id;
  const otherLink = (w: WalletDef) => otherHref(w, mobile, location.href);
  // Keyboard order = the rows in view, top to bottom: Recent, Installed, the WalletConnect row, Other.
  const nav = [
    ...recentRows.map((r) =>
      r.wallet
        ? { id: wKey(r.wallet), run: () => void connectInjected(r.wallet as WalletInfo) }
        : { id: `wc-${r.recent.id}`, run: () => setMore(true) },
    ),
    ...installedRows.map((w) => ({ id: wKey(w), run: () => void connectInjected(w) })),
    ...(wcRowShown ? [{ id: 'wc', run: () => setMore(!more) }] : []),
    ...(otherShown ? otherRows.map((w) => ({ id: `other-${w.id}`, run: () => void window.open(otherLink(w).href, '_blank', 'noopener,noreferrer') })) : []),
  ];
  const navKey = nav.map((n) => n.id).join('|');
  const navIds = useMemo(() => navKey.split('|'), [navKey]);
  const searchable = !mobile && injected.length > 1;
  const { selectedIndex, handleKeyDown } = useKeyboardNav({
    items: navIds,
    onSelect: (id) => nav.find((n) => n.id === id)?.run(),
    isEnabled: isOpen && searchable && !connecting,
  });
  const hl = (id: string) => searchable && navIds[selectedIndex] === id;
  const recentIds = recentRows.map((r) => r.wallet?.id ?? r.recent.id);
  const apps = orderWallets(mobileWallets(), lastWallet, detected);
  const mine = apps.mine.filter((w) => !recentIds.includes(w.id));
  const popular = apps.popular.filter((w) => !recentIds.includes(w.id));
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

  const injectedRow = (w: WalletInfo) => (
    <WalletItemButton
      key={wKey(w)}
      name={mobile ? fill(l.connectInBrowser, w.name) : w.name}
      caption={sections.ambiguous.has(w) ? w.rdns || w.id : undefined}
      icon={<WalletGlyph id={w.id} name={w.name} announcedIcon={w.announcedIcon} size={28} />}
      variant="detected"
      isConnecting={connecting === w.id}
      disabled={connecting !== null}
      isHighlighted={hl(wKey(w))}
      onClick={() => connectInjected(w)}
    />
  );

  // A recent that connected through WalletConnect: a phone with a live pairing opens that wallet's app, anything else starts the pairing.
  const recentRow = ({ recent, wallet }: RecentRow<WalletInfo>) => {
    const def = wallet ? undefined : mobileWallets().find((w) => w.id === recent.id);
    return (
      <div key={wallet ? wKey(wallet) : `wc-${recent.id}`} className="flex items-stretch">
        <div className="flex-1 min-w-0">
          {wallet ? (
            injectedRow(wallet)
          ) : (
            <WalletItemButton
              name={recent.name}
              icon={def ? <WalletGlyph id={def.id} name={def.name} size={28} /> : <WalletTile icon="link" />}
              caption={l.viaWalletConnect}
              isHighlighted={hl(`wc-${recent.id}`)}
              onClick={(e) => (mobile && uri && def ? launch(def, e) : setMore(true))}
            />
          )}
        </div>
        <div className="w-10 shrink-0 flex items-center justify-center border-b border-border bg-bg-2 text-fg-2">
          <CloseButton size={16} aria-label={fill(l.removeRecent, recent.name)} onClick={() => setRecents(removeRecent(recent.id))} />
        </div>
      </div>
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

        {recentRows.length > 0 && (
          <ModalSection title={l.recent} groupId="wm-recent">
            {recentRows.map(recentRow)}
          </ModalSection>
        )}

        {installedRows.length > 0 && (
          <ModalSection title={mobile ? l.thisBrowser : l.installed} groupId="wm-installed">
            {installedRows.map(injectedRow)}
          </ModalSection>
        )}

        {empty && <p className={`${MODAL_PADDING} py-3 text-sm text-fg-2`}>{l.empty}</p>}

        {wcOn && (
          <ModalSection title={l.walletConnect} groupId="wm-wc">
            {wcRowShown && (
              <WalletItemButton
                name={mobile ? l.otherWallets : l.connectMobile}
                icon={<WalletTile icon="link" />}
                caption={mobile ? l.appsCaption : l.qrCaption}
                isSelected={pairing}
                isHighlighted={hl('wc')}
                onClick={() => setMore(!more)}
              />
            )}

            {pairing && mobile && !waiting && (
              <>
                {!uri && !pairError && <p className={`${MODAL_PADDING} py-3 text-xs text-fg-2`}>{l.preparing}</p>}
                {mine.map(row)}
                {popular.map(row)}
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
              <div ref={qrRef} tabIndex={-1} role="group" aria-label={l.qrAlt} className="flex flex-col gap-4 items-center px-4 py-4 outline-none">
                {qr ? (
                  <div className="bg-white p-2 rounded-lg">
                    <img src={qr} alt={l.qrAlt} className="w-full max-w-60 aspect-square" />
                  </div>
                ) : qr === '' || pairError ? (
                  <PageState kind="error" message={l.qrFailed} className="py-0" />
                ) : (
                  <PageState kind="loading" message={l.qrLoading} className="py-8" />
                )}
                <Button disabled={!uri} onClick={copy} leftIcon={copyGlyph}>
                  {copied ? l.copied : l.copyLink}
                </Button>
              </div>
            )}
          </ModalSection>
        )}

        {/* On a phone the open pairing already lists the wallet apps: no second list of the same wallets. */}
        {otherShown && (
          <ModalSection title={empty ? l.installWallet : l.other} groupId="wm-other">
            {otherRows.map((w) => {
              const { href, deepLink } = otherLink(w);
              return (
                <WalletItemButton
                  key={w.id}
                  name={w.name}
                  icon={<WalletGlyph id={w.id} name={w.name} size={28} />}
                  caption={deepLink ? l.open : l.install}
                  ariaLabel={deepLink ? undefined : `${w.name}, ${l.install} ${l.newTab}`}
                  variant="discover"
                  isHighlighted={hl(`other-${w.id}`)}
                  href={href}
                  external={!deepLink}
                  onClick={() => {}}
                />
              );
            })}
          </ModalSection>
        )}
        {extra}
      </>
    </BaseModal>
  );
}
