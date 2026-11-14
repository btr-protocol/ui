// activateAccount + the account panel with TWO announced wallets (fake EIP-6963 providers, no real wallet): the account a click
// names may live in another wallet. happy-dom; every provider records its requests.
import { afterEach, describe, expect, test } from 'bun:test';
import { WalletButton, activateAccount, connectWallet, disconnectWallet, switchWalletAccount, walletAccounts, walletAddress, walletEntry } from '../src';
import { WALLET_ACCOUNTS_KEY, rememberAccounts, walletOf } from '../src/wallet/recentWallets';
import { act, click, mount, until, useDom } from './dom';

useDom();

const AMBIRE_ACCT = '0xB28C00000000000000000000000000000000c140';
const RABBY_ACCT = '0xaB7B000000000000000000000000000000000760';
const RABBY_2 = '0x0b83000000000000000000000000000000001111';

type Opts = { exposed?: string[]; shareOnRequest?: string[]; pickTo?: string; rejectRequest?: boolean; rejectPermissions?: boolean; throwPermissions?: boolean; hang?: boolean; gate?: Promise<void>; throwAccounts?: boolean };
/** `exposed` = already authorised for the site; `shareOnRequest` = added once the user approves eth_requestAccounts. */
function fake(o: Opts = {}) {
  const calls: string[] = [];
  let list = [...(o.exposed ?? [])];
  const listeners = new Map<string, Set<(...a: unknown[]) => void>>();
  return {
    calls,
    async request({ method }: { method: string; params?: unknown[] }) {
      calls.push(method);
      if (method === 'eth_chainId') return '0x8f';
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
        if (o.rejectPermissions) throw Object.assign(new Error('rejected'), { code: 4001 });
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
const entry = (p: Fake, rdns: string, name = rdns) => ({ info: { uuid: rdns, name, rdns }, provider: p });
const prompts = (p: Fake) => p.calls.filter((m) => m === 'eth_requestAccounts' || m === 'wallet_requestPermissions');

/** Connect the "ambire" wallet (active c140), with "rabby" announced beside it. */
async function setup(rabby: Opts, ambire: Opts = {}) {
  const a = fake({ exposed: [AMBIRE_ACCT], ...ambire });
  const r = fake(rabby);
  const ea = entry(a, 'com.ambire', 'Ambire');
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
  test('the account is already authorised in the second wallet: it becomes the connected wallet, nothing is prompted', async () => {
    const { a, r, er, entries } = await setup({ exposed: [RABBY_ACCT] });
    const res = await activateAccount(RABBY_ACCT, { entries });
    expect(res.ok).toBe(true);
    expect(walletEntry.value).toBe(er);
    expect(walletAddress.value).toBe(RABBY_ACCT);
    expect(prompts(a)).toEqual([]);
    expect(prompts(r)).toEqual([]);
    expect([...a.calls, ...r.calls].every((m) => m === 'eth_accounts' || m === 'eth_chainId')).toBe(true); // only silent reads
  });

  test('already the connected wallet\'s active account: bound without waiting for the others, no prompt anywhere', async () => {
    const { a, r, ea, entries } = await setup({ hang: true, exposed: [RABBY_ACCT] });
    const t0 = Date.now();
    expect((await activateAccount(AMBIRE_ACCT, { entries, probeMs: 2000 })).ok).toBe(true);
    expect(Date.now() - t0).toBeLessThan(500); // a hanging second wallet does not hold the answer
    expect(walletEntry.value).toBe(ea);
    expect(prompts(a)).toEqual([]);
    expect(prompts(r)).toEqual([]);
  });

  test('discovery: announced wallets are found through EIP-6963 when no list is passed', async () => {
    const { r, er } = await setup({ exposed: [RABBY_ACCT] });
    const onReq = () => window.dispatchEvent(new CustomEvent('eip6963:announceProvider', { detail: er }));
    window.addEventListener('eip6963:requestProvider', onReq);
    try {
      expect((await activateAccount(RABBY_ACCT)).ok).toBe(true);
    } finally {
      window.removeEventListener('eip6963:requestProvider', onReq);
    }
    expect(walletEntry.value).toBe(er);
    expect(prompts(r)).toEqual([]);
  });

  test('not authorised anywhere: the remembered wallet is asked (eth_requestAccounts), the other one is never prompted', async () => {
    const { a, r, er, entries } = await setup({ shareOnRequest: [RABBY_ACCT] });
    rememberAccounts('io.rabby', [RABBY_ACCT]);
    const res = await activateAccount(RABBY_ACCT, { entries });
    expect(res.ok).toBe(true);
    expect(walletEntry.value).toBe(er);
    expect(r.calls).toContain('eth_requestAccounts');
    expect(r.calls).not.toContain('wallet_requestPermissions'); // the request already exposed it
    expect(prompts(a)).toEqual([]);
  });

  test('exactly one other wallet and nothing remembered: that wallet is asked, then its picker when still not shared', async () => {
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

  test('the user rejects the request: reason rejected naming the wallet, the connected wallet is untouched', async () => {
    const { ea, entries } = await setup({ rejectRequest: true });
    const res = await activateAccount(RABBY_ACCT, { entries });
    expect(res).toMatchObject({ ok: false, reason: 'rejected', wallet: { name: 'Rabby' } });
    expect(walletEntry.value).toBe(ea);
    expect(walletAddress.value).toBe(AMBIRE_ACCT);
  });

  test('still not shared after the picker: reason not-shared, nothing bound', async () => {
    const { ea, entries } = await setup({ exposed: [RABBY_2] });
    const res = await activateAccount(RABBY_ACCT, { entries });
    expect(res).toMatchObject({ ok: false, reason: 'not-shared' });
    expect(walletEntry.value).toBe(ea);
  });

  test('a provider that never answers is skipped after the probe limit; the others still win', async () => {
    const { er, entries } = await setup({ exposed: [RABBY_ACCT] });
    const hung = entry(fake({ hang: true }), 'xyz.hung');
    const t0 = Date.now();
    const res = await activateAccount(RABBY_ACCT, { entries: [...entries, hung], probeMs: 60 });
    expect(res.ok).toBe(true);
    expect(walletEntry.value).toBe(er);
    expect(Date.now() - t0).toBeLessThan(1500);
  });

  test('probes run in parallel (two hung providers cost one limit, not two)', async () => {
    const { entries } = await setup({ hang: true });
    const t0 = Date.now();
    const res = await activateAccount(RABBY_ACCT, { entries: [...entries, entry(fake({ hang: true }), 'xyz.hung2')], probeMs: 200 });
    expect(Date.now() - t0).toBeLessThan(380);
    expect(res.ok).toBe(false);
  });

  test('a provider whose eth_accounts throws is skipped', async () => {
    const { er, entries } = await setup({ exposed: [RABBY_ACCT] });
    const bad = entry(fake({ throwAccounts: true }), 'xyz.bad');
    expect((await activateAccount(RABBY_ACCT, { entries: [bad, ...entries] })).ok).toBe(true);
    expect(walletEntry.value).toBe(er);
  });

  test('abort while probing: cancelled, nothing bound', async () => {
    const { ea, entries } = await setup({ hang: true });
    const ac = new AbortController();
    const p = activateAccount(RABBY_ACCT, { entries, signal: ac.signal, probeMs: 5000 });
    ac.abort();
    expect(await p).toEqual({ ok: false, reason: 'cancelled' });
    expect(walletEntry.value).toBe(ea);
  });

  test('a WalletConnect session is one provider: no discovery, no probe of other wallets', async () => {
    const wc = Object.assign(fake({ exposed: [AMBIRE_ACCT], pickTo: RABBY_ACCT }), { isWalletConnect: true });
    const other = fake({ exposed: [RABBY_ACCT] });
    disconnectWallet();
    await connectWallet({ info: { uuid: 'wc', name: 'WalletConnect', id: 'walletconnect' }, provider: wc });
    const onReq = () => window.dispatchEvent(new CustomEvent('eip6963:announceProvider', { detail: entry(other, 'io.rabby') }));
    window.addEventListener('eip6963:requestProvider', onReq);
    try {
      const res = await activateAccount(RABBY_ACCT);
      expect(other.calls).toEqual([]);
      expect(res.ok).toBe(true); // its own picker moved the account
      expect(wc.calls).toContain('wallet_requestPermissions');
    } finally {
      window.removeEventListener('eip6963:requestProvider', onReq);
    }
  });

  test('a single wallet with several accounts: an authorised non-active account goes through that wallet\'s picker', async () => {
    const solo = fake({ exposed: [AMBIRE_ACCT, RABBY_2], pickTo: RABBY_2 });
    await connectWallet(entry(solo, 'io.one'));
    const res = await activateAccount(RABBY_2, { entries: [] });
    expect(res.ok).toBe(true);
    expect(walletAddress.value).toBe(RABBY_2);
    expect(walletAccounts.value[0]).toBe(RABBY_2);
  });

  test('a single wallet that does not have the account: its picker opens, then not-shared', async () => {
    const solo = fake({ exposed: [AMBIRE_ACCT] });
    await connectWallet(entry(solo, 'io.one', 'One'));
    expect(await activateAccount(RABBY_ACCT, { entries: [] })).toMatchObject({ ok: false, reason: 'not-shared', wallet: { name: 'One' } });
  });

  test('several other wallets and nothing remembered: nobody is prompted, reason none', async () => {
    const { r, entries } = await setup({ exposed: [RABBY_2] });
    const third = fake({ exposed: [] });
    const res = await activateAccount(RABBY_ACCT, { entries: [...entries, entry(third, 'io.third')] });
    expect(res).toEqual({ ok: false, reason: 'none' });
    expect(prompts(r)).toEqual([]);
    expect(prompts(third)).toEqual([]);
  });

  test('switchWalletAccount on the connected provider searches every wallet; on any other provider it is the old picker', async () => {
    const { r, er } = await setup({ exposed: [RABBY_ACCT] });
    const onReq = () => window.dispatchEvent(new CustomEvent('eip6963:announceProvider', { detail: er }));
    window.addEventListener('eip6963:requestProvider', onReq);
    try {
      expect(await switchWalletAccount(walletEntry.value!.provider, RABBY_ACCT)).toBe(true);
    } finally {
      window.removeEventListener('eip6963:requestProvider', onReq);
    }
    expect(walletEntry.value).toBe(er);
    expect(prompts(r)).toEqual([]);
  });

  test('wallet <-> account memory: what a wallet exposed is kept (lowercase, capped), nothing else; broken storage is harmless', async () => {
    const { entries } = await setup({ exposed: [RABBY_ACCT] });
    await activateAccount(RABBY_ACCT, { entries });
    expect(walletOf(RABBY_ACCT)).toBe('io.rabby');
    expect(walletOf(AMBIRE_ACCT)).toBe('com.ambire');
    const raw = JSON.parse(localStorage.getItem(WALLET_ACCOUNTS_KEY) ?? '[]') as string[][];
    expect(raw.every(([a, id]) => /^0x[0-9a-f]{40}$/.test(a!) && /^[a-z0-9._:-]+$/.test(id!))).toBe(true);
    for (let i = 0; i < 40; i++) rememberAccounts('io.x', [`0x${i.toString(16).padStart(40, '0')}`]);
    expect((JSON.parse(localStorage.getItem(WALLET_ACCOUNTS_KEY) ?? '[]') as unknown[]).length).toBe(32);
    localStorage.setItem(WALLET_ACCOUNTS_KEY, '{not json');
    expect(walletOf(RABBY_ACCT)).toBeUndefined();
    expect(() => rememberAccounts('io.x', [RABBY_ACCT])).not.toThrow();
  });
});

describe('account panel with two wallets', () => {
  const chains = [{ id: 143, name: 'Monad' }];
  const text = () => document.body.textContent ?? '';
  const buttons = () => [...document.body.querySelectorAll('button')] as HTMLButtonElement[];
  const byText = (t: string) => buttons().find((b) => b.textContent?.includes(t));
  async function openPanel(rabby: Opts, hooks: { onSwitch?: (a: string) => boolean | Promise<boolean> } = {}) {
    const s = await setup(rabby);
    const announce = () => s.entries.forEach((e) => window.dispatchEvent(new CustomEvent('eip6963:announceProvider', { detail: e })));
    window.addEventListener('eip6963:requestProvider', announce);
    stops.push(() => window.removeEventListener('eip6963:requestProvider', announce));
    // The app: signed in as the Rabby account; the wallet connected is Ambire.
    const r = mount(<WalletButton address={RABBY_ACCT} sessionAddress={RABBY_ACCT} chains={chains} chainId={143} signers={[RABBY_ACCT]} onSwitchAccount={hooks.onSwitch} />);
    click(r.host.querySelector('button') as HTMLElement);
    await until(() => text().includes('Accounts'));
    return s;
  }

  test('mismatch is a list row (not a card) with kit buttons; clicking the account row activates the wallet that holds it', async () => {
    const seen: string[] = [];
    const { er } = await openPanel({ exposed: [RABBY_ACCT] }, { onSwitch: (a) => (seen.push(a), true) });
    expect(text()).toContain('Signing now would fail');
    expect(document.body.querySelector('.rounded-lg.border')).toBeNull(); // no wrapping card
    const row = byText('0xaB7B…0760') as HTMLElement;
    expect(row.tagName).toBe('BUTTON');
    click(row);
    await until(() => seen.length > 0);
    expect(walletEntry.value).toBe(er);
    expect(walletAddress.value).toBe(RABBY_ACCT);
    expect(seen).toEqual([RABBY_ACCT]);
  });

  test('"Switch wallet to" is the same action as the row', async () => {
    const { er } = await openPanel({ exposed: [RABBY_ACCT] });
    click(byText('Switch wallet to') as HTMLElement);
    await until(() => walletEntry.value === er);
    expect(walletAddress.value).toBe(RABBY_ACCT);
  });

  test('rejected in the other wallet: a row names it, the modal stays open, the app step never runs', async () => {
    let ran = 0;
    await openPanel({ rejectRequest: true }, { onSwitch: () => (ran++, true) });
    click(byText('Switch wallet to') as HTMLElement);
    await until(() => text().includes('Request cancelled in Rabby'));
    expect(text()).toContain('share it with this site');
    expect(ran).toBe(0);
    expect(text()).toContain('Accounts');
    expect(walletAddress.value).toBe(AMBIRE_ACCT);
  });

  test('closing the modal cancels a lookup in flight', async () => {
    let open!: () => void;
    const { ea, r } = await openPanel({ shareOnRequest: [RABBY_ACCT], gate: new Promise<void>((res) => (open = res)) });
    click(byText('Switch wallet to') as HTMLElement);
    await until(() => r.calls.includes('eth_requestAccounts')); // the request is out, the wallet's prompt is open
    click(document.body.querySelector('[aria-label^="Close"]') as HTMLElement);
    open(); // the user approves after the modal was closed
    await act(async () => { await new Promise((res) => setTimeout(res, 30)); });
    expect(walletEntry.value).toBe(ea); // nothing is bound behind a closed modal
  });

  test('keyboard: an account row is a real button, Enter activates it', async () => {
    const { er } = await openPanel({ exposed: [RABBY_ACCT] });
    const row = byText('0xaB7B…0760') as HTMLButtonElement;
    row.focus();
    expect(document.activeElement).toBe(row);
    row.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    click(row); // a native button turns Enter into this click
    await until(() => walletEntry.value === er);
    expect(walletEntry.value).toBe(er);
  });

  test('header glyph: while the shown account lives in another wallet it is not the connected wallet\'s mark', async () => {
    await openPanel({ exposed: [RABBY_ACCT] });
    // address shown = RABBY_ACCT, connected wallet = Ambire (no remembered owner of RABBY_ACCT yet): the generic wallet icon
    const header = document.body.querySelector('[title="' + RABBY_ACCT + '"]')!.previousElementSibling!;
    expect(header.getAttribute('data-wallet') ?? header.tagName).not.toBe('Ambire');
  });
});
