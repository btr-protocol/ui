# Changelog

## 0.7.0
- CONSUMER ACTION (pin bump): an app whose Tailwind config does not use this preset must add the new layers before bumping, or `z-base` / `z-raised` / `z-overlay` / `z-label` / `z-sticky` / `z-fullscreen` compile to nothing and badges and chart labels lose their layering. Either use the preset's `zIndex`, or `import { zIndexTheme } from '@btr-protocol/ui/tailwind.preset'` and spread it into `theme.extend.zIndex` (and import `tokens.css`, or mirror the `--z-index-*` vars; the footer is 41, not 40). `zIndexScale` in the same file is the raw numbers. Never copy the numbers by hand.
- ONE z-index scale: `base raised overlay label sticky rail header footer fullscreen modal dropdown tooltip toast` as `--z-index-*` (tokens.css), Tailwind `z-*` (preset) and `Z` / `Z_LAYERS` / `ZLayer` (lib/zIndex.ts); a test keeps the three equal and strictly ordered. Every z literal in the kit is gone. Header / nav count badges are `z-raised` (they rendered behind the neighbouring button border); `ChartShell` / `ChartPanel` are `isolate` stacking contexts and the chart legend is `z-label`, so chart labels no longer float over sticky bars while scrolling. Footer is now 41 (was tied with the header at 40); the full-screen chart is `z-fullscreen` (90, was 1000).
- `StateNotice`: the one in-panel error / warning / info / loading / empty block (panel-body side padding, `alert` role on error, optional retry action, `fill` or `inline` layout). `PANEL_BODY` is exported.
- `PriceWithWarning`: a tabular-nums price with a warning icon in a reserved slot pinned to one edge (`anchor`), icon 1.1em, so the icon never shifts as the figure changes width.
- `Badge` variant `label`: no fill, no border, muted text; the single look for a status label beside a toolbar (a dark `bg-bg-0` box is not a variant).
- Copy: no em dashes in the kit. `formatQtyStr` returns `DASH` (`-`) for a non-decimal instead of an em dash. `scripts/check-copy.sh` (`bun run check:copy`, part of `bun run check`) fails on U+2014 in `src`, README and CHANGELOG.

## 0.6.2
- A restore that lost the race to a manual connect ends its session without throwing on a relay error. Documented: one WalletConnect session per origin (other tabs' sessions are ended).

## 0.6.1
- WalletConnect restore re-adopts THIS app's session by its stored topic (`WC_FLAG` = `{topic, chain}`), never the newest session in the client's store; a pre-topic flag restores nothing (reconnect once).
- Binding a different (non-WalletConnect) wallet ends the previous WalletConnect session on the relay: its own `wcDisconnect` (topic-bound), captured synchronously, so a session built since survives. A restore that lost the race to a manual connect ends the restored session; a restore never replaces a live one.
- Connect / restore end every other session in the client store (orphans). Teardown clears `WC_FLAG` only while it still names its own topic (two tabs).

## 0.6.0
- `WalletModal` is the btr.markets connect modal, moved from the front: installed wallets (EIP-6963 + legacy injected, SDK catalog names and rasters), WalletConnect pairing (QR, phone deep links, in-wallet browser rows, last-used / natively detected order). `onConnect(provider, wallet)` replaces `onSelect`; `providers` is gone. WalletConnect is off until the app calls `configureWalletConnect({ projectId, metadata, chains, reader, loadSignClient })`.
- Account safety: `personalSign` re-reads `eth_accounts` and refuses (`WrongAccountError`) unless the wallet's ACTIVE account is the one asked for; `assertActiveAccount` does the same before any other signature. Store: `walletAccounts`, `restoreWallet`, `switchWalletAccount`, `pickWalletAccount`, `accountGate`.
- `WalletButton`'s modal is the kit `ChainSelectModal` (same chain list as every picker) with an accounts section: every exposed account, one click to switch, "In wallet" / "Signed in" / "Signer" badges, and a wrong-account banner ("Switch wallet to …" / "Use … instead"). New props: `activeAddress`, `accounts`, `sessionAddress`, `signers`, `wallet`, `onSwitchAccount`, `onChooseAccount`; `chains` takes `ChainItem[]`.
- `WalletGlyph` takes `id` / `name` / `announcedIcon` (bundled raster, then the announced icon, then the initial); `info` still works.
- `AccountModal` (the modal behind `WalletButton`, usable alone: an app with its own chip lazy-loads `@btr-protocol/ui/wallet/AccountModal`); `configureNotifications({ add })` routes the kit's toasts into a host app's store; subpath exports `./wallet/WalletModal`, `./wallet/AccountModal`, `./lib/notifications`.
- `ConnectModalHost`: mount once, the modal chunk loads on first open (off the entry). The barrel no longer exports `WalletModal` / `AccountModal` (subpaths only); `WalletButton` lazy-loads its modal.
- Breaking: `WalletChain` removed (use `ChainItem`); `WalletButton` / `AccountModal` `labels` = `Partial<AccountLabels>`. `labelsFrom(defaults, t)` + `WALLET_MODAL_LABELS` / `ACCOUNT_LABELS` translate by key.
- `restoreWallet` never binds over a connect that landed while it awaited; a provider `disconnect` logs out only on 4900 / 4901 (else the wallet's accounts are re-read). Account rows: ↑↓ / Home / End, `aria-disabled` while busy.
- QR generator rewritten (versions 1-10, level L, function patterns reserved before the data): the front copy never decoded and refused URIs over 134 bytes, i.e. every WalletConnect v2 URI. The logo overlay is gone. Round-trip test with jsQR (dev dependency).
- Moved from the front: `walletLink` (deep links, `configureWalletLinks` for an app shell's native plugin), `useWalletConnection`, `connectError`, `useInjectedWallets`, the QR generator.

## 0.5.1
- `PageHeader` / `PageShell` `crumbs`: a detail page's parents as links inside the same h1 ("Pending › #12"): list and detail share one header, no "Back to …" link.
- `ProgressSteps` is a readable bar (h-2, 96px, text-sm count): green filled segments, a shimmer sweep (`.progress-pending`) on each missing one; one continuous track beyond 12 steps.
- `KeyValueTable` rows take `continued` (joins the row above without a divider): call arguments sit in the same key column as every other row.

## 0.5.0
- Breaking: `ChainGlyph` has no `shape` prop (chains are always rounded squares); `text-3xs` / `--fs-3xs` removed (use `text-2xs`, now 11px); `font-bold` / `font-light` / `text-lg` / `text-4xl` out of the scale (lib/design.ts `TYPE_SIZES` / `TYPE_WEIGHTS`, linted).
- Added: `SelectionModal` / `MultiSelectModal` `groups` (labelled sections) and `presets` (quick picks), `MultiSelectModal` `triggerContent` / `disabled` / `labels`, `ChainStack`, `StackedIcons` `shape`.
