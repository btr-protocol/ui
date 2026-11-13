#!/usr/bin/env bash
# Fails on an em dash (U+2014), or an escape / entity spelling of it, in kit copy, code, tests, docs and scripts.
# Usage: scripts/check-copy.sh [root]. Scans src test docs scripts and every root *.md (SVG text included). No dependencies.
set -u
root="${1:-$(cd "$(dirname "$0")/.." && pwd)}"
cd "$root" || exit 2
targets=()
for t in src test docs scripts *.md; do [ -e "$t" ] && targets+=("$t"); done
[ ${#targets[@]} -gt 0 ] || { echo "check-copy: nothing to scan in $root" >&2; exit 2; }
# Patterns are assembled from pieces so this file does not match itself.
n=2014
pats=(-e $'\xe2\x80\x94' -e "\\u$n" -e "\\u{$n" -e "0x$n" -e "&md${n:0:0}ash;" -e "&#$n;" -e "&#x$n;")
hits=$(LC_ALL=C grep -rnIiF "${pats[@]}" "${targets[@]}")
rc=$?
if [ "$rc" -gt 1 ]; then echo "check-copy: grep failed (rc=$rc)" >&2; exit 2; fi
if [ -n "$hits" ]; then
  echo "check-copy: em dash (U+$n) or an escape of it found; use ; : - , or reword:" >&2
  echo "$hits" >&2
  exit 1
fi
echo "check-copy: ok"
