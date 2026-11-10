# Changelog

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
