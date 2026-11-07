# @btr-protocol/ui

The BTR UI kit: Svelte 5 components, one stylesheet and the theme tokens. Source only, no build step. MIT.

## Install

A git dependency pinned to a commit:

```json
{ "dependencies": { "@btr-protocol/ui": "github:btr-protocol/ui#<commit>" } }
```

Alias `@btr-protocol/ui` to `node_modules/@btr-protocol/ui/src` in your bundler. Peer dependency: `svelte` 5. `wallet.js` also needs `@btr-protocol/sdk` (`eth/rpc`, `eth/types`) resolvable by your bundler.

## Contents

| Import | What |
|---|---|
| `@btr-protocol/ui/kit.css` | base, buttons, pill, card, table, segmented toggle, empty and error surfaces |
| `@btr-protocol/ui/theme/{tokens,dark,light}.css` | the palette and scales as CSS variables |
| `Button.svelte` | the action button, with a `pending` state and a `why` reason when disabled |
| `Spinner.svelte`, `EmptyState.svelte`, `ErrorState.svelte`, `Icon.svelte` | loading, empty and error surfaces, inline icons |
| `wallet.js` | EIP-6963 discovery, `connectProvider`, `personalSign`, `assertSiweMessage` |

## Theming

Everything reads CSS variables (`--bg`, `--text`, `--accent`, `--border`, `--btn-h-md`, `--sp-4`, ...). Import `theme/tokens.css` plus `dark.css` and `light.css`, set `data-theme="dark"|"light"` on `<html>`, and override any variable to retheme.
