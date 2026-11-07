import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import { LOGO_URL } from '../lib/assets';
import { navigateTo, openExternal } from '../lib/nav';
import { scrollPane } from '../lib/scroll';
import { Tooltip } from '../ui/FloatingPanel';
import { MaskIcon } from '../ui/MaskIcon';

const FOOTER_LINK = 'text-fg-2 pt-0.5 hover:text-fg-0 transition-colors';

export interface FooterLink {
  title: string;
  /** Absolute URL, or an app path. */
  href: string;
  description?: string;
  /** Icon URL (social row only); masked and tinted like the logo. */
  icon?: string;
  /** Opens outside the app. Default: true for `http(s)://` hrefs. */
  external?: boolean;
}

const isExternal = (l: FooterLink) => l.external ?? /^https?:\/\//.test(l.href);
const open = (l: FooterLink, onNavigate?: (href: string) => void) =>
  isExternal(l) ? openExternal(l.href) : (onNavigate ?? navigateTo)(l.href);

/** Social icon row. Shared with the phone More sheet. */
export function SocialLinks({
  links,
  onNavigate,
}: {
  links: FooterLink[];
  onNavigate?: (href: string) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      {links.map((link) => (
        <Tooltip key={link.title} content={link.description || link.title} side="top">
          <button
            onClick={() => open(link, onNavigate)}
            aria-label={link.description || link.title}
            className="p-1 hover:opacity-80 transition-opacity"
          >
            <MaskIcon
              src={link.icon ?? ''}
              size={20}
              color="var(--fg-3)"
              className="hover:brightness-125"
            />
          </button>
        </Tooltip>
      ))}
    </div>
  );
}

/** ToS + Disclaimer. Shared with the phone More sheet. */
export function LegalLinks({
  links,
  className = FOOTER_LINK,
  onNavigate,
}: {
  links: FooterLink[];
  className?: string;
  onNavigate?: (href: string) => void;
}) {
  return (
    <>
      {links.map((link) => (
        <button key={link.title} onClick={() => open(link, onNavigate)} className={className}>
          {link.title}
        </button>
      ))}
    </>
  );
}

export interface FooterProps {
  social?: FooterLink[];
  legal?: FooterLink[];
  /** Left of the bar after the social icons: a status beacon, a latency read. */
  status?: ComponentChildren;
  /** Before the legal links: a FAQ disclosure. */
  about?: ComponentChildren;
  onNavigate?: (href: string) => void;
  logoSrc?: string;
  /** Aria label of the back-to-top buttons. */
  topLabel?: string;
}

/** Desktop only: below `lg` the tab bar and its More sheet carry all of this. */
export function Footer({
  social = [],
  legal = [],
  status,
  about,
  onNavigate,
  logoSrc = LOGO_URL,
  topLabel = 'Back to top',
}: FooterProps) {
  const currentYear = new Date().getFullYear();
  const [logoHover, setLogoHover] = useState(false);
  const handleScrollTop = () => scrollPane();

  return (
    // h/pb/pl/pr = --chrome-b + safe insets; ::before paints bg-0 under the system nav bar.
    <footer className="no-print max-lg:hidden kbd:hidden fixed inset-x-0 bottom-0 z-footer flex h-[var(--chrome-b)] items-center pb-[var(--sab)] pl-[var(--sal)] pr-[var(--sar)] font-light text-sm safe-b">
      <nav className="relative px-3 max-w-6xl h-full mx-auto flex items-center justify-between border border-b-0 rounded-t-lg backdrop-blur-md bg-glass border-border w-full">
        <div className="flex items-center gap-3">
          <SocialLinks links={social} onNavigate={onNavigate} />
          {status}
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          {about}
          <LegalLinks links={legal} onNavigate={onNavigate} />

          <button
            className="hidden sm:block text-fg-2 pt-0.5 cursor-pointer hover:text-fg-0 font-title"
            onClick={handleScrollTop}
            aria-label={topLabel}
          >
            © {currentYear}
          </button>

          <button
            className="hidden sm:block cursor-pointer"
            onClick={handleScrollTop}
            aria-label={topLabel}
            onMouseEnter={() => setLogoHover(true)}
            onMouseLeave={() => setLogoHover(false)}
          >
            <MaskIcon
              src={logoSrc}
              width="4rem"
              height="1.8rem"
              color={logoHover ? 'var(--fg-1)' : 'var(--fg-3)'}
              className="transition-all duration-200"
            />
          </button>
        </div>
      </nav>
    </footer>
  );
}

/** Desktop FAQ-style disclosure anchored to the footer bar (opens upward at full bar width). */
export function FooterAbout({ label, children }: { label: string; children: ComponentChildren }) {
  return (
    <details>
      <summary
        className={`${FOOTER_LINK} cursor-pointer list-none [&::-webkit-details-marker]:hidden`}
      >
        {label}
      </summary>
      <div className="absolute bottom-full inset-x-0 mb-1 max-h-[60dvh] overflow-y-auto space-y-2 rounded-md border border-border bg-bg-1 p-3 text-xs leading-snug text-fg-2 shadow-lg sm:left-auto sm:w-[36rem]">
        {children}
      </div>
    </details>
  );
}
