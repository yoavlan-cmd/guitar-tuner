// Material the session hasn't used (Oct 2026; Google sign-in, Drive and GitHub mocked): a song first split from a file on the
// phone, then its MP4 put in Drive. "Rebuild the guide" first looks in Drive (by the song's name), finds the video the session
// never saw (also when Drive's name search misses it), and sends it to GitHub like a new song (drive.json: the video as the source and for the stills, its folder) instead of
// only listening again. Another song's video isn't taken. With nothing new in Drive, Rebuild just rebuilds (no GitHub job) and says so.
const {chromium}=require('playwright');const path=require('path'),fs=require('fs'),http=require('http');
const ROOT=path.resolve(__dirname,'..');
const srv=http.createServer((q,r)=>{const f=path.join(ROOT,decodeURIComponent(q.url.split('?')[0]).replace(/\/$/,'/index.html'));fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);return r.end()}r.writeHead(200,{'content-type':/\.html$/.test(f)?'text/html':'application/octet-stream'});r.end(d)})}).listen(0);
const APP=`http://localhost:${srv.address().port}/index.html`;
let fail=0;const ok=(c,m)=>{console.log((c?'ok  ':'FAIL')+' '+m);if(!c)fail++};
const T='שאריות של החיים',A='אמיר דדון';
(async()=>{const b=await chromium.launch({...(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{})});
 const ctx=await b.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
 const H={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,PUT,PATCH,DELETE','access-control-expose-headers':'*'};
 await ctx.route('https://accounts.google.com/gsi/client',r=>r.fulfill({contentType:'text/javascript',headers:H,body:`window.google={accounts:{oauth2:{initTokenClient:c=>({requestAccessToken(){setTimeout(()=>c.callback({access_token:'drivetok',expires_in:3600}),10)}})}}};`}));
 let driveHas=true,searches=[];
 await ctx.route(/^https:\/\/www\.googleapis\.com\//,async r=>{const q=r.request(),u=q.url();if(q.method()==='OPTIONS')return r.fulfill({status:204,headers:H});
  if(/drive\/v3\/files\?q=/.test(u)){const qq=decodeURIComponent(u);searches.push(qq);
   // like Drive, the name search can miss "Artist -Song.mp4" (words matched from their start): only the newest-files list has it
   const files=driveHas&&/'me' in owners/.test(qq)?[{id:'vidS1234567890',name:'אמיר דדון -שאריות של החיים.mp4',mimeType:'video/mp4',parents:['folderS'],webViewLink:'https://drive.google.com/file/d/vidS1234567890/view'},
    {id:'otherVid123456',name:'שאריות אחרות - Someone.mp4',mimeType:'video/mp4',parents:['folderX']}]:[];
   return r.fulfill({status:200,headers:{...H,'content-type':'application/json'},body:JSON.stringify({files})})}
  return r.fulfill({status:404,headers:H,body:'{}'})});
 const jobs={},blobs={};let dispatches=0;
 const J=(r,st,o)=>r.fulfill({status:st,contentType:'application/json',headers:H,body:JSON.stringify(o||{})});
 await ctx.route('https://api.github.com/**',async r=>{const q=r.request(),u=q.url().replace('https://api.github.com/repos/me/split',''),m=q.method();
  if(m==='OPTIONS')return r.fulfill({status:204,headers:H});
  if(m==='GET'&&u==='')return J(r,200,{default_branch:'main',private:true});
  if(u.startsWith('/contents/.github/workflows/split.yml'))return m==='GET'?J(r,404,{message:'Not Found'}):J(r,201,{});
  if(u==='/git/blobs'){const c=JSON.parse(q.postData()).content,sha='b'+Object.keys(blobs).length;blobs[sha]=Buffer.from(c,'base64').toString();return J(r,201,{sha})}
  if(u==='/git/trees'){const t=JSON.parse(q.postData()).tree[0];return J(r,201,{sha:'t:'+t.path+':'+t.sha})}
  if(u==='/git/commits')return J(r,201,{sha:'c:'+JSON.parse(q.postData()).tree});
  if(u==='/git/refs'){const d=JSON.parse(q.postData()),id=d.ref.replace('refs/heads/j-',''),[,path,bb]=d.sha.replace('c:t:','').match(/^(.*):(b\d+)$/)||[];jobs[id]={path,body:blobs[bb]};return J(r,201,{})}
  if(u.endsWith('/dispatches')){dispatches++;return r.fulfill({status:204,headers:H,body:''})}
  if(u.startsWith('/actions/runs'))return J(r,200,{workflow_runs:[]});
  return J(r,404,{message:'Not Found'})});
 await ctx.route(/^https:\/\/(?!www\.googleapis\.com|accounts\.google\.com|api\.github\.com)/,r=>r.abort());await ctx.route(/ideas\.json/,r=>r.abort());
 const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.addInitScript(([T,A])=>{window.__GD_CLIENT='test.apps.googleusercontent.com';window.__mxWaitScale=0.001;window.__mxPollMs=1e9;window.__dsTickMs=1e9;
  if(sessionStorage.x)return;sessionStorage.x=1;const S=(k,v)=>localStorage.setItem('tuner.'+k,JSON.stringify(v));
  S('userName','Yoav');S('profile',{name:'Yoav',onboarding:{done:true}});S('learnLang','he');localStorage.setItem('guitaring.gh',JSON.stringify({repo:'me/split',token:'t',branch:'main'}));
  S('song.mix_m1',{title:T+' - '+A,artist:A,dur:10,bpm:100,offset:0,tuning:{id:'std'},segs:[[0,5,0],[5,10,8]],play:{tun:'std',capo:0},v:2,at:Date.now(),from:'guitars',mix:'m1',song:{t:T,a:A}});S('songs',['mix_m1'])},[T,A]);
 await p.goto(APP);await p.waitForTimeout(500);
 await p.evaluate(async([T,A])=>{await window.__bk.put('mixIndex',[{id:'m1',name:A+' - '+T,at:Date.now()-86400000,src:'phone',state:'ready',sess:'done',anaKey:'mix_m1',song:{t:T,a:A}}])},[T,A]);
 await p.reload();await p.waitForTimeout(800);
 const openSong=async()=>{await p.evaluate(()=>window.__v2.goSec('learn'));await p.waitForTimeout(300);await p.tap(`#learnList .lrow:has-text("${T}")`);await p.waitForTimeout(500)};
 await openSong();
 ok(!!await p.$('#sesRebuild')&&/looks in your Drive/.test(await p.$eval('#sesGuide',e=>e.textContent)),'the song’s page: Rebuild, saying it first looks in Drive for unused video or audio');
 await p.tap('#sesRebuild');await p.waitForTimeout(1500);
 const ids=Object.keys(jobs),job=ids.length&&JSON.parse(jobs[ids[0]].body||'{}');console.log('  job:',JSON.stringify(job&&{file:job.file,video:job.video,folder:job.folder,base:job.base}));
 ok(searches.some(q=>q.includes("name contains 'שאריות'"))&&searches.some(q=>/'me' in owners/.test(q)),'it looked for the song’s files in Drive by its longest word, then among the newest files (the name search missed it)');
 ok(ids.length===1&&job.file==='vidS1234567890'&&job.folder==='folderS'&&dispatches===1,'the unused MP4 is sent to GitHub: split from its sound, stills from its picture, in its own folder');
 const idx=await p.evaluate(()=>window.__bk.get('mixIndex'));const n=(idx||[]).find(x=>x.id!=='m1');
 ok(n&&n.drive&&n.drive.file==='vidS1234567890'&&n.song&&n.song.t===T,'a new split of the song is on its way (the same song, from the video)');
 ok(!JSON.stringify(jobs).includes('otherVid123456'),'another song’s video isn’t taken');
 // nothing new in Drive: a plain rebuild, no GitHub job
 driveHas=false;await p.evaluate(async([T,A])=>{await window.__bk.put('mixIndex',[{id:'m1',name:A+' - '+T,at:Date.now()-86400000,src:'phone',state:'ready',sess:'done',anaKey:'mix_m1',song:{t:T,a:A}}])},[T,A]);
 await p.reload();await p.waitForTimeout(800);await openSong();const before=Object.keys(jobs).length;
 await p.tap('#sesRebuild');await p.waitForTimeout(1200);
 const it=(await p.evaluate(()=>window.__bk.get('mixIndex'))).find(x=>x.id==='m1');
 ok(Object.keys(jobs).length===before&&it&&it.sess!=='done','nothing new in Drive: no GitHub job, the guide is simply rebuilt ('+(it&&it.sess)+')');
 ok(/No video of this song in your Drive/.test(await p.$eval('#toast',e=>e.textContent)),'…and it says so (no silent fallback)');
 ok(!errs.length,'no page errors '+JSON.stringify(errs));
 console.log(fail?`${fail} FAILED`:'all passed');await b.close();srv.close();process.exit(fail?1:0)})();
