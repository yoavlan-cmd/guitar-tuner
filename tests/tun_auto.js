const APP=process.env.APP||('file://'+require('path').resolve(__dirname,'../index.html'));
const {chromium}=require('playwright');const fs=require('fs');
const ac64=fs.readFileSync(require('path').join(__dirname,'samples/')+'guitar-acoustic_A2.mp3').toString('base64'),el64=fs.readFileSync(require('path').join(__dirname,'samples/')+'guitar-electric_A2.mp3').toString('base64');
const hz=m=>440*Math.pow(2,(m-69)/12),R=(m,c=0)=>hz(m)*Math.pow(2,c/1200)/110;
const S={};
S.tuning=[];{let t=.5;for(const [m,cs] of [[45,[-25,-15,-8,-3,0]],[40,[12,5,1]],[50,[-6,-2,0]],[55,[0]],[59,[-10,-3]],[64,[0]]])for(const c of cs){S.tuning.push({t,notes:[R(m,c)]});t+=2.4}}
S.sixQuick=[40,45,50,55,59,64].map((m,k)=>({t:.5+k*.8,notes:[R(m)]})).concat([40,45,50,55,59,64].map((m,k)=>({t:6+k*.9,notes:[R(m)]})));
S.strum=[];for(let t=1;t<12;t+=.6)S.strum.push({t,notes:[40,47,52,56,59,64].map(m=>R(m)),spread:.015});
S.chordChange=[];{const ch=[[40,47,52,56,59,64],[45,52,57,61,64],[43,47,50,55,59,67],[50,57,62,66]];let k=0;for(let t=1;t<12;t+=.5)S.chordChange.push({t,notes:ch[(k++>>2)%4].map(m=>R(m)),spread:.012})}
S.melody=[];{const sc=[52,54,56,57,59,61,63,64,63,61,59,57,56,54];let k=0;for(let t=1;t<12;t+=.32)S.melody.push({t,notes:[R(sc[k++%sc.length])]})}
S.checkStrum=[];{let t=.5;for(const m of [40,45,50])for(let k=0;k<2;k++){S.checkStrum.push({t,notes:[R(m,-6+k*5)]});t+=2.2}for(let k=0;k<3;k++)S.checkStrum.push({t:t+k*.6,notes:[40,45,50,55,59,64].map(m=>R(m)),spread:.015});t+=2.5;for(const m of [55,59,64]){S.checkStrum.push({t,notes:[R(m,4)]});t+=2.2}}
for(const k of ['wind','traffic','chatter','birds','street'])S['bg_'+k]={bg:k};
S.tuneStreet=Object.assign(S.tuning.slice(),{bg:'street'});S.strumStreet=Object.assign(S.strum.slice(),{bg:'street'});S.quickPlucks=[];for(let t=.5;t<14;t+=.5)S.quickPlucks.push({t,notes:[R(45,-10+t)]});
S.quiet=[{t:.5,notes:[R(45)]}];
const want=process.argv[2]?process.argv[2].split(','):Object.keys(S);
(async()=>{const b=await chromium.launch({...(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{}),args:['--autoplay-policy=no-user-gesture-required']});
 await Promise.all(want.map(async name=>{const sc=Array.isArray(S[name])?S[name]:[],bg=S[name].bg,end=+(process.env.END||(name==='quiet'?22:18));
 const p=await (await b.newContext()).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));await p.route(/^https:\/\//,r=>r.abort());
 await p.addInitScript({path:require('path').join(__dirname,'noisegen.js')});await p.addInitScript(([b64,sc,bg,lvl])=>{localStorage.setItem('tuner.userName','"Yoav"');
  navigator.mediaDevices.getUserMedia=async()=>{const ac=new AudioContext();const bin=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));const buf=await ac.decodeAudioData(bin.buffer);
   const dst=ac.createMediaStreamDestination();const q=ac.createBiquadFilter();q.type='highpass';q.frequency.value=180;q.connect(dst);
   const nb=ac.createBuffer(1,ac.sampleRate*4,ac.sampleRate),nd=nb.getChannelData(0);for(let i=0;i<nd.length;i++)nd[i]=.004*(Math.random()*2-1);const ns=ac.createBufferSource();ns.buffer=nb;ns.loop=true;ns.connect(dst);ns.start();
   if(bg){const arr=__noiseGen(bg,ac.sampleRate),nb2=ac.createBuffer(1,arr.length,ac.sampleRate);nb2.getChannelData(0).set(arr.map(x=>x*lvl));const s2=ac.createBufferSource();s2.buffer=nb2;s2.loop=true;s2.connect(dst);s2.start()}
   const t0=ac.currentTime+.1;
   sc.forEach(ev=>ev.notes.forEach((r,k)=>{const s=ac.createBufferSource();s.buffer=buf;s.playbackRate.value=r;const g=ac.createGain();g.gain.value=ev.notes.length>1?.45:1;s.connect(g);g.connect(q);const st=t0+ev.t+(ev.spread||0)*k;s.start(st);s.stop(st+(ev.notes.length>1?0.65:2.6))}));
   window.__t0=performance.now();return dst.stream}},[ac64,sc,bg,process.env.LVL||.2]);
 await p.goto(APP);await p.waitForTimeout(300);if(await p.$('#wSkip:visible'))await p.click('#wSkip');
 await p.click('#listen');let stopped=null,st='';
 for(let k=0;k<end*5;k++){await p.waitForTimeout(200);const r=await p.evaluate(()=>[document.getElementById('listen').classList.contains('on'),document.getElementById('status').textContent,performance.now()-window.__t0]);if(!r[0]){stopped=(r[2]/1000).toFixed(1);st=r[1];break}}
 console.log(name.padEnd(12),stopped?`STOPPED at ${stopped}s: "${st}"`:`still listening after ${end}s`,errs.join(';'));await p.close()}));
 await b.close()})();
