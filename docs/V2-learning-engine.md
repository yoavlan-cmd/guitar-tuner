# Guitaring learning engine (Oct 2026)

Yoav's brief: the app is the source of truth for how to play a song. Chord detection = (1) the most accurate reading of the sound
and the video, (2) a session the app keeps improving as it learns. Never show a nearby chord instead of the one played. The app keeps
notes of every issue, so later builds take them into account. Every day at 5:00 (Israel) a process builds the sessions again with
what was learned up to then and lists what would change and how much it improves; Yoav reads a few lists before deciding how new
versions reach the app. Guardrail (his words): "I want to have a clear understanding what impacted what. I don't want that the
engine will go crazy every update."

## Pieces

| Piece | Where | What |
|---|---|---|
| Any chord drawn as itself | `30-song-analysis` `shapeForSeg` / `segShapeOk`, `55-chord-book` `voicings`, `83-song-session` | A diagram must sound exactly the chord's notes, bass lowest; otherwise the shape finder draws it from its notes. |
| Learning log | `69-learn-log` (`KP+'learn'`, backed up) | Notes per session build: least sure chords, video disagreements, chords BTC hears that Guitaring can't name yet (dim, aug, 6, m6, mMaj7, dim7, m7b5); and every chord edit (heard → fix). Sounding names, seconds. |
| Engine version | `ENGINE_V` (code) + learned step → id `code.step`, e.g. `1.3` | Bump `ENGINE_V` with every change to how chords are found. Sessions (`a.eng`) and notes carry the id. |
| Learned settings | guitaring-split, branch `learn`: `engine/engine.json` | `{cur:{code,v,tune,commit}, log:[…], tried:[…]}`. The app applies `cur.tune` when `cur.code === ENGINE_V`. |
| Session copies | branch `learn`: `sessions/<key>.json`, `learn.json` | Sent after a build or an edit and once a day (`lsSync`). |
| Kept parts | branch `keep-<id>` | The split's result commit, kept instead of deleted (no upload). Songs split before this: Rebuild splits once more. |
| Daily check | `.github/workflows/daily.yml` (main), `tools/daily.js` (branch `bench`) | See below. |
| The list | branch `learn`: `daily/<date>.json`, `daily/latest.json`; new versions in `versions/<key>/<id>.json` | Shown by `93-session-news` ("What's new in your sessions", Home card, a notification once per list). |

## The daily check, step by step

1. **Engine.** The app's `ENGINE_V`; a new one is logged with the app's detection commits since the last (what changed). Each code
   version's app is kept (`engine/app-<code>.html`) so older engines can run again.
2. **Learning, guarded.** A few small steps (±10 %, one setting each, a different few each day) are tried on the test songs (bench
   truth) and on Yoav's edits. A step is taken only if **no test song gets worse on any score** (root, major/minor, exact), **no edit
   is lost**, and the gain is real; **at most one step a day**. The step gets a new engine id and a plain note (what, why, scores
   before/after). Everything tried is kept (`tried`).
3. **Sessions.** Only sessions made with an older engine are built again: with their own engine and with today's, on the same kept
   parts on the same machine, so any difference is the engine's. The video's reading is reused (no Claude call).
4. **Compare.** Per song: the places where the Full chords change (from → to), the share of the song, capo / tuning / tempo changes,
   and the evidence old vs new (Yoav's edits ×3, the hand in the video ×2, BTC ×1): better / worse / unclear. Size: small (< 3 %),
   medium (3–15 %), big (> 15 %). Each change names its cause: the engine log entries since the session's engine.
5. Nothing changes on the phone.

## Cost

GitHub's free minutes: about 10–20 minutes on a normal day (the tries), more on a day the engine changes (each session built twice).
No Claude calls.
