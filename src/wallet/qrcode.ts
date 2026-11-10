/** Minimal QR generator, fixed: version 6 (41x41), level L, byte mode, mask 0. Capacity 134 bytes (UTF-8). */

const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);

(function initGF() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d; // primitive polynomial
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
})();

const gfMul = (a: number, b: number) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

function getPoly(degree: number): Uint8Array {
  const poly = new Uint8Array(degree + 1);
  poly[0] = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = i + 1; j >= 1; j--) {
      poly[j] = poly[j] ^ gfMul(poly[j - 1], EXP[i]);
    }
    poly[0] = gfMul(poly[0], EXP[i]);
  }
  return poly;
}

function getECC(data: Uint8Array, degree: number): Uint8Array {
  const poly = getPoly(degree);
  const ecc = new Uint8Array(degree);
  for (let i = 0; i < data.length; i++) {
    const inv = ecc[0] ^ data[i];
    for (let j = 0; j < degree - 1; j++) ecc[j] = ecc[j + 1] ^ gfMul(inv, poly[degree - 1 - j]);
    ecc[degree - 1] = gfMul(inv, poly[0]);
  }
  return ecc;
}

class BitStream {
  data: number[] = [];
  length = 0;

  put(num: number, len: number) {
    for (let i = 0; i < len; i++) {
      this.putBit(((num >>> (len - i - 1)) & 1) === 1);
    }
  }

  putBit(bit: boolean) {
    if (this.length === this.data.length * 8) this.data.push(0);
    if (bit) this.data[this.length >>> 3] |= 0x80 >>> (this.length & 7);
    this.length++;
  }

  // V6-L: 2 blocks, 68 data + 18 ECC bytes each, interleaved
  getBytes(): Uint8Array {
    const dataLen = 68;
    const eccLen = 18;

    const d1 = new Uint8Array(this.data.slice(0, dataLen));
    const d2 = new Uint8Array(this.data.slice(dataLen, dataLen * 2));
    const e1 = getECC(d1, eccLen);
    const e2 = getECC(d2, eccLen);

    const final = new Uint8Array(172);
    let k = 0;

    for (let i = 0; i < dataLen; i++) {
      final[k++] = d1[i];
      final[k++] = d2[i];
    }
    for (let i = 0; i < eccLen; i++) {
      final[k++] = e1[i];
      final[k++] = e2[i];
    }

    return final;
  }
}

const SIZE = 41; // Version 6
const FORMAT_INFO = 0x77c4; // level L, mask 0 (precomputed BCH)

export function createQr(text: string, options?: { logo?: boolean }): string {
  const stream = new BitStream();
  const utf8 = new TextEncoder().encode(text);

  if (utf8.length > 134) throw new Error('Text too long for QR V6');

  stream.put(0x4, 4); // byte mode
  stream.put(utf8.length, 8);
  utf8.forEach((b) => stream.put(b, 8));

  const totalDataBits = 136 * 8;
  if (stream.length + 4 <= totalDataBits) stream.put(0, 4);
  while (stream.length % 8 !== 0) stream.putBit(false);

  // pad bytes alternate 0xEC, 0x11
  while (stream.length < totalDataBits) {
    stream.put(0xec, 8);
    if (stream.length < totalDataBits) stream.put(0x11, 8);
  }

  const data = stream.getBytes();

  const mod = Array(SIZE)
    .fill(null)
    .map(() => Array(SIZE).fill(null));
  const set = (x: number, y: number, v: boolean) => (mod[y][x] = v);

  const fillRect = (x: number, y: number, w: number, h: number) => {
    for (let r = y; r < y + h; r++) for (let c = x; c < x + w; c++) set(c, r, true);
  };
  const box = (x: number, y: number) => {
    fillRect(x, y, 7, 7);
    for (let i = 2; i < 5; i++) for (let j = 2; j < 5; j++) set(x + j, y + i, true);
    for (let i = 1; i < 6; i++) {
      set(x + i, y + 1, false);
      set(x + i, y + 5, false);
      set(x + 1, y + i, false);
      set(x + 5, y + i, false);
    }
  };

  box(0, 0);
  box(SIZE - 7, 0);
  box(0, SIZE - 7);

  const hLine = (x: number, y: number, l: number) => {
    for (let i = 0; i < l; i++) set(x + i, y, false);
  };
  const vLine = (x: number, y: number, l: number) => {
    for (let i = 0; i < l; i++) set(x, y + i, false);
  };
  hLine(0, 7, 8);
  hLine(SIZE - 8, 7, 8);
  hLine(0, SIZE - 8, 8);
  vLine(7, 0, 8);
  vLine(SIZE - 8, 0, 8);
  vLine(7, SIZE - 8, 8);

  // alignment centres at 6/34; (6,6) is a finder, excluded
  const alignPoints = [
    [6, 34],
    [34, 6],
    [34, 34],
  ];
  alignPoints.forEach(([c, r]) => {
    for (let y = r - 2; y <= r + 2; y++)
      for (let x = c - 2; x <= c + 2; x++)
        set(x, y, y === r - 2 || y === r + 2 || x === c - 2 || x === c + 2 || (x === c && y === r));
  });

  for (let i = 8; i < SIZE - 8; i++) {
    if (mod[6][i] === null) set(i, 6, i % 2 === 0);
    if (mod[i][6] === null) set(6, i, i % 2 === 0);
  }

  let idx = 0;
  for (let right = SIZE - 1; right > 0; right -= 2) {
    if (right === 6) right--;
    for (let vert = 0; vert < SIZE; vert++) {
      const y = (right + 1) & 2 ? SIZE - 1 - vert : vert;
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        if (mod[y][x] === null) {
          let bit = false;
          if (idx < data.length * 8) {
            bit = ((data[idx >>> 3] >>> (7 - (idx & 7))) & 1) === 1;
          }
          // mask 0: flip where (x + y) is even
          if ((x + y) % 2 === 0) bit = !bit;
          set(x, y, bit);
          idx++;
        }
      }
    }
  }

  const bits = FORMAT_INFO;
  for (let i = 0; i < 15; i++) {
    const v = ((bits >>> i) & 1) === 1;
    if (i < 6) set(8, i, v);
    else if (i < 8) set(8, i + 1, v);
    else set(8, SIZE - 15 + i, v);
    if (i < 8) set(SIZE - 1 - i, 8, v);
    else if (i < 9) set(15 - i, 8, v);
    else set(15 - i - 1, 8, v);
  }
  set(8, SIZE - 8, true); // dark module

  let path = '';
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (mod[y][x]) path += `M${x} ${y}h1v1h-1z`;
    }
  }

  let logoSvg = '';
  if (options?.logo) {
    const logoSize = 7;
    const logoPos = (SIZE - logoSize) / 2;
    logoSvg = `<rect x="${logoPos}" y="${logoPos}" width="${logoSize}" height="${logoSize}" fill="white"/>`;
    logoSvg += `<image x="${logoPos}" y="${logoPos}" width="${logoSize}" height="${logoSize}" href="/brand/logo-b.svg"/>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" shape-rendering="crispEdges"><path d="${path}"/>${logoSvg}</svg>`;
}
