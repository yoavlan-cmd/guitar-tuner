const APP=process.env.APP||('file://'+require('path').resolve(__dirname,'../index.html'));
// realistic high-E tuning: re-plucks every PL s, sympathetic strings ringing softly, detuned -DET cents gliding to 0; level LV
const {chromium}=require('playwright');const fs=require('fs');
const e4=fs.readFileSync(require('path').join(__dirname,'samples/')+'guitar-acoustic_E4.mp3').toString('base64'),a2=fs.readFileSync(require('path').join(__dirname,'samples/')+'guitar-acoustic_A2.mp3').toString('base64');
const PL=+(process.env.PL||1),DET=+(process.env.DET||30),LV=+(process.env.LV||1),SYM=+(process.env.SYM||.15),NF=process.env.NF||'strong',NOISE=+(process.env.NOISE||.002);
(async()=>{const b=await chromium.launch({...(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{}),args:['--autoplay-policy=no-user-gesture-required']});
 const p=await (await b.newContext()).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));await p.route(/^https:\/\//,r=>r.abort());
 await p.addInitScript(([e4,a2,PL,DET,LV,SYM,NF,NOISE])=>{localStorage.setItem('tuner.userName','"Yoav"');localStorage.setItem('tuner.nf',JSON.stringify(NF));window.__plog=[];window.__tlog=[];
  navigator.mediaDevices.getUserMedia=async()=>{const ac=new AudioContext();const dec=async b=>ac.decodeAudioData(Uint8Array.from(atob(b),c=>c.charCodeAt(0)).buffer);const E=await dec(e4),A=await dec(a2);
   const dst=ac.createMediaStreamDestination();const hp=ac.createBiquadFilter();hp.type='highpass';hp.frequency.value=200;hp.connect(dst);
   const nb=ac.createBuffer(1,ac.sampleRate*4,ac.sampleRate),nd=nb.getChannelData(0);for(let i=0;i<nd.length;i++)nd[i]=NOISE*(Math.random()*2-1);const ns=ac.createBufferSource();ns.buffer=nb;ns.loop=true;ns.connect(dst);ns.start();
   const t0=ac.currentTime+.3;for(let t=0;t<20;t+=PL){const c=-DET*Math.max(0,1-t/8);
    const s=ac.createBufferSource();s.buffer=E;s.playbackRate.value=Math.pow(2,c/1200);const g=ac.createGain();g.gain.value=LV;s.connect(g);g.connect(hp);s.start(t0+t);s.stop(t0+t+PL+.4);
    // other open strings ring along a little (B3, G3 from the A2 sample re-pitched, and low E)
    if(SYM)for(const m of [59,55,40]){const r=440*Math.pow(2,(m-69)/12)/110;const s2=ac.createBufferSource();s2.buffer=A;s2.playbackRate.value=r;const g2=ac.createGain();g2.gain.value=LV*SYM;s2.connect(g2);g2.connect(hp);s2.start(t0+t+.02);s2.stop(t0+t+PL+.4)}}
   return dst.stream}},[e4,a2,PL,DET,LV,SYM,NF,NOISE]);
 await p.goto(APP);await p.waitForTimeout(300);await p.waitForSelector('#wSkip',{state:'visible',timeout:2000}).then(()=>p.click('#wSkip')).catch(()=>{});await p.evaluate(()=>window.__v2&&window.__v2.goSec('tuner'));
 await p.click('#listen');const tr=[];let stop='';
 for(let k=0;k<36;k++){await p.waitForTimeout(500);const s=await p.evaluate(()=>[document.getElementById('listen').classList.contains('on'),document.getElementById('note').textContent,document.getElementById('cents').textContent,document.getElementById('status').textContent]);if(!s[0]){stop=s[3];break}if(k%2==0)tr.push(s[1]+' '+s[2])}
 const PLG=await p.evaluate(()=>window.__plog.slice(-3));const T=await p.evaluate(()=>{const L=window.__tlog;const n=L.length;const cl=L.filter(x=>x[4]>=.85).length;const loud=L.filter(x=>x[1]>=x[2]).length;return {n,clear:cl,aboveGate:loud,gate:L[n-1]&&L[n-1][2],rmsMax:Math.max(...L.map(x=>x[1]))}});
 console.log(`PL=${PL} DET=${DET} LV=${LV} SYM=${SYM} NF=${NF} →`,stop?'STOPPED: '+stop:'listening',`| ${tr.join(' , ')}`);console.log('   frames',JSON.stringify(T),'plog',JSON.stringify(PLG),errs.join(';'));await b.close()})();
