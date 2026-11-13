// Tuning a standard guitar down to "Half step down" (Nov 2026, the user: "the needle didn't move at all"): every string starts a
// whole half step (~100¢) sharp. The needle must move across all of it (not sit at the end of a ±50¢ gauge), and a low E at
// standard pitch must read as E (tune down), never as its 2nd harmonic on another string ("tune up to F♯").
const APP=process.env.APP||('file://'+require('path').resolve(__dirname,'../index.html'));
const {chromium}=require('playwright');const fs=require('fs'),path=require('path');
let fail=0;const ok=(c,m)=>{console.log((c?'ok  ':'FAIL')+' '+m);if(!c)fail++};
(async()=>{const b=await chromium.launch({...(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{}),args:['--autoplay-policy=no-user-gesture-required']});
 const run=async(file,semis)=>{const b64=fs.readFileSync(path.join(__dirname,'samples',file)).toString('base64');
  const p=await (await b.newContext({viewport:{width:390,height:800}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));await p.route(/^https:\/\//,r=>r.abort());
  await p.addInitScript(([b64,RATE])=>{localStorage.setItem('tuner.userName','"Yoav"');
   navigator.mediaDevices.getUserMedia=async()=>{const ac=new AudioContext();const bin=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));const buf=await ac.decodeAudioData(bin.buffer);
    const s=ac.createBufferSource();s.buffer=buf;s.loop=true;s.playbackRate.value=RATE;const dst=ac.createMediaStreamDestination();s.connect(dst);s.start();return dst.stream}},[b64,Math.pow(2,semis/12)]);
  await p.goto(APP);await p.waitForTimeout(300);await p.waitForSelector('#wSkip',{state:'visible',timeout:2000}).then(()=>p.click('#wSkip')).catch(()=>{});await p.evaluate(()=>window.__v2&&window.__v2.goSec('tuner'));
  await p.click('#tunings [data-id=half]');await p.waitForTimeout(150);await p.click('#listen');const seen=[];
  for(let k=0;k<22;k++){await p.waitForTimeout(120);seen.push(await p.evaluate(()=>({note:document.getElementById('note').textContent,c:+document.getElementById('cents').textContent,st:document.getElementById('status').textContent,ang:+(document.getElementById('needle').getAttribute('transform').match(/rotate\(([-\d.]+)/)||[0,0])[1]})))}
  await p.close();const last=seen.slice(-6);return {last,errs,ang:last.reduce((s,x)=>s+x.ang,0)/last.length}};
 // A2 from standard pitch down to A♭2: 0, -0.25, -0.5, -0.75, -1 half step
 const A=[];for(const s of [0,-.25,-.5,-.75,-1])A.push(await run('guitar-acoustic_A2.mp3',s));
 console.log('  A2 needle angles:',A.map(x=>x.ang.toFixed(1)).join(' → '));
 ok(A[0].last.every(x=>/^A2/.test(x.note)&&x.c>=95&&/tune down/.test(x.st)),'A at standard pitch: about +100¢, tune down');
 ok(A.every((x,i)=>i===0||x.ang<A[i-1].ang-4),'the needle moves at every step of the half step (no stop at the end of the gauge)');
 ok(A[0].ang<62.01&&A[0].ang>55,'a whole half step sharp: the needle near the end, not past it');
 ok(Math.abs(A[4].ang)<3&&A[4].last.some(x=>/in tune/.test(x.st)),'tuned down a half step: A♭ in tune, needle in the middle');
 const E=await run('guitar-acoustic_E2.mp3',0);console.log('  E2 at standard pitch:',E.last.map(x=>x.note+' '+x.c).join(', '));
 ok(E.last.every(x=>/^E2/.test(x.note)&&/tune down/.test(x.st)),'a low E at standard pitch reads E2, tune down (not its 2nd harmonic as another string)');
 const H=await run('guitar-acoustic_E4.mp3',0);ok(H.last.every(x=>/^E4/.test(x.note)&&/tune down/.test(x.st)),'a high E at standard pitch reads E4, tune down');
 ok(![...A,E,H].some(x=>x.errs.length),'no page errors');
 await b.close();console.log(fail?fail+' FAILED':'all passed');process.exit(fail?1:0)})();
