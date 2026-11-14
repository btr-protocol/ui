// Account mismatch, the account switch flow, the shared chain list in the wallet modal, the connect modal and the
// WalletConnect glue's account events. happy-dom; fake EIP-1193 providers record every request.
import { afterEach, describe, expect, test } from 'bun:test';
import {
  ConnectModalHost,
  WalletButton,
  WrongAccountError,
  accountGate,
  accountList,
  assertActiveAccount,
  configureWalletConnect,
  configureWalletLinks,
  connectWallet,
  disconnectWallet,
  installedWallets,
  openWallet,
  orderWallets,
  personalSign,
  pickInstalled,
  restoreWallet,
  switchWalletAccount,
  walletAccounts,
  walletAddress,
  webHref,
} from '../src';
import { WALLETS } from '@btr-protocol/sdk/eth/wallets';
import { WalletModal } from '../src/wallet/WalletModal';
import { labelsFrom, WALLET_MODAL_LABELS } from '../src';
import { act, click, mount, until, useDom } from './dom';

useDom();

const SESSION = '0xaB7B000000000000000000000000000000000760';
const OTHER = '0x0b83000000000000000000000000000000001111';
const THIRD = '0x3333000000000000000000000000000000003333';

/** A wallet whose active account is `accounts[0]`; `wallet_requestPermissions` moves it to `pickTo` (the user's choice). */
function fakeWallet(accounts: string[], pickTo?: string) {
  const calls: { method: string; params?: unknown[] }[] = [];
  const listeners = new Map<string, Set<(...a: unknown[]) => void>>();
  let list = [...accounts];
  const emit = (ev: string, arg: unknown) => listeners.get(ev)?.forEach((l) => l(arg));
  const provider = {
    calls,
    emit,
    setAccounts(next: string[]) {
      list = next;
      emit('accountsChanged', next);
    },
    async request({ method, params }: { method: string; params?: unknown[] }) {
      calls.push({ method, params });
      if (method === 'eth_accounts' || method === 'eth_requestAccounts') return list;
      if (method === 'eth_chainId') return '0x8f';
      if (method === 'wallet_requestPermissions') {
        if (pickTo) list = [pickTo, ...list.filter((a) => a !== pickTo)];
        return [{ parentCapability: 'eth_accounts' }];
      }
      if (method === 'personal_sign') return '0xsig';
      throw Object.assign(new Error('unsupported'), { code: 4200 });
    },
    on(ev: string, l: (...a: unknown[]) => void) {
      if (!listeners.has(ev)) listeners.set(ev, new Set());
      listeners.get(ev)?.add(l);
    },
    removeListener(ev: string, l: (...a: unknown[]) => void) {
      listeners.get(ev)?.delete(l);
    },
  };
  return provider;
}
const entry = (p: ReturnType<typeof fakeWallet>, rdns = 'io.rabby') => ({ info: { uuid: rdns, name: 'Rabby', rdns }, provider: p });

afterEach(() => {
  disconnectWallet();
  document.body.innerHTML = '';
  try {
    localStorage.clear();
  } catch {}
});

describe('account mismatch', () => {
  test('accountList keeps valid addresses, active first, deduped case-insensitively', () => {
    expect(accountList([OTHER, "nope", SESSION.toLowerCase(), SESSION]) as string[]).toEqual([OTHER, SESSION.toLowerCase()]);
    expect(accountList(undefined)).toEqual([]);
  });

  test('accountGate: mismatch only when both sides are known and differ', () => {
    expect(accountGate(OTHER, SESSION).mismatch).toBe(true);
    expect(accountGate(SESSION.toLowerCase(), SESSION).mismatch).toBe(false);
    expect(accountGate(undefined, SESSION).mismatch).toBe(false);
  });

  test('a wallet active on another account never gets the signature request', async () => {
    const w = fakeWallet([OTHER, SESSION]);
    await expect(personalSign(entry(w), SESSION, 'hello')).rejects.toBeInstanceOf(WrongAccountError);
    expect(w.calls.some((c) => c.method === 'personal_sign')).toBe(false);
    const e = await assertActiveAccount(w, SESSION).catch((x: WrongAccountError) => x);
    expect(e).toBeInstanceOf(WrongAccountError);
    expect((e as WrongAccountError).active).toBe(OTHER);
    expect((e as WrongAccountError).expected).toBe(SESSION);
  });

  test('the live account is re-read right before signing (a stale store cannot vouch for it)', async () => {
    const w = fakeWallet([SESSION]);
    await connectWallet(entry(w));
    expect(walletAddress.value).toBe(SESSION);
    // The wallet switched without telling us (no accountsChanged): the guard still reads it.
    w.request = ((orig) => async (r: { method: string; params?: unknown[] }) =>
      r.method === 'eth_accounts' ? [OTHER] : orig(r))(w.request.bind(w));
    await expect(personalSign(entry(w), SESSION, 'hi')).rejects.toBeInstanceOf(WrongAccountError);
    expect(walletAddress.value).toBe(OTHER); // and the store followed
  });

  test('matching account signs', async () => {
    const w = fakeWallet([SESSION]);
    expect(await personalSign(entry(w), SESSION.toLowerCase(), 'hello')).toBe('0xsig');
  });
});

describe('store + switch flow', () => {
  test('accountsChanged updates the active account and the list immediately', async () => {
    const w = fakeWallet([SESSION, OTHER]);
    await connectWallet(entry(w));
    expect(walletAccounts.value).toEqual([SESSION, OTHER]);
    w.setAccounts([OTHER, SESSION]);
    expect(walletAddress.value).toBe(OTHER);
    expect(walletAccounts.value).toEqual([OTHER, SESSION]);
    w.setAccounts([]);
    expect(walletAddress.value).toBeUndefined(); // locked / revoked = disconnected
  });

  test('switchWalletAccount: already active -> no picker; else the wallet picker, then re-check', async () => {
    const same = fakeWallet([SESSION]);
    expect(await switchWalletAccount(same, SESSION)).toBe(true);
    expect(same.calls.some((c) => c.method === 'wallet_requestPermissions')).toBe(false);

    const w = fakeWallet([OTHER, SESSION], SESSION);
    expect(await switchWalletAccount(w, SESSION)).toBe(true);
    expect(w.calls.map((c) => c.method)).toContain('wallet_requestPermissions');

    const wrong = fakeWallet([OTHER], THIRD); // the user picked yet another account
    expect(await switchWalletAccount(wrong, SESSION)).toBe(false);
  });

  test('restoreWallet re-adopts the last injected wallet without a prompt', async () => {
    const w = fakeWallet([SESSION]);
    await connectWallet(entry(w, 'io.metamask'));
    disconnectWallet();
    expect(await restoreWallet([entry(w, 'io.metamask')])).toBe(SESSION);
    expect(w.calls.filter((c) => c.method === 'eth_requestAccounts')).toHaveLength(1); // only the first connect prompted
  });
});

describe('WalletButton account modal', () => {
  const chains = [
    { id: 143, name: 'Monad' },
    { id: 1, name: 'Ethereum' },
    { id: 9999, name: 'Roadmap', planned: true },
    { id: 11155111, name: 'Sepolia', testnet: true },
  ];
  const open = (props: Parameters<typeof WalletButton>[0]) => {
    const r = mount(<WalletButton {...props} />);
    click(r.host.querySelector('button') as HTMLElement);
    return r;
  };
  const text = () => document.body.textContent ?? '';
  const buttons = () => [...document.body.querySelectorAll('button')] as HTMLButtonElement[];
  const byText = (t: string) => buttons().find((b) => b.textContent?.includes(t));

  test('wrong account: primary says "Switch wallet to <session>", secondary "Use <active> instead"', async () => {
    const switched: string[] = [];
    open({ address: SESSION, sessionAddress: SESSION, activeAddress: OTHER, accounts: [OTHER, SESSION], chainId: 143, chains, onSwitchAccount: (a) => (switched.push(a), true) });
    await until(() => text().includes('Switch wallet to'));
    expect(byText('Switch wallet to 0xaB7B…0760')).toBeTruthy();
    expect(byText('Use 0x0b83…1111 instead')).toBeTruthy();
    click(byText('Switch wallet to') as HTMLElement);
    await until(() => switched.length > 0);
    expect(switched).toEqual([SESSION]);
  });

  test('lists accounts with In wallet / Signed in / Signer badges; one click switches', async () => {
    const switched: string[] = [];
    open({ address: SESSION, sessionAddress: SESSION, activeAddress: SESSION, accounts: [SESSION, OTHER], signers: [SESSION, OTHER], chainId: 143, chains, onSwitchAccount: (a) => (switched.push(a), true) });
    await until(() => text().includes('Accounts'));
    expect(text()).not.toContain('Switch wallet to');
    expect(text()).toContain('In wallet');
    expect(text()).toContain('Signed in');
    expect((text().match(/Signer(?!s)/g) ?? []).length).toBeGreaterThanOrEqual(2);
    // the current account's row is selected, full contrast, and not a switch target
    const current = buttons().find((b) => b.textContent?.includes('0xaB7B…0760')) as HTMLButtonElement;
    expect(current.disabled).toBe(false);
    click(current);
    await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
    expect(switched).toEqual([]);
    const row = buttons().find((b) => b.textContent?.includes('0x0b83…1111')) as HTMLButtonElement;
    click(row);
    await until(() => switched.length > 0);
    expect(switched).toEqual([OTHER]);
  });

  test('the chain list is the kit ChainSelect list: mainnets (planned last), testnets behind the switch', async () => {
    open({ address: SESSION, chainId: 143, chains, accounts: [SESSION], activeAddress: SESSION });
    await until(() => text().includes('Monad'));
    expect(text()).toContain('Ethereum');
    expect(text()).toContain('143');
    expect(text()).toContain('Roadmap');
    expect(text()).not.toContain('Sepolia');
    expect(text().indexOf('Ethereum')).toBeLessThan(text().indexOf('Roadmap'));
    expect(document.body.querySelector('[aria-label="Show testnets"]')).toBeTruthy();
  });
});

describe('WalletModal', () => {
  const announce = (p: ReturnType<typeof fakeWallet>, rdns: string, name: string) =>
    window.dispatchEvent(new CustomEvent('eip6963:announceProvider', { detail: { info: { uuid: rdns, name, icon: '', rdns }, provider: p } }));

  test('lists announced wallets and hands the chosen provider to onConnect', async () => {
    const w = fakeWallet([SESSION]);
    const got: string[] = [];
    let closed = false;
    mount(<WalletModal isOpen onClose={() => (closed = true)} onConnect={async (p, info) => void got.push(`${info.id}:${(await p.request({ method: 'eth_accounts' }) as string[])[0]}`)} />);
    act(() => { announce(w, 'io.rabby', 'Rabby Wallet'); });
    await until(() => (document.body.textContent ?? '').includes('Rabby'));
    click([...document.body.querySelectorAll('button')].find((b) => b.textContent?.includes('Rabby')) as HTMLElement);
    await until(() => closed);
    expect(got).toEqual([`rabby:${SESSION}`]);
  });

  test('WalletConnect path appears only when a project id is configured', async () => {
    configureWalletConnect({ projectId: '', metadata: { name: 'x', description: 'x', url: 'https://x', icons: [] }, chains: () => [], loadSignClient: async () => ({ default: { init: async () => ({}) } }) });
    const a = mount(<WalletModal isOpen onClose={() => {}} />);
    act(() => { announce(fakeWallet([SESSION]), 'io.metamask', 'MetaMask'); });
    await until(() => (document.body.textContent ?? '').includes('MetaMask'));
    expect(document.body.textContent).not.toContain('Connect a mobile wallet');
    a.unmount();
    configureWalletConnect({ projectId: 'public-id', metadata: { name: 'x', description: 'x', url: 'https://x', icons: [] }, chains: () => [143], loadSignClient: async () => ({ default: { init: async () => ({}) } }) });
    mount(<WalletModal isOpen onClose={() => {}} />);
    act(() => { announce(fakeWallet([SESSION]), 'io.metamask', 'MetaMask'); });
    await until(() => (document.body.textContent ?? '').includes('Connect a mobile wallet'));
    expect(document.body.textContent).toContain('Connect a mobile wallet');
  });
});

describe('ConnectModalHost', () => {
  test('nothing while closed; the lazy modal on open', async () => {
    const { openConnectModal, closeConnectModal } = await import('../src');
    mount(<ConnectModalHost />);
    expect(document.body.textContent).not.toContain('Connect wallet');
    act(() => openConnectModal());
    await until(() => (document.body.textContent ?? '').includes('Connect wallet'));
    expect(document.body.textContent).toContain('Connect wallet');
    act(() => closeConnectModal());
  });
});

describe('walletLink (moved from the front)', () => {
  const WC = 'wc:abc@2?relay-protocol=irn&symKey=k';
  const w = (id: string) => WALLETS.find((x) => x.id === id) as (typeof WALLETS)[number];
  test('webHref: explicit intent on Android, pass-through elsewhere', () => {
    expect(webHref(WC, 'com.binance.dev', true)).toBe('intent:abc@2?relay-protocol=irn&symKey=k#Intent;scheme=wc;package=com.binance.dev;end');
    expect(webHref('https://x.io/wc?uri=a', 'p', true)).toBe('https://x.io/wc?uri=a');
    expect(webHref(WC, 'p', false)).toBe(WC);
  });
  test('orders last-used, installed, rest', () => {
    const cat = ['metamask', 'trust', 'rabby', 'safe'].map(w);
    expect(pickInstalled(cat, ['com.debank.rabbymobile', 'io.metamask'])).toEqual(['metamask', 'rabby']);
    const { mine, popular } = orderWallets(cat, 'safe', ['metamask', 'rabby']);
    expect(mine.map((x) => x.id)).toEqual(['safe', 'metamask', 'rabby']);
    expect(popular.map((x) => x.id)).toEqual(['trust']);
  });
  test('native plugin: a thenable proxy resolves instead of hanging', async () => {
    const proxy = new Proxy({}, { get: (_, k) => (k === 'then' ? () => { throw new Error('then'); } : k === 'installed' ? async () => ({ installed: ['io.metamask'] }) : async () => ({ opened: true })) });
    configureWalletLinks({ native: async () => ({ api: proxy as never }) });
    (globalThis as { Capacitor?: unknown }).Capacitor = { isNativePlatform: () => true };
    try {
      expect(await installedWallets([w('metamask'), w('rabby')])).toEqual(['metamask']);
      expect(await openWallet(w('metamask'), WC)).toBe(true);
    } finally {
      (globalThis as { Capacitor?: unknown }).Capacitor = undefined;
      configureWalletLinks({});
    }
  });
});

describe('WalletConnect glue', () => {
  test('reads go to the configured reader; session accountsChanged reaches the provider', async () => {
    const { buildWcProvider, bindClientEvents } = await import('../src/wallet/walletConnect');
    const reads: string[] = [];
    configureWalletConnect({
      projectId: 'public-id',
      metadata: { name: 'x', description: 'x', url: 'https://x', icons: [] },
      chains: () => [143],
      reader: (id, method) => ({ request: async () => (reads.push(`${id}:${method}`), '0x1') }),
      loadSignClient: async () => ({ default: { init: async () => ({}) } }),
    });
    const on = new Map<string, (ev: unknown) => void>();
    const client = { on: (n: string, cb: (ev: unknown) => void) => on.set(n, cb), request: async () => '0xsig', disconnect: async () => {}, session: { getAll: () => [] }, core: { relayer: { restartTransport: async () => {} }, pairing: { disconnect: async () => {} } } };
    bindClientEvents(client as never);
    const wc = buildWcProvider(client as never, { topic: 't', expiry: 9e9, namespaces: { eip155: { accounts: [`eip155:143:${SESSION}`], methods: ['personal_sign'] } } });
    expect(await wc.provider.request({ method: 'eth_blockNumber' })).toBe('0x1');
    expect(reads).toEqual(['143:eth_blockNumber']);
    const seen: unknown[] = [];
    wc.provider.on?.('accountsChanged', (a) => seen.push(a));
    on.get('session_event')?.({ topic: 't', params: { event: { name: 'accountsChanged', data: [`eip155:143:${OTHER}`] } } });
    expect(seen).toEqual([[OTHER]]);
    expect(await wc.provider.request({ method: 'eth_accounts' })).toEqual([OTHER]);
    await wc.disconnect();
  });
});

describe('configureNotifications', () => {
  test("the kit's toasts reach the host's store when a sink is set", async () => {
    const { addNotification, configureNotifications } = await import('../src');
    const got: string[] = [];
    configureNotifications({ add: (t, m) => (got.push(`${t}:${m}`), 'x') });
    try {
      addNotification('success', 'Connected via WalletConnect');
    } finally {
      configureNotifications({});
    }
    expect(got).toEqual(['success:Connected via WalletConnect']);
  });
});

describe('review fixes', () => {
  test('restoreWallet never binds over a connect that landed while it was awaiting', async () => {
    const slow = fakeWallet([OTHER]);
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const orig = slow.request.bind(slow);
    slow.request = async (r: { method: string; params?: unknown[] }) => (r.method === 'eth_accounts' ? (await gate, [OTHER]) : orig(r));
    localStorage.setItem('btr-last-wallet', 'io.slow');
    const restoring = restoreWallet([entry(slow, 'io.slow')]);
    const manual = fakeWallet([SESSION]);
    await connectWallet(entry(manual, 'io.rabby'));
    release();
    await restoring;
    expect(walletAddress.value).toBe(SESSION);
  });

  test('a transient disconnect (1013) re-checks the wallet; 4900 logs out', async () => {
    const w = fakeWallet([SESSION]);
    await connectWallet(entry(w));
    w.emit('disconnect', { code: 1013 });
    await act(async () => { await new Promise((r) => setTimeout(r, 10)); });
    expect(walletAddress.value).toBe(SESSION);
    w.emit('disconnect', { code: 4900 });
    expect(walletAddress.value).toBeUndefined();
  });

  test('account rows: arrow keys move focus; a busy list keeps focus (aria-disabled, not disabled)', async () => {
    const { AccountList } = await import('../src');
    const { host } = mount(<AccountList accounts={[SESSION, OTHER, THIRD]} active={SESSION} busy={OTHER} onSelect={() => {}} />);
    const rows = [...host.querySelectorAll('button')].filter((b) => /0x/.test(b.textContent ?? ''));
    expect(rows.every((b) => !b.disabled && b.getAttribute('aria-disabled') === 'true')).toBe(true);
    rows[0]!.focus();
    act(() => { rows[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })); });
    expect(document.activeElement).toBe(rows[1]!);
    act(() => { rows[1]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true })); });
    expect(document.activeElement).toBe(rows[2]!);
  });

  test('labelsFrom walks the keys: the app translates without mirroring the list', () => {
    const l = labelsFrom(WALLET_MODAL_LABELS, (k) => (k === 'title' ? 'Portefeuille' : undefined));
    expect(l.title).toBe('Portefeuille');
    expect(l.installed).toBe(WALLET_MODAL_LABELS.installed);
  });
});

describe('WalletConnect restore by topic', () => {
  test("pickLiveSession takes this app's topic only, never the newest other session", async () => {
    const { pickLiveSession, readWcFlag, wcFlag } = await import('../src/wallet/walletConnect');
    const s = (topic: string, expiry: number) => ({ topic, expiry, namespaces: { eip155: { accounts: [] } } });
    const all = [s('mine', 100), s('other-newer', 900)];
    expect(pickLiveSession(all, 50, 'mine')?.topic).toBe('mine');
    expect(pickLiveSession(all, 150, 'mine')).toBeUndefined(); // expired: nothing, not the other one
    expect(readWcFlag(wcFlag('mine', 143))).toEqual({ topic: 'mine', chain: 143 });
    expect(readWcFlag('143')).toBeUndefined(); // a pre-topic flag restores nothing
  });

  // One fake sign-client for the module (the glue caches it): sessions are mutable, disconnects recorded.
  const sessions: { topic: string; expiry: number; namespaces: { eip155: { accounts: string[] } } }[] = [];
  const ended: string[] = [];
  const fake = { on: () => {}, request: async () => '0x', disconnect: async ({ topic }: { topic: string }) => { ended.push(topic); }, session: { getAll: () => sessions }, core: { relayer: { restartTransport: async () => {} }, pairing: { disconnect: async () => {} } } };
  const sess = (topic: string, expiry = 9e9) => ({ topic, expiry, namespaces: { eip155: { accounts: [`eip155:143:${SESSION}`] } } });
  const setup = async () => {
    const wc = await import('../src/wallet/walletConnect');
    configureWalletConnect({ projectId: 'public-id', metadata: { name: 'x', description: 'x', url: 'https://x', icons: [] }, chains: () => [143], loadSignClient: async () => ({ default: { init: async () => fake } }) });
    await wc.disconnectWalletConnect();
    sessions.length = 0;
    ended.length = 0;
    return wc;
  };

  test('restore: the stored topic comes back, other sessions are ended as orphans', async () => {
    const wc = await setup();
    sessions.push(sess('mine'), sess('orphan'));
    localStorage.setItem('btr-wc-session', wc.wcFlag('mine', 143));
    const r = await wc.restoreWalletConnect();
    expect(r?.address).toBe(SESSION);
    expect(ended).toEqual(['orphan']);
    await r?.disconnect();
  });

  test('restore: an expired or missing topic restores nothing and clears the flag', async () => {
    const wc = await setup();
    sessions.push(sess('mine', 1), sess('other'));
    localStorage.setItem('btr-wc-session', wc.wcFlag('mine', 143));
    expect(await wc.restoreWalletConnect()).toBeNull();
    expect(localStorage.getItem('btr-wc-session')).toBeNull();
    localStorage.setItem('btr-wc-session', '143'); // pre-topic flag
    expect(await wc.restoreWalletConnect()).toBeNull();
    expect(localStorage.getItem('btr-wc-session')).toBeNull();
    localStorage.setItem('btr-wc-session', wc.wcFlag('gone', 143)); // topic no longer in the client
    expect(await wc.restoreWalletConnect()).toBeNull();
    expect(localStorage.getItem('btr-wc-session')).toBeNull();
  });

  test('switching to another wallet ends exactly that session and clears the flag; a newer session survives', async () => {
    const wc = await setup();
    sessions.push(sess('live'));
    const built = wc.buildWcProvider(fake as never, sess('live'));
    await connectWallet({ info: { uuid: 'walletconnect', name: 'WalletConnect', id: 'walletconnect' }, provider: built.provider });
    expect(localStorage.getItem('btr-wc-session')).toContain('live');
    await connectWallet(entry(fakeWallet([OTHER])));
    await until(() => ended.includes('live'));
    expect(localStorage.getItem('btr-wc-session')).toBeNull();
    // the old session's teardown never touches a newer one's flag (two tabs / a later session)
    const older = wc.buildWcProvider(fake as never, sess('older'));
    wc.buildWcProvider(fake as never, sess('newer'));
    await older.disconnect();
    expect(localStorage.getItem('btr-wc-session')).toContain('newer');
  });
});
