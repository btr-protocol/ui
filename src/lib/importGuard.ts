type Guard = <T>(p: Promise<T>) => Promise<T>;
export type ImportFailureKind = 'stale' | 'failed' | 'offline';

/** A dynamic import that failed in a way the app already classified: `message` is the plain, user-facing copy (never the browser's
 *  "Failed to fetch dynamically imported module: <url>"). A browser caches a failed module fetch for the life of the page, so the
 *  only retry is a reload: kit fallbacks show `actionLabel` and reload, except while `kind` is 'offline' (a reload would land on the
 *  browser's offline page; the action appears when the connection returns). */
export class ImportFailure extends Error {
  constructor(
    message: string,
    readonly actionLabel: string = 'Reload',
    readonly kind: ImportFailureKind = 'failed',
  ) {
    super(message);
    this.name = 'ImportFailure';
  }
}
const GENERIC = 'This part of the app could not be loaded. Reload the page.';

export interface ImportGuardOptions {
  /** The kit's own failure notices (connect / account fallback, pairing error) call this with their element while mounted and
   *  run the returned function on unmount: the app knows which failure message is actually visible. Default: no-op. */
  registerNotice?: (el: HTMLElement) => () => void;
}
let guard: Guard = (p) => p;
let register: NonNullable<ImportGuardOptions['registerNotice']> = () => () => {};

/** Call once at boot. Every dynamic import the kit makes (wallet modals, WalletConnect glue, QR, chain picker, charts) goes through `fn`, so an app
 *  can classify a gone chunk (a deploy deleted it) and reject with an `ImportFailure` (or its subclass). Unset = the raw promise. */
export function configureImportGuard(fn: Guard, o: ImportGuardOptions = {}): void {
  guard = fn;
  register = o.registerNotice ?? (() => () => {});
}
export const registerFailureNotice = (el: HTMLElement): (() => void) => register(el);

const asFailure = (e: unknown): Error => (e instanceof Error ? e : new ImportFailure(GENERIC));

/** Never lets a misbehaving guard break a caller: a throw, or a result that is not a promise / resolves to nothing, becomes a rejected ImportFailure; a non-Error rejection is normalised too. */
export function guardedImport<T>(load: () => Promise<T>): Promise<T> {
  try {
    const out = guard(load()) as Promise<T> | undefined;
    if (!out || typeof out.then !== 'function') return Promise.reject(new ImportFailure(GENERIC));
    return out.then(
      (v) => {
        if (v === undefined || v === null) throw new ImportFailure(GENERIC);
        return v;
      },
      (e: unknown) => {
        throw asFailure(e);
      },
    );
  } catch (e) {
    return Promise.reject(asFailure(e));
  }
}
