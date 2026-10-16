const APP=process.env.APP||('file://'+require('path').resolve(__dirname,'../index.html'));
const {chromium}=require('playwright');const fs=require('fs');
const files=process.argv.slice(2);
(async()=>{const b=await chromium.launch({...(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{}),args:['--autoplay-policy=no-user-gesture-required']});
 for(const hp of (process.env.HP||"0,160").split(",").map(Number)) for(const f of files){
 const b64=fs.readFileSync(f).toString('base64');
 const p=await (await b.newContext({viewport:{width:390,height:800}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));await p.route(/^https:\/\//,r=>r.abort());
 await p.addInitScript(([b64,hp,RATE])=>{localStorage.setItem("tuner.userName","\"Yoav\"");localStorage.RATE=RATE;
  navigator.mediaDevices.getUserMedia=async()=>{const ac=new AudioContext();const bin=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));const buf=await ac.decodeAudioData(bin.buffer);
   const s=ac.createBufferSource();s.buffer=buf;s.loop=true;s.playbackRate.value=+(localStorage.RATE||1);let n=s;if(hp){const q=ac.createBiquadFilter();q.type='highpass';q.frequency.value=hp;q.Q.value=.9;s.connect(q);n=q}const dst=ac.createMediaStreamDestination();n.connect(dst);s.start();window.__dur=buf.duration;return dst.stream}},[b64,hp,+(process.env.RATE||1)]);
 await p.goto(APP);await p.waitForTimeout(300);await p.waitForSelector('#wSkip',{state:'visible',timeout:2000}).then(()=>p.click('#wSkip')).catch(()=>{});await p.evaluate(()=>window.__v2&&window.__v2.goSec('tuner'));
 await p.click('#listen');await p.waitForTimeout(100);const seen=[];
 for(let k=0;k<30;k++){await p.waitForTimeout(100);seen.push(await p.evaluate(()=>document.getElementById('note').textContent+' '+document.getElementById('hz').textContent+' '+document.getElementById('cents').textContent+' '+document.getElementById('status').textContent))}
 console.log(`\n== ${f.split('/').pop()} hp=${hp} dur=${await p.evaluate(()=>window.__dur?.toFixed(1))}`);console.log(seen.join('\n'),errs.join(';'));await p.close()}
 await b.close()})();
