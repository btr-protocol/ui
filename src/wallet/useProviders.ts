import { useEffect, useState } from 'preact/hooks';
import { type ProviderEntry, discoverProviders } from './wallet';

/** EIP-6963 wallets announced in this page, including late announcements. */
export function useProviders(): ProviderEntry[] {
  const [list, setList] = useState<ProviderEntry[]>([]);
  useEffect(() => {
    let live = true;
    const add = (e: ProviderEntry) =>
      setList((l) => (l.some((x) => x.info.uuid === e.info.uuid) ? l : [...l, e]));
    const onAnnounce = (ev: Event) => {
      const d = (ev as CustomEvent<ProviderEntry>).detail;
      if (d?.info?.uuid && typeof d.provider?.request === 'function') add(d);
    };
    window.addEventListener('eip6963:announceProvider', onAnnounce);
    void discoverProviders().then((found) => live && found.forEach(add));
    return () => {
      live = false;
      window.removeEventListener('eip6963:announceProvider', onAnnounce);
    };
  }, []);
  return list;
}
