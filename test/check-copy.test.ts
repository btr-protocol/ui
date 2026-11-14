import { expect, test } from 'bun:test';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const EM = String.fromCharCode(8212);
const ESC = ['\\u', '2014'].join('');
const DEC = ['&#', '8212;'].join('');
const HEX = ['0', 'x2014'].join('');
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

test('check-copy also scans test, docs, scripts, root markdown and svg, and rejects escapes', () => {
  for (const [f, body] of [
    ['test/a.test.ts', `x ${EM}`], ['docs/a.md', `x ${EM}`], ['scripts/a.sh', `x ${EM}`], ['NOTES.md', `x ${EM}`],
    ['src/a.svg', `<text>${EM}</text>`], ['src/b.ts', `'${ESC}'`], ['src/c.ts', `const c = ${HEX}`], ['src/d.html', `a ${DEC} b`],
  ] as const) {
    const root = fixture('ok\n');
    for (const d of ['test', 'docs', 'scripts']) mkdirSync(join(root, d), { recursive: true });
    writeFileSync(join(root, f), body);
    expect(run(root).exitCode).toBe(1);
  }
});

test('check-copy exits 2 when nothing can be scanned', () => {
  expect(run(mkdtempSync(join(tmpdir(), 'check-copy-'))).exitCode).toBe(2);
});

test('check-copy passes on clean copy', () => {
  expect(run(fixture('a - b; c: d\n')).exitCode).toBe(0);
});

test('the kit itself is clean', () => {
  expect(Bun.spawnSync(['bash', 'scripts/check-copy.sh']).exitCode).toBe(0);
});

test('check-copy self-test (boundaries, entities, css and en dash forms)', () => {
  const r = Bun.spawnSync(['bash', 'scripts/check-copy.sh', '--self-test'], { stdout: 'pipe', stderr: 'pipe' });
  expect(r.stderr.toString()).toBe('');
  expect(r.exitCode).toBe(0);
}, 60_000); // spawns grep per fixture: seconds on a busy machine
