import { type WalletInfo, detectLegacy, mergeWallets } from '@btr-protocol/sdk/eth/wallets';
import { useMemo } from 'preact/hooks';
import { useProviders } from './useProviders';

export type { WalletInfo };
/** A detected wallet plus its EIP-6963 announcement uuid (unique per announcement, unlike the rdns): the row key. */
export type InjectedWallet = WalletInfo & { uuid?: string };

/** Providers injected into this page: EIP-6963 announcements (late ones included) plus legacy globals
 *  (in-wallet browsers, extensions that do not announce), deduped and named from the SDK catalog. Legacy is
 *  probed once, synchronously, so the first paint is right. The btr.markets list, verbatim. */
export function useInjectedWallets(): InjectedWallet[] {
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
      )
        // The SDK dedupes by id only: an unknown announced wallet that is also window.ethereum would show twice.
        .filter((w) => !(w.id === 'injected' && announced.some((a) => a.provider === w.provider)))
        .map((w) => ({ ...w, uuid: announced.find((a) => a.provider === w.provider)?.info.uuid })),
    [announced, legacy],
  );
}
