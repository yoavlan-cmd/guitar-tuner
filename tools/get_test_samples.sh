#!/usr/bin/env bash
# Real guitar recordings used by the tuner tests (tonejs-instruments by Nicholaus Brosowsky, CC-BY 3.0).
set -euo pipefail
cd "$(dirname "$0")/../tests" && mkdir -p samples && cd samples
for f in guitar-acoustic/A2 guitar-acoustic/E2 guitar-acoustic/D3 guitar-acoustic/E4 guitar-electric/A2 guitar-electric/E2 guitar-nylon/A2 guitar-nylon/E4; do
  curl -sSfL -o "$(echo $f|tr / _).mp3" "https://raw.githubusercontent.com/nbrosowsky/tonejs-instruments/master/samples/$f.mp3" && echo "ok $f"; sleep 1; done
