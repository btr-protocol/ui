type Guard = <T>(p: Promise<T>) => Promise<T>;
export type ImportFailureKind = 'stale' | 'failed' | 'offline';

/** A dynamic import that failed in a way the app already classified: `message` is the plain, user-facing copy (never the browser's
 *  "Failed to fetch dynamically imported module: <url>"). A browser caches a failed module fetch for the life of the page, so the
 *  only retry is a reload: kit fallbacks show `actionLabel` and reload, but only while the browser is online (offline a reload would land on the
 *  browser's offline page; the action appears when the connection returns). */
export class ImportFailure extends Error {
  constructor(
    message: string,
    readonly actionLabel: string = texts.action,
    readonly kind: ImportFailureKind = 'failed',
  ) {
    super(message);
    this.name = 'ImportFailure';
  }
}
export interface ImportTexts {
  /** Fallback modal title (default 'Wallet'). */
  title: string;
  /** Message when the failure carries none of its own (default: plain English). */
  message: string;
  /** Action label when the failure carries none of its own (default 'Reload'). */
  action: string;
}
const DEFAULT_TEXTS: ImportTexts = { title: 'Wallet', message: 'This part of the app could not be loaded. Reload the page.', action: 'Reload' };
let texts = DEFAULT_TEXTS;
/** The kit's English fallbacks, overridable through `configureImportGuard(fn, { texts })` (the same call the app already makes). */
export const importTexts = (): ImportTexts => texts;

export interface ImportGuardOptions {
  /** The kit's own failure notices (connect / account fallback, pairing error) call this with their element while mounted and
   *  run the returned function on unmount: the app knows which failure message is actually visible. Default: no-op. */
  registerNotice?: (el: HTMLElement) => () => void;
  /** Overrides for the kit's English literals in its failure fallbacks (title, message, action). Failures that carry their own message / label win. */
  texts?: Partial<ImportTexts>;
}
let guard: Guard = (p) => p;
let register: NonNullable<ImportGuardOptions['registerNotice']> = () => () => {};

/** Call once at boot. Every dynamic import the kit makes (wallet modals, WalletConnect glue, QR, chain picker, charts) goes through `fn`, so an app
 *  can classify a gone chunk (a deploy deleted it) and reject with an `ImportFailure` (or its subclass). Unset = the raw promise. */
export function configureImportGuard(fn: Guard, o: ImportGuardOptions = {}): void {
  guard = fn;
  register = o.registerNotice ?? (() => () => {});
  texts = { ...DEFAULT_TEXTS, ...o.texts };
}
export const registerFailureNotice = (el: HTMLElement): (() => void) => register(el);

const asFailure = (e: unknown): Error => (e instanceof Error ? e : new ImportFailure(texts.message, texts.action));

/** Never lets a misbehaving guard break a caller: a throw, or a result that is not a promise / resolves to nothing, becomes a rejected ImportFailure; a non-Error rejection is normalised too. */
export function guardedImport<T>(load: () => Promise<T>): Promise<T> {
  try {
    const out = guard(load()) as Promise<T> | undefined;
    if (!out || typeof out.then !== 'function') return Promise.reject(new ImportFailure(texts.message, texts.action));
    return out.then(
      (v) => {
        if (v === undefined || v === null) throw new ImportFailure(texts.message, texts.action);
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
