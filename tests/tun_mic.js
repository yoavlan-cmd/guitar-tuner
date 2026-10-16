const APP=process.env.APP||('file://'+require('path').resolve(__dirname,'../index.html'));
const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch({...(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{}),args:['--autoplay-policy=no-user-gesture-required']});
 const p=await (await b.newContext({viewport:{width:360,height:740},deviceScaleFactor:2})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));await p.route(/^https:\/\//,r=>r.abort());
 await p.addInitScript(()=>{localStorage.setItem('tuner.userName','"Yoav"');
  navigator.mediaDevices.getUserMedia=async()=>{const ac=new AudioContext(),sr=ac.sampleRate,len=sr*8,buf=ac.createBuffer(1,len,sr),d=buf.getChannelData(0),F=+(localStorage.F||110.5);
   for(let i=0;i<len;i++){const t=(i%(sr*2))/sr;let v=0;for(let h=1;h<=6;h++)v+=Math.sin(2*Math.PI*F*h*(i/sr))/h*Math.exp(-t*(.6+h*.4));d[i]=.3*v}
   const s=ac.createBufferSource();s.buffer=buf;s.loop=true;const dst=ac.createMediaStreamDestination();s.connect(dst);s.start();return dst.stream}});
 await p.goto(APP);await p.waitForTimeout(300);await p.waitForSelector('#wSkip',{state:'visible',timeout:2000}).then(()=>p.click('#wSkip')).catch(()=>{});await p.evaluate(()=>window.__v2&&window.__v2.goSec('tuner'));
 await p.click('#listen');await p.waitForTimeout(1500);
 console.log('status',await p.$eval('#status',e=>e.textContent),'| needle',await p.$eval('#needle',e=>e.getAttribute('transform')),'| target',await p.$eval('.peg.target',e=>e.innerText.replace(/\s+/g,'')),'| sharp lit',await p.$eval('#sharpInd',e=>e.classList.contains('on')));
 await p.screenshot({path:require('path').join(__dirname,'out','tun_mic360.png')});
 await p.click('.peg[data-i="1"]');await p.waitForTimeout(300);console.log('locked chip',await p.$eval('#modeChip',e=>e.textContent));
 await p.click('.peg[data-i="1"]');console.log('unlock chip',await p.$eval('#modeChip',e=>e.textContent));
 await p.click('#listen');await p.waitForTimeout(900);console.log('stopped needle',await p.$eval('#needle',e=>e.getAttribute('transform')),'status',await p.$eval('#status',e=>e.textContent));
 console.log('errors',errs);await b.close()})();
