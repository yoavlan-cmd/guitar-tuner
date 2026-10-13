#!/usr/bin/env bash
# Builds index.html (repo root = GitHub Pages site) from src/guitaring.html. Run from anywhere: bash tools/build.sh
# bash tools/build.sh beta  -> beta/index.html: a preview copy served at …/guitar-tuner/beta/ (same data, BETA badge).
set -euo pipefail
cd "$(dirname "$0")/.."
out=index.html; extra=''; badge=''
if [ "${1:-}" = beta ]; then
  mkdir -p beta; out=beta/index.html
  extra='<base href="../">\n'   # manifest, icons, sw.js and ideas.json resolve to the main app's files
  badge='<div style="position:fixed;top:calc(8px + env(safe-area-inset-top,0px));right:10px;z-index:200;background:#FF6A1A;color:#fff;font:700 11px/1 system-ui,sans-serif;letter-spacing:.08em;padding:5px 8px;border-radius:999px;pointer-events:none">BETA</div><script>document.title="Guitaring beta"</script>\n'
fi
{ printf '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'"$extra"'<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n<meta name="theme-color" content="#15100E">\n<link rel="manifest" href="manifest.webmanifest">\n<link rel="icon" type="image/png" href="icon-192.png">\n<link rel="apple-touch-icon" href="apple-touch-icon.png">\n<meta name="mobile-web-app-capable" content="yes">\n<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0}*{box-sizing:border-box}[hidden]{display:none!important}</style>\n</head>\n<body>\n'
  cat src/guitaring.html
  printf '\n%b<script>if("serviceWorker" in navigator){const hadSW=!!navigator.serviceWorker.controller;let reloaded=false;navigator.serviceWorker.addEventListener("controllerchange",()=>{if(reloaded||!hadSW)return;reloaded=true;location.reload()});addEventListener("load",()=>{navigator.serviceWorker.register("sw.js",{updateViaCache:"none"}).then(r=>r.update()).catch(()=>{})})}</script>\n</body>\n</html>\n' "$badge"
} > "$out"
echo "built $out ($(wc -c < "$out") bytes)"
