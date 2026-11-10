import { type WalletInfo, detectLegacy, mergeWallets } from '@btr-protocol/sdk/eth/wallets';
import { useMemo } from 'preact/hooks';
import { useProviders } from './useProviders';

export type { WalletInfo };

/** Providers injected into this page: EIP-6963 announcements (late ones included) plus legacy globals
 *  (in-wallet browsers, extensions that do not announce), deduped and named from the SDK catalog. Legacy is
 *  probed once, synchronously, so the first paint is right. The btr.markets list, verbatim. */
export function useInjectedWallets(): WalletInfo[] {
  const announced = useProviders();
  const legacy = useMemo(detectLegacy, []);
  return useMemo(
    () =>
      mergeWallets(
        announced.map(({ info, provider }) => ({
          info: { uuid: info.uuid, name: info.name, icon: info.icon ?? '', rdns: info.rdns ?? '' },
          provider: provider as WalletInfo['provider'],
        })),
        legacy,
      ),
    [announced, legacy],
  );
}
