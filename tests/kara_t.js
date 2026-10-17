// Play along with the video (V2): in the guide's Full tab a song with a video shows it with its chords in time, karaoke style,
// instead of the song map (Easy keeps the map). The guitar part (generated) is C#m · A · E · F#m, 2 bars each at 104 BPM, a strum on
// every beat; it goes through the real session build. The song's video (generated, VP8 + Opus) carries the same sound 0.6 s late, as
// a video that doesn't line up with the MP3 would: the phone finds that offset. Checks: the karaoke replaces the map in Full only;
// the offset (0.6 s); chord changes on beats; the chord shown in the middle of every chord is right; tapping the lane jumps ahead.
const {chromium}=require('playwright');const path=require('path'),fs=require('fs'),http=require('http');const {execFileSync}=require('child_process');
const ROOT=path.resolve(__dirname,'..'),OUT=path.join(__dirname,'out');fs.mkdirSync(OUT,{recursive:true});
const srv=http.createServer((q,r)=>{const f=path.join(ROOT,decodeURIComponent(q.url.split('?')[0]).replace(/\/$/,'/index.html'));fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);return r.end()}r.writeHead(200,{'content-type':/\.html$/.test(f)?'text/html':'application/octet-stream'});r.end(d)})}).listen(0);
const APP=process.env.APP||`http://localhost:${srv.address().port}/index.html`;
let fail=0;const ok=(c,m)=>{console.log((c?'ok  ':'FAIL')+' '+m);if(!c)fail++};
// a guitar part like the one that met this ("במקום בו אני גר", guitars only): C#m · A · E · F#m, 4.6 s each, mostly root and 5th;
// each minor 3rd is faint, and the root's own overtone on the major 3rd is a little louder (so the 3rd alone would say "major")
const N=(n,o)=>440*Math.pow(2,(({C:0,'C#':1,D:2,Eb:3,E:4,F:5,'F#':6,G:7,Ab:8,A:9,Bb:10,B:11})[n]-9)/12+(o-4));
const BP=60/104,CL=8*BP;// a beat; a chord lasts 2 bars
const V={'C#m':['C#','E','Ab'],A:['A','C#','E'],E:['E','Ab','B'],'F#m':['F#','A','C#']};
const seq=['C#m','A','E','F#m','C#m','A','E','F#m'];
const expr=seq.map((c,i)=>{const t0=i*CL;return V[c].flatMap(n=>[[N(n,3),1],[N(n,4),.7]]).map(([f,a])=>`${a}*between(t,${t0.toFixed(4)},${(t0+CL).toFixed(4)})*sin(2*PI*${f.toFixed(2)}*t)*exp(-4*mod(t,${BP.toFixed(5)}))`).join('+')}).join('+');
const DUR=seq.length*CL,GTR=path.join(OUT,'ka_gtr.flac'),VID=path.join(OUT,'ka_video.webm'),OFF=0.6;
execFileSync('ffmpeg',['-y','-v','error','-f','lavfi','-i',`aevalsrc='(${expr})*0.06':s=44100:d=${DUR.toFixed(3)}`,'-ac','2',GTR]);
// the video: a test picture, and the same sound 0.6 s late
execFileSync('ffmpeg',['-y','-v','error','-f','lavfi','-i',`testsrc=size=320x180:rate=15:duration=${(DUR+OFF).toFixed(3)}`,'-i',GTR,'-filter_complex',`[1:a]adelay=${OFF*1000}|${OFF*1000}[a]`,'-map','0:v','-map','[a]','-c:v','libvpx','-b:v','150k','-c:a','libopus','-b:a','64k','-shortest',VID]);
(async()=>{const b=await chromium.launch({...(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{}),args:['--autoplay-policy=no-user-gesture-required']});
 const ctx=await b.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});await ctx.route(/^https:\/\//,r=>r.abort());await ctx.route(/ideas\.json/,r=>r.abort());
 const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.addInitScript(()=>{window.__mxPollMs=1e9;if(sessionStorage.x)return;sessionStorage.x=1;localStorage.setItem('tuner.userName','"Yoav"');localStorage.setItem('tuner.profile',JSON.stringify({name:'Yoav',level:'intermediate',onboarding:{done:true}}));localStorage.setItem('tuner.learnLang','"en"')});
 await p.goto(APP);await p.waitForTimeout(400);
 const B=f=>fs.readFileSync(f).toString('base64');
 await p.evaluate(async b64=>{const gtr=new Blob([Uint8Array.from(atob(b64),c=>c.charCodeAt(0))],{type:'audio/flac'});
  await window.__bk.put('mixdata:k1',{stems:{guitar:gtr}});await window.__bk.put('mixIndex',[{id:'k1',name:'Test Band - Karaoke Song',at:Date.now(),src:'cloud',state:'ready',sess:'queued'}])},B(GTR));
 await p.reload();await p.waitForFunction(()=>{const it=window.__mxTest.idx().find(x=>x.id==='k1');return it&&(it.sess==='done'||it.sess==='failed')},null,{timeout:180000}).catch(()=>{});
 // the video GitHub would have handed back (splitter v7)
 await p.evaluate(async b64=>{const v=new Blob([Uint8Array.from(atob(b64),c=>c.charCodeAt(0))],{type:'video/webm'});await window.__bk.put('mixvideo:k1',{blob:v,at:Date.now(),from:'split'});
  const ix=await window.__bk.get('mixIndex');ix.forEach(x=>{if(x.id==='k1')x.hasVid=true});await window.__bk.put('mixIndex',ix)},B(VID));
 await p.reload();await p.waitForTimeout(500);await p.tap('#bnav [data-sec=learn]');await p.waitForTimeout(300);await p.tap('#learnList .lrow:has-text("Karaoke Song")');await p.waitForTimeout(600);
 const tab=async m=>{if(await p.$eval(`[data-gd=${m}]`,e=>e.getAttribute('aria-pressed'))!=='true'){await p.tap(`[data-gd=${m}]`);await p.waitForTimeout(300)}};
 await tab('easy');ok(!await p.$('#gdKara')&&!!await p.$('.gdmap'),'Easy keeps the song map (no video there)');
 await tab('full');ok(!!await p.$('#gdKara')&&!await p.$('.gdmap'),'Full: the video with its chords instead of the song map');
 await p.waitForSelector('#gdKara video',{timeout:8000}).catch(()=>{});
 // the offset is found once (from the video's own sound)
 await p.waitForFunction(()=>window.__ka.state()&&window.__ka.state().off!==0,null,{timeout:60000}).catch(()=>{});
 const st=await p.evaluate(()=>window.__ka.state());console.log('  state:',JSON.stringify(st));
 ok(st&&Math.abs(st.off-0.6)<.05,'the video runs 0.6 s behind the song’s audio, and the phone finds it ('+(st&&st.off)+' s)'.replace('0.6',''));
 // the chord changes sit on the beat
 const bk=await p.evaluate(()=>window.__ka.blocks('mix_k1'));const off=bk.blocks.map(x=>{let m=9;for(const t of bk.beats)m=Math.min(m,Math.abs(t-x.t0));return m});
 console.log('  blocks:',bk.blocks.map(x=>x.n+'@'+x.t0.toFixed(2)).join(' '));ok(bk.blocks.length>=7&&off.slice(1).every(x=>x<.005),'every chord change sits on a beat');
 // in the middle of each chord, the chord shown is that chord
 const seen=[];for(let i=0;i<seq.length;i++){const t=(i+.5)*CL;await p.evaluate(([t,o])=>{const v=document.querySelector('#gdKara video');v.currentTime=t+o},[t,st.off]);await p.waitForTimeout(250);
  seen.push(await p.evaluate(()=>{const s=window.__ka.state();return s&&s.name}))}
 console.log('  shown:',seen.join(' '));ok(seen.every((n,i)=>n===seq[i]),'in the middle of every chord, the chord shown is that chord (with the video’s 0.6 s lined up)');
 // at the moment of each change (±0.12 s): before it the old chord, after it the new one (the video's 0.6 s lined up)
 const edge=[];for(let i=1;i<seq.length;i++){const T=i*CL;for(const [dt,want] of [[-.12,seq[i-1]],[.12,seq[i]]]){await p.evaluate(([t,o])=>{document.querySelector('#gdKara video').currentTime=t+o},[T+dt,st.off]);await p.waitForTimeout(220);
   const n=await p.evaluate(()=>window.__ka.state().name);edge.push(n===want?'✓':`✗${n}≠${want}@${(T+dt).toFixed(2)}`)}}
 console.log('  at the changes:',edge.join(' '));ok(edge.every(x=>x==='✓'),'right at every change (0.12 s before / after) the chord shown switches with the music');
 ok(!!await p.$eval('#gdKara .kcur b',e=>e.textContent)&&!!await p.$('#gdKara .kdg svg'),'the chord now is big, with its shape');
 // just before a change, the next chord counts down in beats
 await p.evaluate(([t,o])=>{document.querySelector('#gdKara video').currentTime=t+o},[3*CL-1.5*BP,st.off]);await p.waitForTimeout(250);
 const nx=await p.$eval('#gdKara .knx',e=>e.textContent.replace(/\s+/g,' '));console.log('  next:',nx);ok(/F#m/.test(nx)&&/in 2/.test(nx),'just before a change: “Next F#m in 2” (beats)');
 // play, and tap the lane to jump ahead
 await p.tap('#gdKara .kbig');await p.waitForTimeout(800);const t1=await p.evaluate(()=>document.querySelector('#gdKara video').currentTime);
 const box=await p.$eval('#gdKara .klane',e=>{const r=e.getBoundingClientRect();return {x:r.left+r.width*.9,y:r.top+r.height/2}});await p.mouse.click(box.x,box.y);await p.waitForTimeout(300);
 const t2=await p.evaluate(()=>document.querySelector('#gdKara video').currentTime);console.log('  jump:',t1.toFixed(2),'→',t2.toFixed(2));ok(t2>t1+1.5,'tapping the lane ahead of the line jumps there');
 // the play button as in the player: in a −5s / ▶ / +5s row under the video (not over it); ❚❚ while it plays; −5s goes back
 ok(await p.$eval('#gdKara .kbig',e=>e.classList.contains('mixplay')&&!e.closest('.kvid')&&e.textContent==='❚❚'&&e.getAttribute('aria-label')==='Pause'),'the play button is the player’s, under the video: ❚❚ while it plays');
 {const a0=await p.evaluate(()=>document.querySelector('#gdKara video').currentTime);await p.tap('#gdKara [data-kj="-5"]');await p.waitForTimeout(150);const a1=await p.evaluate(()=>document.querySelector('#gdKara video').currentTime);ok(a1<a0-4,'−5s goes back 5 seconds');}
 await p.screenshot({path:path.join(OUT,'karaoke.png'),fullPage:false});
 await p.tap('#gdKara .kbig');await p.waitForTimeout(150);ok(await p.$eval('#gdKara .kbig',e=>e.textContent==='▶'),'tapping it pauses (▶)');
 // leaving the page stops it
 await p.tap('#bnav [data-sec=home]');await p.waitForTimeout(400);ok(await p.evaluate(()=>!window.__ka.state())&&await p.evaluate(()=>{const v=document.querySelector('#gdKara video');return !v||v.paused}),'leaving the page stops the video');
 ok(!errs.length,'no page errors '+JSON.stringify(errs));
 console.log(fail?`${fail} FAILED`:'all passed');await b.close();srv.close();process.exit(fail?1:0)})();
