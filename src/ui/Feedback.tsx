import { SEVERITY_COLOR, SEVERITY_ICON, type Severity } from '../lib/severity';
import { Button } from './Button';
import { Tooltip } from './FloatingPanel';
import { Icon, type IconName } from './Icon';
import { LINK } from './InfoBox';
import { Skeleton } from './Loaders';
import { Spinner } from './Spinner';
import { PAGE_DESC } from './classes';
import type { MetricPhase } from '../lib/metricPhase';
import { navigateTo, openExternal } from '../lib/nav';
import { cn } from '../lib/cn';
import type { ComponentChildren, JSX } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { isInternalHref, isSafeExternalHref, isSamePageHref } from '../lib/safeHref';
import { safeHref } from '../lib/safeHref';

export type PageStateKind = 'loading' | 'error' | 'empty' | 'notfound';

export interface PageStateProps {
  kind: PageStateKind;
  title?: string;
  message?: string;
  action?: { label: string; onClick: () => void };
  className?: string;
}

export function PageState({ kind, title, message, action, className }: PageStateProps) {
  const isLoading = kind === 'loading';
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-2 py-12 px-4 text-center bg-transparent w-full',
        className,
      )}
    >
      {isLoading && <Skeleton lines={3} className="max-w-xs" />}
      {title && <div className={cn('text-sm font-medium text-fg-0', isLoading && 'sr-only')}>{title}</div>}
      {message && <div className={cn(PAGE_DESC, isLoading && 'sr-only')}>{message}</div>}
      {action && (
        <Button size="sm" variant="secondary" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}

export function Empty({
  message,
  children,
  inline = false,
  roomy = true,
  className,
}: {
  message?: string;
  children?: ComponentChildren;
  inline?: boolean;
  roomy?: boolean;
  className?: string;
}) {
  const body = children ?? message;
  if (inline) return <span className={cn('text-sm text-fg-3', className)}>{body}</span>;
  return (
    <div
      className={cn(
        'flex items-center justify-center text-center text-sm text-fg-3',
        roomy && 'py-8',
        className,
      )}
    >
      {body}
    </div>
  );
}

export * from './Notice';

export type ToastKind = Severity | 'loading';

export interface ToastLink {
  href: string;
  label: string;
}

export type FeedbackHrefKind = 'internal' | 'same-page' | 'external' | 'invalid';

export function classifyHref(href: string): FeedbackHrefKind {
  if (isInternalHref(href)) return 'internal';
  if (isSamePageHref(href)) return 'same-page';
  return isSafeExternalHref(href) ? 'external' : 'invalid';
}

/**
 * The one notification link: internal paths SPA-navigate (GlossaryLink/DocsLink pattern),
 * same-page refs stay plain anchors, safe externals go through the confirm modal, and anything
 * else renders a disabled span WITH its reason - never a dead anchor, never a full reload.
 */
export function FeedbackLink({
  href,
  label,
  linkClass,
  onNavigate,
}: {
  href: string;
  label: string;
  linkClass?: string;
  onNavigate?: () => void;
}) {
  const kind = classifyHref(href);
  if (kind === 'internal') {
    return (
      <a
        href={href}
        className={linkClass}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onNavigate?.();
          navigateTo(href);
        }}
      >
        {label}
      </a>
    );
  }
  if (kind === 'same-page') {
    return (
      <a href={href} className={linkClass} onClick={(e) => e.stopPropagation()}>
        {label}
      </a>
    );
  }
  if (kind === 'external') {
    return (
      <button
        type="button"
        className={cn(linkClass, 'inline-flex items-center gap-1')}
        onClick={() => openExternal(href)}
      >
        {label}
        <Icon name="external-link" className="w-3 h-3" />
      </button>
    );
  }
  return (
    <Tooltip content={`Link unavailable: "${href}" is not a supported URL.`} side="bottom">
      <span aria-disabled="true" className={cn(linkClass, 'text-fg-3 no-underline')}>
        {label}
      </span>
    </Tooltip>
  );
}

export function Toast({
  kind,
  message,
  link,
  actions,
  duration = 5000,
  onDismiss,
  className,
}: {
  kind: ToastKind;
  message: ComponentChildren;
  link?: ToastLink;
  actions?: { label: string; onClick: () => void }[];
  duration?: number;
  onDismiss?: () => void;
  className?: string;
}) {
  const color = kind === 'loading' ? undefined : SEVERITY_COLOR[kind];
  const barRef = useRef<HTMLDivElement>(null);
  const durationSeconds = duration / 1000;
  // Sticky (duration 0): its owner removes it when the cause clears, so a tap or a button press
  // must not strand the state it reports. Only the X (when given) dismisses it.
  const auto = duration > 0;

  useEffect(() => {
    if (barRef.current && durationSeconds > 0) {
      void barRef.current.offsetHeight;
      barRef.current.style.transition = `width ${durationSeconds}s linear`;
      barRef.current.style.width = '0%';
    }
  }, [durationSeconds]);

  return (
    <div
      role={kind === 'error' || kind === 'warning' ? 'alert' : 'status'}
      aria-live="polite"
      onClick={auto ? onDismiss : undefined}
      className={cn(
        'surface pointer-events-auto relative overflow-hidden flex items-start gap-2 px-2.5 py-2 rounded-lg bg-bg-1 shadow-sm border border-border',
        auto && onDismiss && 'cursor-pointer',
        className,
      )}
    >
      {durationSeconds > 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-b-lg overflow-hidden bg-bg-3">
          <div
            ref={barRef}
            className="h-full transition-none"
            style={{
              backgroundColor: color
                ? `color-mix(in srgb, ${color} 70%, var(--bg-4))`
                : 'var(--bg-4)',
              width: '100%',
            }}
          />
        </div>
      )}

      {kind === 'loading' ? (
        <Spinner />
      ) : (
        <Icon
          name={SEVERITY_ICON[kind]}
          className="w-4 h-4 mt-0.5 shrink-0"
          style={color ? { color } : undefined}
        />
      )}
      <div className="text-sm flex-1 leading-snug text-fg-0 min-w-0">
        <p className="break-words">
          {message}
          {link && (
            <FeedbackLink
              href={safeHref(link.href) ?? '#'}
              label={link.label}
              linkClass={cn('ml-1.5 inline align-baseline', LINK)}
            />
          )}
        </p>
      </div>
      {actions?.map((a) => (
        <Button
          key={a.label}
          variant="secondary"
          size="xs"
          className="shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            a.onClick();
            if (auto) onDismiss?.();
          }}
        >
          {a.label}
        </Button>
      ))}
      {onDismiss && (
        <Button
          variant="ghost"
          size="xs"
          onClick={(e) => {
            e.stopPropagation();
            onDismiss();
          }}
          className="shrink-0"
          leftIcon={<Icon name="x" className="w-3 h-3" />}
          aria-label="Dismiss notification"
        />
      )}
    </div>
  );
}

export interface DataStateOpts {
  phase: MetricPhase;
  error?: string | null;
  subject: string;
  className?: string;
  quietLoading?: boolean;
  /** Offered on the error card only (a retry, a sign-in); loading has nothing to act on. */
  action?: PageStateProps['action'];
}

const NO_RESPONSE = 'No response. Retry.';

/** Transport and machine-code failures ("backend-error 500 /v1/…") read as one plain line;
 *  anything a person can act on passes through. Kept for callers that show an action's own text; `dataState` never shows raw text. */
export function cleanError(raw: string | null | undefined): string {
  return !raw || /backend-error|\/v\d\/|\bHTTP\b|fetch|network|timed? ?out|abort/i.test(raw)
    ? NO_RESPONSE
    : raw;
}

const lower = (s: string) => (/^[A-Z][a-z]/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s);
const logged = new Set<string>();
/** Raw failure detail goes to the console once per (subject, text); the card says one fixed line. */
const logOnce = (subject: string, raw: string | null | undefined) => {
  const k = `${subject}|${raw ?? ''}`;
  if (raw && !logged.has(k)) {
    logged.add(k);
    console.warn(`${subject} failed`, raw);
  }
};

export function dataState({
  phase,
  error,
  subject,
  className,
  quietLoading = false,
  action,
}: DataStateOpts): JSX.Element | null {
  if (phase === 'error') {
    logOnce(subject, error);
    return <PageState kind="error" title={`${subject.charAt(0).toUpperCase()}${subject.slice(1)} could not be read.`} className={className} action={action} />;
  }
  if (phase === 'loading' && !quietLoading) {
    return <PageState kind="loading" title={`Loading ${lower(subject)}`} className={className} />;
  }
  return null;
}
