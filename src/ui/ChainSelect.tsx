import type { ComponentChildren } from 'preact';
import { useMemo, useState } from 'preact/hooks';
import { chainIcon } from '../lib/chainIcon';
import { cn } from '../lib/cn';
import { Button } from './Button';
import { Icon } from './Icon';
import { type SelectionItem, type SelectionSortColumn, SelectionModal } from './Select';
import { Switch } from './Switch';

/** A chain a picker offers. `icon` overrides the bundled mark (see `chainIcon`). */
export interface ChainItem {
  id: number;
  name: string;
  icon?: ComponentChildren;
  explorer?: string;
  testnet?: boolean;
  /** Roadmap entry: hidden unless "Planned" is on, then disabled and captioned. Default false. */
  planned?: boolean;
}

/** Caption for a chain the protocol has committed to and not deployed. */
export const CHAIN_PLANNED_CAPTION = 'Planned';

/** What a glyph is FOR decides its size: a list row is 32px, a control's icon slot 16px. */
export type GlyphRole = 'row' | 'trigger';
export const glyphSize = (role: GlyphRole): number => (role === 'row' ? 32 : 16);

/** Chain mark: rounded square (the token shape is a circle), initials tile when the kit has no
 *  mark for the chain. */
export function ChainGlyph({
  chainId,
  name,
  role = 'row',
  className,
}: {
  chainId: number;
  name?: string;
  role?: GlyphRole;
  className?: string;
}) {
  const src = chainIcon(chainId);
  const dim = `${glyphSize(role) / 16}rem`;
  const cls = cn('shrink-0 align-middle ring-1 ring-bg-0 rounded-xs', className);
  if (src) {
    return <img src={src} alt="" aria-hidden="true" style={{ width: dim, height: dim }} className={cls} />;
  }
  return (
    <div
      aria-hidden="true"
      style={{ width: dim, height: dim }}
      className={cn(cls, 'bg-bg-3 text-fg-1 flex items-center justify-center font-title font-semibold')}
    >
      <span style={{ fontSize: `${glyphSize(role) * 0.025}rem` }}>{(name ?? String(chainId)).slice(0, 3)}</span>
    </div>
  );
}

/** Right-aligned numeric column of the chain picker, sized to the `SelectionModal` sort header
 *  so the cells sit under `Chain ID` rather than beside it. */
function ChainIdBadge({ chainId }: { chainId: number }) {
  return (
    <span className="w-[4.75rem] shrink-0 text-right text-xs text-fg-3 font-numeric tabular-nums">
      {chainId}
    </span>
  );
}

/** Sortable columns of every chain picker (`asset` is prepended by `SelectionModal`). */
export const CHAIN_SORT_COLUMNS: SelectionSortColumn[] = [{ key: 'chainId', label: 'Chain ID' }];

/**
 * The chain list as `SelectionItem`s for `SelectionModal`. One row per chain; planned entries only
 * with `includePlanned`, disabled and captioned. The pinned `Network / Chain ID` header is the
 * heading: do not prepend rows.
 */
export function chainSelectItems(
  chains: readonly ChainItem[],
  { includePlanned = false }: { includePlanned?: boolean } = {},
): SelectionItem[] {
  return chains
    .filter((chain) => !chain.planned || includePlanned)
    .map((chain) => ({
      id: String(chain.id),
      label: chain.name,
      icon: chain.icon ?? <ChainGlyph chainId={chain.id} name={chain.name} />,
      disabled: !!chain.planned,
      caption: chain.planned ? CHAIN_PLANNED_CAPTION : undefined,
      data: { chainId: chain.id, testnet: !!chain.testnet },
      badge: <ChainIdBadge chainId={chain.id} />,
    }));
}

interface ChainSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  chains: readonly ChainItem[];
  /** Selected chain id, or null when the wallet is on a chain this list does not carry. */
  value: number | null;
  onSelect: (chainId: number) => void;
  title?: string;
  /** Row pinned above the list. */
  listHeader?: ComponentChildren;
  size?: 'sm' | 'md';
}

/** THE chain modal: pinned sortable `Network / Chain ID` header, "Planned" switch (shown when the
 *  list has planned chains). The current selection is never hidden. */
export function ChainSelectModal({
  isOpen,
  onClose,
  chains,
  value,
  onSelect,
  title = 'Select network',
  listHeader,
  size = 'sm',
}: ChainSelectModalProps) {
  const [showPlanned, setShowPlanned] = useState(false);
  const hasPlanned = chains.some((c) => c.planned);
  const items: SelectionItem[] = useMemo(() => {
    const shown = chainSelectItems(chains, { includePlanned: showPlanned });
    if (showPlanned || value == null || shown.some((item) => Number(item.id) === value)) {
      return shown;
    }
    return chainSelectItems(chains, { includePlanned: true }).filter(
      (item) => Number(item.id) === value || !item.disabled,
    );
  }, [chains, showPlanned, value]);

  return (
    <SelectionModal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      searchPlaceholder="Search networks…"
      items={items}
      selectedIds={value == null ? [] : [String(value)]}
      onSelect={(id) => {
        const chainId = Number(Array.isArray(id) ? id[0] : id);
        onClose();
        if (Number.isFinite(chainId)) onSelect(chainId);
      }}
      sortColumns={CHAIN_SORT_COLUMNS}
      primaryColumnLabel="Network"
      listHeader={listHeader}
      emptyMessage="No networks match"
      hasActiveFilters={showPlanned}
      onResetFilters={() => setShowPlanned(false)}
      headerRight={
        hasPlanned ? (
          <label className="flex items-center gap-1.5 cursor-pointer">
            <span className="text-xs uppercase tracking-wide text-fg-2 max-sm:hidden">Planned</span>
            <Switch
              checked={showPlanned}
              onCheckedChange={setShowPlanned}
              aria-label="Show planned networks"
            />
          </label>
        ) : undefined
      }
      size={size}
    />
  );
}

interface ChainSelectProps {
  chains: readonly ChainItem[];
  /** Selected chain id. */
  value: number;
  onChange: (chainId: number) => void;
  title?: string;
}

/** The standard chain trigger: a button over `ChainSelectModal`. Reports ids only. */
export function ChainSelect({ chains, value, onChange, title }: ChainSelectProps) {
  const [open, setOpen] = useState(false);
  const current = chains.find((c) => c.id === value);
  return (
    <>
      <Button
        type="button"
        size="sm"
        onClick={() => setOpen(true)}
        leftIcon={
          current ? (
            (current.icon ?? <ChainGlyph chainId={current.id} name={current.name} role="trigger" />)
          ) : undefined
        }
        rightIcon={<Icon name="caret-down" className="w-3.5 h-3.5 text-fg-3 shrink-0" />}
      >
        <span className="truncate max-w-40">{current?.name ?? `Chain ${value}`}</span>
      </Button>
      <ChainSelectModal
        isOpen={open}
        onClose={() => setOpen(false)}
        chains={chains}
        value={value}
        onSelect={onChange}
        title={title}
      />
    </>
  );
}
