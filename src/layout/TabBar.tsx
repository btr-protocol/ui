import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import { cn } from '../lib/cn';
import { haptic } from '../lib/haptic';
import { scrollPane } from '../lib/scroll';
import { BaseModal, MODAL_PADDING } from '../ui/BaseModal';
import { Icon } from '../ui/Icon';
import { MaskIcon } from '../ui/MaskIcon';
import { type NavItem, isNavActive } from './nav';

/** Nav icons are either an Icon name or an svg path (starts with `/`, `.` or `http`). */
function NavIcon({ icon }: { icon?: string }) {
  if (!icon) return null;
  return /^(\/|\.|https?:)/.test(icon) ? (
    <MaskIcon src={icon} size="md" color="currentColor" />
  ) : (
    <Icon name={icon} className="w-5 h-5" />
  );
}

const ROW = `w-full flex items-center gap-3 ${MODAL_PADDING} py-3 text-left hover:bg-bg-2 transition-colors`;

export interface TabBarProps {
  /** The bottom tabs (4 in btr.markets); a "More" tab is appended when `more` or `children` exist. */
  tabs: NavItem[];
  /** Entries in the More sheet. */
  more?: NavItem[];
  activePath: string;
  /** `replace`: tab switches replace history so Back never walks through tabs. */
  onNavigate: (path: string, opts?: { replace?: boolean }) => void;
  moreLabel?: string;
  primaryLabel?: string;
  /** More-sheet rows after the entries: settings row, network select, social + legal links. */
  children?: ComponentChildren;
  isActive?: (itemPath: string) => boolean;
}

/** Phone bottom bar (< lg). Matches the desktop footer's full-width glass frame in a --chrome-b box
 *  (56dp + gesture inset). Hidden with the keyboard up. "More" is a sheet with everything the
 *  desktop footer and More menu carry. */
export function TabBar({
  tabs,
  more = [],
  activePath,
  onNavigate,
  moreLabel = 'More',
  primaryLabel = 'Primary',
  children,
  isActive = (p) => isNavActive(activePath, p),
}: TabBarProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const hasMore = more.length > 0 || !!children;
  const moreActive = moreOpen || more.some((i) => isActive(i.path));

  // Tapping the tab you are on scrolls to the top.
  const goTab = (to: string) => {
    haptic('tap');
    if (isActive(to)) scrollPane();
    else onNavigate(to, { replace: true });
  };
  const goMore = (item: NavItem) => {
    setMoreOpen(false);
    onNavigate(item.path, { replace: true });
  };

  const tab = (active: boolean) =>
    cn(
      'flex h-full min-w-0 flex-col items-center justify-center gap-0.5 rounded-sm px-2 text-2xs font-medium font-title transition-colors',
      active ? 'bg-bg-primary text-primary' : 'text-fg-2',
    );

  return (
    <>
      {/* Same safe-area offsets and frame as the desktop footer. */}
      <nav
        aria-label={primaryLabel}
        className="no-print lg:hidden kbd:hidden pointer-events-none fixed inset-x-0 bottom-0 z-footer flex h-[var(--chrome-b)] items-center justify-center pb-[var(--sab)] pl-[var(--sal)] pr-[var(--sar)] safe-b"
      >
        <div
          className="pointer-events-auto relative mx-auto grid h-full w-full max-w-6xl gap-0.5 rounded-t-lg border border-b-0 border-border bg-glass p-0.5 backdrop-blur-md"
          style={{ gridTemplateColumns: `repeat(${tabs.length + (hasMore ? 1 : 0)}, minmax(0, 1fr))` }}
        >
          {tabs.map((item) => (
            <button
              key={item.path}
              type="button"
              onClick={() => goTab(item.path)}
              aria-current={isActive(item.path) ? 'page' : undefined}
              className={tab(isActive(item.path))}
            >
              <NavIcon icon={item.icon} />
              {item.title}
            </button>
          ))}
          {hasMore && (
            <button
              type="button"
              onClick={() => {
                haptic('tap');
                setMoreOpen(true);
              }}
              aria-haspopup="dialog"
              aria-expanded={moreOpen}
              className={tab(moreActive)}
            >
              <Icon name="menu" className="w-5 h-5" />
              {moreLabel}
            </button>
          )}
        </div>
      </nav>

      <BaseModal
        isOpen={moreOpen}
        onClose={(open) => setMoreOpen(open)}
        title={moreLabel}
        headerType="title"
        size="sm"
      >
        <div className="divide-y divide-border">
          {more.map((item) => (
            <button
              key={item.path}
              type="button"
              onClick={() => goMore(item)}
              className={cn(ROW, isActive(item.path) && 'text-primary')}
            >
              <span className="text-fg-2">
                <NavIcon icon={item.icon} />
              </span>
              <div className="flex-1">
                <div className="text-sm font-medium">{item.title}</div>
                {item.description && <div className="text-xs text-fg-2">{item.description}</div>}
              </div>
            </button>
          ))}
          {children}
        </div>
      </BaseModal>
    </>
  );
}

/** Row styling for custom More-sheet rows (settings, network): same padding as the entries. */
export const TAB_BAR_ROW = ROW;
