import { useMemo } from 'preact/hooks';
import { cn } from '../lib/cn';
import { useOpen } from '../lib/modalRoute';
import { SWATCH_NAMES, swatchColor } from '../lib/swatch';
import { Button } from './Button';
import { SelectionModal } from './Select';

export const Swatch = ({ index, className }: { index: number; className?: string }) => (
  <span aria-hidden="true" className={cn('inline-block h-3 w-3 shrink-0 rounded-full', className)} style={{ background: swatchColor(index) }} />
);

/** Colour picker: a swatch button that opens the kit's modal select (one swatch row each). `value` is the swatch index in use
 *  (the default included); `onChange(null)` = back to the default. Routed like every modal select. */
export function SwatchSelect({ value, isDefault, onChange, label, routeKey, defaultLabel = 'Default', names = SWATCH_NAMES, className }: {
  value: number;
  /** The value is the default (no override): the "Default" row is the selected one. */
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
      { id: 'default', label: defaultLabel, icon: <Swatch index={value} className="h-4 w-4" /> },
      ...names.map((n, i) => ({ id: String(i), label: n, icon: <Swatch index={i} className="h-4 w-4" /> })),
    ],
    [names, defaultLabel, value],
  );
  return (
    <>
      <Button type="button" variant="ghost" size="xs" className={className} aria-label={label} title={label} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>
        <Swatch index={value} className="h-3.5 w-3.5" />
      </Button>
      <SelectionModal
        isOpen={open}
        onClose={() => setOpen(false)}
        title={label}
        items={items}
        selectedIds={[isDefault ? 'default' : String(value)]}
        onSelect={(ids) => {
          setOpen(false);
          const v = Array.isArray(ids) ? ids[0] : ids;
          if (v === undefined) return;
          onChange(v === 'default' ? null : Number(v));
        }}
        size="sm"
      />
    </>
  );
}
