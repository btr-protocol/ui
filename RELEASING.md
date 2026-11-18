# Releasing @btr-protocol/ui

Owner-only. Nothing here runs in CI. Version bump rule: patch = fixes, minor = features or any
breaking change while 0.x, major once 1.0. Keep `package.json` and `jsr.json` versions and the
CHANGELOG heading in lockstep. `@btr-protocol/sdk` 0.6.0 must be LIVE on npm before publishing this package (it peers on `^0.6.0`); verify with `npm view @btr-protocol/sdk version`.

1. On a clean `main`: `git fetch --prune && git status`.
2. Bump versions, CHANGELOG `## X.Y.Z - date`.
3. `bun install && bun run check` (the full suite needs `bunx playwright install chromium` or CHROMIUM_PATH; without it 96 browser tests fail).
4. `npm pack --dry-run`.
5. Commit `chore(release): vX.Y.Z`, push, signed tag: `git tag -s vX.Y.Z -m vX.Y.Z && git push origin vX.Y.Z`.
6. npm (2FA prompt): `npm publish --access public`
7. JSR: `bunx jsr publish`. JSR carries TS/TSX modules only; CSS, Tailwind preset and `assets/*` are npm-only.
