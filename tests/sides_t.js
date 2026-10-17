// Several guitars (step 1, Oct 2026): two guitars sitting apart (chords strummed on the left, a single-note line on the right): the
// session build splits the guitars part by side, analyses each side alone and says so in the guide's "Built from"; the chords still
// come from the whole guitars part.
const {chromium}=require('playwright');const path=require('path'),fs=require('fs'),http=require('http');const {execFileSync}=require('child_process');
const ROOT=path.resolve(__dirname,'..'),OUT=path.join(__dirname,'out');fs.mkdirSync(OUT,{recursive:true});
const srv=http.createServer((q,r)=>{const f=path.join(ROOT,decodeURIComponent(q.url.split('?')[0]).replace(/\/$/,'/index.html'));fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);return r.end()}r.writeHead(200,{'content-type':/\.html$/.test(f)?'text/html':'application/octet-stream'});r.end(d)})}).listen(0);
const APP=process.env.APP||`http://localhost:${srv.address().port}/index.html`;
let fail=0;const ok=(c,m)=>{console.log((c?'ok  ':'FAIL')+' '+m);if(!c)fail++};
// left: G · C · D · Em strummed (all notes at once, 2 bars each at 100 BPM); right: one note at a time, every 0.3 s, from each chord
const F={G:[98,123.47,146.83,196,246.94,392],C:[130.81,164.81,196,261.63,329.63],D:[146.83,220,293.66,369.99],Em:[82.41,123.47,164.81,196,246.94,329.63]};
const seq=['G','C','D','Em','G','C','D','Em','G','C','D','Em'];
const L=seq.map((c,i)=>{const t0=i*4.8;return F[c].map(f=>`between(t,${t0},${t0+4.8})*sin(2*PI*${f}*t)*exp(-2*mod(t-${t0},0.6))`).join('+')}).join('+');
const Rn=[];seq.forEach((c,i)=>{for(let k=0;k<16;k++){const t0=i*4.8+k*.3,f=F[c][k%F[c].length]*2;Rn.push(`between(t,${t0.toFixed(2)},${(t0+.3).toFixed(2)})*sin(2*PI*${f}*t)*exp(-6*(t-${t0.toFixed(2)}))`)}});
const GTR=path.join(OUT,'sides_gtr.flac');
execFileSync('ffmpeg',['-y','-v','error','-f','lavfi','-i',`aevalsrc='(${L})*0.08|(${Rn.join('+')})*0.35':s=44100:d=${seq.length*4.8}`,GTR]);
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
  await window.__bk.put('mixIndex',[{id:'z1',name:'Test Band - Two Guitars',at:Date.now(),src:'cloud',state:'ready',sess:'queued',drive:{file:'f',folder:'d',ok:true,out:{guitars:{id:'g',name:'x',url:'u'}}}}])},b64);
 await p.reload();await p.waitForTimeout(400);
 const t0=Date.now();await p.waitForFunction(()=>{const it=window.__mxTest.idx().find(x=>x.id==='z1');return it&&(it.sess==='done'||it.sess==='failed')},null,{timeout:240000}).catch(()=>{});
 const it=await p.evaluate(()=>window.__mxTest.idx().find(x=>x.id==='z1'));console.log(`  built in ${Math.round((Date.now()-t0)/1000)} s:`,it.sess);
 const S=await p.evaluate(()=>(JSON.parse(localStorage.getItem('tuner.song.mix_z1')||'{}')).guitars);console.log('  guitars:',JSON.stringify(S));
 ok(it.sess==='done'&&S&&S.apart,'the guitars sitting apart are found');
 const Ls=S&&S.sides&&S.sides.find(x=>x.pos==='L'),Rs=S&&S.sides&&S.sides.find(x=>x.pos==='R');
 ok(Ls&&Rs&&S.sides.length===2,'two sides analysed: left and right');
 ok(Ls&&Ls.notes>=2.3&&Ls.agree>=.6,'left: strummed chords (notes at once '+(Ls&&Ls.notes)+'), the same roots as the guitars part '+(Ls&&Ls.agree));
 ok(Rs&&Rs.notes<1.8,'right: single notes (notes at once '+(Rs&&Rs.notes)+')');
 await p.tap('#bnav [data-sec=learn]');await p.waitForTimeout(300);await p.tap('#learnList .lrow');await p.waitForTimeout(500);
 if(await p.$eval('[data-gd=full]',e=>e.getAttribute('aria-pressed'))!=='true'){await p.tap('[data-gd=full]');await p.waitForTimeout(150)}
 const line=await p.$$eval('.gdsrc li',l=>l.map(x=>x.textContent).find(t=>/apart|by side/.test(t))||'');console.log('  built from:',line);
 ok(/2 guitars sit apart: left .*strums .*G.*right .*plays mostly single notes/.test(line),'Built from says it: left strums the chords, right plays single notes');
 await p.screenshot({path:path.join(OUT,'sides.png'),fullPage:true});
 ok(!errs.length,'no page errors '+JSON.stringify(errs));
 console.log(fail?`${fail} FAILED`:'all passed');await b.close();srv.close();process.exit(fail?1:0)})();
