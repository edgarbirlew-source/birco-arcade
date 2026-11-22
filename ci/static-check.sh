#!/usr/bin/env bash
# CI-06 static checks for birco-arcade (no browser, no builds, no uploads).
# Prints PASS/FAIL per file; exit 1 if any FAIL. Port of cash-diamond _src/static-check.sh (CI-05).
# Checks: node --check on every tracked .js/.mjs (vendored/minified and native build dirs skipped),
# and a syntax check of every inline <script> in every tracked .html.
# Does NOT replace the Playwright / test-monetize suites.
# Usage (from repo root): bash ci/static-check.sh
cd "$(dirname "$0")/.." || exit 2
fail=0; n=0; tmp=$(mktemp -d)
ok(){ echo "PASS $1"; n=$((n+1)); }; bad(){ echo "FAIL $1"; fail=1; n=$((n+1)); }
skip='(^|/)(node_modules|android|ios|Pods|dist|www|build|lib)/|\.min\.js$'
files=$(git ls-files 2>/dev/null || find . -type f | sed 's|^\./||')
for f in $(echo "$files" | grep -E '\.(js|mjs)$' | grep -Ev "$skip"); do
  if node --check "$f" 2>"$tmp/err"; then ok "node --check $f"; else bad "node --check $f: $(head -3 "$tmp/err" | tr '\n' ' ')"; fi
done
i=0
for h in $(echo "$files" | grep -E '\.html$' | grep -Ev "$skip"); do
  i=$((i+1)); d="$tmp/h$i"; mkdir -p "$d"
  python3 - "$h" "$d" <<'PY'
import re,sys,pathlib
src=pathlib.Path(sys.argv[1]).read_text(errors='replace')
for i,m in enumerate(re.finditer(r'<script(?![^>]*\bsrc=)([^>]*)>(.*?)</script>',src,re.S)):
  a=m.group(1).lower()
  if 'json' in a or 'importmap' in a or 'text/template' in a: continue
  ext='.mjs' if 'module' in a else '.js'
  pathlib.Path(sys.argv[2],f"s{i}{ext}").write_text(m.group(2))
PY
  for s in "$d"/s*; do [ -f "$s" ] || continue
    if node --check "$s" 2>"$tmp/err"; then ok "inline $(basename "$s") ($h)"; else bad "inline $(basename "$s") ($h): $(head -3 "$tmp/err" | tr '\n' ' ')"; fi
  done
done
rm -rf "$tmp"
[ $fail = 0 ] && echo "ALL STATIC CHECKS PASS ($n)" || echo "STATIC CHECKS FAILED ($n checked)"; exit $fail
