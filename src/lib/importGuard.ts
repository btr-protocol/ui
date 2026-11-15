type Guard = <T>(p: Promise<T>) => Promise<T>;
let guard: Guard = (p) => p;

/** Call once at boot. Every dynamic import the kit makes (wallet modal, WalletConnect glue, QR, chain picker) goes through `fn`, so an app
 *  can classify a gone chunk (a deploy deleted it) and reject with a plain message instead of the browser's "Failed to fetch dynamically imported module: <url>". Unset = the raw promise. */
export function configureImportGuard(fn: Guard): void {
  guard = fn;
}
export const guardedImport = <T>(load: () => Promise<T>): Promise<T> => guard(load());
