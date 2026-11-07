# @btr-protocol/ui

The btr.markets UI kit: Preact components, the fixed-shell layout (Header, Footer, TabBar), theme tokens and a Tailwind 3 preset, extracted from the BTR front so every BTR app looks and behaves the same. TypeScript source only, no build step. MIT.

## Install

```json
{ "dependencies": { "@btr-protocol/ui": "github:btr-protocol/ui#<commit>" } }
```

Peers: `preact`, `@preact/signals`, `lucide-preact`, `tailwindcss` 3, `tailwind-merge`. Fonts (Mozilla Text, Geist Mono; SIL OFL 1.1, licences in `src/assets/fonts/`) ship with the kit.

## Setup

`tailwind.config.js`

```js
import preset from '@btr-protocol/ui/tailwind.preset';
export default {
  presets: [preset],
  content: ['./index.html', './src/**/*.{ts,tsx}', './node_modules/@btr-protocol/ui/src/**/*.{ts,tsx}'],
};
```

PostCSS: `tailwindcss` + `autoprefixer` (the stylesheet carries the `@tailwind` directives). Entry:

```ts
import '@btr-protocol/ui/styles'; // fonts + tokens + base rules + @tailwind
```

## Usage

```tsx
import { Shell, Header, Footer, TabBar, PageShell, WalletButton, WalletModal, ThemeProvider, SOCIAL_ICONS } from '@btr-protocol/ui';

const items = [{ path: '/safety', title: 'Safety', icon: 'shield' }];

<ThemeProvider>
  <Shell
    header={<Header items={items} activePath={path} onNavigate={navigate} brandLabel="Home" right={<WalletButton />} />}
    footer={<Footer social={[{ title: 'GitHub', href: 'https://github.com/btr-protocol', icon: SOCIAL_ICONS.github }]} />}
    tabBar={<TabBar tabs={items} activePath={path} onNavigate={navigate} />}
  >
    <PageShell title="Safety">...</PageShell>
  </Shell>
  <WalletModal />
</ThemeProvider>;
```

Strings are props; the kit is English by default. Routing is the host's: pass `onNavigate`, and call `configureNav({ navigate, openExternal })` once for in-kit links.

## Layout

```
src/styles    tokens.css  fonts.css  index.css  tailwind.preset.js
src/layout    Shell Header Footer TabBar PageShell PageToolbar Notifications
src/ui        Button Badge Input Select(Dropdown, SelectionModal) Table BaseModal ConfirmSheet Feedback Tooltip ...
src/wallet    EIP-6963 discovery + signal store, WalletButton, WalletModal
src/lib       cn, notifications (toasts), theme, nav seam, address helpers
src/assets    brand/logo.svg, icons/, fonts/
```

Exports: `.`, `./ui`, `./layout`, `./wallet`, `./styles`, `./styles/tokens.css`, `./styles/fonts.css`, `./tailwind.preset`, `./lib/*`, `./assets/*`.

## Checks

`bun install && bunx tsc --noEmit && bun test`
