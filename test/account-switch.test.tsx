// activateAccount + the account panel with TWO announced wallets (fake EIP-6963 providers, no real wallet): the account a click
// names may live in another wallet. happy-dom; every provider records its requests. No wall-clock asserts: waits are conditions.
import { afterEach, describe, expect, test } from 'bun:test';
import { LAST_WALLET_KEY, WalletButton, activateAccount, connectWallet, disconnectWallet, switchWalletAccount, walletAccounts, walletAddress, walletEntry } from '../src';
import { act, click, mount, until, useDom } from './dom';

useDom();

const AMBIRE_ACCT = '0xB28C00000000000000000000000000000000c140';
const RABBY_ACCT = '0xaB7B000000000000000000000000000000000760';
const RABBY_2 = '0x0b83000000000000000000000000000000001111';
const ICON_A = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="red"/></svg>';

type Opts = {
  exposed?: string[];
  shareOnRequest?: string[];
  pickTo?: string;
  rejectRequest?: boolean;
  throwPermissions?: boolean;
  hang?: boolean;
  throwAccounts?: boolean;
  /** eth_requestAccounts waits for this. */
  gate?: Promise<void>;
  /** After the wallet was bound (its first eth_chainId) it no longer exposes the account. */
  dropAfterBind?: boolean;
};
/** `exposed` = already authorised for the site; `shareOnRequest` = added once the user approves eth_requestAccounts. */
function fake(o: Opts = {}) {
  const calls: string[] = [];
  let list = [...(o.exposed ?? [])];
  const listeners = new Map<string, Set<(...a: unknown[]) => void>>();
  return {
    calls,
    set(next: string[]) {
      list = next;
      listeners.get('accountsChanged')?.forEach((l) => l(next));
    },
    async request({ method }: { method: string; params?: unknown[] }) {
      calls.push(method);
      if (method === 'eth_chainId') {
        if (o.dropAfterBind) list = [RABBY_2];
        return '0x8f';
      }
      if (method === 'eth_accounts') {
        if (o.hang) return new Promise(() => {});
        if (o.throwAccounts) throw new Error('boom');
        return list;
      }
      if (method === 'eth_requestAccounts') {
        if (o.gate) await o.gate;
        if (o.rejectRequest) throw Object.assign(new Error('rejected'), { code: 4001 });
        if (o.shareOnRequest) list = [...o.shareOnRequest, ...list.filter((a) => !o.shareOnRequest!.includes(a))];
        return list;
      }
      if (method === 'wallet_requestPermissions') {
        if (o.throwPermissions) throw Object.assign(new Error('unsupported'), { code: -32601 });
        if (o.pickTo) list = [o.pickTo, ...list.filter((a) => a !== o.pickTo)];
        return [{ parentCapability: 'eth_accounts' }];
      }
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
}
type Fake = ReturnType<typeof fake>;
const entry = (p: Fake, rdns: string, name = rdns, icon?: string) => ({ info: { uuid: `${rdns}-${name}`, name, rdns, icon }, provider: p });
const prompts = (p: Fake) => p.calls.filter((m) => m === 'eth_requestAccounts' || m === 'wallet_requestPermissions');
const tick = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

/** Connect the "ambire" wallet (active c140), with "rabby" announced beside it. */
async function setup(rabby: Opts, ambire: Opts = {}) {
  const a = fake({ exposed: [AMBIRE_ACCT], ...ambire });
  const r = fake(rabby);
  const ea = entry(a, 'com.ambire', 'Ambire', ICON_A);
  const er = entry(r, 'io.rabby', 'Rabby');
  await connectWallet(ea);
  a.calls.length = 0;
  return { a, r, ea, er, entries: [ea, er] };
}

const stops: (() => void)[] = [];
afterEach(() => {
  stops.splice(0).forEach((f) => f());
  disconnectWallet();
  document.body.innerHTML = '';
  try {
    localStorage.clear();
  } catch {}
});

describe('activateAccount', () => {
  test('exactly one other wallet exposes the account: it becomes the connected wallet, nothing is prompted, LAST_WALLET_KEY follows', async () => {
    const { a, r, er, entries } = await setup({ exposed: [RABBY_ACCT] });
    const res = await activateAccount(RABBY_ACCT, { entries });
    expect(res.ok).toBe(true);
    expect(walletEntry.value).toBe(er);
    expect(walletAddress.value).toBe(RABBY_ACCT);
    expect(prompts(a)).toEqual([]);
    expect(prompts(r)).toEqual([]);
    expect(localStorage.getItem(LAST_WALLET_KEY)).toBe('io.rabby');
  });

  test('no localStorage entry ever holds an address (no wallet <-> account memory)', async () => {
    const { entries } = await setup({ exposed: [RABBY_ACCT] });
    await activateAccount(RABBY_ACCT, { entries });
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)!;
      expect(`${k}=${localStorage.getItem(k)}`).not.toMatch(/0x[0-9a-fA-F]{40}/);
    }
  });

  test('already the connected wallet\'s active account: nothing bound, no prompt anywhere, a hanging second wallet is not waited for', async () => {
    const { a, r, ea, entries } = await setup({ hang: true, exposed: [RABBY_ACCT] });
    const ac = new AbortController();
    // The limit is far away: an implementation that waited for the second wallet would never get here.
    const res = await activateAccount(AMBIRE_ACCT, { entries, probeMs: 600_000, signal: ac.signal });
    ac.abort();
    expect(res.ok).toBe(true);
    expect(walletEntry.value).toBe(ea);
    expect(prompts(a)).toEqual([]);
    expect(prompts(r)).toEqual([]);
  });

  test('discovery: announced wallets are found through EIP-6963 when no list is passed', async () => {
    const { r, er } = await setup({ exposed: [RABBY_ACCT] });
    const onReq = () => window.dispatchEvent(new CustomEvent('eip6963:announceProvider', { detail: er }));
    window.addEventListener('eip6963:requestProvider', onReq);
    stops.push(() => window.removeEventListener('eip6963:requestProvider', onReq));
    expect((await activateAccount(RABBY_ACCT)).ok).toBe(true);
    expect(walletEntry.value).toBe(er);
    expect(prompts(r)).toEqual([]);
  });

  test('a rogue second wallet claims the account too: nobody is bound, nobody is prompted, reason ambiguous', async () => {
    const { a, r, ea, entries } = await setup({ exposed: [RABBY_ACCT] });
    const rogue = fake({ exposed: [RABBY_ACCT] });
    const res = await activateAccount(RABBY_ACCT, { entries: [...entries, entry(rogue, 'evil.wallet')] });
    expect(res).toEqual({ ok: false, reason: 'ambiguous' });
    expect(walletEntry.value).toBe(ea);
    expect([...prompts(a), ...prompts(r), ...prompts(rogue)]).toEqual([]);
  });

  test('one rdns announced twice, one of them claims the account: not bound (ambiguous)', async () => {
    const { ea, entries } = await setup({ exposed: [RABBY_ACCT] });
    const twin = entry(fake({ exposed: [] }), 'io.rabby', 'Rabby (copy)');
    expect(await activateAccount(RABBY_ACCT, { entries: [...entries, twin] })).toEqual({ ok: false, reason: 'ambiguous' });
    expect(walletEntry.value).toBe(ea);
  });

  test('the only other wallet shares a rdns with the connected one: ambiguous, no request', async () => {
    const a = fake({ exposed: [AMBIRE_ACCT] });
    const twin = fake({ shareOnRequest: [RABBY_ACCT] });
    const ea = entry(a, 'com.same', 'One');
    await connectWallet(ea);
    expect(await activateAccount(RABBY_ACCT, { entries: [ea, entry(twin, 'com.same', 'Two')] })).toEqual({ ok: false, reason: 'ambiguous' });
    expect(prompts(twin)).toEqual([]);
  });

  test('nobody exposes it and exactly one other wallet: it is asked (eth_requestAccounts), the connected one never prompted', async () => {
    const { a, r, er, entries } = await setup({ shareOnRequest: [RABBY_ACCT] });
    expect((await activateAccount(RABBY_ACCT, { entries })).ok).toBe(true);
    expect(walletEntry.value).toBe(er);
    expect(r.calls).toContain('eth_requestAccounts');
    expect(r.calls).not.toContain('wallet_requestPermissions'); // the request already exposed it
    expect(prompts(a)).toEqual([]);
  });

  test('still not shared after the request: its picker opens next', async () => {
    const { r, er, entries } = await setup({ pickTo: RABBY_ACCT, exposed: [RABBY_2] });
    const res = await activateAccount(RABBY_ACCT, { entries });
    expect(r.calls.filter((m) => m !== 'eth_accounts' && m !== 'eth_chainId')).toEqual(['eth_requestAccounts', 'wallet_requestPermissions', 'eth_requestAccounts']);
    expect(res.ok).toBe(true);
    expect(walletEntry.value).toBe(er);
  });

  test('a wallet that throws on wallet_requestPermissions falls back to what eth_requestAccounts gave', async () => {
    const { er, entries } = await setup({ throwPermissions: true, exposed: [RABBY_2], shareOnRequest: [RABBY_ACCT] });
    expect((await activateAccount(RABBY_ACCT, { entries })).ok).toBe(true);
    expect(walletEntry.value).toBe(er);
  });

  test('several other wallets and none exposes it: nobody is prompted, reason ambiguous', async () => {
    const { r, entries } = await setup({ exposed: [RABBY_2] });
    const third = fake({ exposed: [] });
    const res = await activateAccount(RABBY_ACCT, { entries: [...entries, entry(third, 'io.third')] });
    expect(res).toEqual({ ok: false, reason: 'ambiguous' });
    expect([...prompts(r), ...prompts(third)]).toEqual([]);
  });

  test('the user rejects the request: reason rejected naming the wallet, the connected wallet is untouched', async () => {
    const { ea, entries } = await setup({ rejectRequest: true });
    const res = await activateAccount(RABBY_ACCT, { entries });
    expect(res).toMatchObject({ ok: false, reason: 'rejected', wallet: { name: 'Rabby' } });
    expect(walletEntry.value).toBe(ea);
    expect(walletAddress.value).toBe(AMBIRE_ACCT);
  });

  test('still not shared after the picker: reason not-shared, nothing bound', async () => {
    const { ea, entries } = await setup({ exposed: [RABBY_2] });
    expect(await activateAccount(RABBY_ACCT, { entries })).toMatchObject({ ok: false, reason: 'not-shared' });
    expect(walletEntry.value).toBe(ea);
  });

  test('a provider that never answers is skipped at its limit; the others still decide', async () => {
    const { er, entries } = await setup({ exposed: [RABBY_ACCT] });
    const res = await activateAccount(RABBY_ACCT, { entries: [...entries, entry(fake({ hang: true }), 'xyz.hung')], probeMs: 40 });
    expect(res.ok).toBe(true);
    expect(walletEntry.value).toBe(er);
  });

  test('probes go out in parallel: both hung wallets are asked before either limit', async () => {
    const h1 = fake({ hang: true });
    const h2 = fake({ hang: true });
    const { entries } = await setup({ hang: true });
    const ac = new AbortController();
    const p = activateAccount(RABBY_ACCT, { entries: [...entries, entry(h1, 'xyz.h1'), entry(h2, 'xyz.h2')], probeMs: 600_000, signal: ac.signal });
    await until(() => h1.calls.includes('eth_accounts') && h2.calls.includes('eth_accounts'));
    expect(h1.calls).toContain('eth_accounts');
    expect(h2.calls).toContain('eth_accounts');
    ac.abort();
    expect(await p).toEqual({ ok: false, reason: 'cancelled' });
  });

  test('a provider whose eth_accounts throws is skipped', async () => {
    const { er, entries } = await setup({ exposed: [RABBY_ACCT] });
    expect((await activateAccount(RABBY_ACCT, { entries: [entry(fake({ throwAccounts: true }), 'xyz.bad'), ...entries] })).ok).toBe(true);
    expect(walletEntry.value).toBe(er);
  });

  test('abort while probing: cancelled, nothing bound', async () => {
    const { ea, entries } = await setup({ hang: true });
    const ac = new AbortController();
    const p = activateAccount(RABBY_ACCT, { entries, signal: ac.signal, probeMs: 600_000 });
    ac.abort();
    expect(await p).toEqual({ ok: false, reason: 'cancelled' });
    expect(walletEntry.value).toBe(ea);
  });

  test('disconnect during a pending request: nothing is bound afterwards', async () => {
    let open!: () => void;
    const { r, entries } = await setup({ shareOnRequest: [RABBY_ACCT], gate: new Promise<void>((res) => (open = res)) });
    const p = activateAccount(RABBY_ACCT, { entries });
    await until(() => r.calls.includes('eth_requestAccounts'));
    disconnectWallet();
    open();
    expect(await p).toEqual({ ok: false, reason: 'cancelled' });
    expect(walletEntry.value).toBeUndefined();
  });

  test('the connected wallet changed its account during the request: stale, nothing is bound', async () => {
    let open!: () => void;
    const { a, r, ea, entries } = await setup({ shareOnRequest: [RABBY_ACCT], gate: new Promise<void>((res) => (open = res)) });
    const p = activateAccount(RABBY_ACCT, { entries });
    await until(() => r.calls.includes('eth_requestAccounts'));
    a.set([RABBY_2]); // accountsChanged on the connected wallet
    open();
    expect(await p).toEqual({ ok: false, reason: 'cancelled' });
    expect(walletEntry.value).toBe(ea);
  });

  test('two clicks: the later wins, the earlier binds nothing', async () => {
    let open!: () => void;
    const { r, er, ea, entries } = await setup({ shareOnRequest: [RABBY_ACCT], exposed: [], gate: new Promise<void>((res) => (open = res)) });
    const first = activateAccount(RABBY_ACCT, { entries });
    await until(() => r.calls.includes('eth_requestAccounts'));
    const second = activateAccount(AMBIRE_ACCT, { entries }); // a newer click, on the connected wallet's own account
    expect((await second).ok).toBe(true);
    open();
    expect(await first).toEqual({ ok: false, reason: 'cancelled' });
    expect(walletEntry.value).toBe(ea);
    expect(walletEntry.value).not.toBe(er);
  });

  test('the wallet stops exposing the account right after it was bound: the previous wallet is back, not-shared', async () => {
    const { ea, entries } = await setup({ exposed: [RABBY_ACCT], dropAfterBind: true });
    const res = await activateAccount(RABBY_ACCT, { entries });
    expect(res).toMatchObject({ ok: false, reason: 'not-shared', wallet: { name: 'Rabby' } });
    expect(walletEntry.value).toBe(ea);
    expect(walletAddress.value).toBe(AMBIRE_ACCT);
    expect(localStorage.getItem(LAST_WALLET_KEY)).toBe('com.ambire');
  });

  test('undo puts the previous wallet back; it does nothing once another wallet was connected', async () => {
    const { ea, er, entries } = await setup({ exposed: [RABBY_ACCT] });
    const res = await activateAccount(RABBY_ACCT, { entries });
    if (!res.ok) throw new Error('not ok');
    await res.undo();
    expect(walletEntry.value).toBe(ea);
    const again = await activateAccount(RABBY_ACCT, { entries });
    if (!again.ok) throw new Error('not ok');
    await connectWallet(entry(fake({ exposed: [RABBY_2] }), 'io.third', 'Third'));
    await again.undo();
    expect(walletEntry.value?.info.rdns).toBe('io.third');
    expect(walletEntry.value).not.toBe(er);
  });

  test('a WalletConnect session is one provider: no discovery, no probe of other wallets', async () => {
    const wc = Object.assign(fake({ exposed: [AMBIRE_ACCT], pickTo: RABBY_ACCT }), { isWalletConnect: true });
    const other = fake({ exposed: [RABBY_ACCT] });
    disconnectWallet();
    await connectWallet({ info: { uuid: 'wc', name: 'WalletConnect', id: 'walletconnect' }, provider: wc });
    const onReq = () => window.dispatchEvent(new CustomEvent('eip6963:announceProvider', { detail: entry(other, 'io.rabby') }));
    window.addEventListener('eip6963:requestProvider', onReq);
    stops.push(() => window.removeEventListener('eip6963:requestProvider', onReq));
    const res = await activateAccount(RABBY_ACCT);
    expect(other.calls).toEqual([]);
    expect(res.ok).toBe(true); // its own picker moved the account
    expect(wc.calls).toContain('wallet_requestPermissions');
  });

  test('a single wallet with several accounts: an authorised non-active account goes through that wallet\'s picker', async () => {
    const solo = fake({ exposed: [AMBIRE_ACCT, RABBY_2], pickTo: RABBY_2 });
    await connectWallet(entry(solo, 'io.one'));
    expect((await activateAccount(RABBY_2, { entries: [] })).ok).toBe(true);
    expect(walletAddress.value).toBe(RABBY_2);
    expect(walletAccounts.value[0]).toBe(RABBY_2);
  });

  test('a single wallet that does not have the account: its picker opens, then not-shared', async () => {
    await connectWallet(entry(fake({ exposed: [AMBIRE_ACCT] }), 'io.one', 'One'));
    expect(await activateAccount(RABBY_ACCT, { entries: [] })).toMatchObject({ ok: false, reason: 'not-shared', wallet: { name: 'One' } });
  });

  test('switchWalletAccount keeps its contract: only the provider it is given, never another wallet', async () => {
    const { r, ea } = await setup({ exposed: [RABBY_ACCT] });
    expect(await switchWalletAccount(ea.provider, RABBY_ACCT)).toBe(false);
    expect(walletEntry.value).toBe(ea);
    expect(r.calls).toEqual([]);
  });
});

describe('account panel with two wallets', () => {
  const chains = [{ id: 143, name: 'Monad' }];
  const text = () => document.body.textContent ?? '';
  const buttons = () => [...document.body.querySelectorAll('button')] as HTMLButtonElement[];
  const byText = (t: string) => buttons().find((b) => b.textContent?.includes(t));
  async function openPanel(rabby: Opts, hooks: { onSwitch?: (a: string) => boolean | Promise<boolean>; address?: string; session?: string; extra?: ReturnType<typeof entry>[] } = {}) {
    const s = await setup(rabby);
    const announce = () => [...s.entries, ...(hooks.extra ?? [])].forEach((e) => window.dispatchEvent(new CustomEvent('eip6963:announceProvider', { detail: e })));
    window.addEventListener('eip6963:requestProvider', announce);
    stops.push(() => window.removeEventListener('eip6963:requestProvider', announce));
    // The app: signed in as the Rabby account; the wallet connected is Ambire.
    const r = mount(<WalletButton address={hooks.address ?? RABBY_ACCT} sessionAddress={hooks.session ?? RABBY_ACCT} chains={chains} chainId={143} signers={[RABBY_ACCT]} onSwitchAccount={hooks.onSwitch} />);
    click(r.host.querySelector('button') as HTMLElement);
    await until(() => text().includes('Accounts'));
    return s;
  }
  const closeModal = () => click(document.body.querySelector('[aria-label^="Close"]') as HTMLElement);

  test('the mismatch is a list item with two actions; clicking the account row activates the wallet that holds it', async () => {
    const seen: string[] = [];
    const { er } = await openPanel({ exposed: [RABBY_ACCT] }, { onSwitch: (a) => (seen.push(a), true) });
    expect(text()).toContain('Signing now would fail');
    expect(document.body.querySelector('li [role=alert]')?.textContent).toContain('Signing now would fail');
    expect(document.body.querySelector('.rounded-lg.border')).toBeNull(); // no wrapping card
    const row = byText('0xaB7B…0760') as HTMLElement;
    expect(row.tagName).toBe('BUTTON');
    click(row);
    await until(() => seen.length > 0);
    expect(walletEntry.value).toBe(er);
    expect(walletAddress.value).toBe(RABBY_ACCT);
    expect(seen).toEqual([RABBY_ACCT]);
  });

  test('"Switch wallet to" is the same action as the row; its accessible name starts with the visible label', async () => {
    const { er } = await openPanel({ exposed: [RABBY_ACCT] });
    const b = byText('Switch wallet to') as HTMLButtonElement;
    const name = b.getAttribute('aria-label') ?? '';
    expect(name.startsWith(b.textContent ?? '?')).toBe(true);
    expect(name).toContain(RABBY_ACCT);
    expect(b.hasAttribute('title')).toBe(false);
    click(b);
    await until(() => walletEntry.value === er);
    expect(walletAddress.value).toBe(RABBY_ACCT);
  });

  test('rejected in the other wallet: a row names it once, the modal stays open, the app step never runs', async () => {
    let ran = 0;
    await openPanel({ rejectRequest: true }, { onSwitch: () => (ran++, true) });
    click(byText('Switch wallet to') as HTMLElement);
    await until(() => text().includes('Request cancelled in Rabby'));
    expect(text()).toContain('Request cancelled in Rabby. Select 0xaB7B…0760 there, share it with this site, then try again.');
    expect(ran).toBe(0);
    expect(text()).toContain('Accounts');
    expect(walletAddress.value).toBe(AMBIRE_ACCT);
  });

  test('ambiguous wallets: a row sends the user to "Add or switch wallet", nothing is bound or called', async () => {
    let ran = 0;
    const s = await openPanel({ exposed: [RABBY_2] }, { onSwitch: () => (ran++, true), extra: [entry(fake({ exposed: [] }), 'io.third', 'Third')] });
    click(byText('Switch wallet to') as HTMLElement);
    await until(() => text().includes('another installed wallet'));
    expect(text()).toContain('Choose that wallet with "Add or switch wallet"');
    expect(ran).toBe(0);
    expect(walletEntry.value).toBe(s.ea);
  });

  test('closing the modal cancels a lookup in flight and the app step never runs', async () => {
    let open!: () => void;
    let ran = 0;
    const { ea, r } = await openPanel({ shareOnRequest: [RABBY_ACCT], gate: new Promise<void>((res) => (open = res)) }, { onSwitch: () => (ran++, true) });
    click(byText('Switch wallet to') as HTMLElement);
    await until(() => r.calls.includes('eth_requestAccounts')); // the request is out, the wallet's prompt is open
    closeModal();
    open(); // the user approves after the modal was closed
    await tick();
    await until(() => walletEntry.value !== ea || r.calls.filter((m) => m === 'eth_chainId').length > 0);
    expect(walletEntry.value).toBe(ea); // nothing is bound behind a closed modal
    expect(ran).toBe(0);
  });

  test('the app step failing (false) puts the previous wallet back and shows a row; throwing does the same', async () => {
    for (const how of ['false', 'throw'] as const) {
      disconnectWallet();
      document.body.innerHTML = '';
      const { ea } = await openPanel({ exposed: [RABBY_ACCT] }, { onSwitch: async () => (how === 'false' ? false : Promise.reject(new Error('sign-in refused'))) });
      click(byText('Switch wallet to') as HTMLElement);
      await until(() => text().includes('The previous wallet is back'));
      expect(text()).toContain('Could not switch to 0xaB7B…0760. The previous wallet is back. Try again.');
      expect(walletEntry.value).toBe(ea);
      expect(walletAddress.value).toBe(AMBIRE_ACCT);
      expect(localStorage.getItem(LAST_WALLET_KEY)).toBe('com.ambire');
    }
  });

  test('the account row is a real, focusable button and the current row is not', async () => {
    await openPanel({ exposed: [RABBY_ACCT] });
    const row = byText('0xaB7B…0760') as HTMLButtonElement;
    expect(row.tagName).toBe('BUTTON');
    row.focus();
    expect(document.activeElement).toBe(row); // Enter / Space activate a native button (asserted in Chromium: account-panel.browser.test)
  });

  test('header glyph: the connected wallet\'s mark only while it exposes the address shown', async () => {
    await openPanel({ exposed: [RABBY_ACCT] }); // shown = RABBY_ACCT, connected = Ambire, which does not expose it
    const glyph = () => document.body.querySelector(`[title="${RABBY_ACCT}"]`)!.previousElementSibling!.querySelector('img');
    expect(glyph()).toBeNull();
    disconnectWallet();
    document.body.innerHTML = '';
    await openPanel({ exposed: [RABBY_ACCT] }, { address: AMBIRE_ACCT, session: AMBIRE_ACCT });
    const mark = document.body.querySelector(`[title="${AMBIRE_ACCT}"]`)!.previousElementSibling!.querySelector('img');
    expect(mark?.getAttribute('src')).toBe(ICON_A);
  });
});
