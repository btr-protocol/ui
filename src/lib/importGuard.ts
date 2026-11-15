type Guard = <T>(p: Promise<T>) => Promise<T>;
let guard: Guard = (p) => p;

/** A dynamic import that failed in a way the app already classified: `message` is the plain, user-facing copy (never the browser's
 *  "Failed to fetch dynamically imported module: <url>"). A browser caches a failed module fetch for the life of the page, so the
 *  only retry is a reload: kit buttons that retry show `actionLabel` and reload when they see one. */
export class ImportFailure extends Error {
  constructor(
    message: string,
    readonly actionLabel: string = 'Reload',
  ) {
    super(message);
    this.name = 'ImportFailure';
  }
}
const GENERIC = 'This part of the app could not be loaded. Reload the page.';

/** Call once at boot. Every dynamic import the kit makes (wallet modals, WalletConnect glue, QR, chain picker, charts) goes through `fn`, so an app
 *  can classify a gone chunk (a deploy deleted it) and reject with an `ImportFailure` (or its subclass). Unset = the raw promise. */
export function configureImportGuard(fn: Guard): void {
  guard = fn;
}

/** Never lets a misbehaving guard break a caller: a throw, or a result that is not a promise / resolves to nothing, becomes a rejected ImportFailure. */
export function guardedImport<T>(load: () => Promise<T>): Promise<T> {
  try {
    const out = guard(load()) as Promise<T> | undefined;
    if (!out || typeof out.then !== 'function') return Promise.reject(new ImportFailure(GENERIC));
    return out.then((v) => {
      if (v === undefined || v === null) throw new ImportFailure(GENERIC);
      return v;
    });
  } catch (e) {
    return Promise.reject(e instanceof Error ? e : new ImportFailure(GENERIC));
  }
}
