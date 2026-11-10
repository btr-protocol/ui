/**
 * Minimal QR generator for WalletConnect pairing URIs: byte mode, error level L, mask 0, versions 1-10 (up to 271
 * bytes; a WalletConnect v2 URI with `expiryTimestamp` is ~170-220). Layout per ISO 18004 (the Nayuki reference):
 * every function module is reserved BEFORE the data zigzag, so no data bit lands under the format / version info.
 * `test/qrcode.test.ts` decodes the output with an independent reader.
 */

// Level L per version: EC codewords per block, then [block count, data codewords per block] groups.
const BLOCKS: Record<number, [number, [number, number][]]> = {
  1: [7, [[1, 19]]],
  2: [10, [[1, 34]]],
  3: [15, [[1, 55]]],
  4: [20, [[1, 80]]],
  5: [26, [[1, 108]]],
  6: [18, [[2, 68]]],
  7: [20, [[2, 78]]],
  8: [24, [[2, 97]]],
  9: [30, [[2, 116]]],
  10: [18, [[2, 68], [2, 69]]],
};
const ALIGN: Record<number, number[]> = {
  1: [],
  2: [6, 18],
  3: [6, 22],
  4: [6, 26],
  5: [6, 30],
  6: [6, 34],
  7: [6, 22, 38],
  8: [6, 24, 42],
  9: [6, 26, 46],
  10: [6, 28, 50],
};
const MAX_VERSION = 10;

const gfMul = (x: number, y: number): number => {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z & 0xff;
};

function rsDivisor(degree: number): number[] {
  const r = Array<number>(degree).fill(0);
  r[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < degree; j++) {
      r[j] = gfMul(r[j], root);
      if (j + 1 < degree) r[j] ^= r[j + 1];
    }
    root = gfMul(root, 0x02);
  }
  return r;
}

function rsRemainder(data: number[], divisor: number[]): number[] {
  const r = Array<number>(divisor.length).fill(0);
  for (const b of data) {
    const factor = b ^ (r.shift() as number);
    r.push(0);
    for (let i = 0; i < divisor.length; i++) r[i] ^= gfMul(divisor[i], factor);
  }
  return r;
}

/** 15-bit format info (level L, mask 0) and 18-bit version info, BCH-coded. */
const formatBits = (): number => {
  const data = (1 << 3) | 0; // L = 01, mask 000
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  return ((data << 10) | rem) ^ 0x5412;
};
const versionBits = (v: number): number => {
  let rem = v;
  for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
  return (v << 12) | rem;
};

export function createQr(text: string): string {
  const bytes = new TextEncoder().encode(text);
  const fits = (v: number) => {
    const [, groups] = BLOCKS[v];
    const cap = groups.reduce((n, [c, d]) => n + c * d, 0) * 8;
    return 4 + (v < 10 ? 8 : 16) + bytes.length * 8 <= cap;
  };
  let version = 1;
  while (version <= MAX_VERSION && !fits(version)) version++;
  if (version > MAX_VERSION) throw new Error(`Text too long for a QR code (${bytes.length} bytes)`);

  // Data codewords: mode, count, bytes, terminator, byte padding, 0xEC / 0x11 fill.
  const [ecLen, groups] = BLOCKS[version];
  const dataCap = groups.reduce((n, [c, d]) => n + c * d, 0);
  const bits: number[] = [];
  const put = (v: number, n: number) => {
    for (let i = n - 1; i >= 0; i--) bits.push((v >>> i) & 1);
  };
  put(0b0100, 4);
  put(bytes.length, version < 10 ? 8 : 16);
  for (const b of bytes) put(b, 8);
  put(0, Math.min(4, dataCap * 8 - bits.length));
  while (bits.length % 8) bits.push(0);
  for (let pad = 0xec; bits.length < dataCap * 8; pad ^= 0xec ^ 0x11) put(pad, 8);
  const data: number[] = [];
  for (let i = 0; i < bits.length; i += 8) data.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0));

  // Blocks, EC, interleave.
  const divisor = rsDivisor(ecLen);
  const blocks: { d: number[]; e: number[] }[] = [];
  let at = 0;
  for (const [count, len] of groups)
    for (let i = 0; i < count; i++) {
      const d = data.slice(at, (at += len));
      blocks.push({ d, e: rsRemainder(d, divisor) });
    }
  const codewords: number[] = [];
  const maxD = Math.max(...blocks.map((b) => b.d.length));
  for (let i = 0; i < maxD; i++) for (const b of blocks) if (i < b.d.length) codewords.push(b.d[i]);
  for (let i = 0; i < ecLen; i++) for (const b of blocks) codewords.push(b.e[i]);

  // Function patterns (reserved), then the data zigzag, then format / version info.
  const size = 17 + 4 * version;
  const dark: boolean[][] = Array.from({ length: size }, () => Array<boolean>(size).fill(false));
  const fixed: boolean[][] = Array.from({ length: size }, () => Array<boolean>(size).fill(false));
  const set = (x: number, y: number, v: boolean) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    dark[y][x] = v;
    fixed[y][x] = true;
  };
  for (let i = 0; i < size; i++) {
    set(6, i, i % 2 === 0);
    set(i, 6, i % 2 === 0);
  }
  for (const [cx, cy] of [
    [3, 3],
    [size - 4, 3],
    [3, size - 4],
  ])
    for (let dy = -4; dy <= 4; dy++)
      for (let dx = -4; dx <= 4; dx++) {
        const d = Math.max(Math.abs(dx), Math.abs(dy));
        set(cx + dx, cy + dy, d !== 2 && d !== 4);
      }
  const al = ALIGN[version];
  for (const ay of al)
    for (const ax of al) {
      const corner = (ax === 6 && ay === 6) || (ax === 6 && ay === al[al.length - 1]) || (ax === al[al.length - 1] && ay === 6);
      if (corner) continue;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(ax + dx, ay + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
  const fmt = formatBits();
  const bit = (v: number, i: number) => ((v >>> i) & 1) === 1;
  for (let i = 0; i <= 5; i++) set(8, i, bit(fmt, i));
  set(8, 7, bit(fmt, 6));
  set(8, 8, bit(fmt, 7));
  set(7, 8, bit(fmt, 8));
  for (let i = 9; i < 15; i++) set(14 - i, 8, bit(fmt, i));
  for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(fmt, i));
  for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(fmt, i));
  set(8, size - 8, true);
  if (version >= 7) {
    const vb = versionBits(version);
    for (let i = 0; i < 18; i++) {
      const a = size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      set(a, b, bit(vb, i));
      set(b, a, bit(vb, i));
    }
  }

  let i = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++)
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vert : vert;
        if (fixed[y][x]) continue;
        const b = i < codewords.length * 8 && bit(codewords[i >>> 3], 7 - (i & 7));
        i++;
        dark[y][x] = (x + y) % 2 === 0 ? !b : b; // mask 0
      }
  }

  let path = '';
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (dark[y][x]) path += `M${x} ${y}h1v1h-1z`;
  // 4-module quiet zone on white: readable on a dark page.
  const q = 4;
  const w = size + 2 * q;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-q} ${-q} ${w} ${w}" shape-rendering="crispEdges"><rect x="${-q}" y="${-q}" width="${w}" height="${w}" fill="#fff"/><path d="${path}"/></svg>`;
}
