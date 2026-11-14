// Page for test/wallet-rows.browser.test.tsx: the real connect modal with 2 Recent + 2 Installed wallets, rendered by Chromium.
// ?icon=ok (default): Ambire announces an SVG with transparent areas; ?icon=broken: an undecodable data URI.
import { render } from 'preact';
import { RECENT_KEY } from '../../src/wallet/recentWallets';
import { WalletModal } from '../../src/wallet/WalletModal';

const q = new URLSearchParams(location.search);
const svg = (fill: string) =>
  `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="9" fill="${fill}"/></svg>`)}`;
const icon = q.get('icon') === 'broken' ? 'data:image/png;base64,AAAA' : svg('#6f4cff');
const now = Date.now();
const rec = (id: string, name: string, n: number) => ({ id, name, via: 'injected', last: now - n, uses: 1 });
localStorage.setItem(RECENT_KEY, JSON.stringify([rec('com.ambire.wallet', 'Ambire', 1), rec('io.rabby', 'Rabby Wallet', 2)]));

const provider = { request: async () => [], on() {}, removeListener() {} };
const wallets = [
  { uuid: 'ambire', name: 'Ambire', rdns: 'com.ambire.wallet', icon },
  { uuid: 'rabby', name: 'Rabby Wallet', rdns: 'io.rabby', icon: svg('#8697ff') },
  { uuid: 'brave', name: 'Brave Wallet', rdns: 'com.brave.wallet', icon: svg('#fb542b') },
  { uuid: 'phantom', name: 'Phantom', rdns: 'app.phantom', icon: svg('#ab9ff2') },
];
const announce = () => wallets.forEach((info) => window.dispatchEvent(new CustomEvent('eip6963:announceProvider', { detail: { info, provider } })));
window.addEventListener('eip6963:requestProvider', announce);

render(<WalletModal isOpen onClose={() => {}} />, document.body.appendChild(document.createElement('div')));
announce();
