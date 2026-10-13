const APP=process.env.APP||('file://'+require('path').resolve(__dirname,'../index.html'));
const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch({...(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{}),args:['--autoplay-policy=no-user-gesture-required']});
 const p=await (await b.newContext({viewport:{width:390,height:800}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));await p.route(/^https:\/\//,r=>r.abort());
 await p.addInitScript(()=>{localStorage.setItem('tuner.userName','"Yoav"');
  navigator.mediaDevices.getUserMedia=async()=>{const ac=new AudioContext();const o=ac.createOscillator();o.setPeriodicWave(ac.createPeriodicWave(new Float32Array([0,.3,1,.6,.4,.2,.1]),new Float32Array(7)));o.frequency.value=110*Math.pow(2,-20/1200);window.__o=o;window.__ac=ac;const g=ac.createGain();g.gain.value=.3;o.connect(g);const dst=ac.createMediaStreamDestination();g.connect(dst);o.start();return dst.stream}});
 await p.goto(APP);await p.waitForTimeout(300);if(await p.$('#wSkip:visible'))await p.click('#wSkip');
 await p.click('#listen');await p.waitForTimeout(1200);console.log('at -20:',JSON.stringify(await p.evaluate(()=>__tunerTest.state())));
 // slow peg turn: glide -20 → 0 over 1.5s
 await p.evaluate(()=>{__o.frequency.setValueAtTime(__o.frequency.value,__ac.currentTime);__o.frequency.linearRampToValueAtTime(110,__ac.currentTime+1.5)});
 const t0=Date.now();let first=null;const tr=[];for(let k=0;k<50;k++){await p.waitForTimeout(60);const s=await p.evaluate(()=>__tunerTest.state());tr.push(s.cents);if(!first&&/in tune/.test(s.st))first=Date.now()-t0}
 console.log('trace',tr.join(' '));console.log('in tune after',first,'ms (glide ends at 1500)');
 await p.evaluate(()=>{__o.frequency.setValueAtTime(110*Math.pow(2,8/1200),__ac.currentTime)});await p.waitForTimeout(500);console.log('jump to +8 after 0.5s:',JSON.stringify(await p.evaluate(()=>__tunerTest.state())));
 console.log(errs);await b.close()})();
