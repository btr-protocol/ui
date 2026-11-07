import { useEffect, useState } from 'preact/hooks';

import type { Severity } from './severity';
import { type Haptic, haptic } from './haptic';

/** Toasts use the app-wide severity scale; see severity.ts. */
export type NotificationType = Severity;
interface NotificationAction {
  label: string;
  onClick: () => void;
}
interface NotificationLink {
  href: string;
  label: string;
}
export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message?: string;
  /** Optional explorer (or other) link rendered next to the message. */
  link?: NotificationLink;
  /** Buttons. On an auto-closing toast a press dismisses it; on a sticky one it does not. */
  actions?: NotificationAction[];
  /** Sticky only: no X, so the toast can only be removed by its owner (state the user must not lose). */
  locked?: boolean;
  timestamp: number;
  /** ms until auto-close; 0 = sticky (stays until dismissed or removed by its owner). */
  duration: number;
}

const MIN_DURATION_MS = 5000;
const MAX_DURATION_MS = 15000;
const MS_PER_CHAR = 120;

// Toasts auto-close; the log below does not.
let toastState: Notification[] = [];
const toastSubs = new Set<(s: Notification[]) => void>();

let logState: Notification[] = [];
const logSubs = new Set<(s: Notification[]) => void>();

const emitToasts = () => toastSubs.forEach((fn) => fn(toastState));
const emitLog = () => logSubs.forEach((fn) => fn(logState));

function calculateDuration(message: string, type?: NotificationType): number {
  const baseDuration = message.length * MS_PER_CHAR;

  // Errors and warnings stay longer.
  const multiplier = type === 'error' ? 1.5 : type === 'warning' ? 1.3 : 1.0;

  return Math.min(MAX_DURATION_MS, Math.max(MIN_DURATION_MS, baseDuration * multiplier));
}

export function useNotifications() {
  const [s, set] = useState(toastState);
  useEffect(() => {
    toastSubs.add(set);
    return () => void toastSubs.delete(set);
  }, []);
  return s;
}

export function useNotificationLog() {
  const [s, set] = useState(logState);
  useEffect(() => {
    logSubs.add(set);
    return () => void logSubs.delete(set);
  }, []);
  return s;
}

/** The haptic funnel: every toast buzzes by severity, so call sites never vibrate on their own. */
const BUZZ: Partial<Record<NotificationType, Haptic>> = {
  success: 'ok',
  warning: 'warn',
  error: 'err',
};

/** `opts.id` dedupes: while a toast with that id is on screen a repeat is dropped. A `sticky` toast
 *  (no auto-close; its owner removes it) is instead updated in place, so one status line can move
 *  from pending to settled without stacking. */
export function addNotification(
  type: NotificationType,
  message: string,
  opts?: {
    link?: NotificationLink;
    actions?: NotificationAction[];
    id?: string;
    sticky?: boolean;
    locked?: boolean;
  },
) {
  const id = opts?.id ?? Math.random().toString(36).slice(2);
  const existing = toastState.find((n) => n.id === id);
  if (opts?.id && existing && !(opts.sticky && existing.duration === 0)) return id;
  const buzz = BUZZ[type];
  if (buzz) haptic(buzz);
  const duration = opts?.sticky ? 0 : calculateDuration(message + (opts?.link?.label ?? ''), type);
  const title = type.charAt(0).toUpperCase() + type.slice(1);
  const notification: Notification = {
    id,
    type,
    title,
    message,
    link: opts?.link,
    actions: opts?.actions,
    locked: opts?.sticky && opts.locked,
    timestamp: Date.now(),
    duration,
  };

  if (existing) {
    if (existing.message === message && existing.type === type) return id;
    toastState = toastState.map((n) => (n.id === id ? notification : n));
  } else toastState = [notification, ...toastState];
  logState = [notification, ...logState];

  emitToasts();
  emitLog();

  // Removed from toasts after `duration`, never from the log.
  // An old timer must not take down a newer toast that reused the id.
  if (duration)
    setTimeout(() => {
      if (toastState.find((n) => n.id === id) === notification) removeNotification(id);
    }, duration);
  return id;
}

export function removeNotification(id: string) {
  toastState = toastState.filter((n) => n.id !== id);
  emitToasts();
}

export function clearLog() {
  logState = [];
  emitLog();
}

/** Test seam: read the toast list without a component. */
export function peekToasts(): Notification[] {
  return toastState;
}
