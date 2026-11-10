import { walletId } from '@btr-protocol/sdk/eth/wallets';
import { useEffect, useState } from 'preact/hooks';
import { walletIcon } from '../lib/walletIcon';
import type { ProviderInfo } from './wallet';

/**
 * A wallet mark, one degradation order: the bundled btr.markets raster for a catalog id (`metamask`, `rabby`, …), then
 * the icon the wallet ANNOUNCED (EIP-6963 data URI: attacker-controlled, so `<img src>` only), then its initial on a tile.
 */
export function WalletGlyph({
  info,
  // A bare EIP-6963 entry (restored, never through the modal) names itself by rdns: the SDK alias map gives the catalog id.
  id = info?.id ?? (info?.rdns ? walletId(info.rdns) : undefined),
  name = info?.name ?? id ?? '?',
  announcedIcon = info?.icon,
  size = 28,
}: {
  info?: Pick<ProviderInfo, 'name' | 'icon' | 'id' | 'rdns'>;
  id?: string;
  name?: string;
  announcedIcon?: string;
  size?: number;
}) {
  const raster = id ? walletIcon(id) : undefined;
  const [stage, setStage] = useState(0);
  useEffect(() => setStage(0), [id, announcedIcon]);
  const box = { width: size, height: size };
  const src = stage === 0 && raster ? raster[0] : stage <= 1 && announcedIcon ? announcedIcon : undefined;
  if (src)
    return (
      <img
        src={src}
        srcSet={stage === 0 && raster ? `${raster[0]} 1x, ${raster[1]} 2x` : undefined}
        alt=""
        style={box}
        className="shrink-0 rounded-xs ring-1 ring-bg-0"
        onError={() => setStage(stage === 0 && raster ? 1 : 2)}
      />
    );
  return (
    <span
      style={box}
      aria-hidden="true"
      className="flex shrink-0 items-center justify-center rounded-xs bg-bg-3 text-xs font-semibold text-fg-1"
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}
