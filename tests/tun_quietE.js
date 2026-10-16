const APP=process.env.APP||('file://'+require('path').resolve(__dirname,'../index.html'));
// a high E that is quiet compared with the room (phone mic, thin string): must still move the needle while the peg turns
const {chromium}=require('playwright');const fs=require('fs');
const e4=fs.readFileSync(require('path').join(__dirname,'samples/')+'guitar-acoustic_E4.mp3').toString('base64');
const LV=+(process.env.LV||.03),NOISE=+(process.env.NOISE||.008),PL=+(process.env.PL||1.2);
(async()=>{const b=await chromium.launch({...(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{}),args:['--autoplay-policy=no-user-gesture-required']});
 const p=await (await b.newContext()).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));await p.route(/^https:\/\//,r=>r.abort());
 await p.addInitScript(([e4,LV,NOISE,PL])=>{localStorage.setItem('tuner.userName','"Yoav"');
  navigator.mediaDevices.getUserMedia=async()=>{const ac=new AudioContext();const E=await ac.decodeAudioData(Uint8Array.from(atob(e4),c=>c.charCodeAt(0)).buffer);
   const dst=ac.createMediaStreamDestination();const nb=ac.createBuffer(1,ac.sampleRate*4,ac.sampleRate),nd=nb.getChannelData(0);for(let i=0;i<nd.length;i++)nd[i]=NOISE*(Math.random()*2-1);const ns=ac.createBufferSource();ns.buffer=nb;ns.loop=true;const lp=ac.createBiquadFilter();lp.type='lowpass';lp.frequency.value=900;ns.connect(lp);lp.connect(dst);ns.start();
   const t0=ac.currentTime+2.5;for(let t=0;t<20;t+=PL){const c=-30*Math.max(0,1-t/8);const s=ac.createBufferSource();s.buffer=E;s.playbackRate.value=Math.pow(2,c/1200);const g=ac.createGain();g.gain.value=LV;s.connect(g);g.connect(dst);s.start(t0+t);s.stop(t0+t+PL+.3)}
   return dst.stream}},[e4,LV,NOISE,PL]);
 await p.goto(APP);await p.waitForTimeout(300);await p.waitForSelector('#wSkip',{state:'visible',timeout:2000}).then(()=>p.click('#wSkip')).catch(()=>{});await p.evaluate(()=>window.__v2&&window.__v2.goSec('tuner'));
 await p.click('#listen');const tr=[];let stop='';
 for(let k=0;k<40;k++){await p.waitForTimeout(400);const s=await p.evaluate(()=>[document.getElementById('listen').classList.contains('on'),document.getElementById('note').textContent,document.getElementById('cents').textContent,document.getElementById('status').textContent,document.getElementById('hz').textContent]);if(!s[0]){stop=s[3];break}if(k>=6&&k%2==0)tr.push(s[1]+' '+s[2])}
 const vals=tr.map(x=>parseInt(x.split(' ')[1])).filter(x=>!isNaN(x));const moved=vals.length>3&&Math.max(...vals)-Math.min(...vals)>=15;
 console.log(`LV=${LV} NOISE=${NOISE} →`,stop?'STOPPED: '+stop:'listening',moved?'| needle MOVED':'| needle STUCK',`| ${tr.join(' , ')}`,errs.join(';'));await b.close()})();
