// Faint thirds (V2 phase 4): a guitar part that sounds mostly root and 5th, whose minor 3rds are faint and whose roots' overtones
// sit on the major 3rd, was heard as F# and C# for F#m and C#m (and, with a 9th on top, F#add9 for F#m add9). Now a chord whose 3rd is too faint to call takes the quality that
// fits the song's key (here E major / C# minor). Built as a split song, so the session builds itself, then the guide is read.
const {chromium}=require('playwright');const path=require('path'),fs=require('fs'),http=require('http');const {execFileSync}=require('child_process');
const ROOT=path.resolve(__dirname,'..'),OUT=path.join(__dirname,'out');fs.mkdirSync(OUT,{recursive:true});
const srv=http.createServer((q,r)=>{const f=path.join(ROOT,decodeURIComponent(q.url.split('?')[0]).replace(/\/$/,'/index.html'));fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);return r.end()}r.writeHead(200,{'content-type':/\.html$/.test(f)?'text/html':'application/octet-stream'});r.end(d)})}).listen(0);
const APP=process.env.APP||`http://localhost:${srv.address().port}/index.html`;
let fail=0;const ok=(c,m)=>{console.log((c?'ok  ':'FAIL')+' '+m);if(!c)fail++};
// a guitar part like the one that met this ("במקום בו אני גר", guitars only): C#m · A · E · F#m, 4.6 s each, mostly root and 5th;
// each minor 3rd is faint, and the root's own overtone on the major 3rd is a little louder (so the 3rd alone would say "major")
const N=(n,o)=>440*Math.pow(2,(({C:0,'C#':1,D:2,Eb:3,E:4,F:5,'F#':6,G:7,Ab:8,A:9,Bb:10,B:11})[n]-9)/12+(o-4));
const V={'C#m':[[N('C#',3),1],[N('Ab',3),1],[N('C#',4),.9],[N('Ab',4),.6],[N('E',4),.18],[N('F',4),.24]],
 A:[[N('A',2),1],[N('E',3),1],[N('A',3),.9],[N('E',4),.6],[N('C#',4),.3]],
 E:[[N('E',2),1],[N('B',2),1],[N('E',3),.9],[N('B',3),.6],[N('Ab',3),.3]],
 'F#m':[[N('F#',2),1],[N('C#',3),1],[N('F#',3),.9],[N('C#',4),.6],[N('A',3),.18],[N('Bb',3),.24]],
 'F#m9':[[N('F#',2),1],[N('C#',3),1],[N('F#',3),.9],[N('C#',4),.6],[N('Ab',4),.7],[N('A',3),.18],[N('Bb',3),.24]]};// F#m with the 9th (G#) on top
const seq=['C#m','A','E','F#m','C#m','A','E','F#m9','C#m','A','E','F#m9'];
const expr=seq.map((c,i)=>{const t0=i*4.6;return V[c].map(([f,a])=>`${a}*between(t,${t0},${t0+4.6})*sin(2*PI*${f.toFixed(2)}*t)*exp(-1.5*mod(t-${t0},0.58))`).join('+')}).join('+');
const GTR=path.join(OUT,'key_gtr.flac');execFileSync('ffmpeg',['-y','-v','error','-f','lavfi','-i',`aevalsrc='(${expr})*0.07':s=44100:d=${seq.length*4.6}`,'-ac','2',GTR]);
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
  await window.__bk.put('mixIndex',[{id:'z1',name:'Test Band - Faint Thirds',at:Date.now(),src:'cloud',state:'ready',sess:'queued',drive:{file:'f',folder:'d',ok:true,out:{guitars:{id:'g',name:'x',url:'u'}}}}])},b64);
 await p.reload();await p.waitForTimeout(400);
 const t0=Date.now();await p.waitForFunction(()=>{const it=window.__mxTest.idx().find(x=>x.id==='z1');return it&&(it.sess==='done'||it.sess==='failed')},null,{timeout:180000}).catch(()=>{});
 const ana=await p.evaluate(()=>JSON.parse(localStorage.getItem('tuner.song.mix_z1')||'null'));ok(!!ana,'the session was built');
 const share=await p.evaluate(()=>{const d=JSON.parse(localStorage.getItem('tuner.song.mix_z1'));const R=['C','C#','D','Eb','E','F','F#','G','Ab','A','Bb','B'],T=['','m','7','m7','maj7','sus2','sus4','add9'];
  const w={};let tot=0;d.segs.forEach(([t0,t1,c])=>{if(c>=96)return;const n=R[Math.floor(c/8)]+T[c%8];w[n]=(w[n]||0)+t1-t0;tot+=t1-t0});return Object.entries(w).map(([n,v])=>[n,Math.round(v/tot*100)]).sort((a,b)=>b[1]-a[1])});
 console.log('  heard:',share.map(x=>x.join(' ')).join(' · '));
 const pct=n=>(share.find(x=>x[0]===n)||[0,0])[1];
 ok(pct('F#m')>=12&&pct('F#')<=3,'F#m is heard as F#m, not F# ('+pct('F#m')+'% / '+pct('F#')+'%)');
 ok(pct('C#m')>=15&&pct('C#')<=3,'C#m is heard as C#m, not C# ('+pct('C#m')+'% / '+pct('C#')+'%)');
 ok(pct('F#add9')<=2,'the F#m with a 9th on top isn’t heard as F#add9 ('+pct('F#add9')+'%)');
 ok(pct('E')+pct('Eadd9')>=15&&pct('A')+pct('Aadd9')+pct('Asus2')>=15,'E and A stay major');
 ok(!errs.length,'no page errors '+JSON.stringify(errs));
 console.log(fail?`${fail} FAILED`:'all passed');await b.close();srv.close();process.exit(fail?1:0)})();
