// Song guide (V2 phase 3): Easy | Full from a song's chord analysis, checked against the reference guide for "שאריות של החיים"
// (capo 2, 108 BPM, Cadd9 · Asus2 · Fmaj7 · G, verse and chorus repeating, strummed D · D U · U D U). The fixture is an analysis
// with those chords (concert pitch: capo 2 shapes), beats at 108 BPM and note onsets on that pattern.
// Checks: Before you play (capo, tempo), How sure is this (chords solid, strumming solid, voicings likely), the chords (Full keeps
// Cadd9/Asus2/Fmaj7; Easy gives C · A · F · G), the strumming boxes, a song map with parts and times and no lyrics, the profile
// picks Easy or Full, Practise opens it, Play along opens the play-along; a song with a messy analysis says "a guess".
const {chromium,devices}=require('playwright');const path=require('path'),fs=require('fs'),http=require('http');
const ROOT=path.resolve(__dirname,'..'),OUT=path.join(__dirname,'out');fs.mkdirSync(OUT,{recursive:true});
const srv=http.createServer((q,r)=>{const f=path.join(ROOT,decodeURIComponent(q.url.split('?')[0]).replace(/\/$/,'/index.html'));fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);return r.end()}r.writeHead(200,{'content-type':/\.html$/.test(f)?'text/html':'application/octet-stream'});r.end(d)})}).listen(0);
const APP=process.env.APP||`http://localhost:${srv.address().port}/index.html`;
let fail=0;const ok=(c,m)=>{console.log((c?'ok  ':'FAIL')+' '+m);if(!c)fail++};
// ---- the fixture: a song like the reference guide ----
const NT=8,R={C:0,'C#':1,D:2,Eb:3,E:4,F:5,'F#':6,G:7,Ab:8,A:9,Bb:10,B:11},TY={'':0,m:1,7:2,m7:3,maj7:4,sus2:5,sus4:6,add9:7};
const cc=(root,type,capo)=>((R[root]+capo)%12)*NT+TY[type];// shape name → concert-pitch chord index
function song(o){const bpm=o.bpm,b=60/bpm,beats=[],segs=[];let t=1.0;
 const prog=o.prog;// [[root,type,beats],…] per part
 for(const part of o.form)for(const [r,ty,n] of prog[part]){segs.push([+t.toFixed(2),+(t+n*b).toFixed(2),cc(r,ty,o.capo)]);t+=n*b}
 const dur=t+1;for(let x=1.0;x<dur;x+=b)beats.push(+x.toFixed(3));
 // onsets: hop 256 at 11025 Hz; the pattern D · D U · U D U (eighths 0,2,3,5,6,7 of each bar)
 const h=256,fr=Math.ceil(dur*11025/h),e=new Uint8Array(fr);const hit=(tt,v)=>{const i=Math.round(tt*11025/h);for(let k=-1;k<=1;k++)if(e[i+k]!==undefined)e[i+k]=Math.max(e[i+k],k?v*.6:v)};
 for(let bi=0;bi+4<beats.length;bi+=4)for(let q=0;q<8;q++){const tt=beats[bi]+q*b/2;const on=o.pat[q]!=='·';if(on)hit(tt,200+((q*37+bi)%40));else hit(tt,o.noise||8)}
 return {title:o.title,dur,bpm,offset:0,tuning:{id:'std',conf:o.conf||'high',why:''},segs,play:{tun:'std',capo:o.capo},beats,ons:{h,d:Buffer.from(e).toString('base64')},v:2,at:Date.now()}}
const REF=song({title:'שאריות של החיים - אמיר דדון',bpm:108,capo:2,pat:'D·DU·UDU',
 prog:{V:[['C','add9',4],['A','sus2',4],['F','maj7',4],['G','',4]],C:[['F','maj7',4],['G','',4],['C','add9',4],['A','sus2',4]]},form:['V','V','V','V','C','C','C','C','V','V','V','V','C','C','C','C']});
// a messy one: chords that never repeat, no beat detail
const MESSY=(()=>{const s=song({title:'Messy song',bpm:90,capo:0,conf:'low',pat:'D·D·D·D·',prog:{X:[['C','',1],['E','m7',1],['Bb','sus4',2],['F','m',1],['D','7',3],['Ab','',1],['B','m',2]]},form:['X','X']});delete s.beats;delete s.ons;return s})();
(async()=>{const b=await chromium.launch({...(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{})});
 const run=async(level)=>{const ctx=await b.newContext({...devices['Pixel 7']});await ctx.route(/^https:\/\//,r=>r.abort());await ctx.route(/ideas\.json/,r=>r.abort());
  const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.addInitScript(([REF,MESSY,level])=>{if(sessionStorage.x)return;sessionStorage.x=1;const S=(k,v)=>localStorage.setItem('tuner.'+k,JSON.stringify(v));
   S('userName','Yoav');S('profile',{name:'Yoav',level,onboarding:{done:true}});S('learnLang','he');
   S('song.ref1',REF);S('song.mess1',MESSY);S('songs',['ref1','mess1'])},[REF,MESSY,level]);
  await p.goto(APP);await p.waitForTimeout(500);await p.tap('#bnav [data-sec=learn]');await p.waitForTimeout(200);return {p,ctx,errs}};
 // ---- an intermediate player: Full first ----
 let {p,ctx,errs}=await run('intermediate');
 await p.tap('#learnList .lrow:has-text("שאריות")');await p.waitForTimeout(400);
 ok(!!await p.$('#sesGuide'),'a song with a chord analysis has a song guide');
 ok(/Practise with the song guide/.test(await p.$eval('#sesGo',e=>e.textContent))&&/Full version first/.test(await p.$eval('#sesGo',e=>e.textContent)),'Practise opens the guide (Full first for an intermediate player)');
 ok(await p.$eval('[data-gd=full]',e=>e.getAttribute('aria-pressed'))==='true','Full is the open tab');
 const full=await p.$eval('#gdBody',e=>e.innerText.replace(/\s+/g,' '));console.log('  FULL: '+full.slice(0,700));
 ok(/Capo 2/.test(full)&&/108/.test(full)&&/walking pace/.test(full),'Before you play: capo 2, 108 BPM, a walking pace (as the reference)');
 const lv=await p.$$eval('.gdsure li',l=>Object.fromEntries(l.map(x=>[x.querySelector('span').textContent,x.querySelector('.gdlv').className.split(' ')[1]])));console.log('  sure:',JSON.stringify(lv));
 ok(lv['Chords and order']==='solid'&&lv['Capo and shapes']==='solid'&&lv['Exact voicings']==='likely'&&lv['Strumming']==='solid'&&lv['Tempo']==='solid','How sure is this: chords, capo, strumming and tempo solid; exact voicings likely (as the reference)');
 const fch=await p.$$eval('#gdBody .seschords .sesdg',l=>l.map(x=>x.textContent.trim()||x.querySelector('svg')?.getAttribute('aria-label')||''));
 const fnames=await p.$$eval('#gdBody .seschords svg .dgName',l=>l.map(x=>x.textContent));console.log('  full chords:',fnames.join(' '));
 ok(['Cadd9','Asus2','Fmaj7','G'].every(n=>fnames.includes(n)),'Full shows the recording’s shapes: Cadd9 · Asus2 · Fmaj7 · G');
 const pat=await p.$$eval('#gdBody .gdpat span',l=>l.slice(0,8).map(x=>x.className==='dn'?'D':x.className==='up'?'U':'·').join(''));
 ok(pat==='D·DU·UDU','Full strumming is the pattern of the recording: D · D U · U D U ('+pat+')');
 const map=await p.$$eval('.gdmap li',l=>l.map(x=>({t:x.querySelector('.gdt').textContent,n:x.querySelector('b').textContent,c:x.querySelector('.gdch').textContent})));console.log('  map:',JSON.stringify(map));
 ok(map.length>=4&&/^0:0[0-2]$/.test(map[0].t)&&map[0].c.startsWith('Cadd9 · Asus2 · Fmaj7 · G')&&map[1].c.startsWith('Fmaj7 · G · Cadd9 · Asus2')&&new Set(map.map(m=>m.n)).size<map.length&&map.every(m=>/^[A-G]/.test(m.c)),'the song map has the parts with times and chords, and the parts repeat (verse / chorus)');
 ok(!/את|lyrics:/i.test(await p.$eval('.gdmap',e=>e.textContent)),'no lyrics in the song map');
 // Easy
 await p.tap('[data-gd=easy]');await p.waitForTimeout(150);
 const easy=await p.$eval('#gdBody',e=>e.innerText.replace(/\s+/g,' '));
 const enames=await p.$$eval('#gdBody .seschords svg .dgName',l=>l.map(x=>x.textContent));console.log('  easy chords:',enames.join(' '));
 ok(enames.length===4&&['C','A','Fmaj7','G'].every(n=>enames.includes(n))&&/Capo 2/.test(easy),'Easy: the easiest shapes C · A · Fmaj7 · G with capo 2 (the open Fmaj7 is easier than a barre F)');
 ok(await p.$$eval('#gdBody .gdpat span.dn',l=>l.length)===4&&await p.$$eval('#gdBody .gdpat span.up',l=>l.length)===0,'Easy strumming: one down-strum per beat');
 ok(!/Exact voicings/.test(easy),'Easy leaves out the voicing note');
 await p.screenshot({path:path.join(OUT,'guide_easy.png'),fullPage:true});
 // Play along
 await p.tap('.gdplay');await p.waitForTimeout(400);ok(await p.$eval('#sheetView',e=>!e.hidden)||await p.evaluate(()=>!document.getElementById('paneSong').hidden),'"Play along" opens the play-along');
 ok(!errs.length,'no page errors '+JSON.stringify(errs));await ctx.close();
 // ---- a beginner: Easy first; a messy analysis says so ----
 ({p,ctx,errs}=await run('beginner'));
 await p.tap('[data-lang=en]').catch(()=>{});await p.waitForTimeout(150);
 await p.tap('#learnList .lrow:has-text("Messy song")');await p.waitForTimeout(400);
 ok(await p.$eval('[data-gd=easy]',e=>e.getAttribute('aria-pressed'))==='true','a beginner gets Easy first');
 const lv2=await p.$$eval('.gdsure li',l=>Object.fromEntries(l.map(x=>[x.querySelector('span').textContent,x.querySelector('.gdlv').className.split(' ')[1]])));console.log('  messy sure:',JSON.stringify(lv2));
 ok(lv2['Chords and order']==='guess'&&lv2['Capo and shapes']==='guess'&&lv2['Strumming']==='guess','a messy analysis is marked "a guess" (chords, capo, strumming)');
 await p.tap('[data-gd=full]');await p.waitForTimeout(150);ok(/No clear pattern|one strum per beat/.test(await p.$eval('#gdBody',e=>e.textContent)),'no beat detail: Full falls back to one strum per beat and says why');
 ok(!errs.length,'no page errors '+JSON.stringify(errs));await ctx.close();
 console.log(fail?`${fail} FAILED`:'all passed');await b.close();srv.close();process.exit(fail?1:0)})();
