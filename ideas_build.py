#!/usr/bin/env python3
"""Builds ideas.json for Guitaring's daily song ideas.

  python3 ideas_build.py context            -> prints the current songs + recent suggestions (to avoid repeats)
  python3 ideas_build.py write INDEX SUGG [SHEETS] -> cleans, checks and writes ideas.json
  python3 ideas_build.py sheets SHEETS      -> only refreshes the list of Guitaring sheets in ideas.json
  python3 ideas_build.py jokes JOKES        -> adds new welcome-screen jokes (JSON list of strings, each with {n} for his name)

SHEETS: the Drive search results for  mimeType = 'application/pdf' and (fullText contains 'Guitaring' or fullText contains 'LYRICS & CHORDS' or fullText contains 'PROGRESSION')  (snippetVerbosity BRIEF),
        as a JSON list of {"title","viewUrl","createdTime","contentSnippet","folder" (artist folder name, optional)}

INDEX: {"artists":[folder names], "songs":[{"a": artist folder, "t": file title, "ch": [chords], "capo": n, "tuning": "..."}]}
SUGG:  {"level": "...", "suggestions":[{"title","artist","style","difficulty":1-5,"chords":[...],"capo":0,"tuning":"Standard","why"}]}
"""
import json, re, sys, os, datetime, unicodedata
OUT = os.path.join(os.getcwd(), 'ideas.json')  # run it from the repo root
CHORD = re.compile(r'^[A-G](#|b)?(maj7|maj9|maj|m7b5|m7|m9|m6|m11|mmaj7|m|dim7|dim|aug|sus2|sus4|sus|add9|add11|7sus4|7b9|7#9|13|11|9|7|6|5|4)?(/[A-G](#|b)?)?$')
MARKS = re.compile('[‎‏‪-‮]')
JUNK = re.compile(r'^(untitled( document)?|מסמך ללא שם|document\d*|img[_-]?\d+|vid[_-]?\d+|\d+)$', re.I)

def norm(s): return re.sub(r'\s+', ' ', unicodedata.normalize('NFKC', str(s or '')).lower()).strip()
def clean_title(t):
    t = MARKS.sub('', str(t or ''))
    t = re.sub(r'\.(pdf|docx?|txt|rtf|odt|jpe?g|png|mp4|mov|m4a|mp3)$', '', t, flags=re.I)
    t = re.sub(r'^(copy of|עותק של)\s+', '', t, flags=re.I)
    return re.sub(r'\s+', ' ', t).strip()
def clean_chord(c):
    c = MARKS.sub('', str(c or '')).replace('\\#', '#').replace('ᶥ', 'm').replace('♯', '#').replace('♭', 'b').strip()
    return c if CHORD.match(c) else None
def split_name(title, folder):
    t = clean_title(title); a = clean_title(folder)
    m = re.match(r'^(.+?)\s*[-–—]\s*(.+)$', t)
    if m:
        left, right = m.group(1).strip(), m.group(2).strip()
        heb = lambda x: bool(re.search('[\u0590-\u05FF]', x))
        # split "Artist - Song" only when the left part is the artist: no folder, same name as the folder, or the folder name in the other alphabet
        if not a or norm(a) in norm(left) or norm(left) in norm(a) or heb(left) != heb(a):
            if not re.match(r'(?i)^(acoustic|live|cover|demo|remix|lesson|tab|chords|אקוסטי|הופעה)$', right):
                a = a or left; t = right
    return a, t

OPEN_CH = set('C D E G A Am Em Dm E7 A7 D7 G7 C7 B7 Am7 Em7 Dm7 Cmaj7 Fmaj7 Gmaj7 Dmaj7 Amaj7 Emaj7 Dsus2 Dsus4 Asus2 Asus4 Esus4 Esus2 Cadd9 Gadd9 Dadd9 Em9 A5 D5 E5 G5 C5 G6 C6 D6 E6 A6 Am6 Em6 Dm6'.split())
def chord_level(chs):
    ch = list(dict.fromkeys([c for c in chs if c]))
    if not ch: return 0
    barre = sum(1 for c in ch if c.split('/')[0] not in OPEN_CH)
    ext = sum(1 for c in ch if c.split('/')[0] not in OPEN_CH and re.search(r'(maj9|m7b5|dim|aug|13|11|9|6)', c.split('/')[0]))
    sc = len(ch) * .45 + barre * 1.5 + ext * .6
    return 1 if sc < 3.2 else 2 if sc < 5 else 3 if sc < 7.5 else 4 if sc < 10.5 else 5

def parse_sheet(f):
    sn = str(f.get('contentSnippet') or '').replace('\\#', '#')
    sn = MARKS.sub('', sn)
    head = re.split(r'LYRICS\s*&\s*CHORDS|PROGRESSION', sn, flags=re.I)[0]
    m = re.search(r'([\u0590-\u05FF][\u0590-\u05FF ."\'׳״-]*?)[ \t]+Artist', head) or re.search(r'Artist[ \t]+([^\n]+?)[ \t]+(?:Tuning|Capo|CHORDS)', head) or re.search(r'Artist[ \t]+([^\n]+)$', head, re.M)
    artist = (m.group(1) if m else '')
    if f.get('folder') or len(re.findall(r'[^\W\d_]', artist)) < 2 or re.search(r'\d', artist): artist = f.get('folder') or artist  # the artist folder name wins, so filters stay consistent
    tm = re.search(r'Tuning\s+([A-Za-z][A-Za-z ]*?)\s*\(', head)
    cm = re.search(r'Capo\s+(?:fret\s+)?(\d+|none)', head, re.I)
    part = re.split(r'\bCHORDS\b', head)
    toks = re.findall(r'\S+', part[1]) if len(part) > 1 else []
    chs = []
    for t in toks:
        c = clean_chord(t)
        if c and c not in chs: chs.append(c)
    for line in sn.split('\n'):  # chord-only lines further down the sheet
        w = line.split()
        if w and all(clean_chord(x) for x in w):
            for x in w:
                c = clean_chord(x)
                if c not in chs: chs.append(c)
    title = re.sub(r'\.pdf$', '', str(f.get('title') or ''), flags=re.I).strip()
    if artist and norm(title).startswith(norm(artist) + ' '): title = re.sub(r'^\s*[-–—]\s*', '', title[len(artist):]).strip()
    return {'title': title, 'artist': artist.strip(), 'capo': int(cm.group(1)) if cm and cm.group(1).isdigit() else 0,
            'tuning': (tm.group(1).strip() if tm else 'Standard'), 'chords': chs[:24], 'level': chord_level(chs),
            'url': f.get('viewUrl') or '', 'at': f.get('createdTime') or ''}

def build_sheets(raw):
    out, seen = [], set()
    for f in raw or []:
        if not isinstance(f, dict) or not f.get('title'): continue
        e = parse_sheet(f) if 'contentSnippet' in f else {**f, 'level': f.get('level') or chord_level(f.get('chords') or [])}
        k = norm(e['title'])
        if k in seen: continue
        seen.add(k); out.append(e)
    return out

def load(p, d=None):
    try:
        with open(p, encoding='utf-8') as f: return json.load(f)
    except Exception: return d

def context():
    cur = load(OUT, {}) or {}
    print('Songs already in the folder (last scan):')
    for s in (cur.get('index') or {}).get('songs', []): print(f"  {s.get('a')} - {s.get('t')}")
    print('Suggested before (do not repeat):')
    for h in cur.get('history', [])[-150:]: print(f"  {h.get('artist')} - {h.get('title')}")
    jk = cur.get('jokes', [])
    last = cur.get('jokesDate') or ''
    today = (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=3)).date()
    due = not last or (today - datetime.date.fromisoformat(last)).days >= 2
    print(f"Welcome jokes due today: {'YES' if due else 'no'} (last added {last or 'never'})")
    print('Welcome jokes already in the app (do not repeat or rephrase):')
    for j in BUILTIN_JOKES + [x.get('text', '') for x in jk]: print('  ' + j)

def write(ip, sp, shp=None):
    raw = load(ip); sug = load(sp)
    if not raw or not sug: sys.exit('Could not read the index or the suggestions JSON.')
    songs, seen = [], {}
    for s in raw.get('songs', []):
        a, t = split_name(s.get('t'), s.get('a'))
        if not t or JUNK.match(t): continue
        ch = []
        for c in s.get('ch') or []:
            c = clean_chord(c)
            if c and c not in ch: ch.append(c)
        k = norm(a) + '|' + norm(t)
        if k in seen:
            o = seen[k]; o['ch'] = o['ch'] + [c for c in ch if c not in o['ch']]; continue
        e = {'a': a, 't': t, 'ch': ch[:24]}
        if s.get('capo'): e['capo'] = int(s['capo'])
        if s.get('tuning') and not re.match(r'(?i)^standard', str(s['tuning'])): e['tuning'] = str(s['tuning'])
        seen[k] = e; songs.append(e)
    artists = []
    for x in list(raw.get('artists', [])) + [s['a'] for s in songs if s['a']]:
        x = clean_title(x)
        if x and norm(x) not in [norm(y) for y in artists]: artists.append(x)
    cur = load(OUT, {}) or {}
    hist = cur.get('history', [])
    have = {norm(s['t']) for s in songs}
    before = {norm(h.get('title')) + '|' + norm(h.get('artist')) for h in hist[-150:]}
    out, rejected = [], []
    for s in sug.get('suggestions', []):
        t, a = str(s.get('title', '')).strip(), str(s.get('artist', '')).strip()
        if not t or not a: continue
        if norm(t) in have: rejected.append(f'{a} - {t} (already in the folder)'); continue
        if norm(t) + '|' + norm(a) in before: rejected.append(f'{a} - {t} (suggested before)'); continue
        try: d = max(1, min(5, int(s.get('difficulty', 3))))
        except Exception: d = 3
        ch = [c for c in (clean_chord(c) for c in s.get('chords') or []) if c][:12]
        try: capo = max(0, min(12, int(s.get('capo') or 0)))
        except Exception: capo = 0
        out.append({'title': t, 'artist': a, 'style': str(s.get('style', ''))[:40], 'difficulty': d, 'chords': ch,
                    'capo': capo, 'tuning': str(s.get('tuning') or 'Standard')[:30], 'why': str(s.get('why', ''))[:240]})
    if rejected: print('Rejected:\n  ' + '\n  '.join(rejected))
    if len(out) < 6: sys.exit(f'Only {len(out)} usable suggestions. Replace the rejected ones and run again.')
    now = datetime.datetime.now(datetime.timezone.utc)
    il = (now + datetime.timedelta(hours=3)).date().isoformat()
    hist = (hist + [{'title': s['title'], 'artist': s['artist'], 'date': il} for s in out])[-200:]
    data = {'v': 1, 'at': now.isoformat(timespec='seconds').replace('+00:00', 'Z'), 'date': il,
            'index': {'artists': artists, 'songs': songs}, 'level': str(sug.get('level', ''))[:300],
            'suggestions': out[:12], 'history': hist,
            'sheets': build_sheets(load(shp, [])) if shp else cur.get('sheets', []),
            'jokes': cur.get('jokes', []), 'jokesDate': cur.get('jokesDate', '')}
    with open(OUT, 'w', encoding='utf-8') as f: json.dump(data, f, ensure_ascii=False, indent=1)
    print(f'Wrote ideas.json: {len(artists)} artists, {len(songs)} songs, {len(out[:12])} suggestions.')

def sheets_only(shp):
    cur = load(OUT, {}) or {}
    cur['sheets'] = build_sheets(load(shp, []))
    with open(OUT, 'w', encoding='utf-8') as f: json.dump(cur, f, ensure_ascii=False, indent=1)
    print(f"Updated ideas.json: {len(cur['sheets'])} Guitaring sheets.")

# the jokes built into the app, so new ones are never repeats
BUILTIN_JOKES = '''Lenny Kravitz called. He says you suck on the guitar and shouldn't bother practising. Prove him wrong, {n}.
Metallica paused their world tour when they heard {n} started practising. They might be available soon.
Breaking: guitar shops report a sudden shortage of picks. Sources point to {n}.
Your neighbours asked for a set list, {n}. Mostly so they know when to leave.
Slash heard about you, {n}. He's considering a second hat.
Eric Clapton wrote “Tears in Heaven”. Your F chord wrote “Tears in the Living Room”. Let's fix that, {n}.
The guitar has been waiting all day, {n}. It's not angry. Just out of tune.
Rumour has it Mashina are looking for a stand-in. Warm up, {n}.
Today's forecast: 90% chance of barre chords, light showers of G/B. Dress warmly, {n}.
Jimi Hendrix set his guitar on fire. Please just tune yours, {n}.
Fun fact: 10 minutes a day beats 2 hours on Saturday. Not-so-fun fact: you knew that, {n}.
Your fingertips called, {n}. They want calluses, and they want them now.
Pearl Jam's roadie asked if you're free next summer, {n}. Mostly to carry amps. But it's a start.
Somewhere, a capo is lying in a drawer wondering what it did wrong, {n}.
Aviv Gefen just sent a sad face emoji. He heard you skipped practice yesterday, {n}.
Good news, {n}: every great guitarist once played like you. Bad news: they practised.
Your guitar picked you, {n}. Return the favour.
Radiohead wrote “Creep” in four chords. You know at least three. Let's go, {n}.
Oasis broke up over less than a missed chord change. Stay together with your guitar, {n}.
Statistically, 7 out of 10 cats leave the room when you play, {n}. The other 3 are fans.
The strings are fresh, the coffee is hot and the excuses are out of stock, {n}.
The neighbour's dog has started howling in key. That's progress, {n}.
Keith Richards is still touring. What's your excuse, {n}?
Legend says if you play “Wonderwall” perfectly, a man in a bucket hat appears. Try it, {n}.
Your guitar just filed a missing-person report, {n}. Last seen: you, three days ago.
Fun fact, {n}: the G string is not a fashion statement. Tune it.
Studies show 100% of songs sound better in tune. The study was me, {n}. Tap Listen.
Your F barre chord has been buzzing since 2019, {n}. Today's the day.
Your amp misses you, {n}. It's been humming to itself just to stay busy.
Spotify Wrapped will never know you played “Knockin' on Heaven's Door” 400 times. I will, {n}.
Breaking: local guitarist {n} discovers there are more than four chords. Markets react calmly.
The metronome isn't judging you, {n}. Okay, it is. Practise anyway.
Berry Sakharof makes it look effortless. That's because he practised while you were scrolling, {n}.
Your picks have a group chat, {n}. They're planning an escape under the couch.
Somewhere in Tel Aviv a busker is getting better while you read this, {n}.
The capo is not a cheat code, {n}. Okay, it kind of is. Use it.
Your calluses are filing for unemployment, {n}. Give them some work.
B minor called. It knows you've been avoiding it, {n}.
Strings are like milk, {n}: they expire. When did you last change yours?
Mark Knopfler plays without a pick. You play without practising. Only one of those is a style, {n}.
The neighbours stopped complaining, {n}. Either it's respect or they moved.
One more “Wonderwall” and Oasis reunite just to stop you. Learn something new today, {n}.
Shalom Hanoch has been rocking for 50 years. You can manage 15 minutes, {n}.
Your strumming hand has rhythm, {n}. Your fretting hand is still negotiating.
Ehud Banai has a song for every mood. Pick one and learn it, {n}.
Your guitar is the only thing in the house that gets better when used, {n}. Unlike the couch.'''.strip().split('\n')

def jokes_add(jp):
    new = load(jp)
    if isinstance(new, dict): new = new.get('jokes')
    if not isinstance(new, list) or not new: sys.exit('Could not read the jokes JSON (a list of strings).')
    cur = load(OUT, {}) or {}
    have = cur.get('jokes', [])
    seen = {norm(j) for j in BUILTIN_JOKES} | {norm(x.get('text', '')) for x in have}
    il = (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=3)).date().isoformat()
    added = []
    for j in new:
        j = re.sub(r'\s+', ' ', str(j)).strip()
        if not (20 <= len(j) <= 220) or '{n}' not in j or norm(j) in seen: continue
        seen.add(norm(j)); added.append({'text': j, 'date': il})
    if not added: sys.exit('No usable new jokes (each needs {n}, 20-220 characters, and must be new).')
    cur['jokes'] = (have + added)[-80:]; cur['jokesDate'] = il
    with open(OUT, 'w', encoding='utf-8') as f: json.dump(cur, f, ensure_ascii=False, indent=1)
    print(f'Added {len(added)} welcome jokes ({len(cur["jokes"])} extra jokes in total).')

if __name__ == '__main__':
    if len(sys.argv) >= 2 and sys.argv[1] == 'context': context()
    elif len(sys.argv) in (4, 5) and sys.argv[1] == 'write': write(sys.argv[2], sys.argv[3], sys.argv[4] if len(sys.argv) == 5 else None)
    elif len(sys.argv) == 3 and sys.argv[1] == 'sheets': sheets_only(sys.argv[2])
    elif len(sys.argv) == 3 and sys.argv[1] == 'jokes': jokes_add(sys.argv[2])
    else: print(__doc__)
