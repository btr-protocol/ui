// Own module: keccak (@noble/hashes) stays out of every importer of lib/address.
import { keccak_256 } from '@noble/hashes/sha3.js';

import { type Address, isAddress } from './address';

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
