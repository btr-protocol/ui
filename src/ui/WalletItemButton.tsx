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
  /** With `href`: a page outside this app, opened in a new tab (`noopener noreferrer`). */
  external?: boolean;
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
  /** Accessible name when the visible text is not enough (a link that opens a new tab). */
  ariaLabel?: string;
  /** Unavailable via `aria-disabled` instead of `disabled`: the row keeps focus (and arrow-key order) while busy; the
   *  caller ignores clicks. */
  ariaDisabled?: boolean;
  /** Nothing to do on this row (the current account): same surface, but a plain element with no hover, pointer or focus stop. */
  inert?: boolean;
}

export function WalletItemButton({
  name,
  icon,
  onClick,
  href,
  external = false,
  disabled = false,
  variant = 'default',
  isConnecting = false,
  tooltip,
  rightIcon,
  isHighlighted = false,
  isSelected = false,
  caption,
  ariaLabel,
  ariaDisabled = false,
  inert = false,
}: WalletItemButtonProps) {
  const unavailable = disabled || isConnecting;
  const off = !ariaDisabled && unavailable;
  // Only a row that can start a connection reserves the loader slot; a text-only row (disconnect, copy) or one with its own right icon does not.
  const canConnect = !!icon && !rightIcon;
  const cls = `w-full flex items-center gap-3 h-12 px-3 border-b border-border disabled:opacity-50 disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:cursor-not-allowed font-title transition-colors ${
    isSelected ? 'bg-bg-primary' : isHighlighted ? 'bg-bg-3' : 'bg-bg-2'
  } ${inert ? 'cursor-default' : 'hover-primary'}`;
  const content = (
    <>
      {icon}
      <FormRow
        className="flex-1"
        gap="md"
        label={
          <span className="flex flex-col flex-1 min-w-0 text-left">
            <span className={`font-medium text-sm truncate min-w-0 ${isSelected ? 'text-primary' : 'text-fg-1'}`}>
              {name}
            </span>
            {caption && <span className="text-2xs text-fg-3 truncate">{caption}</span>}
          </span>
        }
        valueClassName="flex items-center"
        value={
          rightIcon || (
            <>
              {variant === 'detected' && <Badge variant="positive">Detected</Badge>}
              {variant === 'discover' && (
                <Icon name="external-link" className="w-4 h-4 text-fg-2 shrink-0" />
              )}
              {/* Fixed slot: the loader is centred on the row's axis and the row never shifts when it appears. */}
              {variant === 'default' && canConnect && (
                <span className="flex h-5 w-5 items-center justify-center" aria-hidden={!isConnecting}>
                  {isConnecting && <Spinner />}
                </span>
              )}
              {isConnecting && !(variant === 'default' && canConnect) && <Spinner className="shrink-0" />}
            </>
          )
        }
      />
    </>
  );
  const button = inert ? (
    <div className={cls} aria-current={isSelected || undefined}>
      {content}
    </div>
  ) : href && !off ? (
      <a href={href} className={cls} onClick={onClick} aria-label={ariaLabel} {...(external && { target: '_blank', rel: 'noopener noreferrer' })}>
        {content}
      </a>
    ) : (
      <button className={cls} onClick={onClick} aria-label={ariaLabel} disabled={off} aria-disabled={(ariaDisabled && unavailable) || undefined}>
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
