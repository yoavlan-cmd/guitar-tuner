# CLAUDE.md — working rules for Guitaring

The app is called **Guitaring** (not "the tuner": the tuner is one of its features). Use that name in the UI, docs, commits and PRs. The repo is still `guitar-tuner` (it is the live web address), and `tuner.*` storage keys stay as they are (users' saved data).

Read `docs/PRD-Guitaring-V1.md` (§0 and the section for the feature you touch) before changing anything.

## Repo layout
The repo root **is** the GitHub Pages site (served from `main`): `index.html`, `sw.js`, `manifest.webmanifest`, icons, `ideas.json`, `ideas_build.py`.
- `src/guitaring.html` — the single source file (CSS + HTML + JS). **Edit this, never `index.html`.**
- `tools/` — `build.sh`, `release.sh`, `get_test_samples.sh`, `daily-job-prompt.md`.
- `tests/` — Playwright checks (see PRD §11). `docs/` — PRD.

## Workflow
- Build: `bash tools/build.sh` (src/guitaring.html → index.html).
- Release: `bash tools/release.sh` (build + bump `guitaring-vNN` in `sw.js` — required on every `index.html` change, or phones keep the old app).
- Deploy: commit `src/guitaring.html`, `index.html`, `sw.js` together and get it onto `main` (Pages serves `main`).
- Commit `src/guitaring.html` and the built `index.html` in the same commit so they never drift.
- Beta preview: `bash tools/build.sh beta` writes `beta/index.html` (served at …/guitar-tuner/beta/, shares the main app's data, service worker and `ideas.json`; shows a BETA badge). Ship it on its own branch/PR to `main` so the live app is untouched.

## Rules
- Find code by section banners (`/* ===== … ===== */`) and element ids; PRD §9 code map (line numbers are approximate). Make small exact edits.
- Do not rename element ids, `localStorage` keys (`tuner.*`, a prefix kept from the app's first name) or data shapes (PRD §7) — users have data saved under them.
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
