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
  case "$code" in
    2*|3*)
      echo "$line" >> "$out_ok"
      ok=$((ok+1))
      ;;
    *)
      echo "$line" >> "$out_err"
      bad=$((bad+1))
      ;;
  esac
done <<< "$links"

echo "" >> "$out_ok"
echo "OK: $ok, BAD: $bad" >> "$out_ok"
exit 0
