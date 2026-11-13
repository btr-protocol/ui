// BTR Tailwind preset (the btr.markets theme). No content globs: consumers add the kit sources to their own
// `content`, e.g. './node_modules/@btr-protocol/ui/src/**/*.{ts,tsx}'.
/** @type {import('tailwindcss').Config} */
export default {
  // `hover:` compiles under (hover: hover): a tap never leaves a sticky hover state.
  future: { hoverOnlyWhenSupported: true },
  theme: {
    extend: {
      borderRadius: {
        xs: 'var(--radius-xs)' /* 5px - checkboxes, panel items */,
        sm: 'var(--radius-sm)' /* 8px - buttons, inputs, badges */,
        md: 'var(--radius-md)' /* 12px - cards, forms */,
        lg: 'var(--radius-lg)' /* 16px - modals, containers */,
        DEFAULT: 'var(--radius-md)',
      },
      fontSize: {
        // Micro labels: 11px on desktop, 12px floor on touch (--fs-2xs in tokens.css). Scale: lib/design.ts TYPE_SIZES.
        '2xs': 'var(--fs-2xs)',
      },
      zIndex: {
        base: 'var(--z-index-base)',
        raised: 'var(--z-index-raised)',
        overlay: 'var(--z-index-overlay)',
        label: 'var(--z-index-label)',
        sticky: 'var(--z-index-sticky)',
        rail: 'var(--z-index-rail)',
        header: 'var(--z-index-header)',
        footer: 'var(--z-index-footer)',
        fullscreen: 'var(--z-index-fullscreen)',
        modal: 'var(--z-index-modal)',
        dropdown: 'var(--z-index-dropdown)',
        tooltip: 'var(--z-index-tooltip)',
        toast: 'var(--z-index-toast)',
      },
      transitionDuration: { DEFAULT: 'var(--dur-2)' },
      transitionTimingFunction: { DEFAULT: 'var(--ease)' },
      borderWidth: {
        DEFAULT: 'var(--border-width)',
      },
      fontFamily: {
        title: 'var(--font-title)',
        mono: 'var(--font-mono)',
      },
      borderColor: {
        DEFAULT: 'var(--border-color)',
        primary: 'var(--border-color-primary)',
      },
      // `ring-primary` is a focus/selection indicator too, so it takes the same 1.4.11 treatment
      // as `ring-ring` below: the raw swatch is 2.18:1 on the light page.
      ringColor: {
        DEFAULT: 'var(--fg-primary)',
        primary: 'var(--fg-primary)',
      },
      // Coloured TEXT resolves to the --fg-* sentiment tokens, coloured FILL keeps the raw swatch.
      // Dark aliases --fg-* straight back to the swatch, so this is a no-op there; light darkens
      // them to clear 4.5:1. Mapping it here rather than renaming ~110 `text-primary`/`text-green`
      // call sites keeps one behaviour change in one place.
      textColor: {
        primary: 'var(--fg-primary)',
        secondary: 'var(--fg-secondary)',
        green: 'var(--fg-success)',
        red: 'var(--fg-error)',
        success: 'var(--fg-success)',
        error: 'var(--fg-error)',
        warning: 'var(--fg-warning)',
        // `fg-3` is the BORDER rung of the ramp, not a text rung: 2.82:1 (dark) / 2.85:1 (light)
        // on bg-0, under even the 3:1 large-text floor, so it cannot be text at any size. The
        // ~124 `text-fg-3` call sites resolve to the muted TEXT rung instead; `bg-fg-3`,
        // `border-fg-3` and the scrollbar thumb still read the real --fg-3 from `colors` below.
        'fg-3': 'var(--fg-3-text)',
        // Fell through to the raw --red swatch: 3.83:1 on the light page, 3.24:1 on dark bg-2.
        destructive: 'var(--fg-error)',
      },
      colors: {
        primary: 'var(--primary)',
        secondary: 'var(--secondary)',
        // OEV arbitrage band blue - the ONE blue shared by the chart drawables and book rows.
        oev: 'var(--oev)',
        black: 'var(--black)',
        white: 'var(--white)',
        green: 'var(--green)',
        red: 'var(--red)',
        destructive: 'var(--red)',
        'red-solid': 'var(--red-solid)',
        line: 'var(--line-ui)', // control boundary, 3:1
        border: 'var(--border-color)',
        // The focus indicator, not a fill: raw --primary is 2.18:1 on the light page, under the
        // 3:1 that WCAG 1.4.11 asks of a non-text indicator. --fg-primary aliases --primary in
        // dark (no-op there) and darkens to 5.52:1 in light.
        ring: 'var(--fg-primary)',
        background: 'var(--bg-0)',
        card: 'var(--bg-1)',

        'bg-0': 'var(--bg-0)',
        'bg-1': 'var(--bg-1)',
        'bg-2': 'var(--bg-2)',
        'bg-3': 'var(--bg-3)',
        'bg-4': 'var(--bg-4)',
        'bg-primary': 'var(--bg-primary)',
        'bg-secondary': 'var(--bg-secondary)',
        'bg-negative': 'var(--bg-negative)',
        'bg-green': 'var(--bg-green)',
        'bg-red': 'var(--bg-red)',

        // Translucent surfaces. The bg-* ramp has no alpha channel, so `bg-bg-0/95` compiles to
        // nothing; these are the two cases that genuinely need see-through. See tokens.css.
        glass: 'var(--glass)',
        scrim: 'var(--scrim)',

        'fg-0': 'var(--fg-0)',
        'fg-1': 'var(--fg-1)',
        'fg-2': 'var(--fg-2)',
        'fg-3': 'var(--fg-3)',
      },
    },
  },
  plugins: [
    // `kbd:` = a text field holds focus on a touch device, i.e. the soft keyboard is up and every
    // fixed bar competes with the field for the few rows left (drop the footer, keep the header).
    function ({ addVariant }) {
      addVariant(
        'kbd',
        '@media (pointer: coarse) { :root:has(input:not([type=checkbox],[type=radio],[type=range],[type=button],[type=submit]):focus, textarea:focus) & }',
      );
    },
    function ({ addUtilities, addVariant }) {
      addVariant('coarse', '@media (pointer: coarse)');
      // Touch scale gate (matches tokens.css): coarse pointer OR a window narrower than lg.
      addVariant('touch', '@media (pointer: coarse), (max-width: 1023.98px)');
      const customUtilities = {
        // Horizontal scroll region (toolbars, wide rows): keeps content reachable
        // on narrow viewports without a scrollbar eating the row's height.
        '.scroll-x': {
          'overflow-x': 'auto',
          'overflow-y': 'hidden',
          'scrollbar-width': 'none',
        },
        '.scroll-x::-webkit-scrollbar': {
          display: 'none',
        },

        // Toolbar items
        '.toolbar-btn': {
          height: '2rem',
          'padding-left': '0.5rem',
          'padding-right': '0.5rem',
          display: 'flex',
          'align-items': 'center',
          cursor: 'pointer',
          color: 'var(--fg-2)',
          'font-weight': '500',
          'transition-property': 'color, background-color',
          'transition-duration': 'var(--dur-2)',
        },
        '@media (hover: hover)': {
          '.toolbar-btn:hover': { color: 'var(--fg-1)', 'background-color': 'var(--bg-2)' },
          '.toolbar-item:hover': { 'background-color': 'var(--bg-2)' },
        },
        // A finger needs the 44px (--ctl-m) target; the glyphs keep their desktop size.
        '@media (pointer: coarse)': {
          // `.tap-min` is the opt-in floor for any control smaller than --ctl-m on touch (glyphs keep size).
          '.toolbar-btn, .toolbar-item, .tap-min': {
            'min-height': 'var(--ctl-m)',
            'min-width': 'var(--ctl-m)',
            'justify-content': 'center',
          },
        },
        '.toolbar-btn-active': {
          'background-color': 'var(--bg-primary)',
          color: 'var(--fg-primary)',
        },
        '.toolbar-item': {
          height: '2rem',
          'padding-left': '0.5rem',
          'padding-right': '0.5rem',
          display: 'flex',
          'align-items': 'center',
          gap: '0.375rem',
          'font-size': '0.75rem',
          'font-weight': '500',
          color: 'var(--fg-1)',
          'border-right': '1px solid var(--border-color)',
          'transition-property': 'background-color',
          'transition-duration': 'var(--dur-2)',
        },

        // Floating panels (tooltips, popovers, dropdowns)
        '.floating-panel': {
          position: 'fixed',
          'z-index': 'var(--z-index-tooltip)',
          'padding-left': '0.75rem',
          'padding-right': '0.75rem',
          'padding-top': '0.5rem',
          'padding-bottom': '0.5rem',
          'font-size': '0.75rem',
          'font-family': 'var(--font-title)',
          'font-weight': '500',
          color: 'var(--fg-1)',
          'background-color': 'var(--bg-1)',
          border: '1px solid var(--border-color)',
          'border-radius': 'var(--radius-sm)',
          'box-shadow': '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
        },

        // Typography
        '.font-numeric': {
          'font-family': 'var(--font-numbers)',
          'font-variant-numeric': 'tabular-nums',
        },

        // NB: btn-group styles are in index.css (need nested selectors)
      };
      addUtilities(customUtilities);
    },
  ],
};
