/** The pane that actually scrolls: the innermost <main> that overflows (docs/blog nest their own scroller
 *  inside the shell's <main>), never the window. */
export function scrollPane(top = 0, behavior: ScrollBehavior = 'smooth'): void {
  [...document.querySelectorAll('main')]
    .reverse()
    .find((m) => m.scrollHeight > m.clientHeight)
    ?.scrollTo({ top, behavior });
}
