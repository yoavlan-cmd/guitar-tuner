// The beta (…/beta/) keeps its own data: on its first open it copies the live app's small data, reads big items from the live
// database only when needed (keeping its own copy), and never writes, changes or deletes anything of the live app.
const {chromium}=require('playwright');const path=require('path'),fs=require('fs'),http=require('http');
const ROOT=path.resolve(__dirname,'..');
const srv=http.createServer((q,r)=>{const f=path.join(ROOT,decodeURIComponent(q.url.split('?')[0]).replace(/\/$/,'/index.html'));fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);return r.end()}r.writeHead(200,{'content-type':/\.html$/.test(f)?'text/html':/webmanifest$/.test(f)?'application/manifest+json':'application/octet-stream'});r.end(d)})}).listen(0);
const BASE=process.env.BASE||`http://localhost:${srv.address().port}/`;
let fail=0;const ok=(c,m)=>{console.log((c?'ok  ':'FAIL')+' '+m);if(!c)fail++};
const noWelcome=pg=>pg.evaluate(()=>{const w=document.getElementById('welcome');if(w)w.hidden=true});
(async()=>{if(!fs.existsSync(path.join(ROOT,'beta/index.html'))){console.log('FAIL beta/index.html missing: run bash tools/build.sh beta');process.exit(1)}
 const b=await chromium.launch({...(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{})});
 const ctx=await b.newContext({viewport:{width:390,height:844}});await ctx.route(/^https:\/\//,r=>r.abort());
 const live=await ctx.newPage();const errs=[];live.on('pageerror',e=>errs.push('live: '+e.message));
 await live.goto(BASE+'index.html');await live.waitForTimeout(300);
 await live.evaluate(async()=>{const S=(k,v)=>localStorage.setItem('tuner.'+k,JSON.stringify(v));S('userName','Yoav');S('instruments',[{id:'m1',type:'electric',name:'Muse'}]);
  localStorage.setItem('guitaring.gh',JSON.stringify({repo:'me/split',token:'t',branch:'main'}));
  const B=window.__bk;await B.put('mixIndex',[{id:'s1',name:'Song one',at:1,src:'phone',state:'ready'}]);
  await B.put('mixdata:s1',{len:4,sr:44100,tracks:[{id:'drums',name:'Drums',data:new Int16Array([1,2,3,4,5,6,7,8])}]});await B.put('gearphoto:g1','data:live-photo')});
 const liveState=()=>live.evaluate(async()=>{const l={};Object.keys(localStorage).filter(k=>/^(tuner|guitaring)\./.test(k)).sort().forEach(k=>l[k]=localStorage.getItem(k));
  const B=window.__bk,d={};for(const k of (await B.keys()).sort()){const v=await B.raw(k);d[k]=JSON.stringify(v,(kk,vv)=>ArrayBuffer.isView(vv)?Array.from(vv):vv)}return {l,d}});
 const s0=await liveState();
 // the beta, first open
 const beta=await ctx.newPage();beta.on('pageerror',e=>errs.push('beta: '+e.message));await beta.goto(BASE+'beta/');await beta.waitForTimeout(500);
 ok(await beta.evaluate(()=>window.__bk.beta===true&&document.title==='Guitaring beta'),'the beta knows it is the beta');
 const copied=await beta.evaluate(()=>({name:JSON.parse(localStorage.getItem('tunerb.userName')),inst:JSON.parse(localStorage.getItem('tunerb.instruments')),gh:JSON.parse(localStorage.getItem('guitaringb.gh'))}));
 ok(copied.name==='Yoav'&&copied.inst[0].name==='Muse'&&copied.gh&&copied.gh.repo==='me/split','first open: your live data is copied into the beta');
 // big items: read from live when needed, kept in the beta's own database
 const r=await beta.evaluate(async()=>{const B=window.__bk,before=(await B.keys()).filter(k=>k==='mixdata:s1').length,v=await B.get('mixdata:s1');return {before,len:v&&v.tracks[0].data.length,type:v&&v.tracks[0].data.constructor.name,after:await B.keys()}});
 ok(r.before===0&&r.len===8&&r.type==='Int16Array'&&r.after.includes('mixdata:s1'),'a Band breakdown song is read from the live app and copied into the beta’s own database');
 // the beta works and changes things…
 await noWelcome(beta);await beta.click('[data-tab=gear]');await beta.waitForTimeout(200);
 await beta.evaluate(async()=>{const B=window.__bk;localStorage.setItem('tunerb.userName','"Beta tester"');await B.put('gearphoto:g1','data:beta-photo');await B.put('mixdata:new','x');await B.del('mixdata:s1');await B.del('gearphoto:g1')});
 const gone=await beta.evaluate(async()=>({s1:await window.__bk.get('mixdata:s1'),g1:await window.__bk.get('gearphoto:g1')}));
 ok(gone.s1===null&&gone.g1===null,'deleting in the beta sticks (not read again from the live app)');
 // …and the live app is exactly as before
 const s1=await liveState();
 ok(JSON.stringify(s0.l)===JSON.stringify(s1.l),'live small data unchanged by the beta');
 ok(JSON.stringify(s0.d)===JSON.stringify(s1.d),'live database unchanged by the beta (nothing written, changed or deleted)');
 // the live app never reads the beta's data
 await live.reload();await live.waitForTimeout(300);ok(await live.evaluate(()=>JSON.parse(localStorage.getItem('tuner.userName')))==='Yoav','the live app still says Yoav');
 // reopening the beta does not copy again
 await beta.reload();await beta.waitForTimeout(400);ok(await beta.evaluate(()=>JSON.parse(localStorage.getItem('tunerb.userName')))==='Beta tester','reopening the beta keeps the beta’s own changes');
 // "Copy my live data again" (two taps)
 await noWelcome(beta);await beta.click('[data-tab=song]');await beta.evaluate(()=>{const d=document.getElementById('bkBox');d.open=true;d.scrollIntoView()});
 ok(/This is the beta/.test(await beta.$eval('#bkBox',e=>e.textContent)),'the beta’s Backup box says it is the beta');
 await beta.click('#bkCopy');const nav=beta.waitForEvent('load',{timeout:10000}).catch(()=>{});await beta.click('#bkCopy');await nav;await beta.waitForTimeout(400);
 const re=await beta.evaluate(async()=>({name:JSON.parse(localStorage.getItem('tunerb.userName')),s1:!!(await window.__bk.get('mixdata:s1')),nw:await window.__bk.raw('mixdata:new')}));
 ok(re.name==='Yoav'&&re.s1&&re.nw==null,'"Copy my live data again" starts the beta over from the live data');
 // the beta installs as its own app
 const man=await beta.evaluate(async()=>{const l=document.querySelector('link[rel=manifest]');const u=new URL(l.getAttribute('href'),document.baseURI).href;const j=await (await fetch(u)).json();return {u,j}});
 ok(/\/beta\/manifest\.webmanifest$/.test(man.u)&&man.j.name==='Guitaring beta'&&man.j.scope==='./','the beta has its own install manifest ("Guitaring beta", scope beta/)');
 const liveMan=await live.evaluate(()=>document.querySelector('link[rel=manifest]').getAttribute('href'));ok(liveMan==='manifest.webmanifest','the live app keeps its own manifest');
 ok(!errs.length,'no page errors '+JSON.stringify(errs));
 console.log(fail?`${fail} FAILED`:'all passed');await b.close();srv.close();process.exit(fail?1:0)})();
