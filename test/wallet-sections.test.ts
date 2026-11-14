// Connect modal sections: recents store (ordering, cap, corrupt / blocked storage) and the Recent / Installed / Other split.
import { afterAll, afterEach, beforeAll, describe, expect, test } from 'bun:test';
import { GlobalRegistrator } from '@happy-dom/global-registrator';
import { WALLETS } from '@btr-protocol/sdk/eth/wallets';
import {
  RECENT_KEPT,
  RECENT_KEY,
  RECENT_SHOWN,
  type RecentWallet,
  noteUse,
  rankRecent,
  readRecent,
  recentEntry,
  recordRecent,
  removeRecent,
} from '../src/wallet/recentWallets';
import { OTHER_IDS, OTHER_MAX, otherHref, sectionWallets } from '../src/wallet/walletSections';

beforeAll(() => GlobalRegistrator.register({ url: 'http://localhost/' }));
afterAll(() => GlobalRegistrator.unregister());
afterEach(() => localStorage.clear());

const rec = (id: string, last: number, uses = 1, via: RecentWallet['via'] = 'injected'): RecentWallet => ({ id, name: id, via, last, uses });
const inj = (id: string, rdns?: string) => ({ id, rdns, name: id });

describe('recent wallets store', () => {
  test('most recent first, ties by use count', () => {
    expect(rankRecent([rec('a', 1), rec('b', 3), rec('c', 3, 5)]).map((r) => r.id)).toEqual(['c', 'b', 'a']);
  });

  test('noteUse bumps count and time, adds new, caps the kept list', () => {
    const one = noteUse([], { id: 'io.rabby', name: 'Rabby', via: 'injected' }, 10);
    expect(one).toEqual([{ id: 'io.rabby', name: 'Rabby', via: 'injected', last: 10, uses: 1 }]);
    const two = noteUse(noteUse(one, { id: 'io.metamask', name: 'MetaMask', via: 'injected' }, 20), { id: 'io.rabby', name: 'Rabby', via: 'injected' }, 30);
    expect(two.map((r) => [r.id, r.uses, r.last])).toEqual([['io.rabby', 2, 30], ['io.metamask', 1, 20]]);
    let many: RecentWallet[] = [];
    for (let i = 0; i < RECENT_KEPT + 4; i++) many = noteUse(many, { id: `w${i}`, name: `w${i}`, via: 'injected' }, i);
    expect(many.length).toBe(RECENT_KEPT);
    expect(many[0]?.id).toBe(`w${RECENT_KEPT + 3}`);
  });

  test('write builds from a field whitelist: no icon, name clamped, bad id refused', () => {
    const w = { id: 'x', name: 'N'.repeat(100), via: 'injected', icon: 'data:image/png;base64,AAAA', extra: 1 } as never;
    const r = noteUse([], w, 1);
    expect(Object.keys(r[0] as object).sort()).toEqual(['id', 'last', 'name', 'uses', 'via']);
    expect(r[0]?.name.length).toBe(40);
    expect(noteUse([], { id: 'Has Space', name: 'X', via: 'injected' }, 1)).toEqual([]);
    expect(noteUse([], { id: 'a'.repeat(65), name: 'X', via: 'injected' }, 1)).toEqual([]);
  });

  test('read: name clamped, bad ids dropped, duplicate ids keep the newest', () => {
    localStorage.setItem(
      RECENT_KEY,
      JSON.stringify([
        { ...rec('dup', 1), name: 'old' },
        { ...rec('dup', 9), name: 'N'.repeat(90), icon: 'x' },
        rec('BAD ID', 5),
        rec('x'.repeat(65), 5),
      ]),
    );
    const got = readRecent();
    expect(got.length).toBe(1);
    expect(got[0]).toEqual({ id: 'dup', name: 'N'.repeat(40), via: 'injected', last: 9, uses: 1 });
  });

  test('removeRecent drops one entry from storage and keeps the rest', () => {
    recordRecent({ id: 'a', name: 'A', via: 'injected' }, 1);
    recordRecent({ id: 'b', name: 'B', via: 'walletconnect' }, 2);
    expect(removeRecent('a').map((r) => r.id)).toEqual(['b']);
    expect(readRecent().map((r) => r.id)).toEqual(['b']);
    expect(removeRecent('nope').map((r) => r.id)).toEqual(['b']);
  });

  test('round trip through localStorage holds no address, only the documented fields', () => {
    recordRecent(recentEntry({ id: 'rabby', rdns: 'io.rabby', name: 'Rabby' }, 'injected'), 5);
    expect(readRecent()).toEqual([{ id: 'io.rabby', name: 'Rabby', via: 'injected', last: 5, uses: 1 }]);
    expect(Object.keys(JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]')[0]).sort()).toEqual(['id', 'last', 'name', 'uses', 'via']);
  });

  test('corrupt or foreign storage reads as empty; bad rows are dropped', () => {
    localStorage.setItem(RECENT_KEY, '{not json');
    expect(readRecent()).toEqual([]);
    localStorage.setItem(RECENT_KEY, JSON.stringify({ a: 1 }));
    expect(readRecent()).toEqual([]);
    localStorage.setItem(RECENT_KEY, JSON.stringify([rec('ok', 1), { id: 1 }, null, { ...rec('bad', 1), via: 'x' }]));
    expect(readRecent().map((r) => r.id)).toEqual(['ok']);
  });

  test('blocked storage: read is empty, record still returns the ranked list and does not throw', () => {
    const real = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get: () => { throw new Error('denied'); } });
    try {
      expect(readRecent()).toEqual([]);
      expect(recordRecent({ id: 'a', name: 'A', via: 'injected' }, 1).map((r) => r.id)).toEqual(['a']);
    } finally {
      if (real) Object.defineProperty(globalThis, 'localStorage', real);
    }
  });
});

describe('sectionWallets', () => {
  const none = { wcOn: true };

  test('empty browser, no history: only Other, capped, in the popular order', () => {
    const s = sectionWallets({ ...none, injected: [], recents: [] });
    expect(s.recent).toEqual([]);
    expect(s.installed).toEqual([]);
    expect(s.other.map((w) => w.id)).toEqual(OTHER_IDS.slice(0, OTHER_MAX));
    expect(s.other.length).toBe(5);
  });

  test('a detected wallet is never in Other (by id or rdns); the list refills to the cap', () => {
    const s = sectionWallets({ ...none, injected: [inj('metamask', 'io.metamask'), inj('x', 'io.rabby')], recents: [] });
    const ids = s.other.map((w) => w.id);
    expect(ids).not.toContain('metamask');
    expect(ids).not.toContain('rabby');
    expect(ids.length).toBe(OTHER_MAX);
    expect(s.installed.length).toBe(2);
  });

  test('natively installed apps are not offered either', () => {
    const s = sectionWallets({ ...none, injected: [], recents: [], nativeIds: ['trust'] });
    expect(s.other.map((w) => w.id)).not.toContain('trust');
  });

  test('Recent: max 3, ranked, detected ones leave Installed', () => {
    const injected = [inj('a', 'a.rdns'), inj('b', 'b.rdns'), inj('c', 'c.rdns'), inj('d', 'd.rdns')];
    const recents = [rec('a.rdns', 1), rec('b.rdns', 4), rec('c.rdns', 3), rec('d.rdns', 2)];
    const s = sectionWallets({ ...none, injected, recents });
    expect(s.recent.map((r) => r.wallet?.id)).toEqual(['b', 'c', 'd']);
    expect(s.recent.length).toBe(RECENT_SHOWN);
    expect(s.installed.map((w) => w.id)).toEqual(['a']);
  });

  test('two recents naming one wallet list it once', () => {
    const s = sectionWallets({ ...none, injected: [inj('metamask', 'io.metamask')], recents: [rec('io.metamask', 2), rec('metamask', 1)] });
    expect(s.recent.length).toBe(1);
    expect(s.installed).toEqual([]);
  });

  test('a WalletConnect recent never becomes an injected row, even when the rdns normalises to its id', () => {
    const s = sectionWallets({ ...none, injected: [inj('metamask', 'io.metamask.flask')], recents: [rec('metamask', 9, 1, 'walletconnect')] });
    expect(s.recent.map((r) => r.wallet)).toEqual([undefined]);
    expect(s.installed.map((w) => w.rdns)).toEqual(['io.metamask.flask']);
  });

  test('an injected recent matches by exact rdns only, not by the normalised id', () => {
    const flask = inj('metamask', 'io.metamask.flask');
    expect(sectionWallets({ ...none, injected: [flask], recents: [rec('metamask', 9)] }).recent).toEqual([]);
    expect(sectionWallets({ ...none, injected: [flask], recents: [rec('io.metamask', 9)] }).recent).toEqual([]);
    expect(sectionWallets({ ...none, injected: [flask, inj('rabby', 'io.rabby')], recents: [rec('io.metamask.flask', 9)] }).recent[0]?.wallet).toBe(flask);
    // a legacy wallet without an rdns is recorded by its catalog id
    const legacy = inj('trust');
    expect(sectionWallets({ ...none, injected: [legacy], recents: [rec('trust', 9)] }).recent[0]?.wallet).toBe(legacy);
  });

  test('announcements sharing an rdns or catalog id stay out of Recent and are marked ambiguous', () => {
    const a = inj('metamask', 'io.metamask');
    const b = inj('metamask', 'io.metamask');
    const c = inj('rabby', 'io.rabby');
    const s = sectionWallets({ ...none, injected: [a, b, c], recents: [rec('io.metamask', 9), rec('io.rabby', 5)] });
    expect(s.recent.map((r) => r.wallet)).toEqual([c]);
    expect(s.installed).toEqual([a, b]);
    expect([...s.ambiguous]).toEqual([a, b]);
    const d = inj('metamask', 'io.metamask.flask');
    expect(sectionWallets({ ...none, injected: [a, d], recents: [] }).ambiguous.size).toBe(2);
  });

  test('WalletConnect recent stays in Recent while WalletConnect is on, else it moves to Other with its install link', () => {
    const recents = [rec('rainbow', 9, 3, 'walletconnect')];
    const on = sectionWallets({ injected: [], recents, wcOn: true });
    expect(on.recent.map((r) => r.recent.id)).toEqual(['rainbow']);
    expect(on.recent[0]?.wallet).toBeUndefined();
    expect(on.other.map((w) => w.id)).not.toContain('rainbow');
    expect(on.other.length).toBe(OTHER_MAX);
    const off = sectionWallets({ injected: [], recents, wcOn: false });
    expect(off.recent).toEqual([]);
    expect(off.other[0]?.id).toBe('rainbow');
    expect(off.other.filter((w) => w.id === 'rainbow').length).toBe(1);
  });

  test('a remembered wallet that is gone moves to Other first; an unknown one with no install page is dropped', () => {
    const s = sectionWallets({ ...none, injected: [], recents: [rec('io.rabby', 9), rec('io.unknown.wallet', 8)] });
    expect(s.recent).toEqual([]);
    expect(s.other[0]?.id).toBe('rabby');
    expect(s.other.map((w) => w.id)).toEqual(['rabby', 'metamask', 'base', 'rainbow', 'trust']);
  });

  test('every Other row has a bundled mark and an install page', async () => {
    const { walletIcon } = await import('../src/lib/walletIcon');
    for (const id of OTHER_IDS) {
      expect(walletIcon(id)).toBeTruthy();
      expect(WALLETS.find((w) => w.id === id)?.url).toMatch(/^https:\/\//);
    }
  });
});

describe('otherHref', () => {
  const def = (id: string) => WALLETS.find((w) => w.id === id) as (typeof WALLETS)[number];
  test('desktop: the official page, new tab', () => {
    expect(otherHref(def('metamask'), false, 'https://btr.markets/')).toEqual({ href: 'https://metamask.io', deepLink: false });
  });
  test('phone: universal link origin, or the in-app browser link', () => {
    expect(otherHref(def('metamask'), true, 'https://btr.markets/')).toEqual({ href: 'https://metamask.app.link', deepLink: true });
    const p = otherHref(def('phantom'), true, 'https://btr.markets/x');
    expect(p.deepLink).toBe(true);
    expect(p.href).toContain('phantom.app/ul/browse/');
  });
  test('phone: no query or hash reaches the wallet deep link', () => {
    const p = otherHref(def('phantom'), true, 'https://btr.markets/x?qq=abc&sig=s#frag');
    expect(decodeURIComponent(p.href)).toContain('https://btr.markets/x');
    expect(p.href).not.toContain('qq');
    expect(p.href).not.toContain('frag');
  });
  test('phone, wallet without a deep link: its page', () => {
    expect(otherHref(def('okx'), true, 'https://btr.markets/')).toEqual({ href: def('okx').url, deepLink: false });
  });
});
