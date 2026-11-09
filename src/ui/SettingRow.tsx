import type { ComponentChildren } from 'preact';
import { FormRow } from './Primitives';

export interface SettingRowProps {
  label: string;
  /** One line saying what changing the setting does. Rendered under the label. */
  description?: string;
  children: ComponentChildren;
}

/** Label left, control right. `flex-wrap` is the whole mobile story: a plain switch or select
 *  stays on the label's line at any width, while a control that declares `flex-1` (the slippage
 *  slider + unit + mode cluster) wraps onto its own full-width line instead of overflowing; the value cell may
 *  shrink to that line so the cluster wraps inside it rather than past the modal edge. */
export function SettingRow({ label, description, children }: SettingRowProps) {
  return (
    <FormRow
      label={
        description ? (
          <span className="flex flex-col gap-0.5">
            <span>{label}</span>
            <span className="text-2xs leading-snug text-fg-3">{description}</span>
          </span>
        ) : (
          label
        )
      }
      value={children}
      className="flex-wrap gap-x-4 gap-y-2"
      labelClassName="text-sm text-fg-2 font-normal"
      valueClassName="min-w-0 shrink"
    />
  );
}
