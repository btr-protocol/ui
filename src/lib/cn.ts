import { extendTailwindMerge } from 'tailwind-merge';

import type { Signal } from '@preact/signals';

export type ClassValue =
  | string
  | number
  | bigint
  | boolean
  | undefined
  | null
  | { [key: string]: boolean }
  | ClassValue[]
  | Signal<string | number | bigint | boolean | undefined | null>
  | Signal<ClassValue>;

/** z-scale names tailwind-merge cannot infer (`z-modal` has no group otherwise); mirrors `zIndex` in tailwind.config.js. */
const merge = extendTailwindMerge({
  extend: {
    classGroups: {
      z: [{ z: ['rail', 'header', 'footer', 'dropdown', 'modal', 'tooltip', 'toast'] }],
    },
  },
});

function isSignalLike(v: ClassValue): boolean {
  return (
    v !== null &&
    typeof v === 'object' &&
    !Array.isArray(v) &&
    'value' in (v as Record<string, unknown>)
  );
}

function flatten(inputs: ClassValue[], out: string[]): void {
  for (let raw of inputs) {
    if (isSignalLike(raw)) {
      raw = (raw as { value: ClassValue }).value;
    }
    if (!raw) continue;

    if (typeof raw === 'string' || typeof raw === 'number' || typeof raw === 'bigint') {
      out.push(String(raw));
    } else if (Array.isArray(raw)) {
      flatten(raw, out);
    } else if (typeof raw === 'object') {
      for (const [key, value] of Object.entries(raw as Record<string, boolean>)) {
        if (value) out.push(key);
      }
    }
  }
}

/** clsx-style conditional classes, then tailwind-merge: the last class of a group wins, so a call-site `className` beats a component base. */
export function cn(...inputs: ClassValue[]): string {
  const classes: string[] = [];
  flatten(inputs, classes);
  return merge(classes.join(' '));
}
