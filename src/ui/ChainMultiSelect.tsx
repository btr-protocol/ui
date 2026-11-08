import { useMemo, useState } from 'preact/hooks';
import { Button } from './Button';
import { type ChainItem, ChainGlyph, chainSelectItems, CHAIN_SORT_COLUMNS } from './ChainSelect';
import { Icon } from './Icon';
import { SelectionModal } from './Select';
import { StackedIcons } from './StackedIcons';

export interface ChainMultiSelectProps {
  chains: readonly ChainItem[];
  /** Selected chain ids. */
  value: readonly number[];
  onChange: (chainIds: number[]) => void;
  /** Trigger caption. Default "Chains". */
  label?: string;
  /** Caption when every chain is selected. Default "All". */
  allLabel?: string;
  title?: string;
  /** Icons on the trigger before "+N". Default 3. */
  maxVisible?: number;
}

/** Multi-select chain filter: trigger shows the picked chains as StackedIcons, the modal is the
 *  chain picker (search, sort, Select All / Unselect All) in multi mode. At least one stays selected. */
export function ChainMultiSelect({
  chains,
  value,
  onChange,
  label = 'Chains',
  allLabel = 'All',
  title = 'Select networks',
  maxVisible = 3,
}: ChainMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const items = useMemo(() => chainSelectItems(chains), [chains]);
  const picked = chains.filter((c) => value.includes(c.id));
  const all = items.length > 0 && picked.length >= items.length;
  return (
    <>
      <Button
        type="button"
        size="sm"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        rightIcon={<Icon name="caret-down" className="h-3.5 w-3.5 shrink-0 text-fg-3" />}
      >
        <span>{label}</span>
        {all ? (
          <span className="text-fg-2">{allLabel}</span>
        ) : (
          <StackedIcons
            size="sm"
            max={maxVisible}
            items={picked.map((c) => ({
              id: c.id,
              label: c.name,
              icon: c.icon ?? <ChainGlyph chainId={c.id} name={c.name} role="trigger" />,
            }))}
          />
        )}
      </Button>
      <SelectionModal
        isOpen={open}
        onClose={() => setOpen(false)}
        title={title}
        searchPlaceholder="Search networks…"
        items={items}
        selectedIds={value.map(String)}
        onSelect={(ids) => {
          setOpen(false);
          onChange((Array.isArray(ids) ? ids : [ids]).map(Number).filter(Number.isFinite));
        }}
        multiSelect
        sortColumns={CHAIN_SORT_COLUMNS}
        primaryColumnLabel="Network"
        emptyMessage="No networks match"
        size="sm"
      />
    </>
  );
}
