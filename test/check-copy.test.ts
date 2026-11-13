import { expect, test } from 'bun:test';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const EM = String.fromCharCode(0x2014);
const run = (root: string) => Bun.spawnSync(['bash', 'scripts/check-copy.sh', root], { stdout: 'pipe', stderr: 'pipe' });

function fixture(body: string, file = 'src/a.ts') {
  const root = mkdtempSync(join(tmpdir(), 'check-copy-'));
  mkdirSync(join(root, 'src'));
  writeFileSync(join(root, file), body);
  return root;
}

test('check-copy fails on an em dash in src, README and CHANGELOG', () => {
  for (const f of ['src/a.ts', 'README.md', 'CHANGELOG.md']) {
    const r = run(fixture(`a ${EM} b\n`, f));
    expect(r.exitCode).toBe(1);
    expect(r.stderr.toString()).toContain(f);
  }
});

test('check-copy passes on clean copy', () => {
  expect(run(fixture('a - b; c: d\n')).exitCode).toBe(0);
});

test('the kit itself is clean', () => {
  expect(Bun.spawnSync(['bash', 'scripts/check-copy.sh']).exitCode).toBe(0);
});
