// Songs split before the session built itself (V2 phase 4): a song added from Drive gets its session on the next open (no tap);
// any other split song with no guide offers "Build the song guide" on its page, which builds it there and shows the guide.
// The song from Drive has the real name of the song that met this ("ג'ימבו ג'יי, … - במקום בו אני גר"). The guitars part as in auto_t.
const {chromium}=require('playwright');const path=require('path'),fs=require('fs'),http=require('http');const {execFileSync}=require('child_process');
const ROOT=path.resolve(__dirname,'..'),OUT=path.join(__dirname,'out');fs.mkdirSync(OUT,{recursive:true});
const srv=http.createServer((q,r)=>{const f=path.join(ROOT,decodeURIComponent(q.url.split('?')[0]).replace(/\/$/,'/index.html'));fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);return r.end()}r.writeHead(200,{'content-type':/\.html$/.test(f)?'text/html':'application/octet-stream'});r.end(d)})}).listen(0);
const APP=process.env.APP||`http://localhost:${srv.address().port}/index.html`;
let fail=0;const ok=(c,m)=>{console.log((c?'ok  ':'FAIL')+' '+m);if(!c)fail++};
// chords as plucked notes (guitar-like decay), 4.8 s each (2 bars at 100 BPM), the progression twice
const F={G:[98,123.47,146.83,196,246.94,392],C:[130.81,164.81,196,261.63,329.63],D:[146.83,220,293.66,369.99],Em:[82.41,123.47,164.81,196,246.94,329.63]};
const seq=['G','C','D','Em','G','C','D','Em','G','C','D','Em'];
const expr=seq.map((c,i)=>{const t0=i*4.8;return F[c].map(f=>`between(t,${t0},${t0+4.8})*sin(2*PI*${f}*t)*exp(-2*mod(t-${t0},0.6))`).join('+')}).join('+');
const GTR=path.join(OUT,'backfill_gtr.flac');execFileSync('ffmpeg',['-y','-v','error','-f','lavfi','-i',`aevalsrc='(${expr})*0.08':s=44100:d=${seq.length*4.8}`,'-ac','2',GTR]);
(async()=>{const b=await chromium.launch({...(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{})});
 const ctx=await b.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});await ctx.route(/^https:\/\//,r=>r.abort());await ctx.route(/ideas\.json/,r=>r.abort());
 const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.addInitScript(()=>{window.__mxPollMs=1e9;window.__notes=[];window.Notification=class{static get permission(){return 'granted'}static requestPermission(){return Promise.resolve('granted')}constructor(t){window.__notes.push(t)}};
  if(window.ServiceWorkerRegistration)ServiceWorkerRegistration.prototype.showNotification=function(t){window.__notes.push(t);return Promise.resolve()};
  if(sessionStorage.x)return;sessionStorage.x=1;localStorage.setItem('tuner.userName','"Yoav"');localStorage.setItem('tuner.profile',JSON.stringify({name:'Yoav',level:'intermediate',onboarding:{done:true}}));localStorage.setItem('tuner.learnLang','"he"')});
 await p.goto(APP);await p.waitForTimeout(400);
 const HEB="ג'ימבו ג'יי, אורית טשומה, אברהם לגסה - במקום בו אני גר";
 // as the earlier beta left them: ready, no session field
 const b64=fs.readFileSync(GTR).toString('base64');
 await p.evaluate(async([b64,HEB])=>{const u=Uint8Array.from(atob(b64),c=>c.charCodeAt(0)),gtr=new Blob([u],{type:'audio/flac'});
  await window.__bk.put('mixdata:d1',{stems:{guitar:gtr}});await window.__bk.put('mixdata:o1',{stems:{guitar:gtr}});
  await window.__bk.put('mixIndex',[{id:'d1',name:HEB,at:Date.now(),src:'cloud',state:'ready',drive:{file:'f',folder:'d',ok:true,out:{guitars:{id:'g',name:'x',url:'u'}}}},
   {id:'o1',name:'Old Band - Old Song',at:Date.now()-9e5,src:'cloud',state:'ready'}])},[b64,HEB]);
 await p.reload();await p.waitForTimeout(400);
 const st=()=>p.evaluate(()=>Object.fromEntries(window.__mxTest.idx().map(x=>[x.id,x.sess||''])));
 await p.waitForFunction(()=>{const it=window.__mxTest.idx().find(x=>x.id==='d1');return it&&(it.sess==='done'||it.sess==='failed')},null,{timeout:180000}).catch(()=>{});
 let s=await st();console.log('  after opening:',JSON.stringify(s));
 ok(s.d1==='done','the song added from Drive before the update gets its session on the next open, with no tap');
 ok(s.o1==='','an older split (not from Drive) is not analysed by itself');
 ok((await p.evaluate(()=>window.__notes)).some(t=>/במקום בו אני גר/.test(t)&&/the session is ready/.test(t)),'a notification says its session is ready');
 await p.tap('#bnav [data-sec=learn]');await p.waitForTimeout(300);
 await p.tap('#learnList .lrow:has-text("במקום בו אני גר")');await p.waitForTimeout(500);
 ok(!!await p.$('#sesGuide')&&!await p.$('#sesBuild'),'its page has the song guide');
 // the older split: its page offers to build the guide
 await p.tap('#bnav [data-sec=learn]');await p.waitForTimeout(200);await p.tap('[data-lang=en]').catch(()=>{});await p.waitForTimeout(200);
 await p.tap('#learnList .lrow:has-text("Old Song")');await p.waitForTimeout(400);
 ok(!await p.$('#sesGuide')&&!!await p.$('#sesMake'),'a split song with no guide offers “Build the song guide”');
 await p.tap('#sesMake');await p.waitForTimeout(150);
 ok(/Building the song’s session/.test(await p.$eval('#sesBuild',e=>e.textContent).catch(()=>'')),'after the tap the page says it is building');
 await p.waitForFunction(()=>!!document.getElementById('sesGuide'),null,{timeout:180000}).catch(()=>{});
 ok(!!await p.$('#sesGuide')&&!await p.$('#sesBuild'),'when it is built the page shows the guide');
 s=await st();ok(s.o1==='done','the older split is now marked done');
 // rebuild: an existing guide can be built again (with the latest listening); nothing set by hand is carried over (the Full guide is
 // the same on every build of the same recording, Oct 2026)
 await p.evaluate(()=>{const k='tuner.song.mix_o1',d=JSON.parse(localStorage.getItem(k));d.play.capo=3;d.play.capoBy='you';d.segs=d.segs.slice(0,2);localStorage.setItem(k,JSON.stringify(d))});
 await p.tap('#bnav [data-sec=learn]');await p.waitForTimeout(200);await p.tap('#learnList .lrow:has-text("Old Song")');await p.waitForTimeout(400);
 ok(!!await p.$('#sesRebuild'),'a split song with a guide offers “Rebuild the guide from the guitars-only part”');
 await p.tap('#sesRebuild');await p.waitForTimeout(150);
 ok(/Building the guide again/.test(await p.$eval('#sesGuide',e=>e.textContent))&&!await p.$('#sesRebuild'),'after the tap the guide says it is being built again');
 await p.waitForFunction(()=>{const it=window.__mxTest.idx().find(x=>x.id==='o1');return it&&(it.sess==='done'||it.sess==='failed')},null,{timeout:180000}).catch(()=>{});
 await p.waitForTimeout(300);
 const re=await p.evaluate(()=>JSON.parse(localStorage.getItem('tuner.song.mix_o1')));
 ok(re.segs.length>2&&re.play.capo===0&&re.play.capoBy!=='you','it is built again from the guitars-only part; a capo set by hand isn’t carried over');
 ok(!!await p.$('#sesRebuild')&&/No capo/.test(await p.$eval('#sesGuide .gdbig b',e=>e.textContent).catch(()=>'')),'when done, the page shows the new guide again (as detected)');
 await p.screenshot({path:path.join(OUT,'backfill.png'),fullPage:true});
 ok(!errs.length,'no page errors '+JSON.stringify(errs));
 console.log(fail?`${fail} FAILED`:'all passed');await b.close();srv.close();process.exit(fail?1:0)})();
