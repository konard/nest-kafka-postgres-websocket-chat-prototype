#!/usr/bin/env bash
set -euo pipefail

root="${1:-researches/genres}"
out_ok="${2:-logs.linkcheck.out}"
out_err="${3:-logs.linkcheck.err}"

> "$out_ok"
> "$out_err"

links=$(rg -No --no-filename "https?://[^)\]\s>]+" "$root" | sort -u)
echo "Found links:" >> "$out_ok"
echo "$links" >> "$out_ok"

echo "" >> "$out_ok"
echo "Checking..." >> "$out_ok"

ok=0
bad=0

while IFS= read -r url; do
  [ -z "$url" ] && continue
  code=$(curl -sS -o /dev/null -L -w "%{http_code}" --max-time 15 "$url" || echo "000")
  line="$code $url"
  if [[ "$code" =~ ^2|3 ]]; then
    echo "$line" >> "$out_ok"
    ok=$((ok+1))
  else
    echo "$line" >> "$out_err"
    bad=$((bad+1))
  fi
done <<< "$links"

echo "" >> "$out_ok"
echo "OK: $ok, BAD: $bad" >> "$out_ok"
exit 0
