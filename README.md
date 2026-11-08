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

## Light theme

Designed, not mirrored from dark (Linear / Stripe / Mercury family). Dark separates surfaces by lightness; light keeps one warm off-white canvas and lifts content onto white-ish raised surfaces with quiet 1px borders, so nothing glares and nothing reads as a grey block. Text is near-black (never `#000`), muted text stays AA on every surface, the orange accent is darkened for text and used as a tinted background for chips and banners, and the series palette drops yellow/cyan (they vanish on white). Everything is a token in `src/styles/tokens.css` (`.light` block); components use no raw colours. `test/contrast.test.ts` computes WCAG ratios from the tokens (text 4.5:1, series / lines / brand mark 3:1) for both themes.

| Token | Light | Role |
|---|---|---|
| `--bg-0` (`--paper`) | `#f6f6f4` | canvas |
| `--bg-1` (`--raised`) | `#fdfdfc` | panels, header, modals |
| `--bg-2` / `--bg-3` / `--bg-4` | `#f0f0ed` / `#e9e9e5` / `#e0e0db` | inset, hover, active |
| `--border-color` / `--bg-5` | `#dcdcd6` / `#d2d2cc` | quiet line / strong line |
| `--fg-0` / `--fg-1` / `--fg-2` | `#1a1a18` / `#3a3a36` / `#5b5b55` | text, secondary, muted (>=4.5:1 on bg-0..3) |
| `--fg-primary` (orange text) | `#9a5200` | AA on canvas and on `--bg-orange` |
| `--fg-success/error/warning/info/secondary` | `#0f6b49 #a7323f #8f4f00 #1d6670 #2b55b8` | tone text, AA on its `--bg-*` tint |
| `--series-1..6` | `#c26a00 #2f63e0 #0a8f64 #c02ac7 #6d55e6 #0e8a96` | chart series, >=3:1 |
| `--brand-safe` | `#0a7a43` (dark: `#12ff80`) | Safe mark |
| `--shadow-float` | `0 1px 2px / 0 6px 16px` at 6-7% ink | popovers only; cards use borders |
