import { haptic } from './haptic';
import { addNotification } from './notifications';

/** Resolves false (after a toast) when the platform refuses: no permission, no focus, insecure context. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    haptic('ok');
    return true;
  } catch {
    addNotification('error', 'Could not copy. Select and copy it by hand.');
    return false;
  }
}
