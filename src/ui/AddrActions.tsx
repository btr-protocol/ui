// CopyAddressButton / ExplorerButton / AddressDisplay - THE address affordances: same glyphs, same
// popovers, same green copied flash. The kit has no chain registry, so the explorer link is a prop.
import type { ComponentChildren } from 'preact';
import { cn } from '../lib/cn';
import { openExternal } from '../lib/nav';
import { shortAddr } from '../lib/address';
import { useCopy } from '../lib/useCopy';
import { Tooltip } from './FloatingPanel';
import { Icon } from './Icon';

export function CopyAddressButton({
  value,
  copiedMessage = 'Copied to clipboard',
  className = 'relative hover:text-primary transition-colors after:absolute after:-inset-2 after:content-[""] coarse:after:-inset-3',
  label = 'Copy address',
  children,
}: {
  value: string;
  /** Toast wording - say WHICH value was taken ("Copied WETH address to clipboard"). */
  copiedMessage?: string;
  className?: string;
  /** Accessible name; the glyph alone has none. */
  label?: string;
  /** Rendered inside the button before the glyph (the short address, a symbol). */
  children?: ComponentChildren;
}) {
  const { copied, copy } = useCopy();
  return (
    <Tooltip content={`Copy ${value}`} side="bottom">
      <button
        type="button"
        onClick={(e) => copy(value, copiedMessage, e)}
        aria-label={label}
        className={cn('flex items-center gap-1 group', className)}
      >
        {children}
        <Icon
          name="copy"
          className={`w-4 h-4 ${copied ? 'text-success' : 'text-fg-3'} group-hover:text-primary`}
        />
      </button>
    </Tooltip>
  );
}

export function ExplorerButton({
  href,
  kind = 'address',
  className = 'relative hover:text-primary transition-colors after:absolute after:-inset-2 after:content-[""] coarse:after:-inset-3',
}: {
  /** Explorer URL of the value; without one nothing renders (a dead-looking control is worse than none). */
  href?: string;
  kind?: 'address' | 'token' | 'tx';
  className?: string;
}) {
  if (!href) return null;
  const view = `View ${kind === 'tx' ? 'transaction' : kind} on the explorer`;
  return (
    <Tooltip content={view} side="bottom">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          openExternal(href);
        }}
        aria-label={view}
        className={className}
      >
        <Icon
          name="external-link"
          className="w-4 h-4 text-fg-3 hover:text-primary"
        />
      </button>
    </Tooltip>
  );
}

/**
 * AddressDisplay: THE way an address, token or tx hash is shown.
 *
 * One presentation: the value, then copy, then explorer, each with a real tooltip. The copy
 * tooltip carries the FULL value, which is what makes a shortened label safe to show.
 */
export function AddressDisplay({
  value,
  name,
  explorerHref,
  kind = 'address',
  full = false,
  lead,
  text,
  copiedMessage,
  className,
  textClassName = 'font-mono text-fg-2',
  title,
}: {
  value: string;
  /** Human name shown before the short address ("Treasury 0x4B1D…1521"). */
  name?: string;
  explorerHref?: string;
  kind?: 'address' | 'token' | 'tx';
  /** Render the whole value instead of the shortened form. */
  full?: boolean;
  lead?: number;
  /** Shown in place of the shortened value (a feed id's own short form); copy still takes `value`. */
  text?: string;
  copiedMessage?: string;
  className?: string;
  textClassName?: string;
  /** Supplementary context for the label itself (a timestamp, a role). The full value is
   *  already on the copy button's tooltip, so this is for anything BESIDES the value. */
  title?: string;
}) {
  if (!value) return null;
  const label = text ?? (full ? value : shortAddr(value, lead));
  return (
    <span className={cn('inline-flex items-center gap-1 coarse:gap-3 align-middle', className)}>
      {name && <span className="font-medium text-fg-0">{name}</span>}
      <span className={textClassName} title={title}>
        {label}
      </span>
      <CopyAddressButton
        value={value}
        copiedMessage={copiedMessage ?? `Copied ${value} to clipboard`}
      />
      <ExplorerButton href={explorerHref} kind={kind} />
    </span>
  );
}
