# Guitaring V2: build plan

Step 2 of the V2 brief. **Approved on 16 Oct 2026** with the decisions in §10. The deployment plan is in `docs/V2-deployment-plan.md`.

---

## 1. The app today, in short

Guitaring is one web app (a single source file, about 5,600 lines) that runs on your phone from GitHub Pages and works offline. It has four tabs:

- **Tuner:** a microphone tuner with a hardware-style meter, 12 tunings, auto string detection and auto-stop.
- **Songs:** this tab holds most of the app.
  - **My library:** the "I'm learning" list merges sheets, Drive songs, video lessons, mixer splits and chord analyses into one row per song.
  - **Add a song:**
    - analyse a song video into chords, tuning, capo, a timeline and a lesson view;
    - turn screenshots or a PDF into a sheet (read on the phone);
    - write a sheet by hand;
    - the practice mixer.
  - **Also here:** the daily song ideas, the sheet catalog, video lessons (including the Android share target), and the Claude settings.
- **Chords:** your chord book and the visual chord finder.
- **My gear:** guitars and amps, filled in from a photo. Each item has overview, controls on your own photos, tips, care, and a Claude chat.

Around these:

- **Welcome screen:** shows on every open, with your name and jokes.
- **Practice mixer:** 6-part split, on GitHub Actions in your private repository `guitaring-split` or on the phone. A mini-player bar shows on every tab.
- **Daily job:** every morning it scans your Drive songs folder and writes `ideas.json` (song index, Guitaring sheets, 10 song ideas, jokes) into this repo.

**Where data lives:**
- **On the phone:** small things in `localStorage` under `tuner.*`; big things in IndexedDB (`guitaring` / `kv`: mixer parts, gear photos).
- **In your Drive:** the sheets.
- **In `guitaring-split`:** the split jobs.

**One correction to the brief:** the Claude GitHub App *is* installed now. Since 13 Oct I push each change as a pull request and you tap Merge. You no longer upload files by hand. The daily job also pushes `ideas.json` itself.

---

## 2. Information architecture and navigation

```
┌────────────────────────────────────────┐
│ 🎸 Guitaring        [Tuner] [Library] [Me] │  ← header on every screen (3 small icons)
├────────────────────────────────────────┤
│                                        │
│   (the current section's screen)       │
│                                        │
├────────────────────────────────────────┤
│ ▶ mini-player (when a jam is loaded)   │
├────────────────────────────────────────┤
│  Home   Learn   Write   Jam   Gear     │  ← bottom bar, one tap to any section
└────────────────────────────────────────┘
```

**Home** (today's welcome overlay, which becomes a real page):
- A greeting from the profile, plus a joke.
- **Continue:** your last song session, or the last jam.
- **Four big tiles:** Learn · Write · Jam · Check my gear.
- Opening the app lands here; it is no longer an overlay you have to skip.

**Tuner, My Library and My profile:**
- **Tuner** opens as a full-screen page over whatever you were doing. ✕ or the back button returns you, and listening stops when it closes.
- **My Library** and **My profile** are pages reached from the header.

**Where today's features go** (nothing is removed):

| Today | V2 |
|---|---|
| Tuner tab | Header icon › Tuner page (unchanged inside) |
| Welcome overlay + name prompt | Home page; onboarding replaces the name prompt |
| Songs › My library (I'm learning) | Learn › My learning library (§4) |
| Songs › Add › Song video | Learn › Upload song materials (video → chord analysis) |
| Songs › Add › Screenshots or PDF | Learn › Upload (as the song's sheet) and Write › "Sheet from screenshots" |
| Songs › Add › Write a sheet | Write › Write a sheet |
| Songs › Add › Practice mixer | Jam › **Band breakdown** |
| Mixer sheet + mini-player | Jam › Jamming player; the mini-player stays on every screen |
| Song ideas | Learn › New songs to learn (collapsed) |
| Sheet catalog, video lessons, saved on phone | My Library › Sheets / Videos (also reachable from each song) |
| Chords tab (chord book + finder) | **My Library › My chords** (the book). The **finder** sits in Write and inside every song session |
| Claude settings (Songs › Claude features) | My profile › Connections (Claude key, GitHub split repository, Drive folder) |
| My gear tab | Gear › Checking my gear (same pages, plus per-song suggestions) |
| Android share target (video links) | Same, and also accepts **files** (audio/video/PDF/images) straight into Upload |

**Why a bottom bar on top of the Home tiles:** your brief puts the four sections on the welcome page. The bottom bar keeps every section one tap away from anywhere, as the tuner icon is. It's 5 slim buttons (approved).

---

## 3. Onboarding and My profile

### 3.1 Screens

The flow takes about 2–3 minutes. It shows a progress bar, uses big tap targets, and every screen has Skip and "Finish later". The only typing is names and favourites.

| # | Screen | Asks | Required |
|---|---|---|---|
| 1 | **Welcome + privacy** | "Your answers stay on this phone. They only go to your own Drive or private GitHub repository if you turn on backup." | — |
| 2 | **About you** | First name · Songs in: Hebrew / English / both | Name recommended (greetings) |
| 3 | **Your playing** | Playing for: <1 yr · 1–3 · 3–10 · 10+ · Level: beginner / improving / intermediate / advanced | No |
| 4 | **Quick check** (optional, replaces a guess) | Tick what you can play: open chords · barre chords · power chords · strumming patterns · fingerpicking · hammer-ons and slides · bends · reading tab | No |
| 5 | **Your instruments** | Acoustic · electric · classical · bass (chips). "Add my gear now" opens the existing gear form; it lands in Checking my gear | No |
| 6 | **Music you love** | Genre chips · favourite artists (type + suggestions from your Drive folder) · songs you dream of playing | No |
| 7 | **Goals** | Campfire · accompany myself singing · play in a band · write my own songs · improve technique · learn theory (multi-choice) | No |
| 8 | **How you learn** | Videos · chord sheets · tabs · by ear (multi) · Time: 10 / 20 / 30 / 60 min a day · days a week 1–7 · Playing context: alone / friends and family / on stage | No |
| 9 | **Summary** | "Here's what Guitaring will do for you": 3–5 lines generated from the answers (no Claude needed) · Edit · Done | — |

**Interface language** (approved). The whole interface is in English today. Translating it into Hebrew, with right-to-left screens, is a large separate job. In V2 I propose the language answer controls *song suggestions and guide language*, and a Hebrew interface becomes a later phase (§9, phase 9).

### 3.2 Existing users

On the first run after the update, everything already known is prefilled and shown ticked:

- **Name:** from `userName`.
- **Instruments:** from My gear.
- **Artists and genres:** from your Drive folder index, `ideaPrefs` and `taste`.
- **Level:** from the daily job's level sentence and your sheets' chord levels.
- **Songs language:** from `ideaPrefs.lang`.

You only see the screens with gaps, typically goals, learning style, time and the quick check.

### 3.3 My profile

My profile is the same screens, editable any time, plus three more parts:

- **Connections:** Claude key, GitHub split repository, Drive folder.
- **Backup:** export/import of all app data, plus optional sync of the profile.
- **Suggested changes:** the app may notice that your sheets now use barre chords and propose "Move level to intermediate?" with Accept / Not now. It never changes the profile silently.

### 3.4 Who uses each answer

| Consumer | Uses |
|---|---|
| Song ideas (app filters + the daily job's prompt) | level, skills, genres, artists, dream songs, songs language, goals |
| Basic guitar material | level, skills, goals, instruments, time per day |
| Song guides | level → opens **Easy** first for beginner/improving, **Full** for intermediate/advanced |
| Gear suggestions | instruments + My gear items |
| Home page | name (greeting), Continue shortcut, today's lesson from basic material |
| Practice reminders (later) | minutes/day, days/week |

The hard-coded personal default in the code (`DEFAULT_TASTE`: "Israeli rock … Mashina, Aviv Gefen …") is removed. Taste comes from the profile only, so a new user starts neutral.

---

## 4. Learning

### 4.1 My learning library

This is today's "I'm learning" list grown up: **one row per song**, with material chips in this fixed order:

`Sheet (Guitaring)` · `Drive sheets` · `Video lessons` · `Play-along` · `Jam track` · `Song guide` · `Riff guides` · `Gear tip`

Lit chips mean you have it; dim chips mean it's missing.

- **Search and filters:** search by title or artist; filter by artist; filter on any chip as *has / missing*, which already exists for five kinds; status: learning / learned / ideas I've kept.
- **Tap a song** to open its **song session**.

### 4.2 Song session (one page per song)

- **Top:**
  - title, artist, tuning and capo;
  - a "what you have" chip row;
  - one main button, **Practise**, which opens the guide at your level.
- **Song guide**, tabs **Easy | Full** (the profile picks which opens first):
  - **Song map:** sections with times (Intro 0:00 · Verse 0:14 …), labelled by name and time only, **never lyrics**.
  - **Chord diagrams with finger numbers:** from the existing diagram code; Full uses your own fingerings from the chord book when you have them.
  - **Strumming:** Easy = one strum per beat; Full = the pattern heard on the guitars-only part (down/up per eighth note), with "feel" notes.
  - **Play-along:** the existing lesson view (video or jam track + fretboard + chord lane) with **slow / medium / full speed**. Slowing down without changing pitch works on the jam track and on audio files; on a video it slows the picture too.
  - **Confidence:** every chord, section and strum pattern is marked *solid / likely / guess*, with an alternative when it's a guess ("could also be G/B").
- **Riff guides** (list + "Make a riff guide"):
  - you pick a time range (e.g. 0:33–0:36) on the waveform;
  - finger-by-finger fretboard steps (string, fret, finger, and a hammer-on / pull-off / slide / bend mark);
  - a tab line, and play-back of the original and of a synthesised version to compare by ear;
  - confidence per note.
- **Linked material:** video lessons (Watch) · sheets (Open) · jam track parts (guitars only / no guitars, opening the player) · **gear tip for this song**.
- **Built from uploads:** "Add material" (§4.3) is at the bottom of every session.

**Reference guides:** received; they are the quality bar and test fixtures for phase 3 (see §10, item 6).

### 4.3 Upload song materials (proposed definition)

**Entry points:**
- Learn › Upload song materials;
- "Add material" in any song session;
- the Android **Share › Guitaring** menu, which also accepts files in V2 (today it takes links only).

**Step 1, which song.** The app guesses title and artist from the file names, the video title and the sheet's top lines, using the same parsing as video lessons. You confirm or pick an existing song. One upload = one song; you can add more files to a song later.

**Step 2, what can go in:**

| Kind | Examples | What happens |
|---|---|---|
| Audio | MP3, M4A, AAC, WAV, FLAC, OGG | Candidate for the jam track and the chord analysis |
| Video | MP4, MOV, WebM, screen recordings | Its sound is a candidate (as above). The video is kept for the play-along *if you choose* (videos are big) |
| Sheet | Screenshots (up to 8), PDF | Read on the phone → opens in the writer as this song's draft sheet (nothing saved until you tap Make) |
| Link | YouTube/Instagram lesson, chord-site page | Saved as a video lesson / link on the song. **No downloading** of streamed audio or video (unchanged rule) |

**Step 3, picking the best audio for the split.** Each sound file is decoded and scored. Silent and broken files are out; that check exists since v105. The score prefers:

1. full-song length (the longest file, unless it's much longer than the others, which suggests a lesson with talking);
2. a higher sample rate, stereo, and lossless or high bitrate;
3. a dedicated audio file over a video's sound, and a video over a screen recording (lower quality, often mono and phone-speaker sound);
4. less clipping.

You see "Using *song.mp3* (3:45, stereo, 320 kbps)" and can pick another.

**Step 4, runs automatically:**

| Step | Where | When |
|---|---|---|
| Jam track split | GitHub (your private repository, runs while the phone is locked); the phone is the fallback if GitHub isn't connected | Right after upload |
| Chord analysis (chords, beats, sections, tuning/capo) | Phone; Basic Pitch "detailed listening" as today | Right after upload; uses the **guitars-only part** once the split is back, for better chords (a re-run is offered) |
| Song guide draft (Easy + Full) | Phone (from the analysis) | When the analysis is done |
| Gear tip | Phone rules (+ Claude if on) | When the analysis is done |

A progress card on the song shows each step: waiting, running, done or failed, with Try again.

**Storage:**
- **Kept:** the chosen audio file stays on the phone in IndexedDB.
- **Videos:** kept only if you choose "Keep the video for the play-along"; each one is 50–500 MB.
- **Storage line:** the app shows a storage line in My Library.

### 4.4 Basic guitar material (proposed scope)

**What:** short built-in lessons, each with an exercise, in four tracks:

| Track | Lessons (first version) |
|---|---|
| **Chords** | Open chords (Em, Am, C, G, D, E, A) · changing chords cleanly · F and the barre · power chords · 7th/sus/add9 colour chords · slash chords and bass walks |
| **Rhythm** | Downstrokes on the beat · down-up eighths · the "campfire" pattern (D DU UDU) · muting and accents · 6/8 and shuffle |
| **Technique** | Fingerpicking (thumb + 3 fingers, Travis basics) · hammer-ons and pull-offs · slides · bends and vibrato · palm muting |
| **Theory, light** | Keys and why capo works · chord families (I–IV–V–vi) · reading tab · the CAGED idea in one lesson |

**Lesson layout:** one screen.
- **Goal:** what you'll be able to do.
- **How:** diagrams, finger numbers and tab.
- **Exercise:** with the built-in metronome or a jam-track backing; 2–5 minutes.
- **Two buttons:** "I can do it" / "Still working on it".

Exercises use the existing chord diagrams, metronome-style clicks and the chord finder. No video production is needed.

**What you get:** "Today: 1 lesson (10 min)" on Home and in Learn, picked from your level, goals and the skills you haven't ticked. Each lesson links to 1–2 songs from your library or ideas that use it ("Barre F: you'll need it in *Wonderwall*").

**Level, kept up to date** from three signals:
- your profile answers (quick check);
- lessons you mark "I can do it";
- the chords in your sheets, using the existing `chordLevel` and the daily job's level sentence.

When the signals disagree, the app *suggests* a level change in My profile; it never changes it silently.

**Content:** I write the lessons once as a data file in the repo (no runtime cost, works offline), and you review them in a beta before release. Claude (if on) adds "Explain differently" on any lesson.

### 4.5 Song ideas

These stay under Learn as **New songs to learn**, collapsed until opened. The daily job and the in-app filters read the profile (§7). **"I'm learning it"** (today's "On it") adds the song to My learning library with no material yet; its session suggests next steps.

---

## 5. Writing

- **Write a sheet:** the existing writer, unchanged.
  - Plus **Sheet from screenshots or PDF** (moved from Songs).
  - Plus the **chord finder**.
  - A sheet started from a song session is linked to that song automatically.
- **Record myself** (first version: simple):
  - record audio (and video when the phone allows it in the browser);
  - name it, optionally attach it to a song, play it back, delete it;
  - saved on the phone in **My Library › My Music**;
  - share it to Drive via the share menu.

## 6. Jamming and Gear

**Jamming:**
- **My jamming library:** My Library's jam folder, one row per song, listing its parts and status (ready / splitting / failed), as today's mixer list does.
- **Jamming player:** today's mixer sheet:
  - sliders per part, with guitars as left/centre/right;
  - mute/solo and presets;
  - **plus** loop a section (A–B, or tap a section from the song map) and **speed 50–100% without changing pitch**;
  - the mini-player bar with ✕ stays.
- **Band breakdown** (the name for "Create split", your choice): GitHub stays first and the phone stays the fallback, as today.

**Checking my gear:**
- **The existing pages:** guitars, amps, photos, controls on photos, care, Claude chat.
- **New item kinds:** **pedal** and **accessory** (capo, strings, picks, tuner), with simple specs (pedal type, controls; string gauge and brand).
- **New on each song session:** a **gear tip** (§8, question 7).

---

## 7. Data model

**Rule:** the V2 records **point to** today's data. Nothing is moved or rewritten, so V1 keeps working and a rollback loses nothing.

### 7.1 Profile: `tuner.profile` (phone, `localStorage`)
```json
{ "v": 1, "updatedAt": "ISO",
  "name": "Yoav", "songLang": ["he","en"], "uiLang": "en",
  "years": "3-10", "level": "intermediate",
  "skills": ["open","barre","power","strum","fingerpick","legato","bends","tab"],
  "instruments": ["acoustic","electric"],
  "genres": ["israeli-rock","alt-rock"], "artists": ["Mashina","Radiohead"], "dreamSongs": [{"t":"…","a":"…"}],
  "goals": ["campfire","sing-along","technique"],
  "learnBy": ["video","sheets"], "time": {"minPerDay": 20, "daysPerWeek": 4}, "context": ["alone","friends"],
  "onboarding": {"done": true, "skipped": ["context"], "at": "ISO"},
  "pending": [{"field":"level","to":"advanced","why":"Your last 5 sheets use barre and 7th chords","at":"ISO"}],
  "sync": {"repo": false, "drive": false} }
```
`tuner.userName` stays and is kept in sync with `profile.name` (old code and tests read it).

### 7.2 Song record: `tuner.songs2` (phone index) + IndexedDB for big things

```json
{ "id": "s_k3x9", "title": "יא", "artist": "Tuna", "aliases": ["Ya"], "status": "learning",
  "createdAt": "ISO", "touchedAt": "ISO",
  "play": {"tuning": "std", "capo": 0},
  "links": {
    "sheets":   [{"src":"drive","url":"…"}, {"src":"phone","lib":"<lib id>"}, {"src":"draft"}],
    "folder":   {"a":"Tuna","t":"יא"},
    "videos":   ["<vlinks id>"],
    "analysis": ["<song.fileKey>"],
    "jam":      ["<mxIdx id>"],
    "guides":   {"easy":"g_1","full":"g_2"},
    "riffs":    ["r_1"],
    "recordings": ["rec_1"],
    "uploads":  ["u_1","u_2"],
    "gearTip":  "gt_1" },
  "notes": "" }
```

**Big things go in IndexedDB** (`guitaring` / `kv`, as the mixer and gear photos already do), each under its own key: `upload:<id>` (file + metadata), `guide:<id>`, `riff:<id>`, `rec:<id>`, `geartip:<id>`.

The library list is built from `songs2` **plus** the existing merge logic. Anything in the old stores that has no record yet still shows up, and gets a record the first time you touch it.

### 7.3 Where things live

| Data | Phone | Your Drive | Private repo `guitaring-split` | Public repo `guitar-tuner` |
|---|---|---|---|---|
| Profile | ✓ | backup (optional) | `profile.json` (optional, read by the daily job) | **never** |
| Song records, guides, riffs | ✓ | backup file (optional) | — | — |
| Uploads, recordings, jam parts | ✓ | via share/backup | split jobs only (deleted after) | — |
| Sheets (PDF) | catalog | ✓ (as today) | — | — |
| Song ideas, jokes, sheet list | cached | — | `ideas.json` (moves here, approved) | `ideas.json` until the move is done |

**Privacy note** (approved: profile and `ideas.json` go private). `guitar-tuner` is a **public** repository. The profile must not go there, so I propose the profile file lives in your private `guitaring-split`. Today's `ideas.json` is already public: it holds your Drive song list and links to your Guitaring sheets. If you'd rather keep that private, the app can read it from `guitaring-split` with the GitHub key you already gave it. That would be its own small step.

---

## 8. Answers to the open questions

1. **Onboarding:** §3: 9 screens, all optional (name recommended), with consumers listed in §3.4.
2. **Basic guitar material:** §4.4: 4 tracks, about 22 lessons; level from profile + "I can do it" + chords in your sheets.
3. **Upload song materials:** §4.3: inputs, one-song grouping, best-audio score, automatic split + analysis + guide + gear tip.
4. **Name for Create split:** **Band breakdown** (your choice).
5. **Data model:** §7.
6. **How guides and riff guides are made:**
   - **Easy and Full guides** come from the existing on-phone analysis:
     - chords, beats and sections (`analyse`, `autoSections`);
     - tuning and capo (`guessTuning`, `ease`);
     - the strumming pattern from note onsets on the **guitars-only part**, with down/up guessed from the beat position.
     - Easy = chords simplified to open/basic shapes with capo, one strum per beat.
     - Full = the detected voicings and extensions, passing chords shorter than a beat, and the pattern.
     - Runs on the phone in under a minute; no new service.
   - **Riff guides** need note detection of a short window:
     - Basic Pitch (already used for "detailed listening") on the guitars-only part, on the phone, for the chosen 2–10 seconds;
     - a fingering solver picks string/fret/finger for the smallest hand movement, preferring positions near the song's chords;
     - hammer-ons, pull-offs and slides are marked when a new note starts without a pick attack, and a slide when the pitch glides.
     - For whole songs later, the same model can run on GitHub Actions as a second job type in the split workflow.
   - **Accuracy:** checked against the two reference guides and 5–10 of your songs that have Guitaring sheets: chord match % and section boundaries within 1 s, kept as automated tests. Every item shows *solid / likely / guess*.
   - **Expectation:** riffs from a full band mix are the hardest part. I expect single-note riffs to come out usable, but chords-with-melody and fast runs will often be "guess".
   - **Claude** (optional) only writes the plain-language notes from the analysis numbers, never lyrics.
7. **Gear suggestions:** rules first, Claude optional.
   - **Analysis needed:** acoustic vs electric part (from the guitars part's sound), amount of distortion, brightness, tempo/style, tuning/capo, and hints of delay/reverb (low confidence).
   - **Rules:** they map that onto your gear:
     - which guitar: an acoustic part → the acoustic; distorted → a humbucker guitar;
     - which pickup: neck for clean/warm, bridge for drive;
     - amp starting settings: channel, gain, EQ by style;
     - effects you own: none are entered yet; pedals arrive with the new item kind;
     - tuning/capo.
   - **One sentence of reasoning.** When nothing you own fits, it says what would ("a fuzz pedal would get closer").
   - **Claude, if on:** refines this for your exact models (e.g. the Catalyst's amp types).
8. **Migration:** non-destructive.
   - New keys only (`profile`, `songs2`); the V1 keys stay untouched.
   - The profile is prefilled from existing data.
   - Song records are created on demand from the existing merge.
   - Phase 0 adds a **one-tap backup** (export everything to a file / Drive) before any V2 release.
   - Details go in the deployment plan.

**Outside the app, the daily job:**
- **Reads** `profile.json` from your private `guitaring-split` repository; the app writes it there when you turn on "Use my profile for daily ideas".
- **Without the file:** it works as today.
- **Prompt change:** the job's prompt gets a step "read the profile: level, genres, artists, languages, goals, dream songs; obey them".
- **`ideas.json`:** gains only optional fields, so older app versions keep working.

---

## 9. Phases (each one usable on its own)

| # | Phase | What you get | Size |
|---|---|---|---|
| 0 | **Safety first** | One-tap **Backup / Restore** of everything (localStorage + IndexedDB) to a file you keep or share to Drive · source file split into parts that the build joins back into one `index.html` (easier, safer edits; same app) | S |
| 1 | **New navigation + Home + onboarding + My profile** | Header icons, bottom bar, Home with Continue, onboarding (new + existing users), My profile with Connections and Backup. **All current features moved** into Learn / Write / Jam / Gear / Library; nothing removed | L |
| 2 | **Unified library** | My Library page (Learning, Jamming, My Music, Sheets, Videos, My chords) · My learning library with 8 chips + filters · song records | M |
| 3 | **Song sessions + guides** | Song session page, Easy/Full guide (map, diagrams with fingers, strumming, play-along slow/medium/full, confidence) · checked against the reference guides | L |
| 4 | **Upload with automatic jam track** | Upload flow, file share target, best-audio pick, auto split + analysis + guide draft, progress card | M–L |
| 5 | **Gear suggestions** | Pedal + accessory items, gear tip on each song, reasoning sentence | M |
| 6 | **Riff guides** | Pick a range → fretboard steps, tab, compare by ear, confidence | L |
| 7 | **Basic guitar material** | 4 tracks of lessons, today's lesson on Home, level suggestions | L (mostly content) |
| 8 | **Record myself** | Record, name, play, delete, attach to a song, My Music | S |
| 9 | *(later)* Hebrew interface | Full Hebrew UI with right-to-left layout | L |

**Plan change (17 Oct 2026, the user):** phases **6 (riff guides)**, **7 (basic guitar material)** and **9 (Hebrew interface)** move to the **backlog**, to be prioritised later (PRD §14). The plan now ends with **5 (gear suggestions)** and **8 (record myself)**, each shipped step by step: beta, your try, then live.

| # | Phase | Status (17 Oct 2026) |
|---|---|---|
| 0–4 | Safety, navigation, library, song sessions, upload | Live (v110) |
| 5 | Gear suggestions | Building (pedals and accessories; gear for this song) |
| 8 | Record myself | Next |
| 6, 7, 9 | Riff guides, basic material, Hebrew interface | Backlog |

**Notes on the order:**
- Phases 0–2 are mostly reorganisation, so they come first: low risk, and everything after builds on them.
- Riff guides (6) are split out from song sessions (3), so the solid parts ship without waiting for the hardest one.
- Each phase ships first to a **beta address** for you to try, then to the live app. That is the deployment plan's job; I'll write it once you approve this.

---

## 10. Decisions (answered 16 Oct 2026)

1. **Bottom bar:** yes, Home · Learn · Write · Jam · Gear, in addition to the Home tiles.
2. **Chords tab:** the chord book goes to My Library › My chords; the finder goes into Write and song sessions.
3. **Interface language:** English UI in V2; the language answer drives songs and guides; a Hebrew UI is a later phase.
4. **Split name:** **Band breakdown**.
5. **Privacy:**
   - the profile lives in the private `guitaring-split` repository, never the public one;
   - `ideas.json` moves to the private repository too.
6. **Reference guides:** received (Tuna "יא" riff guide, Amir Dadon "שאריות של החיים" guide). What they set as the bar:
   - "how sure is this" per item (chords/order, capo/shapes, voicings, strumming);
   - a "before you play" block with capo, BPM and the reasoning behind tuning/capo;
   - an easier alternative (e.g. the riff all on one string);
   - steps that say where the hand moves;
   - times measured on the guitar-only file, with the offset to the video stated.
7. **Phase order:** as listed in §9.
8. **Phase 0 source split:** yes.
