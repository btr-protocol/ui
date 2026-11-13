#!/usr/bin/env bash
# Fails on an em dash (U+2014) in kit copy, code and docs. Usage: scripts/check-copy.sh [root]
# Scans <root>/src, README.md, CHANGELOG.md (root defaults to the repo). No dependencies.
set -u
root="${1:-$(cd "$(dirname "$0")/.." && pwd)}"
cd "$root" || exit 2
targets=()
for t in src README.md CHANGELOG.md; do [ -e "$t" ] && targets+=("$t"); done
[ ${#targets[@]} -gt 0 ] || { echo "check-copy: nothing to scan in $root" >&2; exit 2; }
hits=$(LC_ALL=C grep -rnI --exclude='*.svg' --exclude='*.webp' --exclude='*.woff2' -e $'\xe2\x80\x94' "${targets[@]}")
rc=$?
[ "$rc" -gt 1 ] && { echo "check-copy: grep failed (rc=$rc)" >&2; exit 2; }
if [ -n "$hits" ]; then
  echo "check-copy: em dash (U+2014) found; use ; : - , or reword:" >&2
  echo "$hits" >&2
  exit 1
fi
echo "check-copy: ok"
