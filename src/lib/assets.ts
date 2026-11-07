/** Bundled asset URLs (resolved by the consumer's bundler via `new URL(..., import.meta.url)`). */
export const LOGO_URL = new URL('../assets/brand/logo.svg', import.meta.url).href;
export const LOGO_MARK_URL = new URL('../assets/brand/logo-b.svg', import.meta.url).href;

export const SOCIAL_ICONS = {
  x: new URL('../assets/icons/x.svg', import.meta.url).href,
  telegram: new URL('../assets/icons/telegram.svg', import.meta.url).href,
  github: new URL('../assets/icons/github.svg', import.meta.url).href,
  docs: new URL('../assets/icons/docs.svg', import.meta.url).href,
} as const;
