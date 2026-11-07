import type { ProviderInfo } from './wallet';

/** The wallet's announced icon (EIP-6963 data URI), or its initial on a tile when it announced none. */
export function WalletGlyph({ info, size = 28 }: { info: Pick<ProviderInfo, 'name' | 'icon'>; size?: number }) {
  const box = { width: size, height: size };
  return info.icon ? (
    <img src={info.icon} alt="" style={box} className="shrink-0 rounded-sm" />
  ) : (
    <span
      style={box}
      aria-hidden="true"
      className="flex shrink-0 items-center justify-center rounded-sm bg-bg-3 text-xs font-bold text-fg-1"
    >
      {info.name.charAt(0).toUpperCase()}
    </span>
  );
}
