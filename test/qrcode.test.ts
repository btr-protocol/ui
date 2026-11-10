// The QR the connect modal shows must decode back to the pairing URI (the copy moved from the front decoded to nothing at all,
// and refused any URI over 134 bytes: every WalletConnect v2 URI). Read with an independent decoder (jsQR).
import { expect, test } from 'bun:test';
import jsQR from 'jsqr';
import { createQr } from '../src/wallet/qrcode';

function decode(text: string): string | null {
  const svg = createQr(text);
  const size = Number(/viewBox="-4 -4 (\d+)/.exec(svg)?.[1]) - 8;
  const on = new Set([...svg.matchAll(/M(\d+) (\d+)h1/g)].map((m) => `${m[1]},${m[2]}`));
  const S = 4;
  const Q = 4;
  const W = (size + 2 * Q) * S;
  const px = new Uint8ClampedArray(W * W * 4).fill(255);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++)
      if (on.has(`${x},${y}`))
        for (let dy = 0; dy < S; dy++)
          for (let dx = 0; dx < S; dx++) {
            const i = (((y + Q) * S + dy) * W + (x + Q) * S + dx) * 4;
            px[i] = px[i + 1] = px[i + 2] = 0;
          }
  return jsQR(px, W, W)?.data ?? null;
}

const URI = `wc:${'7f3a'.repeat(16)}@2?relay-protocol=irn&symKey=${'c3d4'.repeat(16)}&expiryTimestamp=1762790000&methods=wc_sessionAuthenticate`;

test('a real-length WalletConnect URI round-trips', () => {
  expect(URI.length).toBeGreaterThan(134);
  expect(decode(URI)).toBe(URI);
});

test('every version 1-10 decodes (byte lengths at each step)', () => {
  for (const n of [1, 17, 32, 53, 78, 106, 134, 154, 192, 230, 271]) {
    const t = URI.padEnd(n, 'x').slice(0, n);
    expect(decode(t)).toBe(t);
  }
});

test('over capacity throws (the modal shows "Could not generate the QR code" and keeps Copy link)', () => {
  expect(() => createQr('x'.repeat(272))).toThrow('Text too long');
});
