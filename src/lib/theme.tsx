import { type JSX, createContext } from 'preact';
import type { ComponentChildren } from 'preact';
import { useContext, useEffect, useState } from 'preact/hooks';

/** Storage key. Kit-local (not the btr.markets one) so an embedding app keeps its own preference. */
export const THEME_STORAGE_KEY = 'btr-ui-theme';

const read = (): string | null => {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY);
  } catch {
    return null;
  }
};
const write = (v: string) => {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, v);
  } catch {}
};

interface ThemeContextType {
  theme: string;
  setTheme: (theme: string) => void;
  toggleTheme: () => void;
}

const ThemeCtx = createContext<ThemeContextType | null>(null);

export function ThemeProvider({ children }: { children: ComponentChildren }) {
  const [theme, setTheme] = useState(() => read() || 'dark');

  useEffect(() => {
    const cl = document.documentElement.classList;
    cl.remove('light', 'dark');
    cl.add(theme);
    // Browser chrome / status bar follows the page ground (index.html's head script sets the first value).
    document
      .querySelector('meta[name=theme-color]')
      ?.setAttribute(
        'content',
        getComputedStyle(document.documentElement).getPropertyValue('--bg-0').trim(),
      );
    write(theme);
  }, [theme]);

  // Paper is white: print in the light palette whichever theme is on screen (dark tokens print as pale text).
  useEffect(() => {
    const cl = document.documentElement.classList;
    const paint = (t: string) => () => {
      cl.remove('light', 'dark');
      cl.add(t);
    };
    const on = paint('light');
    const off = paint(theme);
    addEventListener('beforeprint', on);
    addEventListener('afterprint', off);
    return () => {
      removeEventListener('beforeprint', on);
      removeEventListener('afterprint', off);
    };
  }, [theme]);

  return (
    <ThemeCtx.Provider
      value={{
        theme,
        setTheme,
        toggleTheme: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')),
      }}
    >
      {children}
    </ThemeCtx.Provider>
  ) as JSX.Element;
}

export const useTheme = (): ThemeContextType => {
  const c = useContext(ThemeCtx);
  if (!c) throw new Error('No ThemeProvider');
  return c;
};
