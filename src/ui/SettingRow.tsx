import type { ComponentChildren } from "preact";
import { FormRow } from "./Primitives";

export interface SettingRowProps {
  label: string;
  /** One line saying what changing the setting does. Rendered under the label. */
  description?: string;
  children: ComponentChildren;
}

/** Label left, control right, one line. The label grows from a 10rem basis, so the control only
 *  wraps when label + control cannot share the width; it then sits right-aligned below the text
 *  (`ml-auto`). Same rule for every control kind. */
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
      labelClassName="flex-1 basis-40 text-sm text-fg-2 font-normal"
      valueClassName="ml-auto min-w-0 max-w-full"
    />
  );
}
