# @btr-protocol/ui

The btr.markets UI kit: Preact components, the fixed-shell layout (Header, Footer, TabBar), theme tokens and a Tailwind 3 preset, extracted from the BTR front so every BTR app looks and behaves the same. TypeScript source only, no build step. MIT.

## Install

```json
{ "dependencies": { "@btr-protocol/ui": "github:btr-protocol/ui#<commit>" } }
```

Peers: `tailwindcss` 3 (preset). Runtime deps (`preact`, `@preact/signals`, `lucide-preact`, `tailwind-merge`) ship with the kit. Fonts (Mozilla Text, Geist Mono; SIL OFL 1.1, licences in `src/assets/fonts/`) ship with the kit.

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

## 0.3 additions

Needs peer `@btr-protocol/sdk` (formatters).

- Formatters (`lib/format`, from the index): `formatUsd`/`formatQty` (auto by magnitude, the one implementation), SDK `formatCompact/Number/Price/Currency/CurrencyCompact/Percent/PercentSig/Yield/Units`, `parseUnits`; metrics `DASH num fmtUsd fmtSignedPct fmtCount fmtRatio fmtApr fmtAge fmtFixed fmtWindowMs feeSplit weightedRate`; amounts `formatBalance formatAmount parseAmountInput formatAmountDisplay parseAmountToBig useAmountInput`. Numbers font: `className="font-numeric"`.
- Chains: `chainIcon(idOrSlug, {mono?})`, `chainSlug`, `ChainGlyph`, `ChainSelect`, `ChainSelectModal`, `chainSelectItems` (props: `{id,name,icon?,explorer?,testnet?,planned?}[]`).
- Forms: `MultiInput`, `SettingRow`, `Slider`, `PercentLadderSlider`, `Field` (label, hint, error, `maxW`).

## 0.4 additions (master-detail kit)

```tsx
import { MasterDetail, Table, StackedIcons, Timeline, ChainMultiSelect } from '@btr-protocol/ui';

// Master list + detail. >= lg: clamp(280px, 22%, 360px) | 1fr. < lg: list -> detail drill-down by `selected`.
<MasterDetail
  selected={!!safeId}            // derive from your route; URL-agnostic
  onBack={() => setSafeId(null)} // Back row and Esc on phones; focus moves to detail, then back to the row
  placeholder={<Empty>Select a Safe</Empty>}
  master={
    <Table bare searchable={false} columns={cols} data={safes} rowKey={(s) => s.addr}
      selectedKey={safeId} onSelect={(_, key) => setSafeId(key)} stackBelow="lg" />
  }
  detail={<SafeDetail id={safeId} />}
/>
```

- `Table` `onSelect` + `selectedKey` make rows selectable: `aria-selected`, roving tabindex, ArrowUp/Down/Home/End move focus, Enter/Space/click select. Selected row = detail-pane surface + left primary bar + bold (`SELECTED_ROW`). `bare` drops frame and radius so the table sits flush in a pane.
- `NavItem.badge` / `badgeLabel` (Header + TabBar): `{ path, title, badge: 3, badgeLabel: '3 transactions awaiting your signature' }`. Hidden at 0, `99+` cap, count is visual, the sentence is read. TabBar labels now ellipsise (no crowding at 360px).
- `<StackedIcons items={[{ id, label, icon }]} max={3} size="sm|md" />`: first N icons, `+N` chip, full list as accessible name.
- `<Timeline items={[{ id, icon: 'check', title, meta, href, linkLabel, group: 'Today' }]} empty="No activity yet" />`.
- `<ChainMultiSelect chains={chains} value={ids} onChange={setIds} />`: trigger with stacked chain icons ("All" when full), modal with search, sort and Select All, at least one stays selected.

## Checks

`bun install && bunx tsc --noEmit && bun test`
