/**
 * WalletItemButton - Consolidated wallet item button (detected, discover, or generic)
 * Consolidates WalletButton and DiscoverWalletButton patterns from WalletModal
 */
import type { ComponentChildren } from 'preact';
import { Badge } from './Badge';
import { Tooltip } from './FloatingPanel';
import { Icon } from './Icon';
import { FormRow } from './Primitives';
import { Spinner } from './Spinner';

type WalletItemVariant = 'detected' | 'discover' | 'default';

interface WalletItemButtonProps {
  name: string;
  /** Left-side glyph node: `WalletGlyph`/`NetworkGlyph`, never a raw path. The raster pair,
   *  the degradation order and the fallback all belong to the glyph. Omit for text-only actions
   *  (e.g. Copy Address, Disconnect). */
  icon?: ComponentChildren;
  onClick: (e: Event) => void;
  /** Renders a real link (long-press / open-in-app work) instead of a button; the row is a button
   *  again while it is unset or `disabled`. */
  href?: string;
  disabled?: boolean;
  variant?: WalletItemVariant;
  isConnecting?: boolean;
  tooltip?: string;
  rightIcon?: ComponentChildren;
  isHighlighted?: boolean;
  /** Active/selected state - same treatment as SelectionModal's selected item (primary bg + text). */
  isSelected?: boolean;
  /** Secondary line under the name (e.g. "Not available" on an undeployed chain). */
  caption?: string;
}

export function WalletItemButton({
  name,
  icon,
  onClick,
  href,
  disabled = false,
  variant = 'default',
  isConnecting = false,
  tooltip,
  rightIcon,
  isHighlighted = false,
  isSelected = false,
  caption,
}: WalletItemButtonProps) {
  const off = disabled || isConnecting;
  const cls = `w-full flex items-center gap-3 h-12 px-3 border-b border-border disabled:opacity-50 disabled:cursor-not-allowed font-title transition-colors ${
    isSelected
      ? 'bg-bg-primary hover-primary'
      : isHighlighted
        ? 'bg-bg-3 hover-primary'
        : 'bg-bg-2 hover-primary'
  }`;
  const content = (
    <>
      {icon}
      <FormRow
        className="flex-1"
        gap="md"
        label={
          <span className="flex flex-col flex-1 min-w-0 text-left">
            <span className={`font-medium text-sm ${isSelected ? 'text-primary' : 'text-fg-1'}`}>
              {name}
            </span>
            {caption && <span className="text-3xs text-fg-3 truncate">{caption}</span>}
          </span>
        }
        value={
          rightIcon || (
            <>
              {variant === 'detected' && <Badge variant="positive">Detected</Badge>}
              {variant === 'discover' && (
                <Icon name="external-link" className="w-4 h-4 text-fg-2 shrink-0" />
              )}
              {isConnecting && <Spinner className="shrink-0" />}
            </>
          )
        }
      />
    </>
  );
  const button =
    href && !off ? (
      <a href={href} className={cls} onClick={onClick}>
        {content}
      </a>
    ) : (
      <button className={cls} onClick={onClick} disabled={off}>
        {content}
      </button>
    );

  if (tooltip) {
    return (
      <Tooltip content={tooltip} side="top" asChild>
        {button}
      </Tooltip>
    );
  }

  return button;
}
