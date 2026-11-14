import { walletId } from '@btr-protocol/sdk/eth/wallets';
import { useEffect, useState } from 'preact/hooks';
import { walletIcon } from '../lib/walletIcon';
import { Icon } from '../ui/Icon';
import type { ProviderInfo } from './wallet';

/** 32 KB: an announced icon is a data URI of unbounded size. */
const ANNOUNCED_ICON_MAX = 32 * 1024;

/**
 * A wallet mark, one degradation order: the bundled btr.markets raster for a catalog id (`metamask`, `rabby`, …), then
 * the icon the wallet ANNOUNCED (EIP-6963 data URI: attacker-controlled, so `<img src>` only), then the generic wallet glyph. The glyph tile is always drawn under the image, so a slow or failed load is never an empty square.
 */
export function WalletGlyph({
  info,
  // A bare EIP-6963 entry (restored, never through the modal) names itself by rdns: the SDK alias map gives the catalog id.
  id = info?.id ?? (info?.rdns ? walletId(info.rdns) : undefined),
  name = info?.name ?? id ?? '?',
  announcedIcon = info?.icon,
  size = 28,
  bare = false,
}: {
  info?: Pick<ProviderInfo, 'name' | 'icon' | 'id' | 'rdns'>;
  id?: string;
  name?: string;
  announcedIcon?: string;
  size?: number;
  /** Only the mark: no backing tile, no ring, no generic glyph behind the image (a grid of marks). */
  bare?: boolean;
}) {
  const raster = id ? walletIcon(id) : undefined;
  const [stage, setStage] = useState(0);
  const [loadedSrc, setLoadedSrc] = useState<string>();
  useEffect(() => setStage(0), [id, announcedIcon]);
  // The announced icon is the wallet's own data: only a small inline image is drawn, never a request to its host.
  const announced = announcedIcon && announcedIcon.startsWith('data:image/') && announcedIcon.length <= ANNOUNCED_ICON_MAX ? announcedIcon : undefined;
  const src = stage === 0 && raster ? raster[0] : stage <= 1 && announced ? announced : undefined;
  // The tile (generic wallet glyph) is always there: a slow, missing or blocked image never leaves an empty square.
  return (
    <span
      style={{ width: size, height: size }}
      aria-hidden="true"
      className={`relative flex shrink-0 items-center justify-center rounded-xs ${bare ? '' : 'bg-bg-3 text-fg-2 ring-1 ring-bg-0'}`}
    >
      {!bare && <Icon name="wallet" className="w-4 h-4" />}
      {src && (
        <img
          src={src}
          srcSet={stage === 0 && raster ? `${raster[0]} 1x, ${raster[1]} 2x` : undefined}
          alt=""
          className={`absolute inset-0 h-full w-full rounded-xs ${loadedSrc === src ? '' : 'opacity-0'}`}
          // A cached or data: image can finish before the handler is attached: check on mount too.
          ref={(el) => {
            if (el?.complete && el.naturalWidth > 0) setLoadedSrc(src);
          }}
          onLoad={() => setLoadedSrc(src)}
          onError={() => setStage(stage === 0 && raster ? 1 : 2)}
        />
      )}
    </span>
  );
}

/** A generic action mark in the size and shape of a wallet mark (add / switch wallet, WalletConnect): never a brand icon. */
export function WalletTile({ icon, size = 28 }: { icon: string; size?: number }) {
  return (
    <span
      style={{ width: size, height: size }}
      aria-hidden="true"
      className="flex shrink-0 items-center justify-center rounded-xs bg-bg-3 text-fg-1"
    >
      <Icon name={icon} className="w-4 h-4" />
    </span>
  );
}
