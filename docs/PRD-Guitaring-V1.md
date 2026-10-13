# PRD — Guitaring V1

> **Status:** V1 shipped (PRD written at `tuner-v86`; live build `tuner-v92`, 13 Oct 2026 — see §5.13) · **Owner:** Yoav · **Live app:** https://yoavlan-cmd.github.io/guitar-tuner/ · **Repo:** `yoavlan-cmd/guitar-tuner` (public, GitHub Pages)
>
> This document describes what Guitaring V1 is, how it is built, and how to keep building it. Since 13 Oct 2026 the app is developed with Claude Code directly in the repo. **Agents: read §0 first.**

---

## 0. Instructions for the agent

1. **The whole app is one file: `src/tuner.html`** (~4,500 lines: CSS + HTML + one `<script>`). There is no framework, bundler or npm runtime dependency. `tools/build.sh` wraps it into `index.html` at the repo root (adds `<head>`, manifest link, service-worker registration).
2. **Never edit `index.html` by hand.** Edit `src/tuner.html`, then run `bash tools/build.sh`. For a release run `bash tools/release.sh` (build + bump the cache version in `sw.js`). Phones only pick up a new version when `sw.js` changes.
3. **The repo root is the GitHub Pages site** (`index.html`, `sw.js`, `manifest.webmanifest`, icons, `ideas.json`, `ideas_build.py` for the daily job). Deploy = commit `src/tuner.html` + `index.html` + `sw.js` and get them onto `main`.
4. **Edit surgically.** The file is long and dense (many one-line functions). Find code by the section banners listed in §9 (`/* ===== … ===== */`) and by element `id`s. Prefer small, exact replacements over rewrites. Keep existing ids, `localStorage` keys and data shapes stable — users have data saved under them (§7).
5. **Test with Playwright before shipping** (`tests/`, see §11). Every change to the tuner must re-run the tuner suite; audio behaviour is easy to break silently.
6. **Product rules that override "nice to have"** (§2): phone-first, clean and minimal UI (sections collapsed until opened), everything works without an account, nothing personal leaves the phone unless the user asks.
7. **Check §13 before re-adding anything listed there.** Getting a song video from a link was tested and removed until a better solution exists; lyrics are not sent to Claude because Claude declines to transcribe them.

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
src/tuner.html ──(tools/build.sh)──► index.html ─────┐
sw.js  (offline cache, version string tuner-vNN)      │  GitHub Pages: yoavlan-cmd.github.io/guitar-tuner/
manifest.webmanifest (PWA + Android share target)     ├─► installed on the phone as "Guitaring"
ideas.json  ◄── written daily by a scheduled ────┘
                    Claude job (tools/daily-job-prompt.md + tools/ideas_build.py)
```

### 3.1 Two runtimes, one file
The same `tuner.html` runs in two places; code branches on `window.claude`:

| | **Phone app (GitHub Pages PWA)** — primary | **Claude artifact** (claude.ai, private) |
|---|---|---|
| Claude features | User pastes own Anthropic API key (Songs › Claude features); calls `https://api.anthropic.com/v1/messages` directly with `anthropic-dangerous-direct-browser-access` (`apiCall`, `makeApiSample`). | `window.claude.use('sample')` (no key). |
| Google Drive | Share sheet (`navigator.share` with the PDF) → user picks Drive. Own OAuth (`GDRIVE_CLIENT_ID`) is wired but **empty** (off). | `window.claude.use('mcp')` Drive connector + `downloads` capability. |
| Daily ideas | Fetches `ideas.json` next to `index.html` (bypasses the SW cache). | Generates ideas itself via Claude once a day (`ideaAuto`). |

Both paths expose one internal interface: `sampleFn(prompt, opts)` / `sampleFn.json(...)` (`claudeOn(fn,limit)` / `claudeOff()`). New Claude features must go through `sampleFn`, never call the API directly.

### 3.2 Service worker (`sw.js`)
- Cache name `tuner-vNN` — **bump on every release** (release.sh does it).
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

---

## 4. Navigation & screens

Tabs (`#tabs`, `setTab(t)`): **Tuner** (`#paneTune`) · **Songs** (`#paneSong`) · **Chords** (`#paneChords`) · **My gear** (`#paneGear`). Last tab is remembered (`tab`).

- **Welcome overlay** (`#welcome`) on every app open: asks the first name once, then "Hey, {name}." + a joke + quick buttons (Tune / Learn a song / Write a song / Chords / Gear) + Skip. "Write a song" opens Songs home with all creation options visible.
- **Songs tab always opens on Songs home** (`songsHome()`), not on a sub-view. If a sheet/analysis was open, a "Resume" card (`#resumeCard`) offers to go back.
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

**Known open issue (V1):** the user still reports that on his guitar the **high E sometimes doesn't move the needle** after v84–v86 fixes; not reproduced in simulation. Next step: get a screenshot while plucking (note letter, status, lit peg) and add an on-screen debug overlay (Hz, clarity, rms vs gate) behind a hidden toggle.

### 5.2 Songs — analyse a video ("Choose a song video", `#drop`, `runAnalysis`)
- Pick a video/audio file from the phone (MP4 best). Everything is decoded and analysed **on the phone**.
- Steps: read sound → (optional, default on) "Detailed listening" with Basic Pitch (TF.js) → chord segmentation (chroma templates for maj/min/7/m7/maj7/sus2/sus4/add9, beat-synced) → tuning guess (`guessTuning`) → best capo for easy shapes (`ease`) → optional reading of chord names **written on screen** (on-phone OCR of frames, or Claude vision when on).
- Result view (`#songView`): tuning card (change tuning/capo → names re-spelled), synced video + karaoke chord lane, timeline of chord blocks (tap to edit/merge/split), confidence per chord, "How to play it" diagrams, song notes, Claude check / "better versions" (when Claude is on), search links (YouTube, chord sites).
- Feedback panel: the user types known chords/sections → constrained re-analysis (`refit2`).
- **Lesson view**: video + animated fretboard + strumming rows per bar, sections auto-detected (`autoSections`).
- Save analysis (`saveSong`, last 8 per phone) → open sheet.

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
- Gear chat with Claude (attach a photo from camera/gallery).
- Safety net: removed instruments are kept in `gearLost` with a restore box (an earlier bug deleted amps).
- All sections collapsed on every visit.

### 5.11 Welcome jokes
- 46 built-in jokes (`JOKES`, `{n}` = user's name) + extras from `ideas.json.jokes` (`jokesExtra`). Fresh extras are shown first, once each (`jokesSeen`), then random (never the same twice in a row). "Another one ↻".

### 5.12 Claude features (optional)
- Phone: Songs › Claude features → paste key → test → on. Used for: reading written chords/hand shapes in videos, chord-sheet title/artist order check, song notes / better versions / taste, gear photo fill + gear chat, song ideas re-pick.
- Never used for lyrics transcription.

### 5.13 Practice mixer (added v87–v92, after this PRD was written — spec to be completed)
- Splits one song into parts (drums, bass, other, vocals, guitar, piano) with Meta's HT-Demucs 6-stem model (ONNX Runtime Web 1.26.0 from jsDelivr; model from Hugging Face, ~285 MB WebGPU or ~136 MB CPU, cached in Cache Storage `guitaring-models`), running in a Web Worker. The guitar stem is further split left / centre / right by stereo position. Then mixed live (solo/mute per part).
- UI: `#mixNew` entry on Songs, slide-up sheet `#mxSheet` and a slim bottom bar `#mxBar` on every tab. Last separated song kept in IndexedDB `guitaring` / store `kv`.
- Optional off-phone path: a GitHub Actions workflow (`#mxWf`, "Split song", `workflow_dispatch`) the app can install and run, uploading the song to a `j-<id>` branch.
- Code: banner `/* ===== Practice mixer … */` (≈ line 3836), CSS `/* practice mixer */`.

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

- Fonts/vars: `--display`, `--body`, `--mono`; theme vars `--bg --surface --ink --muted --line --accent --ok --flat --sharp`, light + dark (`prefers-color-scheme`).
- Tuner and chord finder: fixed dark brushed-metal palette `#111115` / `#1A1A1E` cards, radius 24px, mint `#66BB6A` / `#5FD3B3`, amber `#FFB74D`, blue `#4FC3F7`.
- Cards `.card`, collapsible boxes `details.ideabox` with icon + title + one-line subtitle, chips `.chip`, buttons `.btn` / `.btn.ghost`, bottom-sheet pickers `.picker/.pickbox`.
- App icon: dark guitar-pick shape with a flaming "Y" on an orange flame gradient (inline SVG `#appLogo`, PNG icons at the repo root).

---

## 9. Code map (`src/tuner.html`, line numbers as of v86 — sections after the practice mixer CSS/HTML are shifted by ~+60…+600 lines in v92; search the banners)

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
bash tools/build.sh      # src/tuner.html -> index.html (repo root)
bash tools/release.sh    # build + bump sw.js tuner-vNN -> tuner-v(NN+1)
# deploy: commit src/tuner.html + index.html + sw.js, push / merge to main (GitHub Pages serves main)
```
- Until 13 Oct 2026 the user uploaded built files through GitHub's web upload. From now on changes are made with Claude Code in the repo; `src/tuner.html` and `index.html` must always be committed together.
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

Not automated (manual on a real phone): real microphone behaviour on Android, Android share-target, Drive share sheet, PDF output.

---

## 12. Known issues & open items (V1)

| # | Item | Notes / next step |
|---|---|---|
| 1 | **High E sometimes doesn't move the needle on the user's guitar** | Fixes in v84–v86 (hold logic, floor learning, quiet clean pitch, far-off live cents) pass all simulations. Get a screenshot; add hidden debug overlay (Hz, clarity, rms, gate, chosen string). |
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

## 14. V2 backlog (suggested, not committed)

1. **Debug overlay + fix for the high E report** (P0).
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
├─ index.html                   ← BUILT from src/tuner.html (do not edit)
├─ sw.js  manifest.webmanifest  icon-*.png  apple-touch-icon.png
├─ ideas.json  ideas_build.py   ← owned by the daily job
├─ CLAUDE.md  README.md
├─ src/tuner.html               ← THE source (edit this)
├─ docs/PRD-Guitaring-V1.md     ← this document
├─ tools/  build.sh  release.sh  get_test_samples.sh  daily-job-prompt.md
└─ tests/                       ← Playwright checks (see §11), package.json
```
