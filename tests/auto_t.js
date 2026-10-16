// The song's session builds itself (V2 phase 4): when a split is back, the guitars-only part is analysed on the phone in the
// background; the song gets its chord analysis (so its page has the Easy / Full guide and the play-along), a notification says
// the session is ready, and the progress shows "Building the song's session" until then. Resumed after a restart.
// The guitars part here is made by ffmpeg: strummed-like G · C · D · Em chords, 2 bars each at 100 BPM.
const {chromium}=require('playwright');const path=require('path'),fs=require('fs'),http=require('http');const {execFileSync}=require('child_process');
const ROOT=path.resolve(__dirname,'..'),OUT=path.join(__dirname,'out');fs.mkdirSync(OUT,{recursive:true});
const srv=http.createServer((q,r)=>{const f=path.join(ROOT,decodeURIComponent(q.url.split('?')[0]).replace(/\/$/,'/index.html'));fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);return r.end()}r.writeHead(200,{'content-type':/\.html$/.test(f)?'text/html':'application/octet-stream'});r.end(d)})}).listen(0);
const APP=process.env.APP||`http://localhost:${srv.address().port}/index.html`;
let fail=0;const ok=(c,m)=>{console.log((c?'ok  ':'FAIL')+' '+m);if(!c)fail++};
// chords as plucked notes (guitar-like decay), 4.8 s each (2 bars at 100 BPM), the progression twice
const F={G:[98,123.47,146.83,196,246.94,392],C:[130.81,164.81,196,261.63,329.63],D:[146.83,220,293.66,369.99],Em:[82.41,123.47,164.81,196,246.94,329.63]};
const seq=['G','C','D','Em','G','C','D','Em','G','C','D','Em'];
const expr=seq.map((c,i)=>{const t0=i*4.8;return F[c].map(f=>`between(t,${t0},${t0+4.8})*sin(2*PI*${f}*t)*exp(-2*mod(t-${t0},0.6))`).join('+')}).join('+');
const GTR=path.join(OUT,'auto_gtr.flac');execFileSync('ffmpeg',['-y','-v','error','-f','lavfi','-i',`aevalsrc='(${expr})*0.08':s=44100:d=${seq.length*4.8}`,'-ac','2',GTR]);
(async()=>{const b=await chromium.launch({...(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{})});
 const ctx=await b.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});await ctx.route(/^https:\/\//,r=>r.abort());await ctx.route(/ideas\.json/,r=>r.abort());
 const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.addInitScript(()=>{window.__mxPollMs=1e9;window.__notes=[];window.Notification=class{static get permission(){return 'granted'}static requestPermission(){return Promise.resolve('granted')}constructor(t){window.__notes.push(t)}};
  if(window.ServiceWorkerRegistration)ServiceWorkerRegistration.prototype.showNotification=function(t){window.__notes.push(t);return Promise.resolve()};
  if(sessionStorage.x)return;sessionStorage.x=1;localStorage.setItem('tuner.userName','"Yoav"');localStorage.setItem('tuner.profile',JSON.stringify({name:'Yoav',level:'intermediate',onboarding:{done:true}}));localStorage.setItem('tuner.learnLang','"en"')});
 await p.goto(APP);await p.waitForTimeout(400);
 // a split that just came back (as mxCollect leaves it: ready, session queued), with its guitars-only part
 const b64=fs.readFileSync(GTR).toString('base64');
 await p.evaluate(async b64=>{const u=Uint8Array.from(atob(b64),c=>c.charCodeAt(0)),gtr=new Blob([u],{type:'audio/flac'});
  await window.__bk.put('mixdata:z1',{stems:{guitar:gtr}});
  await window.__bk.put('mixIndex',[{id:'z1',name:'Test Band - Four Chords',at:Date.now(),src:'cloud',state:'ready',sess:'queued',drive:{file:'f',folder:'d',ok:true,out:{guitars:{id:'g',name:'x',url:'u'}}}}])},b64);
 await p.reload();await p.waitForTimeout(400);
 // while it builds: the bar and the progress say so
 await p.waitForFunction(()=>{const it=window.__mxTest.idx().find(x=>x.id==='z1');return it&&it.sess==='building'},null,{timeout:8000}).catch(()=>{});
 const bar=await p.$eval('#mxBar',e=>e.hidden?'':e.innerText.replace(/\s+/g,' ')).catch(()=>'');console.log('  bar while building:',bar);
 ok(/Building the song’s session|Listening to the guitars-only part|Listening to the whole song/.test(bar)&&/99%/.test(bar),'while it builds, the bottom bar says which step of the session it’s on');
 const t0=Date.now();await p.waitForFunction(()=>{const it=window.__mxTest.idx().find(x=>x.id==='z1');return it&&(it.sess==='done'||it.sess==='failed')},null,{timeout:180000}).catch(()=>{});
 const it=await p.evaluate(()=>window.__mxTest.idx().find(x=>x.id==='z1'));console.log(`  built in ${Math.round((Date.now()-t0)/1000)} s:`,it.sess,it.anaKey);
 ok(it.sess==='done'&&it.anaKey==='mix_z1','the guitars-only part is analysed on the phone and saved to the song');
 const ana=await p.evaluate(()=>JSON.parse(localStorage.getItem('tuner.song.mix_z1')||'null'));
 const names=await p.evaluate(()=>{const d=JSON.parse(localStorage.getItem('tuner.song.mix_z1'));return d?d.segs.length:0});
 ok(ana&&ana.title==='Test Band - Four Chords'.split(' - ').reverse().join(' - ')||ana&&/Four Chords/.test(ana.title),'the analysis is named after the song ('+(ana&&ana.title)+')');
 ok((await p.evaluate(()=>window.__notes)).some(t=>/the session is ready/.test(t)),'a notification says the session is ready');
 // the song's page has the guide built from it
 await p.tap('#bnav [data-sec=learn]');await p.waitForTimeout(300);
 const rows=await p.$$eval('#learnList .lrow',l=>l.map(r=>r.innerText.replace(/\s+/g,' ')));console.log('  learn rows:',JSON.stringify(rows));
 ok(rows.length===1&&/Four Chords/.test(rows[0])&&/JAM/i.test(rows[0])&&/PLAY-ALONG/i.test(rows[0]),'one song in Learn, with its jam track and its play-along');
 await p.tap('#learnList .lrow');await p.waitForTimeout(500);
 ok(!!await p.$('#sesGuide')&&/Practise with the song guide/.test(await p.$eval('#sesGo',e=>e.textContent)),'its page has the song guide (Practise opens it)');
 const ch=await p.$$eval('#gdBody .seschords svg .dgName',l=>l.map(x=>x.textContent));console.log('  guide chords:',ch.join(' '),'| capo:',await p.$eval('.gdbig b',e=>e.textContent));
 // the analysis may pick a capo: compare the sounding chords (shape + capo) with G C D Em
 const capo=+((await p.$eval('.gdbig b',e=>e.textContent)).match(/\d+/)||[0])[0];
 const R=['C','C#','D','Eb','E','F','F#','G','Ab','A','Bb','B'],snd=n=>{const m=n.match(/^([A-G][#b]?)(m?)/);if(!m)return n;const r=R.indexOf({Db:'C#','D#':'Eb',Gb:'F#','G#':'Ab','A#':'Bb'}[m[1]]||m[1]);return R[(r+capo)%12]+m[2]};
 const sounding=[...new Set(ch.map(snd))];console.log('  sounding:',sounding.join(' '));
 ok(['G','C','D','Em'].filter(c=>sounding.includes(c)).length>=3,'the guide’s chords sound like the song’s G · C · D · Em (at least 3 of 4)');
 await p.screenshot({path:path.join(OUT,'auto_session.png'),fullPage:true});
 ok(!errs.length,'no page errors '+JSON.stringify(errs));
 console.log(fail?`${fail} FAILED`:'all passed');await b.close();srv.close();process.exit(fail?1:0)})();
