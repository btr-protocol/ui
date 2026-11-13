/** The ONE z-index scale. Mirrors `--z-index-*` in styles/tokens.css and `zIndex` in the Tailwind preset (test/zIndex.test.ts keeps all three equal). Use the Tailwind class (`z-raised`) or `Z.raised`; never a literal. */
export const Z = {
  /** Behind siblings in the same stacking context (watermarks, backdrops). */
  base: 0,
  /** One step above siblings: badges on buttons, sticky table heads, slider thumbs. */
  raised: 1,
  /** State overlays inside a panel (chart loading / empty). */
  overlay: 5,
  /** Labels and legends floating over a plot. */
  label: 8,
  /** Sticky in-content bars (toolbar, action bar) and the scroll container. */
  sticky: 10,
  rail: 30,
  header: 40,
  footer: 41,
  /** Full-screen panel (chart): above chrome, below modals. */
  fullscreen: 90,
  modal: 100,
  dropdown: 110,
  tooltip: 120,
  toast: 130,
} as const;

export type ZLayer = keyof typeof Z;
export const Z_LAYERS = Object.keys(Z) as ZLayer[];
