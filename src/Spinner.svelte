<script>
  // One shared busy indicator: a small SVG ring (default 26px), subtle and
  // reduced-motion safe. Used by the shared PanelState overlay and every panel
  // that used to blink a bare dot. Size stays in the 24–32px band.
  let { size = 26, label = '', inline = false } = $props()
</script>

<span class="spinner" class:inline role="status" aria-label={label || 'Loading'}>
  <svg viewBox="0 0 44 44" width={size} height={size} aria-hidden="true">
    <circle class="track" cx="22" cy="22" r="18" />
    <circle class="head" cx="22" cy="22" r="18" />
  </svg>
</span>

<style>
  .spinner { display: inline-grid; place-items: center; flex: none; color: var(--spinner-color, var(--dim)); }
  .spinner.inline { display: inline-grid; vertical-align: text-bottom; }
  .spinner svg { display: block; }
  .track { fill: none; stroke: color-mix(in srgb, currentColor 22%, transparent); stroke-width: 4; }
  .head { fill: none; stroke: var(--spinner-head, var(--accent)); stroke-width: 4; stroke-linecap: round; stroke-dasharray: 78 113; transform-origin: 50% 50%; animation: spinner-turn 0.85s linear infinite; }
  @keyframes spinner-turn { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) {
    .head { animation: none; transform: rotate(-90deg); }
  }
</style>
