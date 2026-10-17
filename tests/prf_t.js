// My profile for daily ideas (privacy step A): a switch in My profile, off by default. On: profile.json in the private repository
// (the answers and your songs with their status and since when: no keys, notes or gear), again after a change to the answers or a
// song's status; off: the file is deleted. Without GitHub the switch can't be
// turned on. The beta writes profile-beta.json.
const {chromium,devices}=require('playwright');const path=require('path'),fs=require('fs'),http=require('http');
const ROOT=path.resolve(__dirname,'..'),OUT=path.join(__dirname,'out');fs.mkdirSync(OUT,{recursive:true});
const srv=http.createServer((q,r)=>{const f=path.join(ROOT,decodeURIComponent(q.url.split('?')[0]).replace(/\/$/,'/index.html'));fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);return r.end()}r.writeHead(200,{'content-type':/\.html$/.test(f)?'text/html':/\.webmanifest$/.test(f)?'application/manifest+json':'application/octet-stream'});r.end(d)})}).listen(0);
const BASE=`http://localhost:${srv.address().port}/`;
let fail=0;const ok=(c,m)=>{console.log((c?'ok  ':'FAIL')+' '+m);if(!c)fail++};
(async()=>{const b=await chromium.launch({...(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{})});
 const run=async(page,gh)=>{const ctx=await b.newContext({...devices['Pixel 7']});const files={},log=[];const H={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'};
  await ctx.route('https://api.github.com/**',async r=>{const q=r.request(),m=q.method(),u=q.url();if(m==='OPTIONS')return r.fulfill({status:204,headers:H});
   const f=(u.match(/\/contents\/([^?]+)/)||[])[1];log.push(m+' '+u.replace('https://api.github.com/repos/',''));
   if(!f)return r.fulfill({status:404,headers:H,body:'{}'});
   if(m==='GET')return files[f]?r.fulfill({status:200,contentType:'application/json',headers:H,body:JSON.stringify({sha:files[f].sha})}):r.fulfill({status:404,contentType:'application/json',headers:H,body:'{"message":"Not Found"}'});
   const body=JSON.parse(q.postData()||'{}');
   if(m==='PUT'){if(files[f]&&body.sha!==files[f].sha)return r.fulfill({status:409,headers:H,body:'{"message":"sha"}'});files[f]={sha:'s'+log.length,json:JSON.parse(Buffer.from(body.content,'base64').toString('utf8')),branch:body.branch};return r.fulfill({status:200,contentType:'application/json',headers:H,body:'{}'})}
   if(m==='DELETE'){if(!files[f]||body.sha!==files[f].sha)return r.fulfill({status:409,headers:H,body:'{}'});delete files[f];return r.fulfill({status:200,contentType:'application/json',headers:H,body:'{}'})}});
  await ctx.route(/^https:\/\/(?!api\.github\.com)/,r=>r.abort());await ctx.route(/ideas\.json/,r=>r.abort());
  const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.addInitScript(gh=>{window.__prfMs=50;if(sessionStorage.x)return;sessionStorage.x=1;const live=!window.__GUITARING_BETA;
   localStorage.setItem('tuner.userName','"Yoav"');localStorage.setItem('tuner.apiKey','"sk-secret"');
   localStorage.setItem('tuner.profile',JSON.stringify({name:'Yoav',level:'intermediate',genres:['israeli-rock'],artists:['אביתר בנאי'],songLang:['he'],onboarding:{done:true}}));
   localStorage.setItem('tuner.songIndex',JSON.stringify({songs:[{t:'יא',a:'אביתר בנאי',ch:['Am','G']},{t:'Wonderwall',a:'Oasis',ch:['Em7','G']},{t:'Gone',a:'X'}]}));
   localStorage.setItem('tuner.songs2',JSON.stringify([{id:'s1',title:'יא',artist:'אביתר בנאי',aliases:[],status:'learned',statusAt:'2026-09-01T10:00:00.000Z',createdAt:'2026-08-01T10:00:00.000Z',touchedAt:'2026-09-01T10:00:00.000Z',links:{},notes:'my secret note'},
    {id:'s2',title:'Wonderwall',artist:'Oasis',aliases:[],status:'learning',createdAt:'2026-08-05T10:00:00.000Z',touchedAt:'2026-08-05T10:00:00.000Z',links:{},notes:''}]));
   localStorage.setItem('tuner.songHidden',JSON.stringify([{t:'Gone',a:'X',at:1}]));
   localStorage.setItem('tuner.gearExtra',JSON.stringify([{id:'g1',kind:'pedal',type:'delay',name:'DD-3'}]));
   if(gh)localStorage.setItem('guitaring.gh',JSON.stringify({repo:'yoav/guitaring-split',token:'t',branch:'main'}))},gh);
  await p.goto(BASE+page);await p.waitForTimeout(500);await p.evaluate(()=>window.__v2.goSec('profile'));await p.waitForTimeout(300);return {p,ctx,errs,files,log}};
 // 1. the live app: off by default; on → profile.json in the private repository, only the answers
 let {p,ctx,errs,files,log}=await run('index.html',true);
 ok(await p.$eval('#prfOn',e=>!e.checked&&!e.disabled)&&/Off: nothing is saved outside this phone/.test(await p.$eval('#prfSync',e=>e.textContent))&&!Object.keys(files).length,'My profile: “Use my profile for daily ideas”, off by default; nothing saved');
 await p.check('#prfOn');await p.waitForTimeout(600);
 const f=files['profile.json'];console.log('  file:',JSON.stringify(f&&f.json));
 ok(f&&f.json.name==='Yoav'&&f.json.level==='intermediate'&&f.json.artists[0]==='אביתר בנאי'&&f.branch==='main'&&log.some(x=>/^PUT yoav\/guitaring-split\/contents\/profile\.json/.test(x)),'on: profile.json in the private repository, with your answers (Hebrew kept)');
 ok(f&&!JSON.stringify(f.json).match(/sk-secret|DD-3|onboarding|"sync"|apiKey|token/),'no keys, gear, or the app’s own fields');
 const S=(f&&f.json.songs)||[],ya=S.find(x=>x.t==='יא'),ww=S.find(x=>x.t==='Wonderwall');
 ok(ya&&ya.status==='learned'&&ya.since==='2026-09-01T10:00:00.000Z'&&ww&&ww.status==='learning'&&ww.since==='2026-08-05T10:00:00.000Z','your songs, with their status and since when');
 ok(!S.some(x=>x.t==='Gone')&&!JSON.stringify(f&&f.json).includes('my secret note'),'hidden songs and song notes are left out');
 // a status change in the song session: saved again, with the new date
 await p.evaluate(()=>window.__v2.goSec('learn'));await p.waitForTimeout(300);await p.tap('#learnList .lrow:has-text("יא")');await p.waitForTimeout(400);await p.click('#sesBox [data-st="learning"]');await p.waitForTimeout(600);
 const w2=((files['profile.json']||{}).json.songs||[]).find(x=>x.t==='יא');
 ok(w2&&w2.status==='learning'&&Date.now()-Date.parse(w2.since)<60000,'changing a song’s status saves it again, dated now');
 await p.evaluate(()=>window.__v2.goSec('profile'));await p.waitForTimeout(300);
 ok(/Saved /.test(await p.$eval('#prfSync',e=>e.textContent)),'My profile says when it was saved');
 ok(/also saved in your private GitHub repository/.test(await p.$eval('#profCard .profhead',e=>e.textContent)),'the top of My profile no longer says the answers stay on this phone');
 // a change to the answers: saved again
 await p.evaluate(()=>{const P=window.__v2.profGet();P.level='advanced';window.__v2.profSet(P)});await p.waitForTimeout(600);
 ok(files['profile.json']&&files['profile.json'].json.level==='advanced','changing an answer saves it again');
 // off: the file is deleted
 await p.uncheck('#prfOn');await p.waitForTimeout(600);
 ok(!files['profile.json']&&log.some(x=>/^DELETE .*profile\.json/.test(x))&&/Off/.test(await p.$eval('#prfSync',e=>e.textContent)),'off: the file is deleted');
 const n=log.length;await p.evaluate(()=>{const P=window.__v2.profGet();P.level='beginner';window.__v2.profSet(P)});await p.waitForTimeout(400);
 ok(log.length===n,'while off, changing an answer writes nothing');
 await p.screenshot({path:path.join(OUT,'prf.png'),fullPage:true});
 ok(!errs.length,'no page errors '+JSON.stringify(errs));await ctx.close();
 // 2. without GitHub: the switch can't be turned on, and says why
 ({p,ctx,errs,files,log}=await run('index.html',false));
 ok(await p.$eval('#prfOn',e=>e.disabled)&&/Connect GitHub first/.test(await p.$eval('#prfSync',e=>e.textContent)),'without GitHub: the switch is off and says to connect GitHub first');
 ok(!errs.length,'no page errors '+JSON.stringify(errs));await ctx.close();
 // 3. the beta: profile-beta.json (never the file the daily job reads)
 ({p,ctx,errs,files,log}=await run('beta/index.html',true));
 if(await p.$('#prfOn')){await p.check('#prfOn');await p.waitForTimeout(600)}
 ok(files['profile-beta.json']&&!files['profile.json'],'the beta writes profile-beta.json, never profile.json');
 ok(!errs.length,'no page errors '+JSON.stringify(errs));await ctx.close();
 console.log(fail?`${fail} FAILED`:'all passed');await b.close();srv.close();process.exit(fail?1:0)})();
