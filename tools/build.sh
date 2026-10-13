#!/usr/bin/env bash
# Builds index.html (repo root = GitHub Pages site) from src/tuner.html. Run from anywhere: bash tools/build.sh
set -euo pipefail
cd "$(dirname "$0")/.."
{ printf '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n<meta name="theme-color" content="#15100E">\n<link rel="manifest" href="manifest.webmanifest">\n<link rel="icon" type="image/png" href="icon-192.png">\n<link rel="apple-touch-icon" href="apple-touch-icon.png">\n<meta name="mobile-web-app-capable" content="yes">\n<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0}*{box-sizing:border-box}[hidden]{display:none!important}</style>\n</head>\n<body>\n'
  cat src/tuner.html
  printf '\n<script>if("serviceWorker" in navigator){const hadSW=!!navigator.serviceWorker.controller;let reloaded=false;navigator.serviceWorker.addEventListener("controllerchange",()=>{if(reloaded||!hadSW)return;reloaded=true;location.reload()});addEventListener("load",()=>{navigator.serviceWorker.register("sw.js",{updateViaCache:"none"}).then(r=>r.update()).catch(()=>{})})}</script>\n</body>\n</html>\n'
} > index.html
echo "built index.html ($(wc -c < index.html) bytes)"
