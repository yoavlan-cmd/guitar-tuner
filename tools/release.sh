#!/usr/bin/env bash
# Build + bump the service-worker cache version so phones pick up the new app. Usage: bash tools/release.sh
set -euo pipefail
cd "$(dirname "$0")/.."
bash tools/build.sh
cur=$(grep -o "tuner-v[0-9]*" sw.js | head -1); n=${cur#tuner-v}; next="tuner-v$((n+1))"
sed -i.bak "s/$cur/$next/" sw.js && rm -f sw.js.bak
echo "sw.js: $cur -> $next. Commit index.html + sw.js and push to main to deploy."
