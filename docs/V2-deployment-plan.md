# Guitaring V2: deployment plan

Step 3 of the V2 brief. It builds on the approved build plan (`docs/V2-build-plan.md`) and needs your approval before any code.

---

## 1. Environments

### 1.1 Live and beta

| | **Live** | **Beta** |
|---|---|---|
| Address | `yoavlan-cmd.github.io/guitar-tuner/` | `yoavlan-cmd.github.io/guitar-tuner/beta/` |
| Built from | `src/` → `index.html` (`tools/release.sh`) | `src/` → `beta/index.html` (`tools/build.sh beta`) |
| On the phone | Your installed Guitaring app | A second app icon, **"Guitaring beta"**, with its own orange badge |
| Updates | Service-worker version bump → phone reloads once | Always loads the newest beta from the network (no bump needed) |

Both are served from `main`, because GitHub Pages only serves `main`. A beta release changes only the `beta/` folder, so **the live app's files never change during a beta**.

### 1.2 Keeping beta data apart (new, built in phase 0)

Today the beta shares the live app's data: same `tuner.*` keys, same database. With V2 migrations that is unsafe. From phase 0 on, the beta gets its own storage:

- **Small data** (`localStorage`):
  - the beta uses its own prefix `tunerb.*`;
  - on the beta's first open it **copies** your live `tuner.*` data into `tunerb.*`, so you test with your real songs, gear and settings;
  - it never writes a `tuner.*` key;
  - a "Copy my live data again" button in the beta's My profile refreshes the copy.
- **Big data** (IndexedDB: band-breakdown parts, gear photos, and later uploads and recordings):
  - the beta uses its own database `guitaring-beta`;
  - when it needs something it doesn't have yet, it **reads it from the live database and keeps its own copy**, so nothing large is duplicated up front;
  - it never writes, changes or deletes anything in the live database.
- **Installing the beta:** it gets its own small manifest (`beta/manifest.webmanifest`, name "Guitaring beta", scope `beta/`), so it installs as a separate icon instead of replacing the live app.
- **Outside the phone:** the beta never pushes to GitHub or Drive as "live". A beta profile sync writes `profile-beta.json`, which the daily job ignores. A Band breakdown started in the beta uses the same private repository (that's harmless: each job has its own branch).

The result: you can break anything in the beta and the live app doesn't notice.

---

## 2. Who does what

- **Me:** each change is a branch and a **pull request** to `main`; the Claude GitHub App is installed, so you no longer upload anything by hand. I build, run the tests, release and write the summary.
- **You:** you tap **Merge** on GitHub (2 taps on the phone).
  - **Beta PRs** are titled `Beta: …` and only touch `src/`, `beta/`, `tests/` and `docs/`.
  - **Live PRs** are titled `Release: …` and touch `src/`, `index.html` and `sw.js`.
- **Nothing extra needed** from you to deploy. You will be asked separately before anything touches Drive, the private repository or the daily job (§8).

---

## 3. Release steps per phase

Every phase runs the same cycle:

1. **Build on a branch** (`v2-p<N>-…`). Run the full test suite (§6). Screenshots at 390 px and 360 px, light and dark.
2. **Beta release:**
   - `bash tools/build.sh beta`;
   - a PR with `src/…`, `beta/index.html`, tests and docs;
   - you merge; the beta updates on the next open.
3. **You try it** on the phone with that phase's checklist (§6.3) and reply **go**, or tell me what's wrong. Fixes are more beta PRs.
4. **Live release** (only after your go):
   - first **snapshot the live version** as a branch `live-v<NNN>` (one command; it's the rollback point);
   - `bash tools/release.sh` (builds `index.html`, bumps `sw.js` `guitaring-vNN`);
   - a PR with `src/…`, `index.html`, `sw.js`, the PRD update and the test table;
   - you merge;
   - the phone picks it up on the next open (it reloads once).
5. **Summary to you:** what changed, what to check on the live app, and the rollback line for that release.

**Files per phase:**

| Phase | Files that change | Live `sw.js` bump |
|---|---|---|
| 0 Safety | `src/` split into `src/parts/*.html` (the build joins them; `index.html` byte-identical before/after the split), `tools/build.sh`, backup/restore code, beta storage, `beta/manifest.webmanifest` | yes (backup ships live **before** any V2 feature) |
| 1 Navigation, Home, onboarding, profile | `src/parts/*` (nav, home, onboarding, profile), tests | yes |
| 2 Library | `src/parts/*` (library, song records) | yes |
| 3 Song sessions + guides | `src/parts/*` (session, guide engine), test fixtures from the reference guides | yes |
| 4 Upload + automatic Band breakdown | `src/parts/*`, `manifest.webmanifest` (share target for files), `sw.js` (receives shared files) | yes |
| 5 Gear suggestions | `src/parts/*` (gear tip, pedal/accessory items in a **new** key) | yes |
| 6 Riff guides | `src/parts/*`; the splitter workflow gains an optional second job type (§7) | yes |
| 7 Basic material | `src/parts/*`, `src/lessons.json` (lesson content, built into the page) | yes |
| 8 Record myself | `src/parts/*` | yes |

---

## 4. Data safety

### 4.1 Backup before V2 (phase 0, shipped live first)

**My profile › Backup** has these actions (in V1 it sits under Songs › settings until phase 1 moves it):

- **Back up everything:** one file, `guitaring-backup-YYYY-MM-DD.zip`, holding:
  - every `tuner.*` setting and list (sheets, library, video lessons, chord book, gear, ideas, drafts, keys excluded unless you tick "include my Claude and GitHub keys");
  - all IndexedDB items: gear photos and Band breakdown parts.

  Then the phone's share sheet opens: save to Drive or to Downloads.
- **Size choice:** Band breakdown parts are big (about 20–60 MB per song). You can tick **"Without Band breakdown parts"** for a small file (a few MB); parts can be re-split.
- **Restore from a backup:**
  - pick the file and see what's in it (counts per kind);
  - choose **Add what's missing** (default, safe) or **Replace everything**;
  - restore;
  - a report shows what was restored.
- **Automatic local safety copy:** before each V2 migration step, the app saves a copy of all `tuner.*` small data inside the phone database (`backup:pre-<step>`). This is not a replacement for the file; it's for an instant undo.

**Before the first V2 live release (phase 1)** you make one full backup file. The phase 1 checklist starts with that, and the release waits for it.

### 4.2 Migration steps

The rules:
- V2 **only adds** new keys (`profile`, `songs2`, `gearExtra`, `lessons`, …);
- it never rewrites the shape of a V1 key;
- V1 keys stay the source of truth for what they hold.

| Step | Phase | What it does | Check |
|---|---|---|---|
| M1 profile | 1 | Builds `tuner.profile` from `userName`, instruments, `ideaPrefs`, `taste`, the Drive folder index, the sheets' chord levels | Every prefilled field is shown on onboarding with ✓; nothing in V1 keys changes (compared before/after) |
| M2 song records | 2 | Creates `tuner.songs2` records from the same merge the "I'm learning" list uses; each record only **points** to sheets, videos, analyses, splits | Number of library rows before = after; every V1 item is linked to exactly one record |
| M3 gear kinds | 5 | Pedals and accessories go in a **new** key `tuner.gearExtra` (V1 would not understand a "pedal" type in `instruments`) | `instruments` byte-identical before/after |

**How each step runs:**
- **Idempotent:** running it twice changes nothing.
- **Logged:** `tuner.v2mig = {done:["M1"], at:…}`.
- **Order:**
  1. take the local safety copy;
  2. build the new data in memory;
  3. check it (the "Check" column);
  4. write the new key;
  5. mark it done.
- **Report:** My profile › Backup shows a migration report (what was created, counts, any warnings).

### 4.3 If a migration fails halfway

- **Nothing is half-written.** A step writes its new key in one go, *after* the checks pass. A crash before that leaves no trace; the step runs again on the next start.
- **If the checks fail:** the step is not marked done, the app keeps working with V1 data (V2 screens show the V1 lists), and a quiet note in My profile offers "Send me the report". Nothing is lost, because V1 keys were never touched.
- **If the new data is wrong after it was written:** My profile › Backup › **Undo V2 data** deletes only the V2 keys (V1 data untouched), and the step reruns on the next start. The safety copies stay for 30 days.

---

## 5. Rollback

**The app (any phase, a few minutes):**

1. I open a `Rollback to v<NNN>` PR. It restores `src/` and `index.html` from the `live-v<NNN>` branch with a **new, higher** `sw.js` version, so phones see it as an update.
2. You merge.
3. Phones switch on the next open (it reloads once). If a phone seems stuck, close the app fully and open it again.

GitHub's "Revert" button on the release PR works too; I'd still bump `sw.js` forward.

**The data:**
- **What a rollback keeps:** because V2 only adds keys, the older version runs on the same data. V2-only data (profile, song records, guides) stays dormant and comes back if you return to V2.
- **The one exception: edits.** Edits made in V2 to shared things (a sheet, a gear item) are kept, and the older version shows them, because the shapes are unchanged.
- **If data itself is damaged:** Restore from the backup file (Add what's missing, or Replace everything).

**Rolling back a beta:** merge an older `beta/index.html`, or ignore the beta; it never affects live.

**Outside the app:** each change to the daily job or the splitter has its own rollback, noted in §7.

---

## 6. Testing before each release

### 6.1 Automated (Playwright, in `tests/`)

**The whole existing suite** runs every time: tuner (all `tun_*`), chord finder, video lessons, library, gear, controls, Band breakdown (mixer) tests.

**New tests:**

| Test | Phase | Checks |
|---|---|---|
| `bk_t.js` | 0 | Backup → wipe → Restore gives identical data (small + IndexedDB); "Add what's missing" never overwrites; corrupt file is refused with a message |
| `beta_t.js` | 0 | Beta copies live data once, never writes `tuner.*` or the live database; reads big items through and keeps its copy |
| `split_t.js` | 0 | `index.html` from the split source is byte-identical to the one before the split |
| `nav_t.js` | 1 | Every V1 feature is reachable in the new navigation (a checklist of ~30 features, so nothing silently disappears); the tuner opens in one tap from every section and stops listening when closed; back button behaviour |
| `onb_new_t.js` | 1 | New user: all 9 screens, skip any, "Finish later", summary, profile saved, greeting uses the name |
| `onb_old_t.js` | 1 | Existing user (a fixture with real-shaped data: sheets, gear, ideas, `taste`): prefilled answers, only missing screens shown, V1 keys unchanged |
| `mig_t.js` | 1–5 | Each migration: idempotent, interrupted at every point (page killed) then rerun = same result, checks catch a broken result, Undo V2 data |
| `lib2_t.js` | 2 | 8 chips, filters, search, song records link every V1 item once |
| `guide_t.js` | 3 | On fixture audio: guide has map, diagrams with fingers, strum, speeds, confidence; **no lyrics** anywhere in a guide; reference guides' facts reproduced (capo 2 / 108 BPM for the Dadon fixture; riff notes for the Tuna fixture) |
| `up_t.js` | 4 | Best-audio pick (lossless beats MP3 beats video sound beats screen recording; silent/broken files out), auto split (GitHub mocked), share-target files |
| `gtip_t.js` | 5 | Gear tip rules: acoustic part → acoustic guitar, distorted → humbucker + bridge, nothing fits → "what would" |
| `riff_t.js` | 6 | Fingering solver: playable positions, smallest hand movement, legato marks, confidence |
| `less_t.js` | 7 | Today's lesson follows level/goals/time; "I can do it" updates progress; level change is suggested, never applied |
| `rec_t.js` | 8 | Record (fake mic), name, play, delete, attach to song |

**Screenshots:** every new screen at **390 px and 360 px**, **light and dark**. I look at them before each beta PR.

### 6.2 Data tests with your real data (optional, you decide)

If you send me a backup file (without keys), I run the migrations on a copy of your real data before the beta. It stays in this session's scratch area, is never committed, and I delete it afterwards.

### 6.3 Your phone checklist (short, per phase)

- **Phase 0:**
  - make a full backup, save it to Drive, open the zip's file count in the report;
  - install the beta icon;
  - in the beta, check your songs and gear are there;
  - change something in the beta and check live didn't change.
- **Phase 1:**
  - backup first;
  - onboarding as an existing user: are the prefilled answers right?
  - Home: greeting, joke, Continue;
  - each of the 5 bottom buttons;
  - the tuner from the header: tune one string and close it;
  - open a sheet, a video lesson, a Band breakdown, a gear item, the chord book: everything you use today, in its new place.
- **Phase 2:** My Library; your learning list (same songs as before?); filters "has video" and "has Band breakdown".
- **Phase 3:** open "יא" and "שאריות של החיים" sessions; compare the guides with the reference guides; slow/medium/full play-along.
- **Phase 4:** upload a song (MP3 + a video), watch the Band breakdown start by itself, lock the phone, come back to parts + guide.
- **Phase 5:** the gear tip on 3 songs (one acoustic, one rock, one clean electric): does it make sense for your gear?
- **Phase 6:** a riff guide for "יא" at 0:33: compare with the reference.
- **Phase 7:** today's lesson; mark one "I can do it".
- **Phase 8:** record 20 seconds, name it, play it, delete it.

---

## 7. Outside the app (in an order that never breaks anything)

| # | When | Change | Order and safety | Rollback |
|---|---|---|---|---|
| A | **Built in the beta (Oct 2026)**; live with the next release | App can write `profile.json` to your **private** `guitaring-split` (My profile › "Use my profile for daily ideas", off until you turn it on) | The job ignores the file until B | Turn the switch off; delete the file |
| B | After A, **with your OK** | Update the daily job's prompt (the routine "Guitaring daily song ideas"): clone `guitaring-split` too, read `profile.json` if present (level, genres, artists, languages, goals, dream songs) and follow it; without the file, it behaves as today | `tools/daily-job-prompt.md` updated in the same PR; I update the routine's prompt in place (keeps its schedule and history) | Restore the previous prompt (kept in git) |
| C | Phase 2 (live), **with your OK** | **Move `ideas.json` to private:** the job writes it to `guitaring-split` **as well as** the public repo for a transition period; the app reads the private copy (with the GitHub key it already has) and falls back to the public one | Both copies are identical during the transition; the app works with either | The app still reads the public copy |
| D | After C is live and your phone has updated, **with your OK** | Stop writing the public `ideas.json` and delete it from `guitar-tuner` | Only after the phone has read the private copy at least once (shown in My profile) | Re-enable public writing |
| E | Only if you want it, **with your OK** | **Old public copies:** `ideas.json` stays in the public repo's *history*, which includes your song list and sheet links. Removing it from history means rewriting the repo's history (a force push). I'd only do it if you ask | Separate decision, after D | Can't be undone, which is why it's optional |
| F0 | Phase 4 (done in the beta, Oct 2026) | The splitter workflow gets **v4**: a job can name a file in your Google Drive (`drive.json`); GitHub fetches it, splits it and saves a full MP3 and a guitars-only MP3 into the same Drive folder | v3 jobs (a song file on the branch) work unchanged; v4 is installed on the next send, as today | The app reinstalls the previous version |
| F | Phase 6 | The splitter workflow gets **v5**: same as v4, plus an optional note-detection job for riff guides | The app keeps reading v4 results; v5 is installed on the next send | The app reinstalls v4 if v5 fails |

`ideas.json` format changes are **additive only** (new optional fields such as `"profileUsed": true`), so older app versions keep working.

---

## 8. Approval gates (where I stop and wait)

1. **This plan:** nothing is built until you approve it.
2. **Each phase, beta → live:** after the beta release and your checklist, I wait for your **go**.
3. **Before phase 1 goes live:** I wait until you've made the full backup.
4. **Anything touching your GitHub or Drive data, or the daily job:** steps B, C, D, E in §7, each with its own OK, even if the phase was approved.
5. **Removing anything you use today:** phase 1 *moves* every V1 feature (proved by `nav_t.js`). If anything would be dropped or merged away, I ask first and name it.
6. **Anything that costs money:** none is planned. If a phase would need one (for example LALAL.AI), I ask first.

---

## 9. Timeline and dependencies

| Order | Phase | Needs | Rough size |
|---|---|---|---|
| 1 | 0 Safety (backup, beta storage, source split) | — | S: 1–2 PRs |
| 2 | 1 Navigation, Home, onboarding, profile | 0 | L: 4–6 PRs |
| 3 | 2 Unified library | 1 | M: 2–3 PRs |
| 4 | 3 Song sessions + guides | 2 (song records), reference guides | L: 4–6 PRs |
| 5 | 4 Upload + automatic Band breakdown | 2, 3 (where uploads land) | M–L: 3–4 PRs |
| 6 | 5 Gear suggestions | 3 (song analysis), 1 (profile) | M: 2–3 PRs |
| 7 | 6 Riff guides | 3, 4 (guitars-only parts) | L: 4–5 PRs |
| 8 | 7 Basic material | 1 (profile) | L, mostly lesson content: 3–5 PRs |
| 9 | 8 Record myself | 2 (My Music in the library) | S: 1–2 PRs |

**Outside the app:** B can follow phase 1 any time; C–D follow phase 2.

**Can move earlier:** phases 7 and 8 depend only on 1–2. If you want them sooner they can move up without blocking anything.

**PR size:** each PR is one beta release you can try. "L" means about a week of back-and-forth at the pace we've had, mostly limited by your testing time, not by building.
