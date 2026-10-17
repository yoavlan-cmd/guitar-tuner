// Daily ideas from the private repository (privacy step C, Oct 2026): with GitHub connected the app reads ideas.json from your
// private repository (the Band breakdown key, its branch); without GitHub, or when the private copy is missing or broken, it reads
// the public one next to the app. My profile says where the ideas last came from.
const {chromium,devices}=require('playwright');const path=require('path'),fs=require('fs'),http=require('http');
const ROOT=path.resolve(__dirname,'..');
const PUB={v:1,at:'2026-10-17T03:00:00Z',date:'2026-10-17',level:'public',index:{artists:['Pub Band'],songs:[{a:'Pub Band',t:'Public Song',ch:['G']}]},suggestions:[],sheets:[],jokes:[]};
const PRIV={...PUB,level:'private',index:{artists:['Priv Band'],songs:[{a:'Priv Band',t:'Private Song',ch:['Am']}]}};
const srv=http.createServer((q,r)=>{const u=decodeURIComponent(q.url.split('?')[0]);if(/\/ideas\.json$/.test(u)){r.writeHead(200,{'content-type':'application/json'});return r.end(JSON.stringify(PUB))}
 const f=path.join(ROOT,u.replace(/\/$/,'/index.html'));fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);return r.end()}r.writeHead(200,{'content-type':/\.html$/.test(f)?'text/html':'application/octet-stream'});r.end(d)})}).listen(0);
const BASE=`http://localhost:${srv.address().port}/`;
let fail=0;const ok=(c,m)=>{console.log((c?'ok  ':'FAIL')+' '+m);if(!c)fail++};
(async()=>{const b=await chromium.launch({...(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{})});
 // priv: what the private repository has ('json' | 'none' | 'broken'); gh: GitHub connected
 const run=async(page,gh,priv)=>{const ctx=await b.newContext({...devices['Pixel 7']});const log=[];const H={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'};
  await ctx.route('https://api.github.com/**',async r=>{const q=r.request(),u=q.url();if(q.method()==='OPTIONS')return r.fulfill({status:204,headers:H});log.push(q.method()+' '+u.replace('https://api.github.com/repos/',''));
   if(/\/contents\/ideas\.json/.test(u)){if(priv==='json')return r.fulfill({status:200,headers:H,contentType:'application/octet-stream',body:JSON.stringify(PRIV)});if(priv==='broken')return r.fulfill({status:200,headers:H,body:'{"v":1,'})}
   return r.fulfill({status:404,headers:H,contentType:'application/json',body:'{"message":"Not Found"}'})});
  await ctx.route(/^https:\/\/(?!api\.github\.com)/,r=>r.abort());
  const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.addInitScript(gh=>{if(sessionStorage.x)return;sessionStorage.x=1;localStorage.setItem('tuner.userName','"Yoav"');localStorage.setItem('tuner.profile',JSON.stringify({name:'Yoav',onboarding:{done:true}}));
   if(gh)localStorage.setItem('guitaring.gh',JSON.stringify({repo:'yoav/guitaring-split',token:'t',branch:'main'}))},gh);
  await p.goto(BASE+page);await p.waitForTimeout(900);
  const st=await p.evaluate(()=>{const g=k=>{for(const pre of ['tunerb.','tuner.']){const v=localStorage.getItem(pre+k);if(v)return JSON.parse(v)}return null};
   return {songs:((g('songIndex')||{}).songs||[]).map(s=>s.t),src:g('ideasSrc'),level:(g('ideas')||{}).level}});
  await p.evaluate(()=>window.__v2.goSec('profile'));await p.waitForTimeout(300);st.line=await p.$eval('#prfSync',e=>e.textContent).catch(()=>'');
  return {p,ctx,errs,log,st}};
 let {ctx,errs,log,st}=await run('index.html',true,'json');
 ok(st.songs.includes('Private Song')&&!st.songs.includes('Public Song')&&st.src&&st.src.src==='private'&&st.level==='private','GitHub connected: the ideas come from the private repository '+JSON.stringify(st));
 ok(log.some(x=>/^GET yoav\/guitaring-split\/contents\/ideas\.json\?ref=main/.test(x)),'read from the private repository, its branch');
 ok(/Daily ideas: from your private repository/.test(st.line),'My profile says the ideas come from the private repository');
 ok(!errs.length,'no page errors '+JSON.stringify(errs));await ctx.close();
 ({ctx,errs,log,st}=await run('index.html',true,'none'));
 ok(st.songs.includes('Public Song')&&st.src&&st.src.src==='public'&&/from the public site/.test(st.line),'no private copy yet: the public one, and My profile says so');
 ok(!errs.length,'no page errors '+JSON.stringify(errs));await ctx.close();
 ({ctx,errs,log,st}=await run('index.html',true,'broken'));
 ok(st.songs.includes('Public Song')&&st.src.src==='public','a broken private copy: the public one');
 ok(!errs.length,'no page errors '+JSON.stringify(errs));await ctx.close();
 ({ctx,errs,log,st}=await run('index.html',false,'json'));
 ok(st.songs.includes('Public Song')&&st.src.src==='public'&&!log.length,'without GitHub: the public one, GitHub not asked');
 ok(!errs.length,'no page errors '+JSON.stringify(errs));await ctx.close();
 ({ctx,errs,log,st}=await run('beta/index.html',true,'json'));
 ok(st.songs.includes('Private Song')&&!log.some(x=>/^(PUT|DELETE|POST)/.test(x)),'the beta reads the private copy too, and never writes it');
 ok(!errs.length,'no page errors '+JSON.stringify(errs));await ctx.close();
 console.log(fail?`${fail} FAILED`:'all passed');await b.close();srv.close();process.exit(fail?1:0)})();
