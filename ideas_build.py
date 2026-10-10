#!/usr/bin/env python3
"""Builds ideas.json for Guitaring's daily song ideas.

  python3 ideas_build.py context            -> prints the current songs + recent suggestions (to avoid repeats)
  python3 ideas_build.py write INDEX SUGG   -> cleans, checks and writes ideas.json

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

def write(ip, sp):
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
            'suggestions': out[:12], 'history': hist}
    with open(OUT, 'w', encoding='utf-8') as f: json.dump(data, f, ensure_ascii=False, indent=1)
    print(f'Wrote ideas.json: {len(artists)} artists, {len(songs)} songs, {len(out[:12])} suggestions.')

if __name__ == '__main__':
    if len(sys.argv) >= 2 and sys.argv[1] == 'context': context()
    elif len(sys.argv) == 4 and sys.argv[1] == 'write': write(sys.argv[2], sys.argv[3])
    else: print(__doc__)
