# Changelog

## 0.5.0
- Breaking: `ChainGlyph` has no `shape` prop (chains are always rounded squares); `text-3xs` / `--fs-3xs` removed (use `text-2xs`, now 11px); `font-bold` / `font-light` / `text-lg` / `text-4xl` out of the scale (lib/design.ts `TYPE_SIZES` / `TYPE_WEIGHTS`, linted).
- Added: `SelectionModal` / `MultiSelectModal` `groups` (labelled sections) and `presets` (quick picks), `MultiSelectModal` `triggerContent` / `disabled` / `labels`, `ChainStack`, `StackedIcons` `shape`.
