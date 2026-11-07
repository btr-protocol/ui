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

/** 0x+`lead`+…+4. Wallets use 0x+4+4; the 6 default suits 32-byte hashes, which collide more often. */
export const shortAddr = (a: string, lead = 6) => shortenAddress(a, lead, 4, '…');
