# CLAUDE.md — working rules for Guitaring

The app is called **Guitaring** (not "the tuner": the tuner is one of its features). Use that name in the UI, docs, commits and PRs. The repo is still `guitar-tuner` (it is the live web address), and `tuner.*` storage keys stay as they are (users' saved data).

Read `docs/PRD-Guitaring-V1.md` (§0 and the section for the feature you touch) before changing anything.

## Repo layout
The repo root **is** the GitHub Pages site (served from `main`): `index.html`, `sw.js`, `manifest.webmanifest`, icons, `ideas.json`, `ideas_build.py`.
- `src/parts/NN-name.html` — the source, split into parts by feature (CSS, markup, then one app script that opens in `20-core-tuner` and closes in `99-startup`). The build joins them in name order into one `index.html`. **Edit the parts, never `index.html`.** A new part gets a number between its neighbours.
- `tools/` — `build.sh`, `release.sh`, `get_test_samples.sh`, `daily-job-prompt.md`.
- `tests/` — Playwright checks (see PRD §11). `docs/` — PRD, V2 build plan and V2 deployment plan (follow them for V2 work).

## Workflow
- Build: `bash tools/build.sh` (src/parts/*.html → index.html; `OUT=path` writes elsewhere).
- Release: `bash tools/release.sh` (build + bump `guitaring-vNN` in `sw.js` — required on every `index.html` change, or phones keep the old app).
- Deploy (live release): commit `src/parts/`, `index.html`, `sw.js` together and get it onto `main` (Pages serves `main`). `LIVE=1 node tests/split_t.js` proves `index.html` is a fresh build.
- Before a live release, keep the current live version as a branch `live-vNNN` (rollback point).
- Beta: `bash tools/build.sh beta` writes `beta/index.html` (served at …/guitar-tuner/beta/, BETA badge, installs as its own "Guitaring beta" icon via `beta/manifest.webmanifest`). The beta keeps **its own data**: `tunerb.*` / `guitaringb.*` keys and the database `guitaring-beta`, copied from the live data on its first open; big items are read from the live database when needed and copied; it never writes the live app's data. In code always use `KP` / `KG` / `IDBN` (never a literal `'tuner.'`, `'guitaring.'` or `'guitaring'` database name). Beta PRs touch `src/`, `beta/`, `tests/`, `docs/` only; the live `index.html` and `sw.js` change only in a release PR.

## Rules
- V2 navigation: open sections with `goSec('home'|'learn'|'write'|'jam'|'gear'|'tuner'|'library'|'profile'|'chords')` (`90-v2-shell`). V1 `setTab` still works. Overlays need z-index ≥ 50 (the bottom bar is 30). Anything a V1 screen shows from another page must make its pane visible itself.
- The player's profile (`profGet()`) is the only source of anything personal (taste, level, languages, instruments); never hard-code one player's taste or data.
- Find code by section banners (`/* ===== … ===== */`) and element ids; PRD §9 code map (line numbers are approximate). Make small exact edits.
- Do not rename element ids, `localStorage` keys (`tuner.*`, a prefix kept from the app's first name) or data shapes (PRD §7) — users have data saved under them. V2 only adds new keys (see `docs/V2-deployment-plan.md` §4).
- Backup and restore (`85-backup`) must cover every new kind of data: small data under `KP`/`KG`, big data in the phone database (`mxPut`/`mxGet`).
- Claude calls go through `sampleFn` only (works both with the phone API key and inside a Claude artifact).
- UI: phone-first (test 390 px and 360 px wide), minimal, secondary sections collapsed until opened, plain language, `dir="auto"` for user text (Hebrew), chord names LTR.
- Tuner changes: run the whole tuner suite in `tests/` (`tun_*.js`, `tun_auto.js`) — audio regressions are silent.
- Before re-adding a removed feature, read PRD §13: "song video from a link" was tested and removed until a better (fully automatic, permitted) solution exists; lyrics are not sent to Claude (it declines).
- Commit messages: short imperative summary; keep `ideas.json` commits separate (the daily job owns that file and `ideas_build.py` at the root).

## Testing
```bash
cd tests && npm i && bash ../tools/get_test_samples.sh
CHROMIUM=/opt/pw-browsers/chromium node tun_ui.js     # CHROMIUM optional; use it in Claude Code cloud sessions
```
`tun_auto.js` runs all scenarios in parallel; on a small machine CPU load can cause false results — re-run failing scenarios by name (`node tun_auto.js sixQuick,strum`).
