const APP=process.env.APP||('file://'+require('path').resolve(__dirname,'../index.html'));
const {chromium}=require('playwright');const fs=require('fs');
const files=(process.env.F||'guitar-acoustic_A2.mp3,guitar-electric_A2.mp3,guitar-acoustic_E2.mp3,guitar-acoustic_D3.mp3,guitar-nylon_A2.mp3').split(',').map(f=>require('fs').existsSync(f)?f:require('path').join(__dirname,'samples',require('path').basename(f)));
(async()=>{const b=await chromium.launch({...(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{}),args:['--autoplay-policy=no-user-gesture-required']});
 for(const noise of [0.002,0.01]) for(const f of files){
 const b64=fs.readFileSync(f).toString('base64');
 const p=await (await b.newContext({viewport:{width:390,height:800}})).newPage();await p.route(/^https:\/\//,r=>r.abort());
 await p.addInitScript(([b64,noise])=>{localStorage.setItem('tuner.userName','"Yoav"');
  navigator.mediaDevices.getUserMedia=async()=>{const ac=new AudioContext();const bin=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));const buf=await ac.decodeAudioData(bin.buffer);
   const s=ac.createBufferSource();s.buffer=buf;const q=ac.createBiquadFilter();q.type='highpass';q.frequency.value=200;s.connect(q);const dst=ac.createMediaStreamDestination();q.connect(dst);
   const nb=ac.createBuffer(1,ac.sampleRate*4,ac.sampleRate),nd=nb.getChannelData(0);for(let i=0;i<nd.length;i++)nd[i]=noise*(Math.random()*2-1);const ns=ac.createBufferSource();ns.buffer=nb;ns.loop=true;ns.connect(dst);ns.start();
   s.start(ac.currentTime+.3);return dst.stream}},[b64,noise]);
 await p.goto(APP);await p.waitForTimeout(300);if(await p.$('#wSkip:visible'))await p.click('#wSkip');
 await p.click('#listen');await p.waitForTimeout(1300);
 const ang=[],cen=[],sts=new Set();
 for(let k=0;k<70;k++){await p.waitForTimeout(40);const r=await p.evaluate(()=>[document.getElementById('needle').getAttribute('transform'),document.getElementById('cents').textContent,document.getElementById('status').textContent]);
  const a=parseFloat((r[0]||'rotate(0').slice(7));ang.push(a);cen.push(r[1]);sts.add(r[2].replace(/\d+¢/,'N¢'))}
 const m=ang.reduce((x,y)=>x+y,0)/ang.length,sd=Math.sqrt(ang.reduce((x,y)=>x+(y-m)**2,0)/ang.length);
 let rev=0;for(let k=2;k<ang.length;k++){if((ang[k]-ang[k-1])*(ang[k-1]-ang[k-2])<0&&Math.abs(ang[k]-ang[k-1])>.3)rev++}
 console.log(`${f.split('/').pop().padEnd(26)} noise=${noise} needle mean ${m.toFixed(1)}° sd ${sd.toFixed(2)}° range ${(Math.max(...ang)-Math.min(...ang)).toFixed(1)}° reversals ${rev} | cents ${[...new Set(cen)].join(',')} | ${[...sts].join(' / ')}`);
 await p.close()}
 await b.close()})();
