import { type Address, type Hex, shortAddr } from '../lib/address';
import { CopyAddressButton } from './AddrActions';
import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { BaseModal, MODAL_PADDING } from './BaseModal';
import { Button } from './Button';
import { ButtonGroup } from './ButtonGroup';
import { HoldButton } from './HoldButton';
import { Icon } from './Icon';

/** The encoded write behind a confirm: what the sheet shows, copies and simulates. */
export interface SheetCall {
  to: Address;
  data: Hex;
  fn: string;
}

type Sim = { s: 'checking' } | { s: 'ok' } | { s: 'revert'; reason: string } | { s: 'unavailable' };

/** Hold on the primary when the write could not be simulated: unknown does not block, but it is
 *  never a one-tap send either. */
export const UNSIMULATED_HOLD_MS = 1500;

/** The primary's hold: the caller's, raised to `UNSIMULATED_HOLD_MS` when a call went unsimulated. */
export const confirmHold = (hold: number, sim: Sim['s'], hasCall: boolean): number =>
  hasCall && sim === 'unavailable' ? Math.max(hold, UNSIMULATED_HOLD_MS) : hold;

/** A revert blocks; an RPC that would not answer does not (unknown is not "reverts"), but it
 *  costs a hold (`confirmHold`). */
export const simVerdict = (e: unknown): Sim =>
  e instanceof SimulationReverted ? { s: 'revert', reason: e.message } : { s: 'unavailable' };

/** Reject `simulate` with this when the call would revert; any other rejection reads as "unavailable". */
export class SimulationReverted extends Error {}

const Row = ({ label, children }: { label: string; children: ComponentChildren }) => (
  <div className="grid grid-cols-[4.25rem_minmax(0,1fr)] gap-x-3 text-sm">
    <span className="pt-0.5 text-xs text-fg-3">{label}</span>
    <div className="min-w-0 break-words text-fg-1">{children}</div>
  </div>
);

/**
 * THE confirm step for any write that costs something: a bottom sheet on phones, a modal above.
 * Says WHERE (chain), WHAT (target, call + selector), whether it can be undone, whether it would
 * revert right now (simulated on open), and WHO signs. The primary stays off on a wrong chain or
 * a simulated revert, and takes a hold for the actions that cannot be walked back or that could
 * not be simulated.
 */
export function ConfirmSheet({
  open,
  title,
  onClose,
  onConfirm,
  confirmLabel,
  tone = 'primary',
  hold = 0,
  chainId,
  target,
  call,
  simNote,
  undo,
  quorum,
  signer,
  walletChainId,
  chainName = (id) => (id ? `chain ${id}` : 'no network'),
  simulate,
  safe = false,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  onConfirm: () => void;
  confirmLabel: string;
  tone?: 'danger' | 'primary';
  /** Hold time (ms) on the primary; 0 = tap. */
  hold?: number;
  /** The chain the write lands on; a wallet elsewhere disables the primary. */
  chainId?: number;
  target?: ComponentChildren;
  call?: SheetCall | null;
  /** Caveat printed under the simulation verdict. */
  simNote?: string;
  undo?: string;
  /** Threshold and owner count when the signer is a Safe (read by the caller, useSafeQuorum). */
  quorum?: { need?: bigint; owners?: number };
  /** Address that will sign; omit to hide the Signer row. */
  signer?: string;
  /** The wallet's current chain; a mismatch with `chainId` disables the primary. */
  walletChainId?: number;
  /** Chain label for the Chain row. */
  chainName?: (id?: number) => string;
  /** Dry-run of `call`: resolve when it would not revert, reject with `SimulationReverted` when it would. */
  simulate?: (call: { to: Address; data: Hex }) => Promise<unknown>;
  /** The signer is a Safe: sending queues the call for the owners. */
  safe?: boolean;
  children?: ComponentChildren;
}) {
  const address = signer;
  const walletChain = walletChainId;
  const mismatch = chainId != null && walletChain !== chainId;
  const [sim, setSim] = useState<Sim>({ s: 'checking' });

  useEffect(() => {
    // Reset first: a reopened sheet must not flash the last verdict over a fresh call.
    setSim({ s: 'checking' });
    if (!open || !call || mismatch) return;
    if (!simulate) return void setSim({ s: 'unavailable' });
    let live = true;
    // A slow RPC must not hold the primary off forever: past 8 s the verdict is "unavailable".
    Promise.race([
      simulate({ to: call.to, data: call.data }),
      new Promise<never>((_, no) => setTimeout(() => no(new Error('timeout')), 8000)),
    ]).then(
      () => live && setSim({ s: 'ok' }),
      (e) => live && setSim(simVerdict(e)),
    );
    return () => {
      live = false;
    };
  }, [open, call?.to, call?.data, mismatch, simulate]);

  const blocked = mismatch || (!!call && (sim.s === 'revert' || sim.s === 'checking'));
  return (
    <BaseModal
      isOpen={open}
      onClose={(o) => !o && onClose()}
      headerType="title"
      title={title}
      headerIcon={<Icon name="warning" className="h-4 w-4 text-warning" />}
      size="md"
      footerControls={
        <ButtonGroup aria-label="Actions" className="flex w-full [&>*]:flex-1">
          <Button onClick={onClose}>Cancel</Button>
          <HoldButton
            variant="primary"
            tone={tone === 'danger' ? 'danger' : undefined}
            hold={confirmHold(hold, sim.s, !!call)}
            disabled={blocked}
            onConfirm={onConfirm}
          >
            {confirmLabel}
          </HoldButton>
        </ButtonGroup>
      }
    >
      <div className={`space-y-2.5 ${MODAL_PADDING} py-3`}>
        {chainId != null && (
          <Row label="Chain">
            <span className={mismatch ? 'text-red' : undefined}>
              {chainName(chainId)} <span className="font-mono text-fg-3">{chainId}</span>
            </span>
            {mismatch && (
              <div className="text-xs text-red">
                Wallet is on {chainName(walletChain)}. Switch it to {chainName(chainId)} first.
              </div>
            )}
          </Row>
        )}
        {target && <Row label="Target">{target}</Row>}
        {call && (
          <Row label="Call">
            <span className="inline-flex flex-wrap items-center gap-x-1.5 font-mono text-xs">
              {call.fn}
              <span className="text-fg-3">{call.data.slice(0, 10)}</span>
              <CopyAddressButton value={call.data} copiedMessage="Copied calldata" />
            </span>
          </Row>
        )}
        {undo && <Row label="Undo">{undo}</Row>}
        {call && !mismatch && (
          <Row label="Check">
            <span role="status" aria-live="polite">
              {sim.s === 'checking' && <span className="text-fg-3">Simulating…</span>}
              {sim.s === 'ok' && <span className="text-success">✓ Would not revert</span>}
              {sim.s === 'revert' && <span className="text-red">✗ Reverts: {sim.reason}</span>}
              {sim.s === 'unavailable' && (
                <span className="text-warning">
                  Could not simulate. The chain will decide: hold to send unchecked.
                </span>
              )}
            </span>
            {simNote && <div className="text-xs text-fg-3">{simNote}</div>}
          </Row>
        )}
        {address && (
          <Row label="Signer">
            <span className="font-mono text-xs">{shortAddr(address)}</span>
            {safe && (
              <span className="text-xs text-fg-3">
                {' '}
                · Safe
                {quorum?.need !== undefined
                  ? `, needs ${quorum.need} of ${quorum.owners ?? '?'}`
                  : ''}
                . Sending queues it for the owners.
              </span>
            )}
          </Row>
        )}
        {children}
      </div>
    </BaseModal>
  );
}
