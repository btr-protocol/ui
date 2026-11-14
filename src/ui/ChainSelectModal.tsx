import type { ComponentChildren } from 'preact';
import { useMemo, useState } from 'preact/hooks';
import { CHAIN_SORT_COLUMNS, type ChainItem, chainSelectItems } from './ChainSelect';
import { Icon } from './Icon';
import { type SelectionItem, SelectionModal } from './Select';
import { Switch } from './Switch';

const ALL_ID = '__all__';

interface ChainSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  chains: readonly ChainItem[];
  /** Selected chain id, or null when the wallet is on a chain this list does not carry (or, with `allLabel`, "all chains"). */
  value: number | null;
  onSelect: (chainId: number) => void;
  /** An "all chains" scope: a row pinned above the list (never a synthetic list row), picked with `onAll`. */
  allLabel?: string;
  onAll?: () => void;
  title?: string;
  /** Row pinned above the list. */
  listHeader?: ComponentChildren;
  size?: 'sm' | 'md';
}

/** THE chain modal: pinned sortable `Network / Chain ID` header, "Testnets" switch (off; shown when
 *  the list has testnets). The current selection is never hidden. */
export function ChainSelectModal({
  isOpen,
  onClose,
  chains,
  value,
  onSelect,
  title = 'Select network',
  listHeader,
  size = 'sm',
  allLabel,
  onAll,
}: ChainSelectModalProps) {
  const [showTestnets, setShowTestnets] = useState(false);
  const hasTestnets = chains.some((c) => c.testnet);
  const items: SelectionItem[] = useMemo(() => {
    const shown = chainSelectItems(chains, { includeTestnets: showTestnets });
    // "All chains" is a real, pinned row: same icon slot, in the arrow-key order, selected like any other.
    const all: SelectionItem[] = allLabel && onAll ? [{ id: ALL_ID, label: allLabel, pinned: true, icon: <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xs bg-bg-3 text-fg-1 ring-1 ring-bg-0"><Icon name="globe" className="h-5 w-5" /></span> }] : [];
    // The wallet's own chain stays listed even when it is a hidden testnet.
    const current =
      value == null || shown.some((item) => Number(item.id) === value)
        ? []
        : chainSelectItems(chains, { includeTestnets: true }).filter((item) => Number(item.id) === value);
    return [...all, ...shown, ...current];
  }, [chains, showTestnets, value, allLabel, onAll]);

  return (
    <SelectionModal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      searchPlaceholder="Search networks…"
      items={items}
      selectedIds={value == null ? (allLabel && onAll ? [ALL_ID] : []) : [String(value)]}
      onSelect={(id) => {
        const raw = Array.isArray(id) ? id[0] : id;
        if (raw === ALL_ID) { onClose(); onAll?.(); return; }
        const chainId = Number(raw);
        onClose();
        if (Number.isFinite(chainId)) onSelect(chainId);
      }}
      sortColumns={CHAIN_SORT_COLUMNS}
      primaryColumnLabel="Network"
      listHeader={listHeader}
      emptyMessage="No networks match"
      hasActiveFilters={showTestnets}
      onResetFilters={() => setShowTestnets(false)}
      headerRight={
        hasTestnets ? (
          <label className="flex items-center gap-1.5 cursor-pointer">
            <span className="text-xs uppercase tracking-wide text-fg-2 max-sm:hidden">Testnets</span>
            <Switch
              checked={showTestnets}
              onCheckedChange={setShowTestnets}
              aria-label="Show testnets"
            />
          </label>
        ) : undefined
      }
      size={size}
    />
  );
}
