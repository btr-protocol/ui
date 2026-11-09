# Changelog

## 0.5.1
- `PageHeader` / `PageShell` `crumbs`: a detail page's parents as links inside the same h1 ("Pending › #12"): list and detail share one header, no "Back to …" link.
- `ProgressSteps` is a readable bar (h-2, 96px, text-sm count): green filled segments, a shimmer sweep (`.progress-pending`) on each missing one; one continuous track beyond 12 steps.
- `KeyValueTable` rows take `continued` (joins the row above without a divider): call arguments sit in the same key column as every other row.

## 0.5.0
- Breaking: `ChainGlyph` has no `shape` prop (chains are always rounded squares); `text-3xs` / `--fs-3xs` removed (use `text-2xs`, now 11px); `font-bold` / `font-light` / `text-lg` / `text-4xl` out of the scale (lib/design.ts `TYPE_SIZES` / `TYPE_WEIGHTS`, linted).
- Added: `SelectionModal` / `MultiSelectModal` `groups` (labelled sections) and `presets` (quick picks), `MultiSelectModal` `triggerContent` / `disabled` / `labels`, `ChainStack`, `StackedIcons` `shape`.
