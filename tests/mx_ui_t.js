// The player as a mixing desk: one coloured strip per part (fader, live level meter, M / S), the song's title and artist, a
// progress bar with times, −5s / +5s; the meters move while playing and fall to zero on pause; a fader changes only its part.
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
 await p.evaluate(async()=>{const n=44100*20,ids=['guitar','vocals','drums','bass','other'];const tr=ids.map((id,j)=>{const a=new Int16Array(n*2);if(id!=='other')for(let i=0;i<a.length;i++)a[i]=(Math.random()*2-1)*(3000+j*2000);return {id,name:id,data:a}});
  await window.__bk.put('mixdata:s1',{len:n,sr:44100,tracks:tr});await window.__bk.put('mixIndex',[{id:'s1',name:'Amir Dadon - Leftovers of Life',at:Date.now(),src:'cloud',state:'ready'}])});
 await p.reload();await p.waitForTimeout(500);await p.evaluate(()=>{window.__mxTest.home();return window.__mxTest.open('s1')});await p.waitForTimeout(700);
 const head=await p.$eval('.mixttl',e=>({t:e.querySelector('b').textContent,a:(e.querySelector('span[dir]')||{}).textContent}));
 ok(head.t==='Leftovers of Life'&&head.a==='Amir Dadon','title and artist on their own lines '+JSON.stringify(head));
 const strips=await p.$$eval('#mxRows .strip',l=>l.map(e=>({c:e.style.getPropertyValue('--c'),name:e.querySelector('b').textContent,fader:!!e.querySelector('[data-vol]'),meter:!!e.querySelector('[data-lv]'),ms:e.querySelectorAll('[data-mute],[data-solo]').length,h:e.querySelector('.fader').getBoundingClientRect().height})));
 ok(strips.length===5&&strips.every(s=>s.fader&&s.meter&&s.ms===2&&s.h>=140)&&new Set(strips.map(s=>s.c)).size===5,'one strip per part, each its own colour, with a tall fader, a meter and M / S '+strips.map(s=>s.name).join(','));
 ok(/0:00/.test(await p.$eval('#mxT',e=>e.textContent))&&/0:20/.test(await p.$eval('#mxD',e=>e.textContent)),'the times under the progress bar: where you are · how long');
 await p.tap('#mxFwd');ok(/0:05/.test(await p.$eval('#mxT',e=>e.textContent)),'+5s jumps forward');await p.tap('#mxBack');ok(/0:00/.test(await p.$eval('#mxT',e=>e.textContent)),'−5s jumps back');
 await p.tap('#mxPlay');await p.waitForTimeout(1500);
 const lv=await p.evaluate(()=>[...document.querySelectorAll('#mxRows [data-lv]')].map(e=>+(e.style.transform.match(/[\d.]+/)||[0])[0]));
 ok(lv.slice(0,4).every(x=>x>0.2)&&lv[4]<0.05&&await p.evaluate(()=>document.body.classList.contains('mxon')),`the meters move while playing (silent part stays down): ${lv.map(x=>x.toFixed(2))}`);
 ok(await p.$eval('#mxSeek',e=>parseFloat(e.style.getPropertyValue('--p'))>0),'the progress bar fills as it plays');
 // a fader changes only its part
 await p.evaluate(()=>{const r=document.querySelector('[data-vol="2"]');r.value=50;r.dispatchEvent(new Event('input',{bubbles:true}))});
 const g=await p.evaluate(()=>window.__mx.gains());ok(g&&g[2]===.5&&g[0]===1&&/50%/.test(await p.$eval('[data-k="2"] output',e=>e.textContent)),'a fader sets its own part only '+JSON.stringify(g));
 // presets for practising: drums only (a rhythm track) and drums + vocals; the chosen one lights up; a hand change turns it off
 await p.tap('[data-pre=drums]');await p.waitForTimeout(150);let gp=await p.evaluate(()=>window.__mx.gains());
 ok(JSON.stringify(gp)==='[0,0,1,0,0]'&&await p.$eval('[data-pre=drums]',e=>e.getAttribute('aria-pressed'))==='true','"Drums only" plays just the drums (a rhythm track) '+JSON.stringify(gp));
 await p.tap('[data-pre=drumsvox]');await p.waitForTimeout(150);gp=await p.evaluate(()=>window.__mx.gains());
 ok(JSON.stringify(gp)==='[0,1,1,0,0]'&&await p.$eval('[data-pre=drums]',e=>e.getAttribute('aria-pressed'))==='false','"Drums + vocals" plays the drums and the vocals '+JSON.stringify(gp));
 await p.tap('[data-mute="0"]');ok(await p.$$eval('[data-pre][aria-pressed=true]',l=>l.length)===0,'changing a part by hand turns the preset light off');
 await p.tap('[data-pre=all]');
 await p.tap('#mxPlay');await p.waitForTimeout(300);
 ok((await p.evaluate(()=>[...document.querySelectorAll('#mxRows [data-lv]')].map(e=>e.style.transform))).every(t=>/scaleY\(0(\.000)?\)/.test(t))&&!(await p.evaluate(()=>document.body.classList.contains('mxon'))),'on pause the meters drop to zero');
 await p.screenshot({path:path.join(OUT,'mx_ui.png')});
 ok(!errs.length,'no page errors '+JSON.stringify(errs));
 console.log(fail?`${fail} FAILED`:'all passed');await b.close();srv.close();process.exit(fail?1:0)})();
