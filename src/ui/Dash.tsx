import { NA_GLYPH } from '../lib/cell';

/** The unavailable / not-applicable cell as ONE light span: the glyph with the reason in `title`. No Tooltip, no focus stop. */
export const Dash = ({ title = 'Unavailable', className }: { title?: string; className?: string }) => (
  <span data-state="unavailable" className={className ? `inline-block tabular-nums text-fg-3 ${className}` : 'inline-block tabular-nums text-fg-3'} title={title}>
    {NA_GLYPH}
  </span>
);
