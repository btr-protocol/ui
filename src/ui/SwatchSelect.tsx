import { useMemo } from 'preact/hooks';
import { cn } from '../lib/cn';
import { useOpen } from '../lib/modalRoute';
import { SWATCH_NAMES, swatchColor } from '../lib/swatch';
import { Button } from './Button';
import { Icon } from './Icon';
import { SelectionModal } from './Select';

export const Swatch = ({ index, className }: { index: number; className?: string }) => (
  <span aria-hidden="true" className={cn('inline-block h-3 w-3 shrink-0 rounded-full', className)} style={{ background: swatchColor(index) }} />
);

/** Colour picker: a palette button (same size as a rename pencil, 44px target on touch) opening the kit modal select, one swatch row each.
 *  `value` is the swatch in use; `defaultIndex` the one used without an override ("Default (Blue)" is its own row, selected while no override is set).
 *  `onChange(null)` = back to the default. Routed like every modal select. */
export function SwatchSelect({ value, defaultIndex, isDefault, onChange, label, routeKey, defaultLabel = 'Default', names = SWATCH_NAMES, className }: {
  value: number;
  defaultIndex: number;
  /** No override is set: the Default row is the selected one. */
  isDefault: boolean;
  onChange: (index: number | null) => void;
  /** Accessible name and modal title ("Colour"). */
  label: string;
  routeKey: string;
  defaultLabel?: string;
  names?: readonly string[];
  className?: string;
}) {
  const [open, setOpen] = useOpen(routeKey);
  const items = useMemo(
    () => [
      { id: 'default', label: `${defaultLabel} (${names[defaultIndex] ?? ''})`, icon: <Swatch index={defaultIndex} className="h-4 w-4" /> },
      ...names.map((n, i) => ({ id: String(i), label: n, icon: <Swatch index={i} className="h-4 w-4" /> })),
    ],
    [names, defaultLabel, defaultIndex],
  );
  return (
    <>
      <Button type="button" variant="ghost" size="xs" className={cn('tap-min shrink-0', className)} aria-label={label} title={label} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)} leftIcon={<Icon name="palette" className="h-3 w-3" />} />
      <SelectionModal
        isOpen={open}
        onClose={() => setOpen(false)}
        title={label}
        searchable={false}
        items={items}
        selectedIds={[isDefault ? 'default' : String(value)]}
        onSelect={(ids) => {
          const v = Array.isArray(ids) ? ids[0] : ids;
          if (v === undefined) return;
          onChange(v === 'default' ? null : Number(v));
        }}
        size="sm"
      />
    </>
  );
}
