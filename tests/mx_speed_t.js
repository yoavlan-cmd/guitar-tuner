// Jam track at Slow / Medium / Full: the song plays slower but the pitch stays (WSOLA time-stretch in the mixer's audio worklet).
// A 440 Hz tone must still be 440 Hz at 60% and 80%; the song advances at 0.6× / 0.8× real time; meters keep moving; the
// mini player says the speed; back to Full plays normally; a seek while slowed lands where it should.
const {chromium}=require('playwright');const path=require('path'),fs=require('fs'),http=require('http');
const ROOT=path.resolve(__dirname,'..'),OUT=path.join(__dirname,'out');fs.mkdirSync(OUT,{recursive:true});
const srv=http.createServer((q,r)=>{const f=path.join(ROOT,decodeURIComponent(q.url.split('?')[0]).replace(/\/$/,'/index.html'));fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);return r.end()}r.writeHead(200,{'content-type':/\.html$/.test(f)?'text/html':'application/octet-stream'});r.end(d)})}).listen(0);
const APP=process.env.APP||`http://localhost:${srv.address().port}/index.html`;
let fail=0;const ok=(c,m)=>{console.log((c?'ok  ':'FAIL')+' '+m);if(!c)fail++};
(async()=>{const b=await chromium.launch({...(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{}),args:['--autoplay-policy=no-user-gesture-required']});
 const ctx=await b.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});await ctx.route(/^https:\/\//,r=>r.abort());await ctx.route(/ideas\.json/,r=>r.abort());
 const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.addInitScript(()=>{if(sessionStorage.x)return;sessionStorage.x=1;localStorage.setItem('tuner.userName','"Yoav"');localStorage.setItem('tuner.profile',JSON.stringify({name:'Yoav',onboarding:{done:true}}))});
 await p.goto(APP);await p.waitForTimeout(400);
 await p.evaluate(async()=>{const sr=44100,n=sr*30,tone=new Int16Array(n*2),drum=new Int16Array(n*2);
  for(let i=0;i<n;i++){const v=Math.round(Math.sin(2*Math.PI*440*i/sr)*9000);tone[2*i]=v;tone[2*i+1]=v}
  for(let i=0;i<n;i+=sr/2)for(let k=0;k<400&&i+k<n;k++){const v=Math.round((Math.random()*2-1)*6000*(1-k/400));drum[2*(i+k)]=v;drum[2*(i+k)+1]=v}
  await window.__bk.put('mixdata:s1',{len:n,sr,tracks:[{id:'guitar',name:'Guitars',data:tone},{id:'drums',name:'Drums',data:drum}]});await window.__bk.put('mixIndex',[{id:'s1',name:'Test - Tone',at:Date.now(),src:'cloud',state:'ready'}])});
 await p.reload();await p.waitForTimeout(500);await p.evaluate(()=>{window.__mxTest.home();return window.__mxTest.open('s1')});await p.waitForTimeout(700);
 ok((await p.$$('#mixView [data-rate]')).length===3&&await p.$eval('[data-rate="1"]',e=>e.getAttribute('aria-pressed'))==='true','speed buttons Slow 60% · Medium 80% · Full, Full on');
 // solo the tone so the pitch can be measured
 await p.tap('[data-solo="0"]');await p.tap('#mxPlay');await p.waitForTimeout(600);await p.evaluate(()=>window.__mx.level());
 const measure=async ms=>{const a=await p.evaluate(()=>({pos:window.__mx.pos(),t:window.__mx.ctxTime()}));await p.waitForTimeout(ms);const fs2=[];for(let i=0;i<5;i++){fs2.push(await p.evaluate(()=>window.__mx.freq()));await p.waitForTimeout(60)}
  const z=await p.evaluate(()=>({pos:window.__mx.pos(),t:window.__mx.ctxTime()}));fs2.sort((x,y)=>x-y);return {ratio:(z.pos-a.pos)/44100/((z.t-a.t)||1),f:fs2[2]}};
 const full=await measure(1500);console.log('  full',JSON.stringify(full));
 ok(Math.abs(full.ratio-1)<.12&&Math.abs(full.f-440)<6,`Full: real speed, 440 Hz (${full.ratio.toFixed(2)}×, ${Math.round(full.f)} Hz)`);
 await p.tap('[data-rate="0.6"]');await p.waitForTimeout(300);const slow=await measure(2000);console.log('  slow',JSON.stringify(slow));
 ok(Math.abs(slow.ratio-.6)<.08,`Slow: the song moves at 0.6× (${slow.ratio.toFixed(2)}×)`);
 ok(Math.abs(slow.f-440)<6,`Slow: the pitch stays at 440 Hz (${Math.round(slow.f)} Hz)`);
 ok(/60% speed/.test(await p.$eval('#mxBarS',e=>e.textContent).catch(()=>''))||await p.$eval('[data-rate="0.6"]',e=>e.getAttribute('aria-pressed'))==='true','the chosen speed is shown');
 await p.tap('[data-rate="0.8"]');await p.waitForTimeout(300);const med=await measure(2000);console.log('  medium',JSON.stringify(med));
 ok(Math.abs(med.ratio-.8)<.08&&Math.abs(med.f-440)<6,`Medium: 0.8×, still 440 Hz (${med.ratio.toFixed(2)}×, ${Math.round(med.f)} Hz)`);
 // meters still move while slowed (unsolo first)
 await p.tap('[data-solo="0"]');await p.waitForTimeout(800);
 const lv=await p.evaluate(()=>[...document.querySelectorAll('#mxRows [data-lv]')].map(e=>+(e.style.transform.match(/[\d.]+/)||[0])[0]));ok(lv[0]>.2,'the meters keep moving at a slower speed '+JSON.stringify(lv));
 // seek while slowed
 await p.evaluate(()=>{const s=document.getElementById('mxSeek');s.value=44100*20;s.dispatchEvent(new Event('change'))});await p.waitForTimeout(500);
 const ps=await p.evaluate(()=>window.__mx.pos()/44100);ok(ps>19.9&&ps<21,`a seek while slowed lands there (${ps.toFixed(2)} s)`);
 await p.tap('[data-rate="1"]');await p.waitForTimeout(300);const back=await measure(1500);ok(Math.abs(back.ratio-1)<.12,`back to Full plays at real speed (${back.ratio.toFixed(2)}×)`);
 await p.screenshot({path:path.join(OUT,'mx_speed.png')});
 ok(!errs.length,'no page errors '+JSON.stringify(errs));
 console.log(fail?`${fail} FAILED`:'all passed');await b.close();srv.close();process.exit(fail?1:0)})();
