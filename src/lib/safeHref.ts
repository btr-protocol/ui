/** Same-app path: a single leading `/`, so `//evil.com` and `\/` tricks never read as internal. */
export const isInternalHref = (href: string): boolean =>
  href.startsWith('/') && !href.startsWith('//') && !/[\\\s]/.test(href);

/** Absolute http(s) only: `javascript:`, `data:` and unparseable hrefs render as plain text. */
export const isSafeExternalHref = (href: string): boolean => {
  if (/[\\\s]/.test(href)) return false;
  try {
    const u = new URL(href, typeof window === 'undefined' ? 'https://invalid.invalid' : window.location.origin);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
};

/** Same-page reference (`#anchor`, `?q=`): a plain anchor, never SPA-navigated nor external. */
export const isSamePageHref = (href: string): boolean => href.startsWith('#') || href.startsWith('?');

/** The href when internal, same-page or http(s); `undefined` for `javascript:`, `data:` and the like. */
export const safeHref = (href: string | undefined): string | undefined =>
  href !== undefined && (isInternalHref(href) || isSamePageHref(href) || isSafeExternalHref(href))
    ? href
    : undefined;
