import { copyText } from './clipboard';
import { addNotification } from './notifications';
import { useState } from 'preact/hooks';

/**
 * Copy with a 2s "copied" flash. The flash is what a caller renders (icon swap, tooltip text); the
 * toast says which value was taken, so its wording stays with the caller. A falsy value is a no-op:
 * nothing is copied and no toast claims otherwise. A refused write toasts the failure (`copyText`)
 * and never flashes.
 */
export function useCopy(resetMs = 2000) {
  const [copied, setCopied] = useState(false);

  const copy = (
    value: string | null | undefined,
    message: string,
    event?: { stopPropagation: () => void },
  ) => {
    event?.stopPropagation();
    if (!value) return;
    void copyText(value).then((ok) => {
      if (!ok) return;
      setCopied(true);
      addNotification('success', message);
      window.setTimeout(() => setCopied(false), resetMs);
    });
  };

  return { copied, copy };
}
