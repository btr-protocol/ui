import type { ComponentChildren } from 'preact';
import { Notifications } from './Notifications';

export interface ShellProps {
  /** Fixed top bar: `<Header/>`. */
  header: ComponentChildren;
  /** Fixed bottom bar, desktop: `<Footer/>`. */
  footer?: ComponentChildren;
  /** Fixed bottom bar, phones: `<TabBar/>`. */
  tabBar?: ComponentChildren;
  children: ComponentChildren;
  /**
   * How the page sits in the scrolling `<main>`:
   * `flow`  - page grows, `<main>` scrolls (default);
   * `fit`   - page fills the viewport between the bars (min 40rem), for terminals;
   * `own`   - the page owns scrolling (side panes scroll independently), `<main>` clips.
   */
  layout?: 'flow' | 'fit' | 'own';
  /** Extra fixed layers (modal hosts, background renderer) rendered inside the shell. */
  overlays?: ComponentChildren;
}

/**
 * Fixed-shell scroll model: the page itself never scrolls; only `<main>` scrolls between the fixed
 * header and footer. Side borders are fixed vertical lines at the edges of the max-w-6xl column,
 * behind the header/footer rounded chrome (z-rail sits below the header/footer band).
 */
export function Shell({ header, footer, tabBar, children, layout = 'flow', overlays }: ShellProps) {
  return (
    <div className="h-dvh overflow-hidden bg-bg-0 text-fg-0 flex flex-col relative kbd:[--chrome-b:var(--sab)]">
      {header}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed top-0 bottom-0 z-rail w-full max-w-6xl left-1/2 -translate-x-1/2"
      >
        <div className="absolute top-0 bottom-0 left-0 w-px bg-border" />
        <div className="absolute top-0 bottom-0 right-0 w-px bg-border" />
      </div>
      <main
        className={`flex-1 relative z-10 pt-[var(--chrome-t)] w-full overflow-x-hidden scroll-pb-[var(--chrome-b)] ${
          layout === 'own' ? 'overflow-hidden' : 'overflow-y-auto'
        }`}
      >
        <div
          className={`max-w-6xl mx-auto w-full flex flex-col ${
            layout === 'fit'
              ? // h-full of main's content box (pt clears the fixed header) + pb for the fixed
                // footer: exact fit, both heights are the --chrome-* tokens.
                'h-full min-h-[40rem] pb-[var(--chrome-b)] flex flex-col'
              : layout === 'own'
                ? 'h-full flex-1 min-h-0 pb-[var(--chrome-b)]'
                : 'min-h-full pb-[var(--chrome-b)]'
          }`}
        >
          {children}
        </div>
      </main>
      {footer}
      {tabBar}
      <Notifications />
      {overlays}
    </div>
  );
}
