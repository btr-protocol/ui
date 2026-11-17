import { SEVERITY_COLOR, SEVERITY_ICON, type Severity } from '../lib/severity';
import { Button } from './Button';
import { Icon, type IconName } from './Icon';
import { cn } from '../lib/cn';
import type { ComponentChildren, JSX } from 'preact';
import { useEffect, useRef } from 'preact/hooks';

export type NoticeTone = 'default' | Severity;
/** `float`: a field message with no box, absolute under its (relative) field, zero flow height. `bar`: the page notice (a bordered card). `note`: a dense hint under a field. `row`: one row of a list (an `li`: the list's edges, padding and
 *  divider, a tinted fill, no card), its action below the text. */
export type NoticeSize = 'bar' | 'note' | 'row' | 'float';

const NEUTRAL: ReadonlySet<NoticeTone> = new Set<NoticeTone>(['default', 'debug', 'info']);

const NOTICE_RANK: Record<NoticeTone, number> = { default: 0, debug: 1, info: 2, success: 3, warning: 4, error: 5 };

/** The one notice a page shows: the highest severity wins, the first of equals; falsy entries are skipped. */
export function pickNotice<T extends { tone?: NoticeTone }>(list: readonly (T | null | false | undefined)[]): T | undefined {
  let best: T | undefined;
  for (const n of list) if (n && (!best || NOTICE_RANK[n.tone ?? 'default'] > NOTICE_RANK[best.tone ?? 'default'])) best = n;
  return best;
}

export interface NoticeActionProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  /** A toggle (e.g. "Acknowledge"): exposed as `aria-pressed`. */
  pressed?: boolean;
  /** Accessible name when the visible label is not enough ("Acknowledge: <alert text>"). */
  ariaLabel?: string;
}

const isActionSpec = (a: unknown): a is NoticeActionProps =>
  typeof a === 'object' && a !== null && !('props' in a) && typeof (a as NoticeActionProps).label === 'string';

/** The notice's own button: tint, border and hover come from the notice tone (`--nt`), not the neutral Button. */
export function NoticeAction({ label, onClick, disabled, pressed, ariaLabel }: NoticeActionProps) {
  return (
    <button type="button" className="notice-action" onClick={onClick} disabled={disabled} aria-pressed={pressed} aria-label={ariaLabel}>
      <span className="truncate">{label}</span>
    </button>
  );
}

/** One line of a merged notice: its own text, its own (tone-matched) action, its own live role and, when it differs from its siblings, its own icon. */
export interface NoticeRow {
  id?: string | number;
  label?: string;
  icon?: IconName;
  /** On the row's text only: toggling the row's action (e.g. Acknowledge) never re-announces it. */
  role?: 'alert' | 'status';
  children?: ComponentChildren;
  action?: NoticeActionProps | ComponentChildren;
}

export interface NoticeProps {
  /** Stable key of this notice when it becomes a row of a merged notice (groupNotices). */
  id?: string | number;
  label?: string;
  /** Several messages of the SAME tone in one notice: one icon, one tint, one row each (text + own action). */
  rows?: readonly NoticeRow[];
  tone?: NoticeTone;
  size?: NoticeSize;
  icon?: IconName | false;
  role?: 'alert' | 'status';
  children?: ComponentChildren;
  /** `{ label, onClick }` renders a tone-matched button; any node is placed as is. */
  action?: NoticeActionProps | ComponentChildren;
  className?: string;
}

export function Notice({ label, tone = 'default', size = 'bar', icon, role, children, action, className, rows }: NoticeProps) {
  const neutral = NEUTRAL.has(tone);
  const color = tone === 'default' ? undefined : SEVERITY_COLOR[tone];
  const float = size === 'float';
  const note = size === 'note' || float;
  const row = size === 'row';
  const Root = (row ? 'li' : 'div') as 'div';
  const body = children != null && children !== false && children !== '';
  const glyph =
    icon === false || (note && icon === undefined)
      ? null
      : (icon ?? (tone === 'default' ? 'info' : SEVERITY_ICON[tone]));
  const tint = neutral ? undefined : color;
  return (
    <Root
      className={cn(
        'flex flex-wrap items-start',
        float
          ? 'pointer-events-none absolute left-1/2 top-full z-raised mt-2 w-max max-w-[min(32rem,calc(100vw-2rem))] -translate-x-1/2 justify-center break-words text-center text-sm leading-snug [text-shadow:0_0_6px_var(--bg-0),0_0_2px_var(--bg-0)]'
          : note
            ? 'mt-1 gap-1.5 px-1 text-2xs leading-snug'
            : row
            ? 'gap-x-3 gap-y-2 border-b border-border bg-bg-2 px-3 py-3 text-sm leading-6 text-fg-1'
            : cn('surface min-h-[calc(var(--ctl-m)+1.5rem)] gap-x-3 gap-y-2 rounded-lg border px-4 py-3 text-sm leading-6', neutral && 'text-fg-2'),
        neutral && (note ? 'text-fg-2' : 'border-border bg-bg-2'),
        className,
      )}
      style={
        note
          ? tint && { color: tint }
          : row
            ? { '--nt': tint ?? 'var(--fg-1)', ...(tint && { backgroundColor: `color-mix(in srgb, ${tint} 8%, var(--bg-2))` }) }
            : {
              '--nt': tint ?? 'var(--fg-1)',
              ...(tint && {
                color: tint,
                borderColor: `color-mix(in srgb, ${tint} 40%, transparent)`,
                backgroundColor: `color-mix(in srgb, ${tint} 8%, transparent)`,
              }),
            }
      }
    >
      {glyph &&
        (note ? (
          <Icon name={glyph} className={cn('mt-0.5 h-3 w-3 shrink-0', neutral && 'text-fg-3')} />
        ) : (
          // One line-height tall (1.5rem): the glyph centres on the first line, so a single-line notice is centred and a wrapped one keeps it on line one.
          <span className="flex h-[var(--ctl-m)] shrink-0 items-center">
            <Icon name={glyph} className={cn('h-5 w-5', neutral && 'text-fg-3')} style={tint ? { color: tint } : undefined} />
          </span>
        ))}
      {rows?.length ? (
        // Each row is one control tall at least: the glyph (also one control tall) centres on the first row, every action lines up right.
        <ul className="notice-rows min-w-0 flex-1">
          {rows.map((r, i) => (
            <li key={r.id ?? i} className="flex min-h-[var(--ctl-m)] flex-wrap items-center gap-x-3 gap-y-1">
              <span role={r.role} className="min-w-0 flex-1 basis-48">
                {r.icon && <Icon name={r.icon} className="mr-1.5 inline h-4 w-4 align-[-0.1875rem]" style={tint ? { color: tint } : undefined} />}
                {r.label && <span className={cn('font-medium', neutral && 'text-fg-1')} style={tint && { color: tint }}>{r.label}</span>}
                {r.label && r.children != null && r.children !== false && r.children !== '' && <span className="mx-2 text-fg-3">·</span>}
                {r.children}
              </span>
              {r.action && <span className="notice-slot ml-auto shrink-0">{isActionSpec(r.action) ? <NoticeAction {...r.action} /> : (r.action as ComponentChildren)}</span>}
            </li>
          ))}
        </ul>
      ) : (
      // the live role sits on the text, not on the notice: a toggled action (Acknowledge) or icon never re-announces it
      <div role={role ?? (tone === 'error' ? 'alert' : undefined)} className={cn('min-w-0 flex-1 basis-64', !note && 'py-[calc((var(--ctl-m)-1.5rem)/2)]')}>
        {label && (
          <span
            className={cn('font-medium', neutral && !note && 'text-fg-1')}
            style={note ? undefined : tint && { color: tint }}
          >
            {label}
          </span>
        )}
        {label && body && <span className="mx-2 text-fg-3">·</span>}
        {body && children}
      </div>
      )}
      {action && (
        <span className={cn('notice-slot', row ? 'w-full min-w-0 pl-8' : 'ml-auto shrink-0 self-center', !note && !row && 'max-sm:pl-8')}>
          {isActionSpec(action) ? <NoticeAction {...action} /> : (action as ComponentChildren)}
        </span>
      )}
    </Root>
  );
}

const liveRole = (n: NoticeProps) => n.role ?? (n.tone === 'error' ? 'alert' : undefined);
const toRows = (n: NoticeProps, icon: boolean): NoticeRow[] =>
  n.rows?.length
    ? [...n.rows]
    : [{ id: n.id, label: n.label, children: n.children, action: n.action, role: liveRole(n), ...(icon && n.icon ? { icon: n.icon } : {}) }];

/** One notice per tone (and size), most severe first (error, warning, success, info...): same-tone notices merge into ONE notice whose rows keep
 *  their own text, action and live role (an `alert` row stays an alert, a `status` row a status), and their own icon when the icons differ (an
 *  acknowledged alert keeps its check). A tone never borrows another's colour. Falsy entries are skipped, a lone notice passes through untouched;
 *  the merged notice keeps the size and the class names of its notices. */
export function groupNotices(list: readonly (NoticeProps | null | false | undefined)[]): NoticeProps[] {
  const by = new Map<string, NoticeProps[]>();
  for (const n of list) if (n) { const k = `${n.tone ?? 'default'}|${n.size ?? 'bar'}`; (by.get(k) ?? by.set(k, []).get(k)!).push(n); }
  return [...by.values()]
    .sort((a, b) => NOTICE_RANK[b[0].tone ?? 'default'] - NOTICE_RANK[a[0].tone ?? 'default'])
    .map((ns) => {
      if (ns.length === 1) return ns[0];
      const same = new Set(ns.map((n) => n.icon)).size === 1;
      const cls = [...new Set(ns.map((n) => n.className).filter(Boolean))].join(' ') || undefined;
      return { id: ns[0].id, tone: ns[0].tone, size: ns[0].size, className: cls, icon: same ? ns[0].icon : undefined, rows: ns.flatMap((n) => toRows(n, !same)) };
    });
}

/** The page's notices: `<NoticeSlot notices={[offline && {...}, stale && {...}]} />` renders one notice per tone, most severe first, same-tone
 *  messages merged as rows (groupNotices). Always the same wrapper, whatever the count. */
export function NoticeSlot({ notices, className }: { notices: readonly (NoticeProps | null | false | undefined)[]; className?: string }) {
  const gs = groupNotices(notices);
  if (!gs.length) return null;
  return <div className={cn('space-y-2', className)}>{gs.map((n, i) => <Notice key={`${n.tone ?? 'default'}|${n.size ?? 'bar'}|${i}`} {...n} />)}</div>;
}

