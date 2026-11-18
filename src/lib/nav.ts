import { isInternalHref, isSafeExternalHref } from './safeHref';

/** Navigation seam. Kit links route through these; the host app swaps in its router once at startup. */
interface NavImpl {
  /** In-app route change for same-origin paths. Default: full page load. */
  navigate: (href: string, opts?: { replace?: boolean }) => void;
  /** Leaving the app (a host may show a confirm sheet first). Default: new tab. */
  openExternal: (href: string) => void;
}

let impl: NavImpl = {
  navigate: (href, opts) => (opts?.replace ? location.replace(href) : location.assign(href)),
  openExternal: (href) => void window.open(href, '_blank', 'noopener,noreferrer'),
};

export function configureNav(next: Partial<NavImpl>): void {
  impl = { ...impl, ...next };
}
/** Both refuse anything but their own kind: `javascript:`, `data:`, `//host` never reach the router. */
export const navigateTo: NavImpl['navigate'] = (href, opts) => {
  if (isInternalHref(href) || href.startsWith('#') || href.startsWith('?')) impl.navigate(href, opts);
};
export const openExternal: NavImpl['openExternal'] = (href) => {
  if (isSafeExternalHref(href)) impl.openExternal(href);
};
