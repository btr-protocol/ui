import type { ComponentChildren } from 'preact';
import { LOGO_URL } from '../lib/assets';
import { cn } from '../lib/cn';
import { Button } from '../ui/Button';
import { Tooltip } from '../ui/FloatingPanel';
import { Icon } from '../ui/Icon';
import { MaskIcon } from '../ui/MaskIcon';
import { Dropdown } from '../ui/Select';
import { NavBadge } from './NavBadge';
import { type NavItem, isNavActive } from './nav';

function NavButton({
  item,
  active,
}: {
  item: NavItem;
  active: boolean;
}) {
  return (
    <Tooltip content={item.description || item.title} side="bottom">
      <Button href={item.path} size="sm" variant="ghost" active={active} className="whitespace-nowrap">
        {item.title}
        <NavBadge count={item.badge} label={item.badgeLabel} inline />
      </Button>
    </Tooltip>
  );
}

export interface HeaderToolProps {
  label: string;
  title?: string;
  /** Registered Icon name. */
  icon: string;
  onClick: () => void;
  /** Overlay count (notification badge). */
  badge?: number;
  /** Hidden below `lg` (phones reach it through the tab bar's More sheet). */
  desktopOnly?: boolean;
  /** Extra content after the icon (a keyboard-hint Badge). */
  children?: ComponentChildren;
}

/** One button of the optional tools group: pass them as `<Header tools={...}>` children. */
export function HeaderTool({
  label,
  title,
  icon,
  onClick,
  badge = 0,
  desktopOnly,
  children,
}: HeaderToolProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={title ?? label}
      className={cn(
        'tap-min relative min-w-[var(--ctl-m)] px-2 coarse:px-3 flex items-center justify-center gap-1.5 text-fg-2 hover:bg-bg-3 hover:text-fg-0 transition-colors border-l border-border first:border-l-0 first:rounded-l-sm last:rounded-r-sm',
        desktopOnly && 'max-lg:hidden',
      )}
    >
      <Icon name={icon} className="w-4 h-4" />
      {children}
      {badge > 0 && (
        <span className="absolute top-0 right-0 -translate-y-1/3 translate-x-1/3 inline-flex items-center justify-center min-w-[14px] h-3.5 px-1 rounded-full bg-primary text-black text-2xs font-semibold leading-none ring-1 ring-bg-1">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </button>
  );
}

export interface HeaderProps {
  /** Desktop nav buttons. */
  items: NavItem[];
  /** Overflow entries behind the "More" dropdown. */
  more?: NavItem[];
  activePath: string;
  onNavigate: (path: string) => void;
  /** Logo link target and its click (default: `onNavigate(homePath)`). */
  homePath?: string;
  /** Accessible name of the logo link. */
  brandLabel?: string;
  logoSrc?: string;
  /** Replaces the logo mask (a co-branded lockup). Sized by the caller to the 2rem header row. */
  brand?: ComponentChildren;
  moreLabel?: string;
  /** Optional bordered tools group left of the right slot: `<HeaderTool/>` children. */
  tools?: ComponentChildren;
  /** Right end: chain select, wallet button, theme toggle. */
  right?: ComponentChildren;
  /** Custom active test; default is path-prefix match. */
  isActive?: (itemPath: string) => boolean;
}

export function Header({
  items,
  more = [],
  activePath,
  onNavigate,
  homePath = '/',
  brandLabel = 'Home',
  logoSrc = LOGO_URL,
  brand,
  moreLabel = 'More',
  tools,
  right,
  isActive = (p) => isNavActive(activePath, p),
}: HeaderProps) {
  const moreActive = more.some((i) => isActive(i.path));
  return (
    // Paints bg-0 behind the status bar (::before over the --sat inset); the glass nav keeps its
    // own blur below it. Landscape cutouts inset by --sal/--sar.
    <header className="no-print fixed inset-x-0 top-0 z-header flex h-[var(--chrome-t)] items-center pl-[var(--sal)] pr-[var(--sar)] pt-[var(--sat)] safe-t">
      <nav className="relative max-w-6xl h-full mx-auto w-full flex items-center justify-between gap-2 lg:gap-6 px-3 border border-t-0 rounded-b-lg backdrop-blur-md bg-glass border-border">
        <a
          href={homePath}
          aria-label={brandLabel}
          onClick={(e) => {
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
            e.preventDefault();
            onNavigate(homePath);
          }}
          className="flex items-center coarse:min-h-10"
        >
          {brand ?? <MaskIcon src={logoSrc} width="6rem" height="2rem" color="var(--fg-0)" />}
        </a>

        <nav className="hidden lg:flex items-center gap-1">
          {items.map((item) => (
            <NavButton
              key={item.path}
              item={item}
              active={isActive(item.path)}
            />
          ))}
          {more.length > 0 && (
            <Dropdown
              items={more.map((i) => ({ value: i.path, label: i.title, tooltip: i.description }))}
              value={more.find((i) => isActive(i.path))?.path ?? ''}
              onChange={(next) => onNavigate(next as string)}
              size="sm"
              minWidth={160}
              side="bottom"
              trigger={
                <span
                  className={`h-[var(--ctl-m)] px-3 text-sm font-medium font-title rounded-sm transition-colors inline-flex items-center gap-1 ${
                    moreActive
                      ? 'text-primary bg-bg-primary'
                      : 'text-fg-2 hover:text-fg-0 hover:bg-bg-2'
                  }`}
                >
                  {moreLabel} <Icon name="caret-down" className="w-3.5 h-3.5" />
                </span>
              }
            />
          )}
        </nav>

        <div className="flex items-center gap-2">
          {tools && (
            <div className="flex items-stretch border border-border rounded-sm bg-bg-1 min-h-[var(--ctl-m)]">
              {tools}
            </div>
          )}
          {right}
        </div>
      </nav>
    </header>
  );
}
