// The capo from the video and the sound together (Oct 2026, "שאריות של החיים" live: capo on fret 3, guitar tuned a half step down).
// The video shows where the capo sits but the hand's shapes can't be read at that size; sound first: near a capo the hand plays
// open shapes, so the tuning is the one where the chords heard become open shapes with the capo seen. Full is the song as he plays
// it: half step down, capo 3, Cadd9 · Am7 · Em · Fmaj7 … (not the barre-like B · Abm · Ebm of capo 3 in standard tuning); Easy has
// it in standard tuning (capo 2 = the same sound and shapes). The same every build (no Claude needed for it). Shapes read clearly
// that agree with the capo seen keep it; a song really played with barre shapes (or with no capo) keeps the capo seen.
// The chords are this recording's as heard (sounding pitch), without its audio.
const {chromium}=require('playwright');const path=require('path'),fs=require('fs'),http=require('http');
const ROOT=path.resolve(__dirname,'..');
const srv=http.createServer((q,r)=>{const f=path.join(ROOT,decodeURIComponent(q.url.split('?')[0]).replace(/\/$/,'/index.html'));fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);return r.end()}r.writeHead(200,{'content-type':/\.html$/.test(f)?'text/html':'application/octet-stream'});r.end(d)})}).listen(0);
const APP=process.env.APP||`http://localhost:${srv.address().port}/index.html`;
let fail=0;const ok=(c,m)=>{console.log((c?'ok  ':'FAIL')+' '+m);if(!c)fail++};
const NT=8,R={C:0,'C#':1,D:2,Eb:3,E:4,F:5,'F#':6,G:7,Ab:8,A:9,Bb:10,B:11},TY={'':0,m:1,7:2,m7:3,maj7:4,sus2:5,sus4:6,add9:7};
const C=n=>{const m=n.match(/^([A-G][#b]?)(.*)$/);return R[m[1]]*NT+TY[m[2]]};
// verse ×2, chorus, bridge (sounding): Dadd9 Bm7 F#m Aadd9 | Gmaj7 D Em F#m7 Bm7 A | E Gmaj7 Dadd9 Esus2
const SEQ=['Dadd9','Bm7','F#m','Aadd9','Dadd9','Bm7','F#m','Aadd9','Gmaj7','D','Em','F#m7','Bm7','Aadd9','Gmaj7','D','Em','Aadd9','E','Gmaj7','Dadd9','Esus2'];
const song=seq=>({title:'שאריות של החיים - אמיר דדון',artist:'אמיר דדון',dur:seq.length*3,bpm:108,offset:0,tuning:{id:'std'},play:{tun:'std',capo:0},v:2,at:Date.now(),
 segs:seq.map((n,i)=>[i*3,i*3+3,C(n)])});
(async()=>{const b=await chromium.launch({...(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{})});
 const ctx=await b.newContext();await ctx.route(/^https:\/\//,r=>r.abort());await ctx.route(/ideas\.json/,r=>r.abort());
 const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));await p.goto(APP);await p.waitForTimeout(400);
 const run=(a,res)=>p.evaluate(([a,res])=>{localStorage.setItem('tuner.song.vs0',JSON.stringify(a));const x=window.__vl.apply('vs0',res,'vs1'),G=window.__gd.build('vs1');
  const h=document.createElement('div');h.innerHTML=window.__gd.html('vs1');
  const e=document.createElement('div');e.innerHTML=window.__gd.html('vs1','easy');
  return {easy:(e.querySelector('.gdbig')||{}).textContent||'',easyCh:G.easy,play:x.play,video:x.video,full:G.full,capo:G.capo,tun:G.tun,why:(G.sure.find(s=>s.k==='Capo and shapes')||{}).why,src:G.sources.map(s=>s[1]).find(t=>/The video/.test(t))||'',like:(h.querySelector('.gdlike')||{}).textContent||''}},[a,res]);
 // 1. capo 3 seen, no shape readable: capo 2 in standard tuning, from the open shapes the sound becomes
 let r=await run(song(SEQ),{capo:3,capo_conf:'high',frames:[]});console.log('  capo 3 seen:',r.capo,'|',r.full.join(' '),'|',JSON.stringify(r.video.shift));
 ok(r.capo===3&&r.tun==='half'&&r.play.tun==='half'&&r.video.shift&&r.video.shift.seenCapo===3&&r.video.capo===3,'capo 3 seen, the hand unreadable: Full is as he plays it, tuned a half step down with capo 3');
 ok(['Cadd9','Am7','Em','Gadd9','Fmaj7','C','Dm','Dsus2'].every(n=>r.full.includes(n))&&!r.full.some(n=>/^(B|Ab|Eb|F#|C#)/.test(n)),'Full: the open shapes he plays (Cadd9 · Am7 · Em · Fmaj7 · Dsus2…), not B · Abm · Ebm');
 ok(/capo sits on fret 3, and the song sounds a half step lower than that gives in standard tuning: the guitar is tuned a half step down/.test(r.why)&&/Easy has it in standard tuning \(capo 2/.test(r.why),'How sure explains it: capo 3 in the video, tuned a half step down, the open shapes ('+r.why.slice(0,80)+'…)');
 console.log('  built from:',r.src);console.log('  before you play:',r.like);
 ok(/capo on fret 3 \(the guitar tuned a half step down\)/.test(r.src),'Built from says what the video shows: capo on fret 3, tuned a half step down');
 ok(/Tune every string a half step down first/.test(r.like)&&!/capo 2/.test(r.like),'Full’s Before you play: tune a half step down first (no standard-tuning alternative in Full)');
 console.log('  easy:',r.easy,'|',r.easyCh.join(' '));
 ok(/^Capo 2Standard tuning/.test(r.easy)&&['C','Am','Em','G','Fmaj7'].every(n=>r.easyCh.includes(n)),'Easy: standard tuning, capo 2, basic shapes (C · Am · Em · G · Fmaj7, the open F)');
 const r2=await run(song(SEQ),{capo:3,capo_conf:'high',frames:[]});ok(JSON.stringify(r2.full)===JSON.stringify(r.full)&&r2.capo===r.capo,'the same on every build');
 // 2. the hand's shapes read clearly and agree with capo 3 (barre shapes): capo 3 stays
 const fr=[[1,'B'],[4,'Abm7'],[7,'Ebm'],[13,'Abm7']].map(([t,s])=>({t,shape:s,conf:'high'}));
 r=await run(song(SEQ),{capo:3,capo_conf:'high',frames:fr});console.log('  shapes agree with capo 3:',r.capo,'|',r.full.slice(0,4).join(' '));
 ok(r.capo===3&&!r.video.shift&&!r.like,'clear shapes that agree with the capo seen keep it (capo 3), nothing to explain');
 // 3. a song in an open key with no capo seen: stays without a capo
 const r3=await run(song(['G','C','D','Em','G','C','D','Em']),{capo:0,capo_conf:'high',frames:[]});console.log('  no capo, open key:',r3.capo,'|',r3.full.join(' '));
 ok(r3.capo===0&&!r3.video.shift&&r3.full.join(' ')==='G C D Em','no capo seen and open chords: no capo, nothing moved');
 // 4. capo seen, and the chords already open with it: kept
 const r4=await run(song(['A','D','E','F#m','A','D','E','F#m']),{capo:2,capo_conf:'high',frames:[]});console.log('  capo 2, open with it:',r4.capo,'|',r4.full.join(' '));
 ok(r4.capo===2&&!r4.video.shift&&r4.full.join(' ')==='G C D Em','capo 2 seen and the chords open with it (G · C · D · Em): kept');
 ok(!errs.length,'no page errors '+JSON.stringify(errs));
 console.log(fail?`${fail} FAILED`:'all passed');await b.close();srv.close();process.exit(fail?1:0)})();
