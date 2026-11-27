export type Address = `0x${string}`;
export type Hex = `0x${string}`;

export function isAddress(value: string): value is Address {
  return /^0x[a-fA-F0-9]{40}$/.test(value);
}

export function shortenAddress(address: string, start = 4, end = 4, sep = '...'): string {
  if (address.length <= start + end + 2) return address;
  return `${address.slice(0, 2 + start)}${sep}${address.slice(-end)}`;
}

/** THE short form: `0x` + 4 hex + `.` + last 4 hex (`0x4B1D.1521`), for a 20-byte address and a
 *  32-byte tx hash alike. One form everywhere, so the eye reads the same shape in a wallet row,
 *  an activity row and a confirm sheet. */
export function shortHex(a: string): string {
  if (a.length <= 10) return a;
  return `${a.slice(0, 6)}.${a.slice(-4)}`;
}

/**
 * Alias of `shortHex` (the name every existing call site uses).
 * @deprecated `lead` is accepted for published callers and ignored: there is one short form now.
 */
export const shortAddr = (a: string, _lead?: number): string => shortHex(a);
