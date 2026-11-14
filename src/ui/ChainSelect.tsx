import type { ComponentChildren } from 'preact';
import { useMemo, useState } from 'preact/hooks';
import { useOpen } from '../lib/modalRoute';
import { chainIcon } from '../lib/chainIcon';
import { cn } from '../lib/cn';
import { Button } from './Button';
import { Icon } from './Icon';
import { type SelectionItem, type SelectionSortColumn, SelectionModal } from './Select';
import { StackedIcons } from './StackedIcons';
import { Switch } from './Switch';

/** A chain a picker offers. `icon` overrides the bundled mark (see `chainIcon`). */
export interface ChainItem {
  id: number;
  name: string;
  icon?: ComponentChildren;
  /** Mark on the trigger button, when it differs from the list row's `icon` (a larger role). */
  triggerIcon?: ComponentChildren;
  explorer?: string;
  testnet?: boolean;
  /** Roadmap entry (no deployment yet): listed after the live chains, disabled and captioned. Default false. */
  planned?: boolean;
}

/** Caption for a chain the protocol has committed to and not deployed. */
export const CHAIN_PLANNED_CAPTION = 'Planned';

/** What a glyph is FOR decides its size: a list row is 32px, a control's icon slot 16px. */
export type GlyphRole = 'row' | 'trigger';
export const glyphSize = (role: GlyphRole): number => (role === 'row' ? 32 : 16);

/** Chain mark: ALWAYS a rounded square (the main app's network rule: a chain is a brand lockup in a rounded square; tokens and
 *  protocols are circles). No shape option: a circle chain mark fails the kit lint. Initials tile when the kit has no mark. */
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
  const cls = cn('shrink-0 align-middle ring-1 ring-bg-0 object-cover rounded-xs', className);
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

/** Several chains as one overlapping row of square marks (+N, tooltip list): the one way to show a chain set. */
export function ChainStack({ chains, max = 3, size = 'sm', list = false, className }: { chains: readonly Pick<ChainItem, 'id' | 'name' | 'icon'>[]; max?: number; size?: 'sm' | 'md'; list?: boolean; className?: string }) {
  return <StackedIcons shape="square" size={size} max={max} list={list} className={className} items={chains.map((c) => ({ id: c.id, label: c.name, icon: c.icon ?? <ChainGlyph chainId={c.id} name={c.name} role="trigger" /> }))} />;
}

/** Chain mark + name, inline: the one way to print a chain in a label, badge or table cell. */
export function ChainLabel({ chainId, name, className }: { chainId: number; name?: string; className?: string }) {
  return (
    <span className={cn('inline-flex min-w-0 items-center gap-1.5', className)}>
      <ChainGlyph chainId={chainId} name={name} role="trigger" />
      <span className="truncate">{name ?? `Chain ${chainId}`}</span>
    </span>
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
 * The chain list as `SelectionItem`s for `SelectionModal`. One row per chain: every mainnet,
 * deployed ones first, then the planned ones (disabled and captioned); testnets only with
 * `includeTestnets`. The pinned `Network / Chain ID` header is the heading: do not prepend rows.
 */
export function chainSelectItems(
  chains: readonly ChainItem[],
  { includeTestnets = false }: { includeTestnets?: boolean } = {},
): SelectionItem[] {
  return chains
    .filter((chain) => !chain.testnet || includeTestnets)
    .sort((a, b) => Number(!!a.planned) - Number(!!b.planned))
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

interface ChainSelectProps {
  chains: readonly ChainItem[];
  /** Selected chain id; null = the `allLabel` scope. */
  value: number | null;
  onChange: (chainId: number) => void;
  allLabel?: string;
  onAll?: () => void;
  title?: string;
  /** Opt-in: the modal gets a history entry (`?modal=<routeKey>`): Back closes, Forward reopens, deep link opens. */
  routeKey?: string;
}

/** The standard chain trigger: a button over `ChainSelectModal`. Reports ids only. */
export function ChainSelect({ chains, value, onChange, title, routeKey, allLabel, onAll }: ChainSelectProps) {
  const [open, setOpen] = useOpen(routeKey);
  const current = value == null ? undefined : chains.find((c) => c.id === value);
  return (
    <>
      <Button
        type="button"
        size="sm"
        onClick={() => setOpen(true)}
        leftIcon={
          current ? (
            (current.triggerIcon ?? current.icon ?? <ChainGlyph chainId={current.id} name={current.name} role="trigger" />)
          ) : undefined
        }
        rightIcon={<Icon name="caret-down" className="w-3.5 h-3.5 text-fg-3 shrink-0" />}
      >
        <span className="truncate max-w-40">{current?.name ?? (value == null ? (allLabel ?? '') : `Chain ${value}`)}</span>
      </Button>
      <ChainSelectModal
        isOpen={open}
        onClose={() => setOpen(false)}
        chains={chains}
        value={value}
        onSelect={(c) => setOpen(false, () => onChange(c))}
        title={title}
        allLabel={allLabel}
        onAll={onAll && (() => setOpen(false, onAll))}
      />
    </>
  );
}
