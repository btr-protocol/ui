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
export const navigateTo: NavImpl['navigate'] = (href, opts) => impl.navigate(href, opts);
export const openExternal: NavImpl['openExternal'] = (href) => impl.openExternal(href);
