import { keccak_256 } from '@noble/hashes/sha3.js';

export type Address = `0x${string}`;
export type Hex = `0x${string}`;

export function isAddress(value: string): value is Address {
  return /^0x[a-fA-F0-9]{40}$/.test(value);
}

/** EIP-55 checksum casing; input may be any-case. */
export function checksumAddress(address: string): Address {
  const lower = address.toLowerCase();
  if (!isAddress(lower)) throw new Error('Invalid address');
  const hex = lower.slice(2);
  const hash = Array.from(keccak_256(new TextEncoder().encode(hex)), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('');
  let out = '0x';
  for (let i = 0; i < hex.length; i++) {
    out += Number.parseInt(hash[i], 16) >= 8 ? hex[i].toUpperCase() : hex[i];
  }
  return out as Address;
}

export function shortenAddress(address: string, start = 4, end = 4, sep = '...'): string {
  if (address.length <= start + end + 2) return address;
  return `${address.slice(0, 2 + start)}${sep}${address.slice(-end)}`;
}

/** 0x+`lead`+…+4: `0x4B1D…1521` for a 20-byte address (the wallet form); 32-byte hashes default to 6, they collide more often. */
export const shortAddr = (a: string, lead = a.length > 42 ? 6 : 4) => shortenAddress(a, lead, 4, '…');
