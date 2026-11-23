export type Address = `0x${string}`;
export type Hex = `0x${string}`;

export function isAddress(value: string): value is Address {
  return /^0x[a-fA-F0-9]{40}$/.test(value);
}

export function shortenAddress(address: string, start = 4, end = 4, sep = '...'): string {
  if (address.length <= start + end + 2) return address;
  return `${address.slice(0, 2 + start)}${sep}${address.slice(-end)}`;
}

/** 0x+`lead`+…+4: `0x4B1D…1521` for a 20-byte address (the wallet form); 32-byte hashes default to 6, they collide more often. */
export const shortAddr = (a: string, lead = a.length > 42 ? 6 : 4) => shortenAddress(a, lead, 4, '…');
