// The beat and chord models (splitter v9, Oct 2026): GitHub runs Beat This! (beats, bars) and BTC (chords) during the split and hands
// back models.json with the parts. The app keeps it with the parts and the session uses it: the beat grid and tempo come from Beat
// This! (a swung song's tempo was read 4/3 too fast by the phone's own beat finder), BTC's chords are one more voice in the decoder.
// A song split from Drive before v9 gets them on Rebuild: it's split once more from the same Drive files. (Google, Drive and GitHub mocked.)
const {chromium}=require('playwright');const path=require('path'),fs=require('fs'),http=require('http');const {execFileSync}=require('child_process');
const ROOT=path.resolve(__dirname,'..'),OUT=path.join(__dirname,'out');fs.mkdirSync(OUT,{recursive:true});
const srv=http.createServer((q,r)=>{const f=path.join(ROOT,decodeURIComponent(q.url.split('?')[0]).replace(/\/$/,'/index.html'));fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);return r.end()}r.writeHead(200,{'content-type':/\.html$/.test(f)?'text/html':'application/octet-stream'});r.end(d)})}).listen(0);
const APP=process.env.APP||`http://localhost:${srv.address().port}/index.html`;
let fail=0;const ok=(c,m)=>{console.log((c?'ok  ':'FAIL')+' '+m);if(!c)fail++};
// the guitar part: G · C · D · Em, 2 bars each at 100 BPM (as auto_t); the "model" says 80 BPM, to show whose beat is used
const F={G:[98,123.47,146.83,196,246.94,392],C:[130.81,164.81,196,261.63,329.63],D:[146.83,220,293.66,369.99],Em:[82.41,123.47,164.81,196,246.94,329.63]};
const seq=['G','C','D','Em','G','C','D','Em'];
const expr=seq.map((c,i)=>{const t0=i*4.8;return F[c].map(f=>`between(t,${t0},${t0+4.8})*sin(2*PI*${f}*t)*exp(-2*mod(t-${t0},0.6))`).join('+')}).join('+');
const GTR=path.join(OUT,'models_gtr.flac'),SIL=path.join(OUT,'models_sil.flac');
execFileSync('ffmpeg',['-y','-v','error','-f','lavfi','-i',`aevalsrc='(${expr})*0.08':s=44100:d=${seq.length*4.8}`,'-ac','2',GTR]);
execFileSync('ffmpeg',['-y','-v','error','-f','lavfi','-i',`anullsrc=r=44100:cl=stereo`,'-t',String(seq.length*4.8),SIL]);
const beats=[...Array(51)].map((_,i)=>+(i*.75).toFixed(3)),MODELS={v:1,beats:{beats,downbeats:beats.filter((_,i)=>i%4===0)},btc:{fps:10/108,frames:[]}};
(async()=>{const b=await chromium.launch({...(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{})});
 const ctx=await b.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
 const H={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,PUT,PATCH,DELETE','access-control-expose-headers':'*'};
 await ctx.route('https://accounts.google.com/gsi/client',r=>r.fulfill({contentType:'text/javascript',headers:H,body:`window.google={accounts:{oauth2:{initTokenClient:c=>({requestAccessToken(){setTimeout(()=>c.callback({access_token:'drivetok',expires_in:3600}),10)}})}}};`}));
 await ctx.route(/^https:\/\/www\.googleapis\.com\//,r=>r.request().method()==='OPTIONS'?r.fulfill({status:204,headers:H}):r.fulfill({status:200,headers:{...H,'content-type':'application/json'},body:JSON.stringify({files:[]})}));
 const jobs={},blobs={};let dispatches=0;const J=(r,st,o)=>r.fulfill({status:st,contentType:'application/json',headers:H,body:JSON.stringify(o||{})});
 const gtr=fs.readFileSync(GTR),sil=fs.readFileSync(SIL);
 await ctx.route('https://api.github.com/**',async r=>{const q=r.request(),u=q.url().replace('https://api.github.com/repos/me/split',''),m=q.method();
  if(m==='OPTIONS')return r.fulfill({status:204,headers:H});
  if(m==='GET'&&u==='')return J(r,200,{default_branch:'main',private:true});
  const raw=(body,ct)=>r.fulfill({status:200,headers:{...H,'content-type':ct||'application/octet-stream'},body});
  if(u.startsWith('/contents/done.json?ref=r-m9'))return raw(JSON.stringify({ok:true,format:'flac',stems:['drums','bass','other','vocals','guitar','piano'],duration:38.4}),'application/json');
  if(u.startsWith('/contents/models.json?ref=r-m9'))return raw(JSON.stringify(MODELS),'application/json');
  const st=u.match(/^\/contents\/(\w+)\.flac\?ref=r-m9/);if(st)return raw(st[1]==='guitar'?gtr:sil);
  if(u.startsWith('/contents/.github/workflows/split.yml'))return m==='GET'?J(r,404,{message:'Not Found'}):J(r,201,{});
  if(u==='/git/blobs'){const c=JSON.parse(q.postData()).content,sha='b'+Object.keys(blobs).length;blobs[sha]=Buffer.from(c,'base64').toString();return J(r,201,{sha})}
  if(u==='/git/trees'){const t=JSON.parse(q.postData()).tree[0];return J(r,201,{sha:'t:'+t.path+':'+t.sha})}
  if(u==='/git/commits')return J(r,201,{sha:'c:'+JSON.parse(q.postData()).tree});
  if(u==='/git/refs'){const d=JSON.parse(q.postData()),id=d.ref.replace('refs/heads/j-',''),[,p2,bb]=d.sha.replace('c:t:','').match(/^(.*):(b\d+)$/)||[];jobs[id]={path:p2,body:blobs[bb]};return J(r,201,{})}
  if(u.endsWith('/dispatches')){dispatches++;return r.fulfill({status:204,headers:H,body:''})}
  if(u.startsWith('/actions/runs'))return J(r,200,{workflow_runs:[]});
  if(m==='DELETE')return r.fulfill({status:204,headers:H,body:''});
  return J(r,404,{message:'Not Found'})});
 await ctx.route(/^https:\/\/(?!www\.googleapis\.com|accounts\.google\.com|api\.github\.com)/,r=>r.abort());await ctx.route(/ideas\.json/,r=>r.abort());
 const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.addInitScript(()=>{window.__GD_CLIENT='test.apps.googleusercontent.com';window.__mxWaitScale=0.001;window.__mxPollMs=1e9;window.__dsTickMs=1e9;
  if(sessionStorage.x)return;sessionStorage.x=1;localStorage.setItem('tuner.profile',JSON.stringify({name:'Yoav',level:'intermediate',onboarding:{done:true}}));localStorage.setItem('tuner.learnLang','"en"');
  localStorage.setItem('guitaring.gh',JSON.stringify({repo:'me/split',token:'t',branch:'main'}))});
 await p.goto(APP);await p.waitForTimeout(500);
 // 1. a split comes back with models.json: kept with the parts; the session takes Beat This!'s beat
 await p.evaluate(async()=>{const it={id:'m9',name:'Test Band - Model Song',at:Date.now(),src:'cloud',state:'wait'};window.__mxTest.add(it);await window.__mxTest.collect(it)});
 await p.waitForFunction(()=>{const it=window.__mxTest.idx().find(x=>x.id==='m9');return it&&(it.sess==='done'||it.sess==='failed')},null,{timeout:180000}).catch(()=>{});
 const md=await p.evaluate(async()=>{const d=await window.__bk.get('mixdata:m9');return d&&d.models?{beats:d.models.beats.beats.length,btc:!!d.models.btc}:null});
 ok(md&&md.beats===51&&md.btc,'the split’s models.json is kept with the parts (beats and chords)');
 const a=await p.evaluate(()=>JSON.parse(localStorage.getItem('tuner.song.mix_m9')||'null'));console.log('  analysis:',a&&JSON.stringify({bpm:a.bpm,beatFrom:a.beatFrom,beats:a.beats&&a.beats.length,down:a.downbeats&&a.downbeats.length}));
 ok(a&&a.beatFrom==='model'&&a.bpm===80&&a.beats.length===51&&a.downbeats&&a.downbeats.length===13,'the session’s beat and tempo are Beat This!’s (80 BPM, its bars), not the phone’s own guess (100)');
 {const L=await p.evaluate(()=>JSON.parse(localStorage.getItem('tuner.learn')||'null'));ok(a&&a.eng===1&&Array.isArray(L),'the session says which engine made it (1), and its build wrote the learning log ('+(L&&L.length)+' notes)')}
 const why=await p.evaluate(()=>{const G=window.__gd.build('mix_m9');return (G.sure.find(s=>s.k==='Tempo')||{}).why||''});console.log('  tempo:',why);
 ok(/Measured by Beat This!/.test(why),'How sure says where the tempo comes from');
 // 2. a song split from Drive before v9 (no models): Rebuild splits it once more from the same Drive files
 await p.evaluate(async()=>{const ix=await window.__bk.get('mixIndex');ix.push({id:'old1',name:'Test Band - Old Song',at:Date.now()-864e5,src:'cloud',state:'ready',sess:'done',anaKey:'mix_old1',song:{t:'Old Song',a:'Test Band'},drive:{file:'fileA',name:'Test Band - Old Song.mp4',folder:'fold1',ok:true,video:{id:'fileA',name:'Test Band - Old Song.mp4'}}});
  await window.__bk.put('mixIndex',ix);const d=await window.__bk.get('mixdata:m9');await window.__bk.put('mixdata:old1',{stems:d.stems});
  const s=JSON.parse(localStorage.getItem('tuner.song.mix_m9'));s.title='Old Song - Test Band';s.mix='old1';s.song={t:'Old Song',a:'Test Band'};delete s.beatFrom;localStorage.setItem('tuner.song.mix_old1',JSON.stringify(s));
  const ix2=JSON.parse(localStorage.getItem('tuner.songs')||'[]');ix2.unshift('mix_old1');localStorage.setItem('tuner.songs',JSON.stringify(ix2))});
 await p.reload();await p.waitForTimeout(800);await p.evaluate(()=>window.__v2.goSec('learn'));await p.waitForTimeout(300);
 await p.tap('#learnList .lrow:has-text("Old Song")');await p.waitForTimeout(500);const before=Object.keys(jobs).length;
 await p.tap('#sesRebuild');await p.waitForTimeout(1500);
 const ids=Object.keys(jobs).slice(before),job=ids.length&&JSON.parse(jobs[ids[0]].body||'{}');console.log('  job:',JSON.stringify(job&&{file:job.file,video:job.video,folder:job.folder}));
 ok(ids.length===1&&job.file==='fileA'&&job.folder==='fold1','Rebuild of a song split before the models: split once more from the same Drive file');
 const tt=await p.evaluate(()=>{const t=document.getElementById('toast');return t?t.textContent:'(no toast) '+document.title});console.log('  toast:',tt.slice(0,160));
 ok(/splits this song once more with the new beat and chord models/.test(tt),'…and it says why (about 15 minutes, once)');
 ok(!errs.length,'no page errors '+JSON.stringify(errs));
 console.log(fail?`${fail} FAILED`:'all passed');await b.close();srv.close();process.exit(fail?1:0)})();
