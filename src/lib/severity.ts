/** One severity scale shared by toasts and the log, so a toast and its log entry agree on glyph and colour. */
import type { IconName } from '../ui/Icon';

export const SEVERITIES = ['debug', 'info', 'success', 'warning', 'error'] as const;

export type Severity = (typeof SEVERITIES)[number];

export interface AppNotification {
  id: string;
  message: string;
  level: Severity;
  timestamp: number;
  count?: number;
  stack?: string;
  /** Optional explorer (or other) link, rendered under the message. */
  link?: { href: string; label: string };
}

export const SEVERITY_ICON: Record<Severity, IconName> = {
  debug: 'bug',
  info: 'info',
  success: 'check-circle',
  warning: 'warning',
  error: 'alert-circle',
};

/** CSS variables, so both the toast (inline style) and the log row (currentColor) theme. */
export const SEVERITY_COLOR: Record<Severity, string> = {
  debug: 'var(--fg-2)',
  info: 'var(--fg-2)',
  success: 'var(--fg-success)',
  warning: 'var(--fg-warning)',
  error: 'var(--fg-error)',
};

/** Severities that should draw attention on the bell badge. */
export const isCritical = (level: Severity): boolean => level === 'error' || level === 'warning';
