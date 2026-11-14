#!/usr/bin/env bash
# Fails on an em dash (U+2014), an escape / entity spelling of it, or a spaced en dash (U+2013) in kit copy, code, tests, docs and scripts.
# Usage: scripts/check-copy.sh [root] | scripts/check-copy.sh --self-test
# Scans src test docs scripts and every root *.md *.html *.json (SVG text included). No dependencies.
set -u
self="$(cd "$(dirname "$0")" && pwd)/$(basename "$0")"
if [ "${1:-}" = "--self-test" ]; then
  tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
  n=2014; d=8212; fail=0
  # label|content|expect (1 = flagged, 0 = clean)
  cases=(
    "raw|a $(printf '\xe2\x80\x94') b|1"
    "u-esc|x = \"\\u$n\"|1"
    "u-brace|\"\\u{$n}\"|1"
    "U-esc|\"\\U0000$n\"|1"
    "x-brace|\"\\x{$n}\"|1"
    "css|content: \"\\$n\";|1"
    "css-pad|content: \"\\00$n\";|1"
    "mdash|a &md${n:0:0}ash; b|1"
    "dec|a &#$d; b|1"
    "hex-ent|a &#x$n; b|1"
    "hex-lit|const c = 0x$n;|1"
    "spaced-en|a $(printf '\xe2\x80\x93') b|1"
    "dec-$n-ok|a &#$n; b|0"
    "addr-ok|0x${n}abcdef0123|0"
    "addr-pre-ok|0x0x${n}|0"
    "css-longer-ok|\"\\${n}1\"|0"
    "range-ok|1$(printf '\xe2\x80\x93')2|0"
  )
  for c in "${cases[@]}"; do
    label="${c%%|*}"; rest="${c#*|}"; content="${rest%|*}"; want="${rest##*|}"
    for f in src/a.ts a.html a.json README.md; do
      d="$tmp/$label"; mkdir -p "$d/src"; printf '%s\n' "$content" > "$d/$f"
      "$self" "$d" >/dev/null 2>&1; got=$?
      [ "$got" -gt 1 ] && got=9
      if [ "$got" != "$want" ]; then echo "check-copy self-test: $label in $f: want $want got $got" >&2; fail=1; fi
      rm -f "$d/$f"
    done
  done
  [ "$fail" = 0 ] && echo "check-copy: self-test ok"
  exit "$fail"
fi
root="${1:-$(cd "$(dirname "$0")/.." && pwd)}"
cd "$root" || exit 2
targets=()
for t in src test docs scripts *.md *.html *.json; do [ -e "$t" ] && targets+=("$t"); done
[ ${#targets[@]} -gt 0 ] || { echo "check-copy: nothing to scan in $root" >&2; exit 2; }
# Patterns are assembled from pieces so this file does not match itself.
n=2014
d=8212
nb='[^0-9A-Za-z_]'
pats=(
  -e $'\xe2\x80\x94'
  -e "\\\\u$n" -e "\\\\u\\{$n" -e "\\\\U0000$n" -e "\\\\x\\{$n"
  -e "\\\\0*$n([^0-9a-f]|\$)"
  -e "(^|$nb)0x$n($nb|\$)"
  -e "&md${n:0:0}ash;" -e "&#0*$d;" -e "&#x0*$n;"
  -e $' \xe2\x80\x93 '
)
hits=$(LC_ALL=C grep -rnIiE "${pats[@]}" "${targets[@]}")
rc=$?
if [ "$rc" -gt 1 ]; then echo "check-copy: grep failed (rc=$rc)" >&2; exit 2; fi
if [ -n "$hits" ]; then
  echo "check-copy: em dash (U+$n), an escape of it, or a spaced en dash found; use ; : - , or reword:" >&2
  echo "$hits" >&2
  exit 1
fi
echo "check-copy: ok"
