// Page for test/account-panel.browser.test.tsx: the kit's WalletButton + account modal over FAKE EIP-6963 wallets (no real wallet).
// The hash picks the scenario: #share (the second wallet already authorises the session account), #reject (it refuses the request),
// #multi (an unknown third wallet too, nothing remembered). `window.__state()` reads the kit store for the assertions.
import { render } from 'preact';
import { Button } from '../../src/ui/Button';
import { WalletButton, connectWallet, walletAddress, walletEntry } from '../../src';

const AMBIRE = '0xB28C00000000000000000000000000000000c140';
const RABBY = '0xaB7B000000000000000000000000000000000760';
const icon = (fill: string) => `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="${fill}"/></svg>`)}`;

function wallet(exposed: string[], o: { reject?: boolean } = {}) {
  let list = exposed;
  return {
    async request({ method }: { method: string }) {
      if (method === 'eth_chainId') return '0x8f';
      if (method === 'eth_accounts') return list;
      if (method === 'eth_requestAccounts') {
        if (o.reject) throw Object.assign(new Error('rejected'), { code: 4001 });
        return list;
      }
      if (method === 'wallet_requestPermissions') {
        if (o.reject) throw Object.assign(new Error('rejected'), { code: 4001 });
        return [];
      }
      throw Object.assign(new Error('unsupported'), { code: 4200 });
    },
    on() {},
    removeListener() {},
  };
}

const hash = location.hash.slice(1);
const fr = hash.endsWith('-fr');
const mode = hash.replace(/-fr$/, '');
// The longest French copy the Safe app used to ship: the actions must still be one line at 360 px.
const FR = { mismatch: 'Votre portefeuille est sur {active}, mais vous êtes connecté en {session}. Signer maintenant échouerait.', switchTo: 'Passer le portefeuille sur {addr}', useInstead: 'Utiliser {addr} à la place' };
const ambire = { info: { uuid: 'a', name: 'Ambire', rdns: 'test.wallet.ambire', icon: icon('#ff00ff') }, provider: wallet([AMBIRE]) };
const rabby = { info: { uuid: 'r', name: 'Rabby', rdns: 'test.wallet.rabby', icon: icon('#00ffff') }, provider: wallet(mode === 'reject' ? [] : [RABBY], { reject: mode === 'reject' }) };
// #match: the session account IS the connected wallet's; the other account is listed (the session's list also shows the other signer).
const others = mode === 'multi' ? [{ info: { uuid: 'x', name: 'Other', rdns: 'test.wallet.other', icon: icon('#ffff00') }, provider: wallet([]) }] : [];
window.addEventListener('eip6963:requestProvider', () => [ambire, rabby, ...others].forEach((d) => window.dispatchEvent(new CustomEvent('eip6963:announceProvider', { detail: d }))));
(window as unknown as { __state: () => unknown }).__state = () => ({ address: walletAddress.value, wallet: walletEntry.value?.info.name });

const chains = [{ id: 143, name: 'Monad' }];
void connectWallet(ambire).then(() =>
  render(
    <main style={{ padding: 16 }}>
      <div className="surface" style={{ display: 'flex', gap: 8, padding: 8, marginBottom: 8, width: 'fit-content' }}>
        <Button size="sm" variant="primary" id="ref-primary">Reference</Button>
        <Button size="sm" id="ref-secondary">Reference</Button>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <WalletButton address={mode === 'match' ? AMBIRE : RABBY} sessionAddress={mode === 'match' ? AMBIRE : RABBY} chains={chains} chainId={143} signers={[RABBY, AMBIRE]} accounts={mode === 'match' ? [AMBIRE, RABBY] : undefined} onSwitchAccount={() => true} labels={fr ? FR : undefined} />
      </div>
    </main>,
    document.body,
  ),
);
