# PRD — Guitaring V1

> **Status:** V1 shipped (PRD written at `tuner-v86`; live build `tuner-v92`, 13 Oct 2026 — see §5.13) · **Owner:** Yoav · **Live app:** https://yoavlan-cmd.github.io/guitar-tuner/ · **Repo:** `yoavlan-cmd/guitar-tuner` (public, GitHub Pages)
>
> This document describes what Guitaring V1 is, how it is built, and how to keep building it. Since 13 Oct 2026 the app is developed with Claude Code directly in the repo. **Agents: read §0 first.**

---

## 0. Instructions for the agent

1. **The whole app is one page built from `src/parts/*.html`** (~5,600 lines in 17 parts by feature: CSS, markup, one app `<script>` that opens in `20-core-tuner` and closes in `99-startup`; split in V2 phase 0). There is no framework, bundler or npm runtime dependency. `tools/build.sh` wraps it into `index.html` at the repo root (adds `<head>`, manifest link, service-worker registration).
2. **Never edit `index.html` by hand.** Edit the parts in `src/parts/`, then run `bash tools/build.sh`. For a release run `bash tools/release.sh` (build + bump the cache version in `sw.js`). Phones only pick up a new version when `sw.js` changes.
3. **The repo root is the GitHub Pages site** (`index.html`, `sw.js`, `manifest.webmanifest`, icons, `ideas.json`, `ideas_build.py` for the daily job). Deploy = commit `src/parts/` + `index.html` + `sw.js` and get them onto `main`.
4. **Edit surgically.** The file is long and dense (many one-line functions). Find code by the section banners listed in §9 (`/* ===== … ===== */`) and by element `id`s. Prefer small, exact replacements over rewrites. Keep existing ids, `localStorage` keys and data shapes stable — users have data saved under them (§7).
5. **The app is called Guitaring** (renamed from "the tuner" in Oct 2026 — the tuner is now one of its features). Use that name everywhere a person reads it. Kept on purpose: the repo `guitar-tuner` (it is the live web address and the installed app's address), the `tuner.*` storage keys (users' data), `window.__tunerTest` and the `tun_*` tests (they test the tuner feature).
6. **Test with Playwright before shipping** (`tests/`, see §11). Every change to the tuner must re-run the tuner suite; audio behaviour is easy to break silently.
7. **Product rules that override "nice to have"** (§2): phone-first, clean and minimal UI (sections collapsed until opened), everything works without an account, nothing personal leaves the phone unless the user asks.
8. **Check §13 before re-adding anything listed there.** Getting a song video from a link was tested and removed until a better solution exists; lyrics are not sent to Claude because Claude declines to transcribe them.

---

## 1. Product summary

**Guitaring** is a phone-first guitar companion web app (installable PWA) for an intermediate player who learns Hebrew and English songs. It combines:

| Area | What it does |
|---|---|
| **Tuner** | Microphone tuner with a hardware-style meter, headstock pegs, 12 tunings, auto string detection, lock-to-string, reference tone, auto-stop. |
| **Songs** | Analyse a song video/audio on the phone → chords, tuning, capo, timeline, lesson view, chord sheet (PDF / Google Drive). Write chord sheets by hand, or from screenshots/PDFs (on-device OCR). Searchable catalog of sheets. Saved video-lesson links matched to sheets. Daily song suggestions. |
| **Chords** | Personal chord book (auto-filled from songs), voicings for any chord, and a visual **chord finder** (place fingers on a fretboard → chord name). |
| **My gear** | The user's guitars and amps with specs (filled from a photo by Claude), care/maintenance advice, controls diagram, and a gear chat with Claude. |
| **Welcome** | Greets the user by name with a rotating sarcastic/humorous practice nudge (new jokes added every 2 days by the daily job). |

### Primary user
Yoav — Israeli PM, plays electric and acoustic guitar, uses **only the phone app** (Android, Samsung; installed from GitHub Pages). Songs and sheets live in his Google Drive songs folder (one sub-folder per artist). The app is designed so other people can use it too (each with their own name, Drive and Claude key).

---

## 2. Product principles (non-negotiable)

1. **Phone first.** Everything must work and fit on a ~390×844 CSS-px Android screen, one-handed. Test at 360 px width too.
2. **Clean and minimal.** Many features exist; secondary sections (`<details>`: song ideas, video lessons, chord sheets catalog, saved songs, settings) are **collapsed until the user opens them**. Song ideas re-collapse every time the Songs tab is opened. My gear sections collapse on every visit.
3. **Private by default.** Audio analysis, OCR and the tuner run on the phone. Nothing is uploaded unless the user explicitly sends something to Claude or Drive.
4. **Works without Claude.** Claude features are optional enhancements (turned on with the user's own API key in the phone app, or automatically when running inside Claude as an artifact).
5. **Plain language UI.** Short sentences, no jargon; every state explains what to do next ("Tap Listen to start", "Pluck one string").
6. **Hebrew + English.** Lyrics, titles and artists are often Hebrew → use `dir="auto"` on user text, keep chord names LTR (`dir="ltr"`), handle RTL lines in sheets.
7. **No duplicates.** Chord book, video links, song suggestions and sheets are de-duplicated (canonical keys, see §7).

---

## 3. Platform & architecture

```
src/parts/*.html ──(tools/build.sh)──► index.html ───────┐
sw.js  (offline cache, version guitaring-vNN)         │  GitHub Pages: yoavlan-cmd.github.io/guitar-tuner/
manifest.webmanifest (PWA + Android share target)     ├─► installed on the phone as "Guitaring"
ideas.json  ◄── written daily by a scheduled ────┘
                    Claude job (tools/daily-job-prompt.md + tools/ideas_build.py)
```

### 3.1 Two runtimes, one file
The same page runs in two places; code branches on `window.claude`:

| | **Phone app (GitHub Pages PWA)** — primary | **Claude artifact** (claude.ai, private) |
|---|---|---|
| Claude features | User pastes own Anthropic API key (Songs › Claude features); calls `https://api.anthropic.com/v1/messages` directly with `anthropic-dangerous-direct-browser-access` (`apiCall`, `makeApiSample`). | `window.claude.use('sample')` (no key). |
| Google Drive | Share sheet (`navigator.share` with the PDF) → user picks Drive. Own OAuth (`GDRIVE_CLIENT_ID`) is wired but **empty** (off). | `window.claude.use('mcp')` Drive connector + `downloads` capability. |
| Daily ideas | Fetches `ideas.json` next to `index.html` (bypasses the SW cache). | Generates ideas itself via Claude once a day (`ideaAuto`). |

Both paths expose one internal interface: `sampleFn(prompt, opts)` / `sampleFn.json(...)` (`claudeOn(fn,limit)` / `claudeOff()`). New Claude features must go through `sampleFn`, never call the API directly.

### 3.2 Service worker (`sw.js`)
- Cache name `guitaring-vNN` (`tuner-vNN` up to v105) — **bump on every release** (release.sh does it).
- Navigations: network-first with `cache:'no-cache'`, fall back to cached `index.html` offline.
- Same-origin files + CDN libraries/fonts: cache-first with background refresh.
- `ideas.json` is never cached (always network).
- The page reloads once when a new SW takes control.

### 3.3 External libraries (lazy-loaded from CDNs, only when the feature is used)
| Library | URL | Used for |
|---|---|---|
| TensorFlow.js 3.21.0 + Spotify Basic Pitch 1.0.1 model | cdn.jsdelivr.net | "Detailed listening": note transcription for song analysis |
| Tesseract.js 7.0.0 (heb+eng) | cdn.jsdelivr.net | OCR of chord-sheet screenshots |
| pdf.js 3.11.174 | cdnjs | Text of chord-sheet PDFs |
| jsPDF 2.5.1 + html2canvas 1.4.1 | cdnjs | Making the chord-sheet PDF |
| Google Fonts | fonts.googleapis.com | UI fonts |
| YouTube oEmbed / noembed.com | — | Video-lesson titles/thumbnails (best effort) |
| Google Identity (gsi) | accounts.google.com | Own-Drive OAuth (inactive while client id is empty) |

### 3.4 Storage
All user data is in `localStorage` under the prefix `tuner.` through the `store.get/set` helper (JSON). Song analyses also use `tuner.song.<fileKey>` (last 8). See §7.

### 3.5 Beta and backup (V2 phase 0)
- **Beta** at `…/guitar-tuner/beta/` (`bash tools/build.sh beta`): BETA badge, installs as its own "Guitaring beta" icon (`beta/manifest.webmanifest`). It keeps its own data: `tunerb.*` / `guitaringb.*` keys and the database `guitaring-beta`. On its first open it copies the live `tuner.*` / `guitaring.*` keys (`betaCopyLive`); big items (Band breakdown parts, gear photos) are read from the live database the first time they are needed and copied (`mxGet` → `idbLiveGet`, which never creates or writes the live database); deleting in the beta leaves a `{__gone:1}` mark so it isn't read again. "Copy my live data again" (Backup box, two taps) starts the beta over. Code must use `KP`, `KG`, `IDBN` for storage names. Test: `tests/beta_t.js`.
- **Backup and restore** (Songs › My library › "Backup and restore"; moves to My profile in V2 phase 1): one ZIP file (stored, readable by any ZIP tool): `manifest.json` (counts, options), `local.json` (all `KP`/`KG` keys), `idb/N.json` + `idb/N-i.bin` per database item (Blobs, Files and typed arrays kept exactly). Options: Band breakdown songs (default in; without them the list keeps only songs still splitting) and the Claude/GitHub keys (default out). Saved to Downloads, with Share when the phone allows. Restore checks every part's checksum first (damaged, cut-short and foreign files are refused before anything changes), shows what the file holds, then **Add what's missing** (default: lists gain missing items by id, objects gain missing entries, nothing is overwritten) or **Replace everything** (two taps; replaces only the kinds the file has). A safety copy of the small data (`backup:pre-restore:*`, 30 days) is kept first. **Back up to Google Drive** (when `GDRIVE_CLIENT_ID` is set): one tap signs in with Google (scope `drive.file`: the app sees only files it made), builds the backup, makes/uses a **Guitaring backups** folder (`gd.bkdir`), uploads with Drive's resumable upload in 8 MB pieces (a failed piece is checked and resent, 3 tries), trashes all but the newest 5 backups there, and confirms with a green toast and a phone notification (`bkNotify`, permission asked on the first tap); failures are red + a notification. "Save the backup file on this phone instead" stays. Saving sheets straight to Drive is a separate opt-in (`gd.sheets`), so sheets keep using the share menu. Test: `tests/bkdrive_t.js` (Google mocked). A backup made in the beta also includes the live items it hasn't read yet (`idbLiveKeys`), so it is complete. A beta backup restores into the live app and the other way round. Test: `tests/bk_t.js`.

---

## 4. Navigation & screens

**V2 (phase 1, `90-v2-shell`)** — the app opens on **Home**; sections are opened with `goSec(s)`:
- **Header** (every screen): logo + three word buttons — **Tuner** (`#hTuner`), **My Library** (`#hLib`), **My profile** (`#hMe`). These open *pages* that close with ✕ / ‹ (`[data-back]`) or the phone's back button (`history.state.gpage`); the page you came from is kept (`secBack`).
- **Bottom bar** `#bnav` (z-index 30, under every overlay): **Home · Learn · Write · Jam · Gear**. Learn and Write are the V1 Songs pane (`#paneSong[data-seg=learn|write]`, heading `#songSech`); Gear is the V1 gear pane; Home `#paneHome`, Jam `#paneJam`, My Library `#paneLib`, My profile `#paneProfile` are new panes. The tuner (`#paneTune`) and the chord book (`#paneChords`, "My chords" from My Library) are pages.
- V1 code that calls `setTab('song'|'gear'|'tune'|'chords')` still works: `setTab` hides the V2 panes and `v2After` marks the right section. Song views opened from another page (`showSheet`, `showSong`, `showReady`, `runAnalysis`, `openWriter`) switch to the Songs pane themselves.
- **Where V1 things went:** Song video tile → Learn (the **chord finder** tile `#findNew` shows in Learn and in Write); I'm learning + New songs to learn → Learn; Write a sheet, Screenshots/PDF, draft card, **chord finder tile** (`#findNew`) → Write; Practice mixer → Jam as **Band breakdown** (`#mixNew`, moved at start) + **Jamming player** (`#jamOpen`) + a list of jam tracks; sheet catalog, video lessons, saved on phone → My Library (moved at start); Claude features, Songs folder link, **GitHub for Band breakdown** (`#ghCfg`), Backup → My profile. The old tab bar `#tabs` and the Songs switch `#songSeg` are gone/hidden. `tests/nav_t.js` checks every V1 feature is reachable.
- **Home**: greeting by the profile's name, a joke (`#hJoke`, "Another one ↻" `#hMore`), **Continue** cards (unfinished sheet, last jam, "Finish setting up Guitaring" while onboarding isn't done), four tiles (Learn, Write, Jam, Check my gear). **Home fits one screen, no scrolling** (`body[data-cursec=home]`): the joke is clamped (4 lines, fewer on short screens), short screens keep one Continue card, "Back to your jam" hides while the player bar shows, and the four tiles share the rest of the height. The welcome overlay `#welcome` is no longer shown.
  - **Look (Oct 2026 redesign):** the joke is said by Guitaring's pick: the app icon (tilted, `.hjpick`) with a cream speech bubble (`.hjbub`, its tail pointing at the pick), the greeting above it in the display font ("HEY, YOAV.", orange), "Another one ↻" as a small orange pill (the bubble pops when the joke changes), on a dark card with a low flame glow along its bottom. The four tiles' titles line up: Learn, Write and Jam are about twice as big (as tall as the two lines of "Check my gear"), capped to the tile's width (`33cqi`), and only once the narrow display font has loaded (`html.fdisp`; a wider fallback keeps the normal size).
- **Onboarding** `#onb` (full screen, z 65): Welcome + privacy · About you · Your playing · Quick check · Your instruments · Music you love · Your goals · How you learn · Summary ("Here's what Guitaring will do for you"). Progress bar; every screen has Skip; **Finish later** (`#wSkip`) any time (then a Home card); big chips, typing only for names and favourites. Opens on the first start when the profile isn't done. Existing players: the profile is prefilled (M1) and only the screens with gaps are shown. My profile › "Change my answers" opens all screens with the answers in.
- **Open lists can always be closed** (`v2Fold`): every list box in My Library, Jam and My profile (`catBox`, `vidBox`, `libSaved`, `jamBox`, the profile boxes) keeps its title at the top with a ✕ while open, and has **Close ✕** at the bottom. The jam tracks in Jam are a list box (`#jamBox`), closed until opened (user feedback, beta of phase 1).
- A link shared into the app (Share › Guitaring) opens **My Library** with the video-lesson form; the setup doesn't open over it (`window.__shared`) and waits for the next open.
- **My profile**: the answers, "Change my answers", Connections, Backup, and "The update to the new Guitaring" (what M1 did + **Undo the new version's data**, two taps: removes only `profile`, `songs2` and `v2mig`).

**V1 (before phase 1):**

Tabs (`#tabs`, `setTab(t)`): **Tuner** (`#paneTune`) · **Songs** (`#paneSong`) · **Chords** (`#paneChords`) · **My gear** (`#paneGear`). Last tab is remembered (`tab`).

- **Welcome overlay** (`#welcome`) on every app open: asks the first name once, then "Hey, {name}." + a joke + quick buttons + Skip. Button hierarchy: **Tune up** (primary, filled cream) › **Learn a song** (filled dark) › Write a song / My gear (outline row). "Write a song" opens Songs home with all creation options visible.
- **Songs tab always opens on Songs home** (`songsHome()`), not on a sub-view. Since the UI redesign (branch `ui-redesign`) Songs home has a two-part switch `#songSeg`: **My library** (default; `#libCard`) and **＋ Add a song** (`#addGrid`: 2×2 tiles Song video / Screenshots or PDF / Write a sheet / Practice mixer). Welcome › Learn a song / Write a song open Add; the share target opens My library (`setSongSeg`). If a sheet/analysis was open, a "Resume" card (`#resumeCard`) offers to go back.
- **Chord finder overlay** (`#cfWrap`) opens from the chord picker (writer) and from the Chords tab.

---

## 5. Feature specifications (as built)

Each feature lists behaviour, key code, and acceptance criteria (AC). AC are what tests in `tests/` check.

### 5.1 Tuner (`#paneTune`; JS from `/* gauge */` ≈ line 1080 to `stopListening` ≈ line 1393)

**UI (hardware style, dark brushed metal in both light and dark themes):**
- Meter card `#screen`: `AUTO` pill (`#modeChip`, shows "String N · X ✕" when locked) top-left; ♭/♯ indicators (`#flatInd`/`#sharpInd`) top-right light amber/blue; semicircular gauge with gradient track amber `#FFB74D` → mint `#66BB6A` → blue `#4FC3F7`; tapered needle with spring physics (`needleStep`, critically damped, respects `prefers-reduced-motion`); jewel pivot; big note (`#note`, e.g. E₂); uppercase status (`#status`); live badge; lock ✓ badge + vibration when in tune.
- **Gauge scale is non-linear** (`centsAng`): ±15¢ fills 60% of the arc (fine tuning), 15–50¢ compressed into the ends. Ticks every 1¢ to ±15, labels −15/+15/−50/+50.
- Headstock card `#strings`: 3+3 metal peg buttons (`.peg`, `data-i` = string index 0 = low string) — top row G³ B² E¹, bottom row D⁴ A⁵ E⁶ (superscript = string number); **labels follow the selected tuning** (Drop D shows D⁶). Active peg: mint border `#66BB6A`, background `#243026`, glow; turns amber/blue when flat/sharp with "↻ tighten / ↺ loosen" hint; ✓ badge when that string was tuned. Strings drawn from pegs to the nut.
- Tuning chips `#tunings` (12 tunings, `TUNINGS`): Standard, Drop D, Half step down, D Standard, Drop C♯, Drop C, Drop B, DADGAD, Open D, Open G, Open E, Open C.
- Guitar line `#gtrLine` / picker: choose which of the user's guitars is being tuned (from My gear); selecting a guitar with a saved tuning switches to it; when all 6 strings are done, the guitar's `tuning` and `lastTuned` are saved.
- Settings (`#tuneSettings`, collapsed): guitar, noise filter (Normal / Strong (default) / Noisy room → `NF`), reference pitch A4 430–450 (`setA4`), Repeat tone (plays the target note; electric gets a light overdrive).
- Tap a peg = lock to that string (and play nothing); tap again or the pill = back to Auto.

**Pitch engine (`loop()` per animation frame):**
- Mic via `getUserMedia({echoCancellation:false,noiseSuppression:false,autoGainControl:false})` → highpass 55 Hz ×2 → lowpass 1100 Hz ×2 → `AnalyserNode` fftSize 4096.
- `detect()` = McLeod-style NSDF on a 2× decimated buffer, first peak ≥ 0.9 × max, parabolic interpolation. Search range: auto = all strings ×0.75…×1.34; locked = that string ×0.75…×1.34.
- **Noise floor** (`floor`) learned only from unclear frames **and not within 1.8 s of a pluck**, rising slowly — otherwise continuous playing teaches the tuner that the guitar is "background" (bug fixed in v85). Gate = `max(.002, floor × NF.gate)`.
- `clear` reading = clarity ≥ NF.clar and (rms ≥ gate, or clarity ≥ .95 and rms ≥ 35% of gate) — so a soft but very clean high E still counts.
- Pick attack skipped (110 ms after an onset). History of the last 300 ms, median, need N agreeing readings (`NF.need`).
- **`octaveFix`** (auto mode only): phone mics lose low fundamentals, so a reading far (>45¢) from every string whose ½ or ⅓ lands on a string is folded down; and (only when >60¢ from every string) an exact 2–4× multiple of the string just played is folded to it. Out-of-tune high strings (E4 = 4× low E) must stay themselves.
- Auto string choice = nearest string in the current tuning.
- **Smoothing:** median of 280 ms, then time-based glide (τ 0.4 s for <1.5¢ changes, 0.14 s <4¢, 0.07 s otherwise; jumps >15¢ immediate). The needle **holds** the last reading only while the signal is weak/noisy (good = clarity ≥ .93 and rms > 2.5×gate, or 3 recent readings agree within 3¢). Needle ignores the last ±1¢; number only changes on whole-cent moves.
- In tune: enter at ±3¢, stay until ±5¢, lock after 450 ms (✓ + vibrate, string marked done).
- Far off (>50¢): needle pinned at the edge, status shows live distance and notes, e.g. "Too low · tune up ↑ · 190¢ (D → E)".
- Hint "· closer / · wrong way" from the 700 ms trend.

**Auto-stop of Listen (`autoStopCheck`):**
- Stops with "Sounds like you're playing · Listen off" when, for ≥1.5 s within a 5 s window: strumming (≥50% loud frames, ≥20% "chord" frames, ≥7 pluck onsets) or a melody (≥9 steady notes held ≥130 ms, ≥4 distinct). A chord frame = several strong spectral peaks (≥5 peaks 12 dB over the median, ≥65% of band energy) or, with a clear pitch, ≥2 peaks that are not harmonics of it. This keeps wind, traffic and talking from counting.
- Stops with "No string heard for a while · Listen off" after 12 s without a clear string note.
- Stops when leaving the Tuner tab.

**AC:** standard strings read within ±3¢ on real recordings (incl. phone-like 250 Hz highpass); detuned −30/−60¢ high E is followed to 0 when re-plucked every 0.6–1 s, quiet or noisy; in-tune needle jitter < 1¢; tuning/arpeggio checks never trigger auto-stop; strumming/melody stop in ~6 s; wind/traffic/street/chatter never produce "playing"; Drop D labels show D⁶.

**Resolved (was the known open issue in V1):** high E sometimes didn't move the needle on the user's guitar. After the v84–v92 fixes the user tuned his Muse on 12 Oct 2026 and it worked perfectly. If it comes back: get a screenshot while plucking (note letter, status, lit peg) and add an on-screen debug overlay (Hz, clarity, rms vs gate) behind a hidden toggle.

### 5.2 Songs — analyse a video ("Choose a song video", `#drop`, `runAnalysis`)
- Pick a video/audio file from the phone (MP4 best). Everything is decoded and analysed **on the phone**.
- Steps: read sound → (optional, default on) "Detailed listening" with Basic Pitch (TF.js) → chord segmentation (chroma templates for maj/min/7/m7/maj7/sus2/sus4/add9, beat-synced) → tuning guess (`guessTuning`) → best capo for easy shapes (`ease`) → optional reading of chord names **written on screen** (on-phone OCR of frames, or Claude vision when on).
- Result view (`#songView`): tuning card (change tuning/capo → names re-spelled), synced video + karaoke chord lane, timeline of chord blocks (tap to edit/merge/split), confidence per chord, "How to play it" diagrams, song notes, Claude check / "better versions" (when Claude is on), search links (YouTube, chord sites).
- Feedback panel: the user types known chords/sections → constrained re-analysis (`refit2`).
- **Lesson view**: video + animated fretboard + strumming rows per bar, sections auto-detected (`autoSections`).
- Save analysis (`saveSong`, last 8 per phone) → open sheet.

- **Faint thirds follow the song's key** (`songKey`, `keyFit`, `TUNE.keyFix` .6, Oct 2026): a guitar that sounds mostly root and 5th has a faint 3rd, and the root's own overtone sits on the major 3rd, so minor chords were heard major ("במקום בו אני גר", guitars only: F#m → F#, C#m → C#; 41% of the time in the sheet's chords). The key comes from all the song's notes (Krumhansl profiles); a major/minor triad (or 7/m7) whose other 3rd is at least 0.6× as strong as its own, and whose other quality is in the key while its own isn't, takes the key's quality. A clear 3rd wins, so out-of-key chords stay (D and E in C major). The rule also covers a major chord with a 9th or a major 7th (add9 → m, maj7 → m7: an F#m with the 9th on top was heard as F#add9; there is no minor add9 to name), and so does the whole-song check. On that song: C#m · F#m · E · A in 100% of the time (A as Aadd9/Asus2: a B is really sounding).

### 5.3 Chord sheet, My songs, PDF, Drive (`/* Chord sheet, My songs, Google Drive */`)
- Sheet (`#sheetView`): name, artist, tuning + capo meta, chord diagrams of used chords, progression or lyrics-with-chords, my notes, footer "Guitaring · date". Hebrew lines RTL.
- **Save to My songs** (`lib` key, on this phone), **Save PDF**, **Share / save to Drive** (PDF via the Android share sheet; inside Claude via the Drive connector into the artist's folder, with artist chips).
- After a successful Drive save the sheet is cleared from the UI (`clearAfterDrive`) and added to the sheet catalog.
- If a saved **video lesson** matches the sheet's song, a "🎬 Your video lesson for this song" link appears at the top (`#shVid`).

### 5.4 Write a song sheet (`/* Write a song sheet by hand */`, `openWriter`)
- Step 1: title, artist, tuning, capo, lyrics textarea. Buttons to insert **chords-only parts** (Intro / Instrumental / Solo / Ending / no label) at the cursor; lines of `♪` slots hold one chord each.
- Step 2: tap any word → chord picker (`#wPick`): chords in this song, chord book, common chords (all roots × qualities + common slash chords), free typing with validation (`parseChord`). Move chord to previous/next word, remove. Edit-text mode (fix/delete/add lines, `[Chorus]` labels). "＋ Add a chords-only line" anywhere.
- **Undo/redo** for every change (`wPush/wRestore`, 60 steps).
- **Drafts:** the sheet is kept as a draft (`writeDraft`) until "Make the chord sheet"; Songs home shows a draft card with Continue / Discard.
- **Chord finder** button in the picker (see 5.9) inserts the found chord; if built in the sheet's tuning+capo, the sheet's chord box uses the user's own fingering (`A.fing`).

### 5.5 Chord sheet from screenshots or a PDF (`/* reading chord sheets on the phone itself */`)
- Up to 8 screenshots (ordered by time taken: file name timestamp → EXIF → file date; reorder by hand) or one PDF ("Print › Save as PDF" from the chord site is most accurate).
- **On-device only** (Claude refuses to transcribe lyrics, so V1 never sends lyrics to Claude): Tesseract heb+eng for words, a second worker tuned for chord symbols; pdf.js text for PDFs.
- Cleaning: crop phone status/nav bars, drop rows cut at edges, site toolbars, URLs, times, repeated sticky UI across screenshots (`dropOverlaps`, `simText`), bidi marks; chord rows vs lyric rows vs section labels (`wordsToLines`, `mergeChordRows`); chords placed above the right words.
- Autofill title/artist/capo/tuning (`metaFromLines`, `splitTitle`, `SITE_RE`, Claude `orderCheck` only for song/artist order).
- Output opens in the writer (fully editable, same format as a hand-written sheet) with the screenshots shown full-size (tap ✕ to close). Nothing is saved until the user taps "Make the chord sheet".

### 5.5b I'm learning (`#learnBox`, banner `/* ===== I'm learning … */`, Oct 2026)
- Songs › My library opens on **I'm learning**: one row per song, merged from every source — Guitaring sheets (Drive list `sheetIndex` + phone `sheetCat`), sheets saved on the phone (`lib`), an unfinished sheet (`writeDraft`), the Drive songs folder (`songIndex`), video lessons (`vlinks`), practice-mixer splits (`mxIdx`, name parsed as "Artist - Song"), saved chord analyses (`songs` / `song.<key>`), and song ideas marked "On it" (`ideaOnIt`).
- Same song = titles match (`vlMatch`) and artists match, or identical title with the artist written in another script (אביתר בנאי / Eviatar Banai).
- **V2 phase 2 (My learning library):** each song has a record in `songs2` (§7) with its **status**: Learning · Learned · Idea for later (set in the row's details; new songs start as Learning). **One language at a time:** a Hebrew | English switch above the list (shown when both kinds exist; one is always chosen; by the title's letters, else the artist's; remembered in `learnLang`, first from the profile's song language, else the one with more songs); every count, filter and the artist list follow it. Filters: status chips (All · Learning · Learned · Ideas, with counts) and an artist list, on top of search and the material chips. Material chips, in V2 order: Guitaring sheet · Drive sheets · Video lessons · Play-along (chords from a video) · Jam track (song guides, riff guides and gear tips join in their phases). My Library has **My learning songs** (count, learned) at the top.
- Each row shows what the song has as short words (Sheet · Drive · Lesson · Play-along · Jam; "Nothing yet" when empty); with icons on, five pedal tiles lit when present, dim when missing. Sorted by most recent activity.
- Search; filter chips per kind cycle *have it → missing → off*.
- Tap a row: what it has (Open / Watch) and what's missing with a next step (Write it, Find chords, Find a lesson, Split it, Pick a video); "On it" songs can be dropped.
- **New songs to learn** (`#suggCard`) holds the daily song ideas (`#ideaBox`), still collapsed until opened; its old "I'm learning" sub-list is gone (the main list replaces it).
- Below the list, "Sheets, lessons and settings" keeps the catalog, video lessons, saved-on-phone list and settings.
- Test: `tests/learn_t.js`.

### 5.5c Song session (V2 phase 3, `#paneSession`, part `83-song-session`)
- Tapping a song in My learning library opens its **song session** page (`openSession` → `goSec('session')`, a page like My Library: ‹ and the phone's back button return to Learn). It follows the song by title/artist (`sesKey`), so new material shows up.
- **Top (fretboard card):** title, artist, tuning · capo · BPM (`sesFacts`: phone sheet `play`, then the Drive sheet list, then a chord analysis), what it has, one **Practise** button (`sesPractise`: play-along › jam track › sheet › video lesson; the Easy/Full guide takes it over next), status Learning / Learned / Idea for later.
- **Song guide** (part `84-song-guide`, when the song has a chord analysis; Practise opens it): tabs **Easy | Full**, the profile's level picks the first (beginner / improving → Easy). Built on the phone from the analysis (`gdBuild`, using `lessonModel`: beats, bars, note onsets): **Before you play** (capo, tuning, BPM in words); **How sure is this** (chords and order · capo and shapes · exact voicings (Full) · strumming · tempo, each *Solid / Likely / A guess* with one line why); **Chords** with fingers (Full: the recording's shapes; Easy: the basic chord unless the original shape is easier to hold, e.g. an open Fmaj7, and the friendliest capo up to 5 that keeps the pitch, `gdEasyCapo`); **Strumming** (Easy: one down-strum per beat; Full: the most common bar heard, eighth-note boxes 1 & 2 & …, or one per beat when there's no beat detail); **Song map** (parts found by the order of the chords in 4-bar blocks, `gdParts`, or your own sections; time, progression once with ×repeats, bars; never lyrics); ▶ Play along (the play-along view). Checked against the reference guide "שאריות של החיים" (`tests/guide_t.js`).
- **Easy with and without a capo** (`gdEasyVers`, `gdEasyAt`, Oct 2026): Easy works out the song's basic chords (standard tuning) **without a capo** and with the **easiest capo (1–7)**. When the capo version is clearly easier, Easy offers both (*No capo* | *With capo N*, `[data-gdever]`); both sound like the recording. Each says which chords are **still a barre** in it, and the no-capo one says the capo version avoids them. Your pick is kept in your profile (`profile.capo`: `'yes'` / `'no'`, shown in My profile) and every song's Easy opens with it; not set yet → the easiest. When no capo is as easy, there is one Easy version, without a capo.
- **Chords in this song** (songs without an analysis): diagrams with finger numbers (`sesDiagram`: the chord library, else built from root and type with `shapeFor`).
- **Jam along** (when it has a jam track): Guitars only · Without the guitars · Drums only (rhythm) · Drums + vocals · The whole band (opens the player with that preset).
- **Everything for this song:** the material rows with Open / Watch and next steps for what's missing (`learnDetail`, actions in `learnAct`); the chord finder; **My notes** (saved in the song record's `notes`).

- **Chord detection: sound first, video second, the chord sheet as a sanity check** (`gdFit`, the user's rule, Oct 2026). (1) The **sound** of the isolated guitar decides the chords, their roots and timing. (2) The **video** (when it was looked at, §5.5d) decides the capo and a chord's minor/major where it saw the hand clearly. (3) A **chord sheet** for the song is informal and often of another version, so it never decides the chords: it settles a chord only where the sound's 3rd was too faint to tell minor from major (the other 3rd ≥ 0.6× as strong, measured from the analysis' saved notes `feat`, `gdThirds`) and the video didn't show that chord; it never changes a root or a voicing (Asus2, Eadd9 stay). Where a clear recording differs, *How sure* says so ("your chord sheet has C#m, but this recording clearly plays C#") and keeps the recording; it also lists chords heard but not on the sheet and the other way round (`gdSheetWhy`). **The capo can't be heard**: it is yours (Full › *Capo in the video*, `play.capoBy:'you'`), else seen in the video, else none (the chords as they sound, *a guess*, or *likely* when the sheet has no capo either). A sheet's capo is offered (*Use capo N*), not applied. What the sheet settled and the capo's source are saved, so the play-along shows the same. A guide matched to the sheet by the earlier version (which replaced chords) says to rebuild it. **Full is the song as played**; **Easy is the capo version** (the capo that gives the same sound with easier basic shapes, one strum per beat).

- **Strumming by majority** (`gdPatOf`, Oct 2026): each eighth note is a strum if it is strummed in most bars with guitar, and *How sure* says how well the bars follow that pattern (the share of eighth notes that agree): solid ≥ 85%, likely ≥ 72%, else a guess ("use it as a starting point"). Before, only bars repeating the exact pattern counted, so a player who varies one strum per bar read as 7% ("במקום בו אני גר"). Per part the same.

- **Play along with the video** (part `86-karaoke`, Oct 2026): in the guide's **Full** tab, a song with a video shows it **instead of the song map**, karaoke style: the video; the chord **now** (big, with its shape) and the **next** one counting down in beats; and a **lane** of chord blocks (sized by how long each lasts, with beat ticks and bar lines) sliding under a fixed "now" line (tap it to jump). Speed 60 / 80 / 100 % (pitch kept) and full screen. **Easy keeps the song map** (its chords and capo can differ from the video). **Timing**: the chord changes come from the analysis, snapped to the song's beat when within 0.4 of a beat (`karaBlocks`; a chord pushed to the "&" stays); the video's own clock drives the lane; and the video's sound is lined up once with the song's audio (`karaOffset`: first by the harmony, every 0.09 s, so a shift of exactly one beat can't match as it can in strums that repeat every beat; then within ±0.15 s by the strums, every 0.023 s), kept as `vOff` in the analysis and named when it isn't 0. **The video**: the phone-sized copy GitHub makes during the split (splitter **v7**: `video.mp4`, 480p H.264, left out above 60 MB), kept as `mixvideo:<id>` (in backups with the audio parts; deleted with the song); a song split before that loads its video from Drive once (*Load the song's video*, a tap; kept on the phone). Leaving the page or redrawing the guide stops it.
  - **Its play button is the player's** (Oct 2026): a −5s / ▶ / +5s row under the video (`.ktrans` with the player's `.mixplay` / `.mixback`), ▶ / ❚❚, its glow breathing while it plays; the video itself stays clear (a tap on it still plays or pauses).
- **The song's name and album cover** (part `87-song-cover`, Oct 2026): the right song and artist come from, in order: **yours** (asked when adding a song if Guitaring isn't sure; *Edit name* on the song's page, `#sesName`, for a song with a jam track: the jam track, its analyses and the cover follow), else a **chord sheet** Guitaring knows for it (`vlFindSheet`), else the **file's name** without what a live or video upload adds (`songClean`: "(חי באולפן …)", "(Live at …)", "[Official Video]", "| …", " - Official Video"; a bracket that is part of the name stays). Kept as `mixIndex[].song {t,a,by:'you'|'sheet'|'name'}` and in the session's analysis as `song {t,a}`; a song video's analysis titled "Artist - Song" is read that way (`anaIdent`, it was shown swapped). **The cover**: looked up by artist and song in Apple's music catalog (`itunes.apple.com/search`, the Israeli store then the US one; free, no key), taken only when one of the song's artists **and** the song match (`covFits`); made once into a 600 px background and a 96 px thumbnail (JPEG) with its colour and kept in the phone database as `cover:<artist>|<song>` (in backups), so another song with the same artist and name reuses it with no lookup; "no cover" is remembered for a week; if the picture can't be copied its address is kept instead. Shown as a **light background** behind the name on the song's page (`.seshero.hascov`, about a third strong, fading toward the text side) and as a small picture next to each song in Learn (`.lcov`, drawn with the list when already loaded). **Always ready** (`covWarm`): a few seconds after the app starts, and whenever the Learn list is drawn, every song's missing cover is looked up in the background, one at a time with a 1.5 s pause after each real lookup (the catalog limits how fast it may be asked), and shown as it arrives (`covPaint`, no redraw). Also asked for when a new song is added (`dsSubmit`, while GitHub splits it). Only an answer from the catalog with no fitting song is kept as "no cover" (`{none, v:2}`); a network error or "too many requests" is tried again next time, and a "no cover" kept before v2 is looked up again. **Edit name** looks the cover up again for the new name right away, even if "no cover" was kept for it.

### 5.5e Jam: create in Band breakdown, pick in the Jamming player (Oct 2026)
- The Jam page has two tiles and **no song list**: **Band breakdown** (`#mixNew`) only creates: its sheet (`mxCreate`) offers *A song file on this phone* (split on GitHub), *A song in your Google Drive* (the Drive form), *Split on this phone instead* and *GitHub connection*, and shows what's **being split** (Progress for a Drive song) or failed (Try again). **Jamming player** (`#jamOpen`) is **the only place to pick a split song**: its sheet (`mxHome`, "Your split songs") lists them (Delete, Try again for failed ones) with nothing to create; with none yet it points to Band breakdown. Inside a song, the list folds under "Your split songs (n): play another". The tiles say what's ready and what's being split (`renderMixNew`). My Library › My jam tracks opens the player (`data-player`).

- **Jamming player transport, "Fluid Pulse"** (Oct 2026): a soft squircle card; the seek bar is the song's waveform (`mxWave`, all parts together, drawn once per song; grey unplayed, mint played) with a glowing orb at the position (the range `#mxSeek` sits invisibly on top, so dragging and the tests are unchanged); the times in mint under it; a large glowing play button, whose glow ring breathes while playing (the button itself stays still; off with reduced motion); recessed −5s / +5s with ripple rings; the speed choice under them.

### 5.5d Add a song from Google Drive (V2 phase 4, part `66-drive-song`)
- Learn › **Add a song** (`#addSong`, dialog `#dsDlg`): paste the link to the song's **folder** in Drive (`dsFolderId`, `dsFolderFiles`: its video and audio are picked, the MP3s Guitaring made there before are left out), or to its **video (MP4) and/or audio (MP3)** (a second link is optional). Tapping the button closes the keyboard and the message under it scrolls into sight (on a phone the keyboard hid it). A YouTube link is refused kindly (YouTube doesn't allow downloading) and offered as a video lesson; a non-Drive link, a non-media file and a missing GitHub connection each say what to do.
- **Which song is it?** (`songIdent`): before sending, Guitaring takes the song and artist from a chord sheet it knows, or from a clean "Artist - Song" file name; when the name is a live or video upload's, or has no artist, it **asks** (Song `#dsT`, Artist `#dsA`, filled with its guess; *Continue* `#dsOk`) and keeps the answer as yours. It names the session and finds the album cover (§5.5c).
- Drive access: **full Drive scope** (`gdTokenFull`, user's choice, Oct 2026), asked straight from the tap; used only to read the linked file and save the two MP3s next to it.
- The job (`dsSubmit` → `mxUpload(it,null,job)`): branch `j-<id>` carries **`drive.json`** `{file, ext, folder, base, token, full}` instead of the song. The audio file is the source when there are both (cleaner); the video is kept as the song's video. No MP3 is made of an MP3 (`full:false`).
- **Splitter v4** (`15-splitter-workflow`): fetches the file from Drive (a refused sign-in stops with a clear message), splits it, makes `<song> (full).mp3` and `<song> (guitars only).mp3` with ffmpeg and uploads both into the same Drive folder (`res/drive.json` says what was saved); it also hands both MP3s back to the app.
- Collect (`mxCollect` → `dsCollect`): links the MP3s GitHub saved (`mixIndex[].drive.out`); if Google's 1-hour sign-in ran out on GitHub, the MP3s are kept on the phone (`mixdrive:<id>`) and the song's page offers **Save them** (`dsSaveLater`). A phone notification says the song is ready.
- **Progress while it works** (`dsShowProgress`): after sending, the sheet becomes a live progress view: Sent to your GitHub · Waiting for a free GitHub computer · Setting up the splitter · Getting the song from your Drive · **Splitting it into parts** · Saving the MP3s to your Drive · Bringing the parts back. The steps are GitHub's own (`/actions/runs/<id>/jobs`, `dsRunInfo`, every 8 s while shown); the split's share of the bar grows with its time against how long your splits take (`tuner.dsSplitMin`, a running average, 14 min to start), with an overall % and "About N min left". It can be closed any time; **Add a song** shows it again while a song is on its way ("Add another song" gives the form). When done: **Ready** with **Open the song**; if it failed: the reason and **Try again**.
- **Never out of sight** (`dsCalc`, `dsTrack`, `dsStatusUI`): while a song is being made on GitHub, every look for finished parts (about every 20 s) also checks its stage. The **bottom bar** shows "<stage> · 53% · about 9 min left" with its line, and tapping it opens the progress. **✕ on the bar shrinks it to a % badge** (`#mkPill`, a ring) that stays until the song is ready, also while another song plays in the bar (it then sits above the bar); tapping it opens the progress. **Home** shows "Making “<song>”" first. The progress view says when it last **checked with GitHub**. Slow cases are named plainly, and the badge turns amber: GitHub hasn't started after 8 min (its free computers may be busy, nothing is lost); the split takes over 2.2× the usual time (still working); GitHub can't be reached for 2 min (check the internet, the work goes on there).
- The song's page lists **The video in Drive**, **Full song MP3 in Drive**, **Guitars-only MP3 in Drive** (`dsRows`) with the jam track.
- **The session builds itself** (part `67-auto-session`, `asBuild`): when the parts come back, the item gets `sess:'queued'` and the phone analyses the **guitars-only part** (the song-video analysis: chords, beats, strumming, tuning, the easiest capo) one song at a time in the background, saves it as a song analysis `song.mix_<id>` (`anaKey`, among the last 8) and sets `sess:'done'` (or `'failed'`: the jam track stays, the progress says the session couldn't be built). Until then the bar, badge, Home card and progress show the 8th stage **Building the song’s session** (99%). Then a notification and a toast (**Open the song**): the song's page has the Easy / Full guide and Play along. No capo is guessed (see the guide's capo rule, §5.5c). **Every source, every time** (the user's rule, Oct 2026): a session is built from (1) the **guitars-only part** (the main source: chords, roots, timing, beat, strumming), (2) the **whole song**: every split part but the drums, summed on the phone and analysed too (`asWhole`, `asFuse`): where the guitar's 3rd is too faint to tell minor from major and the whole song plays one clearly (the other instruments often carry the 3rd), the whole song decides (`whole.fixed`, e.g. B → Bm, which the key alone would have called B); how often both hear the same root is kept (`whole.agree`); its notes are saved (`mfeat`); (3) the **video**, when the song has one; (4) a **chord sheet**, when there is one, as a check (§5.5c). **The beat comes from the drums part** when the song has drums (its RMS > 0.01; an acoustic song's drums part is nearly silent): kick and snare give the tempo and the beat grid that the guitar's strums are read against (`beatFrom:'drums'`; on a test the guitar alone read 144 BPM for a 104 BPM song). The bar names the step (*Listening to the guitars-only part* / *the whole song too* / *Looking at the song’s video*), and the guide lists **Built from** with ✓ or why a source is missing (`gdSources`); a video looked at where the hand was never clear is listed as not helping (–), not ✓. **Video stills from the split** (splitter **v5**, `15-splitter-workflow`): when the job has a video (`drive.json` `video` + `vext`: the one you linked, or, for an MP3 given alone, a video with the same name in its Drive folder, found at sending; or the song itself when it is a video), GitHub takes a 960 px still every 2 s (splitter **v6**; 480 px in v5 was too small to see the hand; **v7** also hands back a phone-sized copy of the video for playing along); **v8**: 1440 px every 3 s, as hands in wide shots are small (`stills.bin` + `stills.json` index) and hands them back with the parts; the phone keeps them as `mixstills:<id>` (in backups with the audio parts; deleted with the song). The build looks in **two steps** (two Claude calls at most): (1) **find**: the stills nearest the middles of up to 27 chord moments go as contact sheets of 4 numbered tiles (`vlContact`, `VL_T`: 2 × 2, each 720 px, sheets 1440 × 810; until Oct 2026 9 tiles of 480 px, which shrank a hand in a wide shot too far to spot), all in the same one call, and Claude lists, per tile, each guitarist whose fretting hand is clearly visible (acoustic / electric, a box, how clear); the guitarist whose hand is clear most often (usually the one strumming the chords) is read, and the others are named (a lead line or another voicing shouldn't decide the chords; `video.who`, `video.others`); (2) **read**: up to 8 of them, spread over the song, are cut to the hand and neck at full size (`vlCrop`, up to 768 px) and sent with one whole still (for the capo) (`vlAsk`). When no tile shows the hand clearly, step 2 is skipped (no cost; `video.nohand`) and *Built from* says the hand isn't shown clearly in this video. The stills from the split are used without Drive or a download on the phone; older songs read the video from Drive and look the same way. Older songs without stills fall back to reading the video from Drive (below). Sound and video together (part `68-video-look`, `vlLook`): when the song is from Drive and Claude is on, the build also looks at the song's **video** (the one linked, else a video in the song's Drive folder with the same name, `vlFind`). One still from the middle of each main chord the sound found (up to 8, `vlTimes`) goes to Claude in one call (it isn't told what the sound heard; no lyrics or other text): the capo it sees and the shape in the hand. Sound keeps the chords and their timing; the video sets the capo (`play.capoBy:'video'`) and a chord's minor/major where the roots agree (`vlApply`: heard F# + hand F#m → F#m); where the roots differ it's kept as a disagreement and How sure names the time. Saved as `video` in the analysis. The video is read from Drive for this only (not kept). Drive's sign-in lasts one visit, so a build after a restart skips the video and the guide offers **Rebuild and check the video** (Drive asked from the tap); without Claude the guide says the key is needed. The bar says *Looking at the song’s video*. Cost: one Claude call with up to 8 pictures per build. An interrupted build resumes on the next open. A song **added from Drive before this** (ready, no `sess`) gets its session on the next open; a split song with a guide has **Rebuild the guide from the guitars-only part** under it (`#sesRebuild`: heard again with the latest listening, e.g. after the faint-thirds fix; a capo you set stays); any split song with no guide has **Build the song guide** on its page (`#sesBuild`, `asStart`; **Try again** after a failure).
- **Several guitars, step 1: by side** (`asSides`, `asNotesAtOnce`, Oct 2026): after the guitars-only part is analysed, the session build splits it by where each guitar sits (left / centre / right, the jam track's own `mxPanSplit` and rule), and analyses each side holding at least 12% of the guitars alone: its main chords, how often it hears the same roots as the whole guitars part, and **how many notes it plays at once** (0.37 s frames, peaks 70–1500 Hz, a note's own overtones not counted: a strummed chord about 3, a riff or lead line about 1). Kept as `guitars {apart, share:{L,C,R}, sides:[{pos, share, chords, agree, notes}]}` in the analysis, and shown in the guide's *Built from*: "2 guitars sit apart: left (45% of the guitars) strums C#m · A · E · F#m …; right (38%) plays mostly single notes (a riff or a lead line)" (under 1.8 notes at once: single notes; 1.8–2.3: a mix; above: strums), or that they sit together and can't be told apart that way. **The chords still come from the whole guitars part**: this step measures real songs first; step 2 decides how the sides are used (the strumming guitar as the base, the other as a check, Guitar 1 / Guitar 2 in the guide). A **Rebuild** measures a song split before (its parts are on the phone).
- **Which analysis the guide shows** (`sesAnaKey`, Oct 2026): the session of the song's newest split (`mix_<id>`), then another split's session, then the newest other analysis. A song video analysed on the phone, or one saved again later, no longer hides the split's session (it did: the guide then showed "The recording you analysed", no whole song, no video, no sheet).

### 5.6 My chord sheets (catalog) (`#catBox`)
- Lists every sheet made with Guitaring: from Drive (`sheetIndex`, written daily into `ideas.json.sheets`) + this phone (`sheetCat`). Search by song/artist; filters: artist, capo (none/with), tuning, level (Easy/Medium/Hard from `chordLevel`, an open-vs-barre heuristic). Rows open the Drive file. Rows with a saved video lesson show 🎬.

### 5.7 My video lessons (`#vidBox`, `/* My video lessons */`)
- Add a link by pasting it, or from YouTube's **Share › Guitaring** (manifest `share_target`, GET `?url=&text=&title=`; the app opens on Songs with the link ready).
- YouTube title/thumbnail via oEmbed (fallback noembed); title parsed into song + artist (`vlParse`: "Artist - Song | שיעור גיטרה", "How to play X by Y", order fixed using known artists/sheets). Instagram/TikTok usually need typing.
- **Duplicate check** on add: same YouTube id (youtu.be / watch / shorts / embed / `&t=` / `si=`) or same normalised URL → "You already saved this video" + Watch link.
- **Chord-sheet match** (`vlFindSheet`) against Drive sheets, My songs and the Drive songs folder index; shown while saving and on each row (📄 Chord sheet button). ▶ Watch opens the source (YouTube app on Android). Edit / Delete / search (>3 items). Stored on the phone (`vlinks`).

### 5.8 Song ideas (`#ideaBox`, `/* song ideas */`)
- 10 suggestions per day based on the Drive songs folder (artists, styles, chords → level), mostly at level + 2–3 step-ups + 1–2 easier, Hebrew/English mix. Each card: title, artist, style, difficulty dots, chords, why; buttons **Chords ↗** (Google "I'm feeling lucky" on `site:tab4u.com "title" artist`), **Listen ↗** (YouTube search), **On it** (moves it to an "On it" list and refreshes suggestions), **Not for me**.
- Fine-tune (styles, bands, difficulty, language) → re-pick with Claude when Claude is on.
- **Collapsed until the user opens it; re-collapses on every Songs visit.**
- Source: `ideas.json` (phone) or self-generated with Claude (artifact).

### 5.9 Chords tab (`#paneChords`, `/* Chord book */`, `/* Chords tab UI */`)
- **Chord book** (`chordbook`): every chord from saved songs/sheets is added automatically (canonical names via `canon`), most-used first, search ("Am7", "sus2", "G/B"), Standard / Drop D view. Detail: notes, songs it appears in, the user's own fingerings, then generated voicings up the neck (`voicings`, `fingerize`), add/remove.
- **Chord finder** (`#cfWrap`, `cfOpen/cfRender/cfResult`, `identifyChord`):
  - Dark brushed-metal panel; wood-grain fretboard (SVG turbulence), silver fret wires, brass nut, pearl inlays, bronze wound + steel plain strings, mint glossy finger markers with note letters, mint barre pill.
  - Controls: tuning (all 12), capo stepper, "From fret" stepper (view moves up the neck; real fret numbers; capo bar drawn).
  - Tap a fret cell = finger (one per string; tap again to lift); tap above a string = open ○ / muted ✕; **tap a fret number on the left = barre** across all non-muted strings (fingers on top of it).
  - Result updates instantly: chord name (shape name relative to capo/tuning, "sounds as A" when capo), notes, finger count ("barre + 3 fingers"), up to 4 alternative names. Identification: every played note must be a chord tone; the 5th may be omitted; penalties for complexity/missing tones/slash bass.
  - From the writer: "Use "G" above the word" (converted to the sheet's tuning/capo if they differ, with an explanation).
  - From the Chords tab: **no duplicates** — if the chord is already in the book: same fingering → "Open in my chord book"; new fingering → "Save this fingering to F#m"; else "Add to my chord book".
  - Fixed top-anchored panel so the board never moves under the finger.

### 5.10 My gear (`#paneGear`, `/* My gear */`)
- List of the user's instruments (`instruments`): types `acoustic` (steel), `classical` (nylon), `electroacoustic`, `electric`, and amps `acamp` (acoustic amplifier) and `elamp` (electric guitar amplifier); electro-acoustics can have a preamp panel. Each has specs (body, top, pickups, bridge, board, finish, strings…), string age (`stringsStatus`), last tuned, notes.
- **Fill from a photo** (Claude vision): fills all spec fields it can see plus a few critical extras, without bombarding; the user edits after.
- Advice per type (`GEAR`: pros, cons, how to use, cleaning schedule, care, when to repair) + model-specific notes (`matchModel`, e.g. Les Paul headstock).
- **Controls and switches**: labelled SVG drawing of each electric guitar's / amp's knobs, switches and jacks (`guitarSVG`, `panelSVG`).
- **More photos per item** (Oct 2026, any gear): Overview shows the photo above the tabs with a strip of all photos and **+ Add photos** (several at once, ≤1200 px each). Extra images live in IndexedDB (`guitaring` / `kv`, key `gearphoto:<id>`); the item keeps only `photos: [{id, at}]` (localStorage stays small). The main photo (`photo`) stays as it was.
- **Controls on your photos**: the Controls tab opens on the photos (switch: Your photos / Drawing) with the same strip; the photo above the tabs steps aside there. Each control's mark is `ctlPos[name] = [x, y, photoId]` (fractions; `photoId` `main` or an extra's id; missing = `main`). Tapping a control in the list jumps to the photo it's marked on. **Find them on my photos** sends every photo (up to the image limit) to Claude, which picks the clearest photo per control, leaves unseen ones unmarked, and may add up to 8 controls it sees that aren't listed (screen, push-pull, extra switch) — these join the item's own list (`controls`). **Place them myself** marks on the photo showing. **Remove this photo** (two taps) removes its marks. An older close-up (`ctlPhoto`, from v99) is moved into the photos with its marks. "Get the exact controls" and Claude's model profile also see all photos. Tests: `tests/ctl_t.js`, `tests/gp_t.js`.
- **Readable marks + full screen**: where marks crowd, each ring shrinks to fit its nearest neighbour and each number moves to a free spot around its ring (8 directions, 3 distances, a thin line back when it had to go further out), the picked one first (`pbLay`). **Full screen** (button on the photo, or tap the photo) opens it full screen (`ctlFs`): pinch, double-tap or wheel to zoom, drag to move; the numbers keep their size and re-lay as you zoom, and a number with no free spot waits for a zoom (the hint says how many). Tap a number to see its name, what it does and the tip in the bottom bar; ‹ › step through the marked controls in order, zooming to each and switching photos as needed. Placing marks works in full screen too (zoom in, tap the spot; **Done** ends placing). ✕ or the phone's back button returns to the page on the same photo with the same control picked. Test: `tests/ctlfs_t.js`.
- Gear chat with Claude (attach a photo from camera/gallery).
- Safety net: removed instruments are kept in `gearLost` with a restore box (an earlier bug deleted amps).
- Detail page (UI redesign): horizontal chip tabs under the photo — **Overview** (specs, last tuned, strings status line, model notes, photo notes, strengths/limits) · **Controls** (diagram on a dark card) · **Tips** · **Care** (strings date, cleaning, care, repair; orange dot when strings are due) · **Ask Claude** (model profile + gear chat). One panel at a time; every visit opens on Overview (`gearTab`).

### 5.11 Welcome jokes (on Home since V2 phase 1)
- 46 built-in jokes (`JOKES`, `{n}` = user's name) + extras from `ideas.json.jokes` (`jokesExtra`). Fresh extras are shown first, once each (`jokesSeen`), then random (never the same twice in a row). "Another one ↻".

### 5.12 Claude features (optional)
- Phone: Songs › Claude features → paste key → test → on. Used for: reading written chords/hand shapes in videos, chord-sheet title/artist order check, song notes / better versions / taste, gear photo fill + gear chat, song ideas re-pick.
- Never used for lyrics transcription.

### 5.13 Practice mixer (added v87–v92, after this PRD was written — spec to be completed)
- Splits one song into parts (drums, bass, other, vocals, guitar, piano) with Meta's HT-Demucs 6-stem model (ONNX Runtime Web 1.26.0 from jsDelivr; model from Hugging Face, ~285 MB WebGPU or ~136 MB CPU, cached in Cache Storage `guitaring-models`), running in a Web Worker. The guitar stem is further split left / centre / right by stereo position. Then mixed live (solo/mute per part).
- UI: `#mixNew` entry on Songs, slide-up sheet `#mxSheet` and a slim bottom bar `#mxBar` on every tab. Last separated song kept in IndexedDB `guitaring` / store `kv`.
- Optional off-phone path: a GitHub Actions workflow (`#mxWf`, "Split song", `workflow_dispatch`) the app can install and run, uploading the song to a `j-<id>` branch.
- Code: banner `/* ===== Practice mixer … */` (≈ line 3836), CSS `/* practice mixer */`.
- **Quality (Oct 2026, `mixer-quality`):** parts are kept and played at **44.1 kHz** (was 22.05 kHz) for songs up to 5 minutes (`MX.HQ_MAX`); longer songs stay at 22.05 kHz so phone memory peaks where it did before. The rate is saved with each song (`mixdata.sr`; older songs without it are 22.05 kHz). Saved mixes and the "guitars → chord analysis" WAV use the song's rate. On-phone windows overlap 50% (`MX.OVL`, was 25%): fewer seams, ~1.5× slower.
- **GitHub splitter v3** (`guitaring-split v3`, auto-updated in the user's repo on the next send): `--shifts 3 --overlap 0.5 --flac` — three time-shifted passes averaged, lossless FLAC parts (`done.json.format:"flac"`; v2 MP3 results still collected). About 15–25 min per song on the free runner; timeout 120 min.
- **Sending to GitHub** (fix, Oct 2026): right after the app installs or updates the splitter, it waits ~5 s before starting it, and retries the start (422/404) up to 3 more times (4, 8, 15 s) — GitHub can refuse to start a just-changed workflow. Errors name the step (installing the splitter / uploading the song / starting the split) and quote GitHub's message. Try again deletes the old `j-`/`r-` branches before re-uploading (it used to race). Test: `tests/mx_send_t.js`.
- **Saving a mix** (fix, Oct 2026): "Save this mix" and "Find the chords from the guitars only" build the WAV on the main thread from the song's parts (`mxRender`, chunked so the screen stays responsive), no longer inside the audio worklet — a user's guitars-only save came out as an all-zero file. A missing/short part no longer wipes the file. If the result would be silent the app says why (everything muted, or the chosen parts are silent in this song) instead of saving it. Test: `tests/mx_save_t.js`.
- **Silent files are stopped** (Oct 2026): a song file with no sound in it (e.g. a silent "(my mix).wav" saved before the fix above) was sent to GitHub twice and came back as six empty parts. Before sending, the app decodes the file at 8 kHz and checks its peak (`mxSilentFile`, about a second for a 5-minute MP3; a file the phone can't decode is still sent); a silent one gets a red message and is not sent. The phone split checks the same before downloading the model. Opening a split whose parts are all silent says why. Test: `tests/mx_silent_t.js`.
- **Status colours** (Oct 2026): toasts take a kind — `toast(msg,'ok')` green frame for things that worked (split ready, sent, connected, saved to Drive, mix saved), `'err'` red for failures, none = orange for info/warnings. Mixer rows: ready = green frame + "Ready ·", failed = red frame with the actions on their own line, in progress unchanged.
- **Expired / revoked GitHub key** (401 "Bad credentials"): the failed row offers **Fix the GitHub key** (opens GitHub connection); connecting a new key retries those songs by itself. If the key fails while a split is already running on GitHub, Try again just picks it up (no re-upload). `errKind:'key'` is kept in the mixer index.
- Not yet: a stronger guitar model than HT-Demucs 6-stem (community RoFormer guitar models exist, but no verified public weights/licence found). Measure on real songs before switching.
- Test: `tests/mx_t.js` (real ONNX Runtime Web from `node_modules`, stand-in model `tests/fixtures/mx_stub.onnx`, GitHub API mocked; hook `window.__mxTest`).

---

## 6. Data flow of the daily job

```
05:51 Israel ─► cloud Claude session (tools/daily-job-prompt.md)
  ├─ Google Drive: list songs folder 1oQhXOTPCngexgTdH8WuG4RLikLSs6XMe (artist sub-folders, chord snippets)
  ├─ Google Drive: find PDFs made by Guitaring ("Guitaring" / "LYRICS & CHORDS" / "PROGRESSION")
  ├─ choose 10 songs, VERIFY each on a chord/lyrics site (made-up Hebrew titles slipped through twice)
  ├─ python3 ideas_build.py write index.json sugg.json sheets.json   (cleans, de-dups, keeps 200-entry history)
  ├─ every 2nd day: python3 ideas_build.py jokes jokes.json          (4 new jokes, ≤80 kept)
  └─ git commit ideas.json && push to main
phone ─► loadDailyIdeas(): fetch ideas.json (≤ every 3 h) → songIndex, ideas, sheetIndex, jokesExtra
```

`ideas.json` schema (v1):
```json
{ "v":1, "at":"ISO time", "date":"YYYY-MM-DD (Israel)",
  "index":{"artists":["…"], "songs":[{"a":"artist","t":"title","ch":["Am"],"capo":1,"tuning":"Drop D"}]},
  "level":"one sentence", "suggestions":[{"title","artist","style","difficulty":1-5,"chords":[],"capo":0,"tuning":"Standard","why"}],
  "history":[{"title","artist","date"}],
  "sheets":[{"title","artist","capo","tuning","chords":[],"level","url","at"}],
  "jokes":[{"text":"… {n} …","date":"YYYY-MM-DD"}], "jokesDate":"YYYY-MM-DD" }
```
The phone replaces its list when `date` changes **or** `at` is newer (so a same-day correction is picked up).

---

## 7. Data model (`localStorage`, prefix `tuner.`)

| Key | Shape / meaning |
|---|---|
| `userName` | first name (welcome) |
| `tab` | last tab |
| `tuning` | tuning id (`std`, `dropd`, `half`, `whole`, `dropcs`, `dropc`, `dropb`, `dadgad`, `opend`, `openg`, `opene`, `openc`) |
| `a4`, `nf`, `inst`, `tuneInst` | reference pitch, noise filter, acoustic/electric tone, guitar being tuned |
| `instruments` | `[{id,type,name,brand,model,tuning,lastTuned,strings…,specs,notes,photo?}]` |
| `gearLost` | removed instruments (restore box) |
| `chordbook` | `{ "F#m": {added, songs:[titles], mine:[{f:[6 frets,-1=muted],tun,capo}]} }` |
| `bookTun`, `bookSeeded`, `cfTun`, `cfCapo` | chord-book view tuning; finder defaults |
| `lib` | My songs: `[{id,name,saved,data:<song or sheet object>,drive?}]` |
| `song.<fileKey>` | saved analyses (last 8), list in `songs` |
| `profile` | V2 player profile (see `docs/V2-build-plan.md` §7.1): name, songLang, years, level, skills, instruments, genres, artists, dreamSongs, goals, learnBy, time {minPerDay, daysPerWeek}, context, onboarding {done, later, skipped, prefilled, at}, pending, sync. Saving it also sets `userName` and `ideaPrefs.lang` when they differ. |
| `dsSplitMin` | how long a split takes on your GitHub, in minutes (running average, for the progress estimate) |
| `learnLang` | the language My learning library shows: `'he'` or `'en'` (V2) |
| `songs2` | V2 song records (phase 2, M2): `[{id:'s_…',title,artist,aliases,status:'learning'|'learned'|'idea',createdAt,touchedAt,links:{sheets:[{src:'drive',url}|{src:'phone',lib}|{src:'draft'}],folder:{a,t}|null,videos:[url],analysis:[song key],jam:[mxIdx id]},notes}]`. Points to V1 data, never moves it. M2 builds one per learning-list song (check: records = rows, every item linked once, V1 keys unchanged; safety copy first). A song with no record still shows and gets one when touched (`songTouch`). Removed by "Undo the new version's data". Restore (add) matches records by song, not id: the backup's record wins (status, notes), a phone's fresh records for other songs are kept. |
| `v2mig` | V2 migration log `{done:['M1',…], at, report, warn}`; safety copies `backup:pre-<step>:<time>` in the phone database |
| `writeDraft` | unfinished hand-written sheet (`kind:'lyrics'`, `lc:[{t:"line", ch:{wordIndex:"Am"}}]`, `play:{tun,capo}`, `fing`) |
| `sheetCat`, `sheetIndex` | sheet catalog: this phone / from Drive (daily) |
| `songIndex` | Drive songs folder index `{at,src,songs:[{a,t,ch}],artists}` |
| `ideas`, `ideaNo`, `ideaOnIt`, `ideaPrefs` | suggestions, rejected, "On it" list, fine-tune choices |
| `vlinks` | video lessons `[{id,url,key,yt,src,title,thumb,song,artist,note,at}]` |
| `jokesExtra`, `jokesSeen`, `lastJokeTxt` | welcome jokes |
| `apiKey` | user's Anthropic key (phone only) |
| `myFolder`, `driveFolderLink` | Drive songs folder link |
| `detailListen`, `taste`, `gearLog`, `gear` | analysis option, taste profile, misc |

Canonical keys: chord names via `canon()` (C, C#, D, Eb, E, F, F#, G, Ab, A, Bb, B + quality alias map); videos via `vlNormUrl()` (`yt:<id>` or host+path+query without tracking params); sheets via `normArt(title)`.

---

## 8. Design system (current)

- **Look (Oct 2026, "Option 2": text first, dark hardware cards, one player), dark only.** Tokens in `:root` (`00-head-style`): `--bg #0F1311`, `--surface #161B18`, `--ink #FFF`, `--muted #9AA0A6`, `--line rgba(255,255,255,.08)`, `--accent` mint `#4EE2B7` (everything active: buttons, current section, play buttons, slider thumbs), `--amber #FF8C32`, `--line-on`, `--r-card 20px`, `--shadow-card`. Feature cards (`.htile`, `.addtile`) carry a drawn background under a dark wash (`--tex-learn` fretboard, `--tex-write` notebook, `--tex-jam` amp grill cloth, `--tex-gear` control knobs: inline SVG made by code, no photos) with a big uppercase title at the bottom. The header is words only; the bottom bar keeps its icons above the words (user's choice; `SKA()` always draws, `SK()` follows `ICONS`). The Band breakdown mini-player (`#mxBar`) is one bar: mint play button, "Now playing / Paused / Ready to play" (`#mxBarK`), title, time, thin progress line; it keeps playing in every section. **The player (mixer sheet) is a small mixing desk:** a "Band breakdown" kicker with equalizer bars that dance while playing (`body.mxon`), the song's title and artist (from `songFromName`) on their own lines; a transport card with the progress bar (filled to the playhead, times under it: `#mxT` where you are, `#mxD` the length) and −5s · play · +5s (`#mxFwd`); presets in one scrolling row (Everything · No guitars · **Drums only** (a rhythm track to keep time) · **Drums + vocals** (the beat and the melody to play over) · Guitars only · No vocals; the chosen one lights up until a part is changed by hand, `mxPre`); then one **channel strip per part** (`#mxRows .strip`, colour per part `MX_COLOR`, short name `MX_SHORT`): %, a vertical fader (`[data-vol]`, a rotated range input), a live **level meter** (`[data-lv]`; the audio worklet sends each part's level with the position, about 10 times a second; `mxMeters`), the name, **M** and **S**. **Speed: Slow 60% · Medium 80% · Full** (`mxSetRate`): the pitch stays the same; the worklet stretches the time (WSOLA: 46 ms grains, half overlap, each grain lined up with the previous one by cross-correlation), the meters and the time follow the song, a seek works at any speed, the mini player says "· 60% speed". The play-along (song video or audio file) has the same three speeds (`vid.playbackRate`, pitch kept by the browser; a video slows its picture too).
- Fonts/vars: `--display`, `--body`, `--mono`; theme vars `--bg --surface --ink --muted --line --accent --ok --flat --sharp`.
- Tuner and chord finder: fixed dark brushed-metal palette `#111115` / `#1A1A1E` cards, radius 24px, mint `#66BB6A` / `#5FD3B3`, amber `#FFB74D`, blue `#4FC3F7`.
- Cards `.card`, collapsible boxes `details.ideabox` with icon + title + one-line subtitle, chips `.chip`, buttons `.btn` / `.btn.ghost`, bottom-sheet pickers `.picker/.pickbox`.
- **Icons are off** (user's choice, Oct 2026: "remove them all and see how it looks"): `const ICONS=false` in `20-core-tuner` makes `SK()` return nothing (except the bottom bar, drawn with `SKA()`); set it to `true` to bring every icon back. I'm learning shows what a song has as short words (`.ltag`, `LTAG`). The gear list and gear page keep the guitar / amp picture when there's no photo (`SKA`). **Preview picture** (`it.cover`, a photo id or `'main'`): Overview › "Use this photo as the preview in My gear"; the strip marks it "Preview"; without a choice the main photo, else the first other photo, is used (`gpCover`); the list loads previews kept in the phone database (`gpCoversLoad`). Editing the details keeps every field the form doesn't show (more photos, control marks, the preview). The icon system, when on: **pedal tiles, no emoji**. Each icon is a line drawing of a guitar-world object on a small dark metal tile with a coloured status LED (`SK('TUNE')` → `<span class="pd">`; drawings in `PDI`, label → drawing + LED colour in `PDM`; size via `--s`). Static HTML uses `<span data-pd="LABEL"></span>`, drawn at start. Labels: TUNE LEARN WRITE GEAR · LIB ADD VIDEO SCAN MIX DRAFT SHEETS SHEET LESSON IDEAS DRIVE NOTE · GTR (L/C/R) VOX DRM BASS KEYS OTHER · AMP MODEL PHOTO RANGE TIP CLEAN HUMID REPAIR STRINGS ASK PROFILE GALLERY CTRL CHORDS · FINDER DEL OK; the locked peg uses the same tile style. Don't add colour emoji to the UI. Text symbols (♭ ♯ ✕ ↗ ✓ ↻ ⛶ ❚❚) stay.
- **App icon (Oct 2026 redesign, the user's spec):** a matte black guitar pick with 6 diagonal string slots cut through it (top-right to bottom-left), on a fiery gradient (deep red-orange at the top to amber at the bottom) with soft flames rising from the bottom and a glow; soft drop shadow, fine grain, a faint rim. Source: `docs/guitaring-icon.svg` (also inline as `#appLogo` in `10-markup`: the header logo and the welcome screen). Exported with Chromium: `icon-192.png` / `icon-512.png` with the rounded corners (radius 115 of 512, transparent outside), `icon-maskable-512.png` full-bleed with the pick at 76 % (inside Android's crop circle), `apple-touch-icon.png` 180 full-bleed (iOS rounds it). The **beta** installs with these from `beta/` (`beta/manifest.webmanifest`); the live icons at the repo root are replaced by copying them at the next release (the beta's page `<link>` icons follow then too). Android updates an installed icon on its own within about a day; removing and adding the home-screen icon shows it at once.
- **Guitaring's picture as a song's cover** (`covDef`, Oct 2026): until a song's album cover is found, and for good when none fits or the song has no artist, the app icon stands in: the light background behind the name on the song's page (`.seshero.covdef`) and the small picture in Learn (`.lcov.def`); a real cover replaces it as soon as it arrives.

---

## 9. Code map

Since V2 phase 0 the source is split into parts (`src/parts/`, joined in name order by `tools/build.sh`):

| Part | Holds |
|---|---|
| `00-head-style` | fonts + all CSS |
| `10-markup` | HTML of every screen (welcome, tabs, panes, sheets, pickers) |
| `15-splitter-workflow` | the GitHub Actions workflow text the app installs (`#mxWf`) |
| `20-core-tuner` | app script starts: icons (`PDI`/`SK`), tunings, **storage names** (`KP`, `KG`, `IDBN`, `BETA`, `betaCopyLive`), `store`, tuner |
| `30-song-analysis` | chord vocabulary, audio analysis, Basic Pitch, song view, Claude via API key |
| `40-sheet-drive` | chord sheet, My songs, PDF, Drive |
| `45-writer-ocr-catalog` | writer, chord finder, screenshots/PDF → sheet, sheet catalog |
| `50-video-lessons` | video lessons |
| `55-chord-book` | chord book + Chords tab |
| `60-lesson-view` | lesson view |
| `65-band-breakdown` | practice mixer / Band breakdown, phone database helpers (`mxDB`, `mxGet` with the beta's read-through, `mxPut`, `mxDel`), GitHub splitter |
| `70-welcome` | welcome + jokes |
| `75-gear` | My gear |
| `80-learning-ideas` | I'm learning (My learning library), song ideas, gear chat |
| `66-drive-song` | add a song from a Drive link: `gdTokenFull`, `openAddSong`, `dsSubmit`, `dsCollect`, `dsSaveLater`, `dsRows` |
| `67-auto-session` | the session builds itself after a split: `asBuild`, `asRun` (guitars-only part → analysis `song.mix_<id>`), `mkList` (what is being made), `asStart` (Build the song guide), `asOpenSong`, `asSides`, `asNotesAtOnce` |
| `68-video-look` | the song's video in the session build: `vlFind`, `vlTimes`, `vlFrames`, `vlAsk`, `vlApply`, `vlLook`, `vlNote` |
| `86-karaoke` | play along with the video in the guide's Full tab: `karaHas`, `karaBlocks`, `karaOffset`, `karaLoadDrive`, `karaHTML`, `karaMount`, `karaStop` |
| `87-song-cover` | the song's name and album cover: `songClean`, `songIdent`, `anaIdent`, `coverKey`, `covFits`, `covSearch`, `covMake`, `coverFor`, `covPaint`, `covWarm` |
| `82-song-records` | song records `songs2`: `sameSong`, `songRec`, `songStatus`, `songTouch`, migration `v2MigM2` |
| `83-song-session` | song session page: `openSession`, `renderSession`, `sesFacts`, `sesPractise`, `sesDiagram` |
| `84-song-guide` | song guide Easy / Full: `gdBuild`, `gdParts`, `gdEasyPick`, `gdEasyVers`, `gdEasyAt`, `gdHTML` |
| `90-v2-shell` | V2 navigation (`goSec`, `v2Hide`, `v2After`, pages + history), Home, Jam, My Library, My profile, profile (`profGet`/`profSet`/`profTaste`/`profPrefill`), M1 (`v2MigM1`), onboarding (`openOnb`, `obRender`, `OB_OPTS`, `OB_STEPS`), `v2Start` |
| `85-backup` | backup and restore (`bkMake`, `bkOpen`, `bkRestore`, `safetyCopy`, ZIP writer/reader) |
| `99-startup` | start-up calls; the app script closes here |

The line numbers below are from v86 (single file) and only show the order of sections inside the parts; search the banners.

| Lines | Section (search for the banner text) | Key functions / ids |
|---|---|---|
| 4–705 | `<style>` (tuner hardware CSS from 576) | |
| 706–1062 | HTML: `#cfWrap` chord finder 719, `#welcome` 733, `#paneTune` 761, `#paneGear` 819, `#paneChords` 822, `#paneSong` 836 | |
| 1063–1393 | Core + **tuner** (`TUNINGS`, `store`, gauge, headstock, pitch engine, auto-stop) | `renderStrings`, `setTuning`, `detect`, `octaveFix`, `autoStopCheck`, `loop`, `startListening`, `stopListening` |
| 1394–1500 | `Learn a song`: chord vocabulary, shapes, diagrams | `TYPES`, `LIB`, `parseChord`, `nameOf`, `shapeForSeg`, `diagram` |
| 1499–1694 | audio analysis, Basic Pitch, tuning guess | `decodeFile`, `transcribe`, `analyse`, `guessTuning` |
| 1695–2094 | song UI, confidence, refit, feedback | `runAnalysis`, `showSong`, `renderTimeline`, `chordConfidence`, `refit2` |
| 2095–2272 | reading chords from the video (Claude / on-phone OCR) | `readFromVideo` |
| 2273–2368 | Claude via API key (phone) | `apiCall`, `makeApiSample`, `claudeOn/Off` |
| 2369–2667 | sheet, My songs, PDF, Drive | `sheetHTML`, `showSheet`, `makePdf`, `saveToLib`, `clearAfterDrive`, `gd*` |
| 2668–2952 | **writer** + **chord finder** | `openWriter`, `renderWLines`, `pickerHTML`, `wPush`, `identifyChord`, `cfRender`, `cfResult`, `bookMine` |
| 2953–3171 | screenshots/PDF → sheet (OCR) | `shotAdd`, `wordsToLines`, `metaFromLines`, `sheetFromShot` |
| 3172–3205 | sheet catalog | `chordLevel`, `catalogAll`, `renderCatalog` |
| 3206–3413 | **video lessons** | `ytId`, `vlParse`, `vlFindSheet`, `renderVids`, `vlStart`, `renderSheetVid` |
| 3414–3517 | chord book + Chords tab | `canon`, `bookAdd`, `voicings`, `fingerize`, `renderBook`, `renderChordDetail` |
| 3518–3680 | lesson view | `lessonModel`, `autoSections`, `buildNeck` |
| 3681–3751 | welcome + jokes | `JOKES`, `pickJoke`, `renderWelcome` |
| 3752–4272 | my gear | `GEAR`, `renderGear`, `renderInstForm`, `instAdvice`, `guitarSVG`, `panelSVG` |
| 4273–4519 | song ideas, gear chat | `loadDailyIdeas`, `renderIdeas`, `ideaAuto`, `renderGearChat` |

Test hooks kept in production (harmless, no UI): `window.__tunerTest` (needle/head/state), `window.__tlog` / `__plog` / `__alog` (only when the page sets them).

---

## 10. Build, release, deploy

```bash
bash tools/build.sh      # src/parts/*.html -> index.html (repo root); bash tools/build.sh beta -> beta/index.html
bash tools/release.sh    # build + bump sw.js guitaring-vNN -> guitaring-v(NN+1)
# deploy: commit src/parts/ + index.html + sw.js, push / merge to main (GitHub Pages serves main)
```
- Until 13 Oct 2026 the user uploaded built files through GitHub's web upload. From now on changes are made with Claude Code in the repo; `src/parts/` and `index.html` must always be committed together.
- Always bump `sw.js` with any `index.html` change.

---

## 11. Testing

`tests/` contains Playwright scripts (Node). Setup: `cd tests && npm i && npx playwright install chromium && bash ../tools/get_test_samples.sh`. Run each with `node <file>`; set `APP=` to test a deployed URL and `CHROMIUM=` to use a specific browser binary. Screenshots go to `tests/out/`.

| Test | Checks |
|---|---|
| `tun_ui.js` | tuner renders (light/dark), peg labels, lock chip, needle spring settles at the right angle, Drop D labels |
| `tun_mic.js` | fake mic (A +8¢) → correct string, status, ♯ lit, lock/unlock, stop |
| `tun_real.js <mp3…>` (env `HP=0,250,400`, `RATE`) | real guitar recordings through a phone-like highpass; octave errors |
| `tun_jit.js` | needle steadiness on in-tune recordings (sd < 2°) |
| `tun_resp.js` | responsiveness: −20¢ → 0 glide, jump to +8¢ |
| `tun_hiE.js`, `tun_hiE2.js`, `tun_quietE.js` | high E: fast decay, re-plucks, sympathetic strings, quiet/noisy, noise-filter modes |
| `tun_auto.js <scenarios>` + `noisegen.js` | auto-stop: strum/chord changes/melody stop; tuning/sixQuick/checkStrum/quickPlucks don't; wind/traffic/chatter/birds/street never "playing" (`LVL`, `END`) |
| `cf_t.js`, `cf_barre.js`, `cf_touch.js`, `cf_dup.js` | chord finder names (G, C, D/F#, capo, Drop D, Bm7b5, F/Bm barre, C7), touch taps, board doesn't move, no duplicate adds |
| `vl_t.js`, `vl_sheet.js` | video lessons: parsing, sheet match, duplicates, share target, sheet banner |
| `clean_t.js` | song ideas closed by default and after revisiting Songs |
| `joke_t.js` | fresh jokes first, escaping |
| `learn_t.js` | I'm learning: merged rows across sources, five tiles, filters, search, details/actions, Hebrew/English artist merge, suggestions card |
| `ctl_t.js` | controls on your photo: place/move/remove marks by hand, Claude finds them (API mocked, photo sent), drawing toggle, marks persist |
| `ctlfs_t.js` | crowded marks: smaller rings, numbers never on top of each other in full screen; full screen opens, tap/step through controls (zooms, crosses photos), double-tap zoom, place marks, ✕ and back button return to the same photo and control |
| `gp_t.js` | more photos: add/show/persist (IndexedDB), marks per photo, list jumps to photo, Claude sees all photos + adds unlisted controls (mocked), remove photo, amp without photo, old close-up migrated |
| `mx_send_t.js` | sending to GitHub (API mocked): retries the start after a fresh splitter install, error names the step and quotes GitHub, Try again order |
| `mx_silent_t.js` | a silent file is not sent to GitHub (red message), one with sound is, an undecodable one still is; phone split says so; an all-silent split says why when opened |
| `mx_save_t.js` | Save this mix: exactly the chosen parts at full length/rate after playing, Everything, silent guitars and all-muted give a message not an empty file, short part, guitars → chord analysis |
| `nav_t.js` | V2 navigation: opens on Home (greeting, joke, Continue, 4 tiles); 22 V1 features each reachable in their new place; chord finder from Write; tuner one tap from every section, ✕ returns, closing stops listening; back button / ‹ on pages; the old tab bar is gone |
| `onb_new_t.js` | onboarding for a new player: privacy line, Finish later + Home card + no re-popup, all screens in order, progress, skip, typed artist/dream song, summary, profile saved and used (greeting, song-idea language), doesn't return, My profile shows answers, Change my answers, no built-in taste |
| `onb_old_t.js` | existing player: M1 prefill (name, languages, instruments, level, artists, chords), V1 data unchanged (also after finishing), log + safety copy, only gap screens asked, runs once, an interrupted first run reruns identically, Undo removes only V2 data |
| `split_t.js` | the source parts join into the page verbatim and in order, one app script, every part ends with a newline; `LIVE=1`: the committed `index.html` is exactly a fresh build |
| `bk_t.js` | backup: real ZIP (checked with Python's zipfile), keys out by default, counts; wipe → restore identical (typed arrays, Blobs, Files); Add what's missing never overwrites; Replace everything (two taps); without parts (smaller, keeps phone parts on replace); damaged / cut-short / foreign files refused with nothing changed; safety copy |
| `bkdrive_t.js` | backup to Google Drive (mocked): one tap, folder made once, resumable 8 MB pieces with a failed piece resent, a valid ZIP arrives, older than 5 trashed, green toast + notification, refused upload red + notification, sheets unchanged |
| `lib2_t.js` | V2 phase 2: M2 makes one record per learning-list song (links to sheet, Drive file, lesson, jam track; same song across scripts shares one), V1 keys unchanged, safety copy, runs once; status Learned / Idea and the status and artist filters; a later song gets its record when touched; My Library's learning entry; the backup holds the records; undo clears the statuses |
| `gcover_t.js` | My gear preview picture: amp picture without photos, first photo by default, pick another (visible in the list, after a reload), editing keeps photos and choice, removing the chosen photo falls back |
| `home_fit_t.js` | Home doesn't scroll and all four tiles are fully visible above the bottom bar and the player, from 360×560 to 412×860, with Continue cards; other sections still scroll; the four titles line up and fit their tiles; with the display font Learn / Write / Jam about twice as big as “Check my gear”; the joke bubble shows whole lines |
| `mx_ui_t.js` | the player as a mixing desk: title / artist, one coloured strip per part with fader, meter and M / S, times, ±5s, meters move while playing and drop on pause, a fader changes only its part |
| `key_t.js` | faint thirds (also an F#m with the 9th on top, not F#add9): a generated guitar part like "במקום בו אני גר" (root and 5th, faint minor 3rds, the roots' overtone on the major 3rd) is heard C#m · A · E · F#m, not C# / F# (fails without `keyFit`) |
| `ses_t.js` | song session: opens from Learn, title/artist/tuning/capo, what it has, Practise picks the best material and opens it, chord diagrams (incl. built ones), status and notes saved, jam buttons set the player, chord finder, ‹ and back return to Learn |
| `guide_t.js` | song guide against the reference "שאריות של החיים" (capo 2, 108 BPM, Cadd9 · Asus2 · Fmaj7 · G, D · DU · UDU): before you play, how sure, Full and Easy chords, strumming, song map with repeating parts and no lyrics, level picks the tab, play-along; a messy analysis is "a guess"; a player who varies one strum per bar still reads D·DU·UDU, the bars follow it 85% |
| `mx_speed_t.js` | jam track at Slow / Medium / Full: the song moves at 0.6× / 0.8× real time and a 440 Hz tone stays 440 Hz, meters move, seek works, back to Full |
| `ds_t.js` | add a song from Drive (Google, Drive, GitHub mocked; a folder link picks its video and audio; the job names the video; an MP3 alone gets its folder's video; a clean name is taken, a live video's name asks for the song and artist first; the stills come back and are kept): YouTube / non-Drive / no GitHub / a document refused with a reason; video + audio → drive.json job (audio source, folder, name, sign-in); parts back, Drive MP3s linked, notification, the song's page; sign-in ran out → Save them uploads both MP3s to the folder |
| `jam_t.js` | Jam: two tiles, no list on the page; Band breakdown only creates (phone file, Drive, on-phone split, GitHub connection, being split / failed); the player only picks (its list, nothing to create, empty points to Band breakdown); a song keeps the list to play another; My jam tracks opens the player |
| `make_t.js` | a song being made stays in sight: bar with stage / % / minutes left, Home card, progress says when it last checked; ✕ → % badge (also while another song plays); amber + plain message when GitHub hasn't started, the split is slow, or GitHub can't be reached; the badge goes when it's ready |
| `auto_t.js` | the session builds itself: a split with a guitars-only part (G · C · D · Em) → the bar says Building the song’s session · 99%; it becomes done (`song.mix_<id>`), notifies, the Learn row has Play along and Jam, the guide shows G C D Em with no capo; a newer phone analysis of the same song doesn't replace the split's session in the guide; one guitar in the middle: Built from says the guitars sit together |
| `sides_t.js` | several guitars by side: a generated guitars part with G · C · D · Em strummed on the left and a single-note line on the right: the build finds them apart, analyses both sides (left about 3 notes at once, the same roots 100%; right about 1.4), and Built from says the left strums the chords and the right plays single notes |
| `backfill_t.js` | songs split before sessions built themselves: a Drive song (the real Hebrew name) gets its session on the next open with a notification; an older split isn't analysed by itself, its page offers Build the song guide, says it's building, then shows the guide; Rebuild on a guide builds it again and keeps your capo |
| `allsrc_t.js` | every source together (two guitarists in the stills: the acoustic, clear most often, is read and the electric named; the beat from a drums part: 104 BPM where the guitar alone read 144): a guitars-only part with a faint 3rd on B, a piano that plays Bm clearly, video stills made by the splitter's own step (its Python run on a generated video), a stand-in Claude and a chord sheet → the bar shows the guitars then the whole song; the whole song settles B → Bm (the key alone said B); the video from the stills (no Drive), one Claude call; Built from lists all four ✓; the guide C#m · A · E · Bm |
| `kara_t.js` | play along with the video: a generated guitar part (C#m · A · E · F#m, 2 bars each at 104 BPM) through the real build, and its video with the same sound 0.6 s late: Full shows the video instead of the map, Easy keeps the map; the offset is found (0.60 s); every change sits on a beat; mid-chord and 0.12 s either side of every change the chord shown is right; Next … in 2 (beats); tapping the lane jumps; leaving stops it; the play button is the player’s, under the video (❚❚ while it plays, ▶ when paused), −5s goes back |
| `cover_t.js` | the song's name and album cover (Apple's catalog and the picture mocked): live / video tags cleaned, a bracket that is the name kept; a live upload isn't sure, a clean "Artist - Song" is; an "Artist - Song" analysis isn't swapped; the cover by the matching artist taken (not another artist's), made into 600 / 96 px and kept; Learn thumbnail; the light background on the song's page; no sideways scroll at 360 px; reused with no second lookup; no cover remembered; Edit name (looks again even after a "no cover"); every song's cover fetched at start without opening anything (7 songs), all shown in Learn at once; a failed lookup (503) isn't kept as "no cover" and the next one finds it; an old "no cover" is looked up again; no cover found → Guitaring's picture in Learn and on the song's page (512 px, ready) |
| `vlook_t.js` | sound and video together (Drive and Claude stand-ins; two steps: find the hand on contact sheets, then read the close-ups; a video that never shows the hand: one call, listed as not helping): built after a restart without Drive → video skipped, the guide offers Rebuild and check the video; with Drive: the video found in the song's folder, read once, 8 stills in one Claude call (not told what was heard), capo 4 from the video, F# → F#m from the hand, one disagreement named with its time, Full shows Capo 4 · Am F C Dm; the hand is looked for on sheets of 4 tiles (1440 × 810) |
| `capo_t.js` | sound first, video second, the sheet a sanity check ("במקום בו אני גר" as heard, with saved notes): no capo (the saved capo 4 was a guess); the faint-3rd F# settled by the sheet to F#m; the clear C# kept and named as differing from the sheet; Asus2 / Eadd9 kept; saved; Easy the capo version; capo 4 set from the video; a sheet's capo 2 offered not applied, Use capo 2; where the video saw F# the sheet doesn't change it; an older sheet-matched guide says rebuild; no sheet: the chords as heard; Easy offers no capo and with capo 4, no capo shows C#m · A · E · F#m and its barres, the pick is kept in the profile, opens next time and shows in My profile |
| `beta_t.js` | beta: copies live data on first open, reads big items through and keeps its copy, deletes stick, live data and database untouched, reopening keeps beta changes, "Copy my live data again", own manifest; the beta installs with its own icons from beta/ at their sizes |
| `mx_t.js` | practice mixer: 44.1 kHz parts (15 kHz tone survives), no window seams, WAV render rate, old 22 kHz songs, FLAC/MP3 GitHub parts, long-song fallback, splitter v3 flags |

Not automated (manual on a real phone): real microphone behaviour on Android, Android share-target, Drive share sheet, PDF output.

---

## 12. Known issues & open items (V1)

| # | Item | Notes / next step |
|---|---|---|
| 1 | ~~High E sometimes doesn't move the needle on the user's guitar~~ | Resolved: the user's Muse tuned perfectly on 12 Oct 2026 (v92). If it comes back, add the hidden debug overlay (Hz, clarity, rms, gate, chosen string). |
| 2 | ~~Daily job can't push~~ | Resolved: the Claude GitHub App is installed; the job committed `ideas.json` itself on 13 Oct 2026. |
| 3 | Own Google Drive OAuth unused | `GDRIVE_CLIENT_ID=''`; phone saves via the share sheet. Needs a Google Cloud OAuth client to enable direct per-user Drive saving. |
| 4 | Song suggestions accuracy | Two made-up Hebrew titles slipped through (פרפרים by ברי סחרוף → חם על הירח; יש בי אהבה → בין קודש לחול). Job now must verify each song on a chord site. |
| 5 | Auto mode in big retunings | Open C / Drop C / Drop B from standard: nearest-note string choice can pick the wrong string. Workaround: tap the peg. Planned: remember the previous tuning and match each string to the range between old and new note. |
| 6 | Strong sympathetic low E | Can make a high E read as the low E in auto mode. Workaround: mute the low E or lock the peg. |
| 7 | Outdoor strumming | Not recognised as "playing" over street noise (stops via "No string heard" instead). Talking nearby can keep Listen on. |
| 8 | Video-lesson metadata | YouTube oEmbed from GitHub Pages not verified on a real phone; Instagram/TikTok need manual titles. Video links live on the phone only. |
| 9 | Single 500 KB file | Works, but hard to maintain. See V2 refactor. |

---

## 13. Decisions & explicitly rejected features

- **Song video from a link (tested, removed until a better solution).** Goal: paste a YouTube (or other) link and get an MP4, without ads, straight into "Choose a song video" with no manual steps. Findings: a browser PWA can't fetch the video files behind these links (no server), and downloading/ad-stripping raises platform-terms issues. A guided "record it with Android's screen recorder, then pick the file" helper was built and tested, then **removed** at the user's request because it still needed manual steps. Revisit when there is a fully automatic, permitted approach (see V2 backlog).
- **Lyrics are not sent to Claude** — Claude declines to reproduce lyrics; screenshots/PDFs are read on the phone (OCR / PDF text) instead.
- Tuner gauge spec asked for ±15¢; implemented as non-linear ±50¢ with ±15¢ taking most of the arc (pure ±15¢ would pin the needle for any coarse tuning).
- Peg labels follow the selected tuning (spec showed standard only).
- The "settings/compass" icon in the chord-finder design was left out (no function defined).
- UI rule: secondary sections stay collapsed until opened.

---

### UI redesign (Oct 2026)
The pre-redesign app (live v92) is kept on branch **`original-ui-ux`** ("original UI / UX"). To roll back: deploy that branch's `index.html` + `src/tuner.html` (the source file's name before it became `src/guitaring.html`) with a bumped `sw.js`.

## 14. V2 backlog (suggested, not committed)

1. ~~Debug overlay + fix for the high E report~~ — resolved per user (12 Oct 2026); build the hidden debug overlay only if the issue returns (P3).
2. **Auto string detection for retunings** (old-tuning-aware ranges) (P1).
3. **Riff / tab lines in the writer**: tap string+fret per note, printed as tab on the sheet (offered, not built) (P1).
4. **Song video from a link, done automatically** — revisit the removed feature (§13) once a fully automatic, permitted approach exists. One candidate that needs no file: **listen-while-it-plays**, live chord detection from the mic while the lesson plays on another device → editable sheet (P2).
5. Direct Google Drive OAuth for all users; sync video lessons/chord book to Drive (P2).
6. Refactor into modules (tuner, analysis, writer, ocr, gear, ideas, ui) with a bundler that still outputs one `index.html` for GitHub Pages; keep ids and storage keys (P2).
7. Left-handed fretboard/headstock option; sound on fret tap in the chord finder (P3).

---

## 15. Repo layout

```
guitar-tuner/                   ← GitHub Pages serves this root from main
├─ index.html                   ← BUILT from src/parts/ (do not edit)
├─ beta/                        ← beta build + its own manifest (own data, see §3.5)
├─ sw.js  manifest.webmanifest  icon-*.png  apple-touch-icon.png
├─ ideas.json  ideas_build.py   ← owned by the daily job
├─ CLAUDE.md  README.md
├─ src/parts/*.html             ← THE source, by feature (edit these)
├─ docs/PRD-Guitaring-V1.md     ← this document; V2-build-plan.md, V2-deployment-plan.md
├─ tools/  build.sh  release.sh  get_test_samples.sh  daily-job-prompt.md
└─ tests/                       ← Playwright checks (see §11), package.json
```
