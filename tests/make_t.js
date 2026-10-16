// A song being made on GitHub never goes out of sight: the bottom bar shows the stage, % and minutes left (tap → the progress);
// ✕ shrinks it to a % badge that stays until it's ready (also while a song plays); Home shows "Making …"; the progress view says
// when it last checked with GitHub; slow cases are named plainly (GitHub hasn't started, the split is slow, GitHub can't be reached).
const {chromium}=require('playwright');const path=require('path'),fs=require('fs'),http=require('http');
const ROOT=path.resolve(__dirname,'..'),OUT=path.join(__dirname,'out');fs.mkdirSync(OUT,{recursive:true});
const srv=http.createServer((q,r)=>{const f=path.join(ROOT,decodeURIComponent(q.url.split('?')[0]).replace(/\/$/,'/index.html'));fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);return r.end()}r.writeHead(200,{'content-type':/\.html$/.test(f)?'text/html':'application/octet-stream'});r.end(d)})}).listen(0);
const APP=process.env.APP||`http://localhost:${srv.address().port}/index.html`;
let fail=0;const ok=(c,m)=>{console.log((c?'ok  ':'FAIL')+' '+m);if(!c)fail++};
(async()=>{const b=await chromium.launch({...(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{})});
 const ctx=await b.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
 const H={'access-control-allow-origin':'*','access-control-allow-headers':'*'};const J=(r,st,o)=>r.fulfill({status:st,contentType:'application/json',headers:H,body:JSON.stringify(o||{})});
 const ago=m=>new Date(Date.now()-m*60000).toISOString();let run={status:'in_progress',split:7},down=false,done=false;
 await ctx.route('https://api.github.com/**',async r=>{const q=r.request(),u=q.url().replace('https://api.github.com/repos/me/split',''),m=q.method();if(m==='OPTIONS')return r.fulfill({status:204,headers:H});
  if(down)return J(r,503,{message:'Service unavailable'});
  if(u.startsWith('/git/ref/heads/r-'))return done?J(r,200,{object:{sha:'x'}}):J(r,404,{message:'Not Found'});
  if(/^\/actions\/runs\/\w+\/jobs/.test(u))return J(r,200,{jobs:[{steps:run.status==='queued'?[]:[{name:'Set up job',status:'completed'},{name:'Install the separation model',status:'completed'},{name:'Get the song',status:'completed'},{name:'Split it',status:'in_progress',started_at:ago(run.split)}]}]});
  if(u.startsWith('/actions/runs'))return J(r,200,{workflow_runs:[{id:'r1',display_title:'split m1',status:run.status,run_started_at:ago(8),updated_at:ago(0)}]});
  if(u.startsWith('/git/refs/heads/'))return r.fulfill({status:204,headers:H,body:''});
  const c=u.match(/^\/contents\/([\w.]+)\?ref=r-m1/);if(c&&done){if(c[1]==='done.json')return r.fulfill({status:200,headers:H,body:JSON.stringify({ok:true,format:'flac'})});if(c[1]==='drive.json')return r.fulfill({status:200,headers:H,body:JSON.stringify({ok:true,files:{guitars:{id:'g',name:'x',url:'u'}}})});return r.fulfill({status:200,headers:H,body:Buffer.from([0x66,0x4c,0x61,0x43])})}
  return J(r,404,{message:'Not Found'})});
 await ctx.route(/^https:\/\/(?!api\.github\.com)/,r=>r.abort());await ctx.route(/ideas\.json/,r=>r.abort());
 const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.addInitScript(()=>{window.__mxPollMs=400;window.__dsTickMs=300;if(sessionStorage.x)return;sessionStorage.x=1;localStorage.setItem('tuner.userName','"Yoav"');localStorage.setItem('tuner.profile',JSON.stringify({name:'Yoav',onboarding:{done:true}}));
  localStorage.setItem('guitaring.gh',JSON.stringify({repo:'me/split',token:'t',branch:'main'}));localStorage.setItem('tuner.dsSplitMin','14')});
 await p.goto(APP);await p.waitForTimeout(300);
 await p.evaluate(async()=>{const n=44100*2;await window.__bk.put('mixdata:a1',{len:n,sr:44100,tracks:[{id:'guitar',name:'Guitars',data:new Int16Array(n*2)}]});
  await window.__bk.put('mixIndex',[{id:'m1',name:'Amir Dadon - Leftovers',at:Date.now(),src:'cloud',state:'wait',sent:Date.now()-180000,drive:{file:'f',folder:'d'}},{id:'a1',name:'Tuna - Ya',at:1,src:'cloud',state:'ready'}])});
 await p.reload();await p.waitForTimeout(1500);
 const vis=s=>p.$eval(s,e=>!e.hidden&&!!e.offsetWidth).catch(()=>false);
 const barTxt=()=>p.$eval('#mxBar',e=>e.innerText.replace(/\s+/g,' ')).catch(()=>'');
 let bt=await barTxt();console.log('  bar:',bt);
 ok(await vis('#mxBar')&&/Amir Dadon - Leftovers/.test(bt)&&/Splitting it into parts · 5\d% · about 9 min left/.test(bt),'the bottom bar shows the song being made: stage, %, minutes left');
 ok(await p.$eval('#mxBarP',e=>parseFloat(e.style.width))>45,'…with its progress line');
 ok(/Making “Amir Dadon - Leftovers”/.test(await p.$eval('#homeCont',e=>e.textContent))&&/5\d%/.test(await p.$eval('#homeCont',e=>e.textContent)),'Home: a “Making …” card with where it stands');
 await p.tap('#mxBarOpen');await p.waitForTimeout(500);
 ok(await vis('#dsDlg')&&/Checked with GitHub (just now|\d+ s ago)/.test(await p.$eval('#dsDlg',e=>e.textContent)),'tapping the bar opens the progress, which says when it last checked with GitHub');
 await p.tap('#dsHide');await p.waitForTimeout(300);ok(await vis('#mxBar')&&!(await vis('#mkPill')),'closing it: the bar is still there (no badge needed)');
 // ✕ on the bar: a % badge stays
 await p.tap('#mxBarX');await p.waitForTimeout(300);
 ok(!(await vis('#mxBar'))&&await vis('#mkPill')&&/5\d%/.test(await p.$eval('#mkPill',e=>e.textContent)),'✕ on the bar: a % badge stays on screen ('+await p.$eval('#mkPill',e=>e.textContent)+')');
 await p.screenshot({path:path.join(OUT,'make_pill.png')});
 await p.tap('#mkPill');await p.waitForTimeout(400);ok(await vis('#dsDlg .dsprog'),'tapping the badge opens the progress');await p.tap('#dsHide');await p.waitForTimeout(200);
 // playing another song meanwhile: the bar plays it, the badge keeps the making in sight
 await p.evaluate(()=>{window.__mxTest.home();return window.__mxTest.open('a1')});await p.waitForTimeout(500);await p.evaluate(()=>{const x=document.getElementById('mxClose');if(x)x.click()});await p.waitForTimeout(600);
 await p.screenshot({path:path.join(OUT,'make_play.png')});ok(/Tuna - Ya/.test(await barTxt())&&await vis('#mkPill'),'while another song plays in the bar, the badge still shows the song being made');
 // slow cases are named
 run={status:'queued'};await p.evaluate(()=>{const it=window.__mxTest.idx().find(x=>x.id==='m1');it.sent=Date.now()-11*60000});await p.waitForTimeout(1200);
 ok(await p.$eval('#mkPill',e=>e.classList.contains('warn')),'GitHub hasn’t started after 8 min: the badge turns amber');
 await p.tap('#mkPill');await p.waitForTimeout(500);ok(/GitHub hasn’t started yet/.test(await p.$eval('#dsDlg',e=>e.textContent)),'…and the progress says so, and that nothing is lost');await p.tap('#dsHide');
 run={status:'in_progress',split:40};await p.waitForTimeout(1200);await p.tap('#mkPill');await p.waitForTimeout(500);
 ok(/taking longer than usual/.test(await p.$eval('#dsDlg',e=>e.textContent)),'a split far longer than usual: says it’s still working');await p.tap('#dsHide');
 down=true;await p.evaluate(()=>{const it=window.__mxTest.idx().find(x=>x.id==='m1');it._chk=Date.now()-4*60000});await p.waitForTimeout(1200);await p.tap('#mkPill');await p.waitForTimeout(600);
 ok(/can’t reach GitHub right now/.test(await p.$eval('#dsDlg',e=>e.textContent)),'GitHub out of reach: says so, and that the work goes on there');await p.tap('#dsHide');
 // done: the badge goes, the song is ready
 down=false;run={status:'completed'};done=true;await p.waitForTimeout(2000);
 ok(!(await vis('#mkPill'))&&await p.evaluate(()=>window.__mxTest.idx().find(x=>x.id==='m1').state)==='ready','when it’s ready the badge goes away');
 ok(!errs.length,'no page errors '+JSON.stringify(errs));
 console.log(fail?`${fail} FAILED`:'all passed');await b.close();srv.close();process.exit(fail?1:0)})();
