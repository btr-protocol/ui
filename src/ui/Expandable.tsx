import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import { Icon } from './Icon';
import { FormRow } from './Primitives';

export interface ExpandableProps {
  header: ComponentChildren;
  children: ComponentChildren;
  defaultExpanded?: boolean;
  /** Controlled (with `onToggle`): a parent that owns several sections keeps the state. */
  open?: boolean;
  onToggle?: () => void;
  className?: string;
  icon?: ComponentChildren;
  /** Inline summary row: no side padding, a control-height header instead of a section header. */
  dense?: boolean;
  /** Side gutter. `panel` = a Panel's `px-3`, so header and body align with the Panel title. Default `px-4`. */
  gutter?: 'default' | 'panel';
}

export function Expandable({
  header,
  children,
  defaultExpanded = false,
  open,
  onToggle,
  className = '',
  icon,
  dense = false,
  gutter = 'default',
}: ExpandableProps) {
  const [own, setOwn] = useState(defaultExpanded);
  const isExpanded = open ?? own;
  const px = gutter === 'panel' ? 'px-3' : 'px-4';
  const toggle = onToggle ?? (() => setOwn(!own));

  return (
    <div className={`w-full border-b border-border last:border-b-0 ${className}`}>
      <button
        onClick={toggle}
        aria-expanded={isExpanded}
        className={`w-full cursor-pointer transition-colors hover:bg-bg-2 ${
          dense ? 'px-1 py-1 coarse:min-h-[var(--ctl-m)]' : `${px} py-3`
        } ${isExpanded ? 'text-fg-0' : 'text-fg-2'}`}
      >
        <FormRow
          label={
            <div className="flex min-w-0 items-center gap-2">
              {icon && <span className="shrink-0">{icon}</span>}
              <h4
                className={`min-w-0 truncate text-sm ${isExpanded ? 'font-semibold' : 'font-medium'}`}
              >
                {header}
              </h4>
            </div>
          }
          value={
            <Icon
              name="caret-down"
              className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            />
          }
        />
      </button>
      {isExpanded && <div className={dense ? 'pt-1' : `${px} pt-3 pb-4`}>{children}</div>}
    </div>
  );
}
