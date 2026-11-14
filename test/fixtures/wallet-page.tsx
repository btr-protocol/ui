// Page for test/wallet-rows.browser.test.tsx: the real connect modal with 2 Recent + 2 Installed wallets, rendered by Chromium.
// ?icon=ok (default): Ambire announces a detailed purple mark on a TRANSPARENT background, as a wallet would (a stand-in:
// the kit bundles no Ambire asset, it only ever arrives as an EIP-6963 data URI); ?icon=broken: an undecodable data URI.
// Connections are recorded on window.__connected.
import { render } from 'preact';
import { RECENT_KEY } from '../../src/wallet/recentWallets';
import { WalletModal } from '../../src/wallet/WalletModal';

const q = new URLSearchParams(location.search);
const svg = (fill: string) =>
  `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="9" fill="${fill}"/></svg>`)}`;
const mark = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#b66bff"/><stop offset="1" stop-color="#5b2bd6"/></linearGradient></defs><path d="M32 4c6 10 20 18 20 34 0 12-9 22-20 22S12 50 12 38C12 22 26 14 32 4z" fill="url(#g)"/><path d="M32 22c3 6 10 10 10 18 0 6-4 11-10 11s-10-5-10-11c0-8 7-12 10-18z" fill="#fff" fill-opacity=".85"/><circle cx="32" cy="42" r="4" fill="#5b2bd6"/></svg>',
)}`;
const icon = q.get('icon') === 'broken' ? 'data:image/png;base64,AAAA' : mark;
const now = Date.now();
const rec = (id: string, name: string, n: number) => ({ id, name, via: 'injected', last: now - n, uses: 1 });
localStorage.setItem(RECENT_KEY, JSON.stringify([rec('com.ambire.wallet', 'Ambire', 1), rec('io.rabby', 'Rabby Wallet', 2)]));

const provider = () => ({ request: async ({ method }: { method: string }) => (method === 'eth_chainId' ? '0x8f' : ['0xaB7B000000000000000000000000000000000760']), on() {}, removeListener() {} });
const wallets = [
  { uuid: 'ambire', name: 'Ambire', rdns: 'com.ambire.wallet', icon },
  { uuid: 'rabby', name: 'Rabby Wallet', rdns: 'io.rabby', icon: svg('#8697ff') },
  { uuid: 'brave', name: 'Brave Wallet', rdns: 'com.brave.wallet', icon: svg('#fb542b') },
  { uuid: 'phantom', name: 'Phantom', rdns: 'app.phantom', icon: svg('#ab9ff2') },
];
const providers = new Map<string, ReturnType<typeof provider>>(); // one provider object per wallet: the modal keys rows by provider
const announce = () => wallets.forEach((info) => window.dispatchEvent(new CustomEvent('eip6963:announceProvider', { detail: { info, provider: providers.get(info.uuid) ?? providers.set(info.uuid, provider()).get(info.uuid) } })));
window.addEventListener('eip6963:requestProvider', announce);

(window as unknown as { __connected: string[] }).__connected = [];
const onConnect = async (_p: unknown, info: { id: string }) => void (window as unknown as { __connected: string[] }).__connected.push(info.id);
render(<WalletModal isOpen onClose={() => {}} onConnect={onConnect} />, document.body.appendChild(document.createElement('div')));
announce();
