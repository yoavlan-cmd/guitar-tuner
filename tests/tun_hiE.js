const APP=process.env.APP||('file://'+require('path').resolve(__dirname,'../index.html'));
// high E that rings briefly (thin string, fast decay) while the peg is turned: -20c -> 0 over 2 s, re-plucked every 1.5 s
const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch({...(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{}),args:['--autoplay-policy=no-user-gesture-required']});
 const p=await (await b.newContext()).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));await p.route(/^https:\/\//,r=>r.abort());
 await p.addInitScript(()=>{localStorage.setItem('tuner.userName','"Yoav"');
  navigator.mediaDevices.getUserMedia=async()=>{const ac=new AudioContext(),sr=ac.sampleRate,len=sr*8,buf=ac.createBuffer(1,len,sr),d=buf.getChannelData(0);let ph=0;
   for(let i=0;i<len;i++){const t=i/sr,tp=t%1.5,c=-20+Math.min(20,t*10),f=329.63*Math.pow(2,c/1200);ph+=f/sr;let v=0;for(let h=1;h<=5;h++)v+=Math.sin(2*Math.PI*h*ph)/h*Math.exp(-tp*(2.2+h*.6));d[i]=.3*v+.002*(Math.random()*2-1)}
   const s=ac.createBufferSource();s.buffer=buf;const dst=ac.createMediaStreamDestination();s.connect(dst);s.start(ac.currentTime+.2);return dst.stream}});
 await p.goto(APP);await p.waitForTimeout(300);if(await p.$('#wSkip:visible'))await p.click('#wSkip');
 await p.click('#listen');const tr=[];for(let k=0;k<28;k++){await p.waitForTimeout(150);tr.push(await p.evaluate(()=>{const s=__tunerTest.state();return (s.cents||'—')+'@'+s.ang.toFixed(0)}))}
 console.log(tr.join(' '));console.log(errs);await b.close()})();
