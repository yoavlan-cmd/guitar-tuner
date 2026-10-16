// Add a song from Google Drive (V2 phase 4; Google sign-in, Drive and GitHub mocked): a Drive link to the video and/or audio →
// GitHub fetches it (drive.json: the audio is the source, no MP3 made of an MP3, the folder, the sign-in) → the parts come back →
// the MP3s GitHub saved in Drive show on the song's page with the video; a phone notification says it's ready. When Google's
// sign-in ran out on GitHub, the page offers "Save them" and the phone saves the MP3s next to the song. A YouTube link is refused
// kindly (offered as a video lesson), a non-Drive link and a missing GitHub connection say what to do.
const {chromium}=require('playwright');const path=require('path'),fs=require('fs'),http=require('http');
const ROOT=path.resolve(__dirname,'..'),OUT=path.join(__dirname,'out');fs.mkdirSync(OUT,{recursive:true});
const srv=http.createServer((q,r)=>{const f=path.join(ROOT,decodeURIComponent(q.url.split('?')[0]).replace(/\/$/,'/index.html'));fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);return r.end()}r.writeHead(200,{'content-type':/\.html$/.test(f)?'text/html':'application/octet-stream'});r.end(d)})}).listen(0);
const APP=process.env.APP||`http://localhost:${srv.address().port}/index.html`;
let fail=0;const ok=(c,m)=>{console.log((c?'ok  ':'FAIL')+' '+m);if(!c)fail++};
(async()=>{const b=await chromium.launch({...(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{})});
 const ctx=await b.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
 const H={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,PUT,PATCH,DELETE','access-control-expose-headers':'*'};
 // ---- Google ----
 let scopes=[],uploads=[];
 await ctx.route('https://accounts.google.com/gsi/client',r=>r.fulfill({contentType:'text/javascript',headers:H,body:`window.google={accounts:{oauth2:{initTokenClient:c=>({requestAccessToken(){window.__scopes=(window.__scopes||[]).concat(c.scope);setTimeout(()=>c.callback({access_token:'drivetok',expires_in:3600}),20)}})}}};`}));
 const FILES={vid1XyZ12345abcDEF:{id:'vid1XyZ12345abcDEF',name:'Amir Dadon - Leftovers.mp4',mimeType:'video/mp4',parents:['folderA'],webViewLink:'https://drive.google.com/file/d/vid1XyZ12345abcDEF/view'},
  aud1XyZ12345abcDEF:{id:'aud1XyZ12345abcDEF',name:'Amir Dadon - Leftovers.mp3',mimeType:'audio/mpeg',parents:['folderA'],webViewLink:'https://drive.google.com/file/d/aud1XyZ12345abcDEF/view'},
  vid2XyZ12345abcDEF:{id:'vid2XyZ12345abcDEF',name:'Tuna - Ya.mp4',mimeType:'video/mp4',parents:['folderB'],webViewLink:'https://drive.google.com/file/d/vid2XyZ12345abcDEF/view'},
  doc1XyZ12345abcDEF:{id:'doc1XyZ12345abcDEF',name:'Notes.docx',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',parents:['folderA']}};
 await ctx.route(/^https:\/\/www\.googleapis\.com\//,async r=>{const q=r.request(),u=q.url();if(q.method()==='OPTIONS')return r.fulfill({status:204,headers:H});
  const m=u.match(/drive\/v3\/files\/([\w-]+)\?fields/);if(m){const f=FILES[m[1]];return r.fulfill({status:f?200:404,headers:{...H,'content-type':'application/json'},body:JSON.stringify(f||{error:{message:'File not found'}})})}
  if(/upload\/drive\/v3\/files\?uploadType=multipart/.test(u)){const body=q.postData()||'';const name=(body.match(/"name":"([^"]+)"/)||[])[1];uploads.push({name,parents:(body.match(/"parents":\["([^"]+)"/)||[])[1],auth:q.headers()['authorization']});return r.fulfill({status:200,headers:{...H,'content-type':'application/json'},body:JSON.stringify({id:'up'+uploads.length,name,webViewLink:'https://drive.google.com/file/d/up'+uploads.length+'/view'})})}
  return r.fulfill({status:404,headers:H,body:'{}'})});
 // ---- GitHub ----
 const jobs={},done={};let dispatches=0,blobs={};
 const J=(r,st,o)=>r.fulfill({status:st,contentType:'application/json',headers:H,body:JSON.stringify(o||{})});
 await ctx.route('https://api.github.com/**',async r=>{const q=r.request(),u=q.url().replace('https://api.github.com/repos/me/split',''),m=q.method();
  if(m==='OPTIONS')return r.fulfill({status:204,headers:H});
  if(m==='GET'&&u==='')return J(r,200,{default_branch:'main',private:true});
  if(u.startsWith('/contents/.github/workflows/split.yml'))return m==='GET'?J(r,404,{message:'Not Found'}):J(r,201,{});
  if(u==='/git/blobs'){const c=JSON.parse(q.postData()).content,sha='b'+Object.keys(blobs).length;blobs[sha]=Buffer.from(c,'base64').toString();return J(r,201,{sha})}
  if(u==='/git/trees'){const t=JSON.parse(q.postData()).tree[0];return J(r,201,{sha:'t:'+t.path+':'+t.sha})}
  if(u==='/git/commits')return J(r,201,{sha:'c:'+JSON.parse(q.postData()).tree});
  if(u==='/git/refs'){const d=JSON.parse(q.postData()),id=d.ref.replace('refs/heads/j-',''),[,path,b]=d.sha.replace('c:t:','').match(/^(.*):(b\d+)$/)||[];jobs[id]={path,body:blobs[b]};return J(r,201,{})}
  if(u.endsWith('/dispatches')){dispatches++;return r.fulfill({status:204,headers:H,body:''})}
  if(u.startsWith('/git/ref/heads/r-')){const id=u.split('r-')[1];return done[id]?J(r,200,{object:{sha:'x'}}):J(r,404,{message:'Not Found'})}
  if(u.startsWith('/git/refs/heads/'))return r.fulfill({status:204,headers:H,body:''});
  if(u.startsWith('/actions/runs'))return J(r,200,{workflow_runs:[]});
  const c=u.match(/^\/contents\/([\w.]+)\?ref=r-(\w+)/);if(c&&done[c[2]]){const f=done[c[2]][c[1]];if(f==null)return J(r,404,{message:'Not Found'});return r.fulfill({status:200,headers:{...H,'content-type':'application/octet-stream'},body:typeof f==='string'?f:Buffer.from(f)})}
  return J(r,404,{message:'Not Found'})});
 await ctx.route(/^https:\/\/(?!www\.googleapis\.com|accounts\.google\.com|api\.github\.com)/,r=>r.abort());await ctx.route(/ideas\.json/,r=>r.abort());
 const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.addInitScript(()=>{window.__GD_CLIENT='test.apps.googleusercontent.com';window.__mxWaitScale=0.001;window.__mxPollMs=1e9;window.__notes=[];
  window.Notification=class{static get permission(){return 'granted'}static requestPermission(){return Promise.resolve('granted')}constructor(t){window.__notes.push(t)}};
  if(window.ServiceWorkerRegistration)ServiceWorkerRegistration.prototype.showNotification=function(t){window.__notes.push(t);return Promise.resolve()};
  if(sessionStorage.x)return;sessionStorage.x=1;localStorage.setItem('tuner.userName','"Yoav"');localStorage.setItem('tuner.profile',JSON.stringify({name:'Yoav',onboarding:{done:true}}));localStorage.setItem('tuner.learnLang','"en"')});
 await p.goto(APP);await p.waitForTimeout(500);
 await p.tap('#bnav [data-sec=learn]');await p.waitForTimeout(200);
 ok(await p.$eval('#addSong',e=>!!e.offsetWidth&&/Add a song/.test(e.textContent)),'Learn has an "Add a song" tile');
 await p.tap('#addSong');await p.waitForTimeout(150);ok(await p.$eval('#dsDlg',e=>!e.hidden)&&!!await p.$('#dsL1'),'it asks for a link to the video or audio in Drive');
 const go=async(l1,l2)=>{await p.fill('#dsL1',l1);if(l2){await p.evaluate(()=>document.querySelector('.dsmore').open=true);await p.fill('#dsL2',l2)}await p.tap('#dsGo');await p.waitForTimeout(500);return p.$eval('#dsMsg',e=>e.textContent).catch(()=>'(closed)')};
 let m=await go('https://youtu.be/abcdefghijk');ok(/YouTube links can’t be turned into song files/.test(m)&&!!await p.$('#dsAsLesson'),'a YouTube link: explains, and offers to keep it as a video lesson');
 m=await go('https://example.com/song.mp3');ok(/doesn’t look like a Google Drive file link/.test(m),'a non-Drive link: says how to copy the Drive link');
 m=await go('https://drive.google.com/file/d/vid1XyZ12345abcDEF/view?usp=sharing');ok(/connect your GitHub/i.test(m),'without GitHub: asks to connect it first');
 await p.evaluate(()=>localStorage.setItem('guitaring.gh',JSON.stringify({repo:'me/split',token:'t',branch:'main'})));
 m=await go('https://drive.google.com/file/d/doc1XyZ12345abcDEF/view');ok(/isn’t a video or audio file/.test(m),'a document: says it isn’t a video or audio file');
 // video + audio of the same song
 m=await go('https://drive.google.com/file/d/vid1XyZ12345abcDEF/view?usp=sharing','https://drive.google.com/open?id=aud1XyZ12345abcDEF');
 ok(m==='(closed)'||await p.$eval('#dsDlg',e=>e.hidden),'with both links the dialog closes and it’s sent');
 const scopes1=await p.evaluate(()=>window.__scopes);ok(scopes1.includes('https://www.googleapis.com/auth/drive'),'it asks Google for Drive access ('+scopes1.join(',')+')');
 const ids=Object.keys(jobs);const job=JSON.parse(jobs[ids[0]].body||'{}');console.log('  job:',jobs[ids[0]].path,JSON.stringify({...job,token:job.token&&'…'}));
 ok(jobs[ids[0]].path==='drive.json'&&job.file==='aud1XyZ12345abcDEF'&&job.ext==='mp3'&&job.full===false&&job.folder==='folderA'&&job.base==='Amir Dadon - Leftovers'&&job.token==='drivetok'&&dispatches===1,
  'GitHub gets a job, not the song: the audio as the source, no MP3 made of an MP3, the folder, the name, the sign-in; the split is started');
 const it1=await p.evaluate(()=>window.__mxTest.idx()[0]);ok(it1.state==='wait'&&it1.drive&&it1.drive.video&&it1.drive.video.id==='vid1XyZ12345abcDEF','the song waits for its parts and remembers the video');
 ok(/on its way/.test(await p.$eval('#toast',e=>e.textContent)),'it says it’s on its way');
 // the parts come back, MP3s saved by GitHub
 const flac=Buffer.from([0x66,0x4c,0x61,0x43,0,0,0,0]);const stems=Object.fromEntries(['drums','bass','other','vocals','guitar','piano'].map(s=>[s+'.flac',flac]));
 done[it1.id]={'done.json':JSON.stringify({ok:true,format:'flac',stems:['drums','bass','other','vocals','guitar','piano']}),...stems,'drive.json':JSON.stringify({ok:true,files:{guitars:{id:'g9',name:'Amir Dadon - Leftovers (guitars only).mp3',url:'https://drive.google.com/file/d/g9/view'}}})};
 await p.evaluate(()=>window.__mxTest.poll());await p.waitForTimeout(600);
 const it2=await p.evaluate(()=>window.__mxTest.idx()[0]);ok(it2.state==='ready'&&it2.drive.ok&&it2.drive.out.guitars.id==='g9','the parts are back and the guitars-only MP3 GitHub saved in Drive is linked');
 ok((await p.evaluate(()=>window.__notes)).some(t=>/is ready/.test(t)),'a phone notification says it’s ready');
 // the song's page
 await p.tap('#bnav [data-sec=home]');await p.tap('#bnav [data-sec=learn]');await p.waitForTimeout(200);
 await p.tap('#learnList .lrow:has-text("Leftovers")');await p.waitForTimeout(300);
 const pg=await p.$eval('#sesBox',e=>e.innerText.replace(/\s+/g,' '));
 ok(/The video in Drive/.test(pg)&&/Guitars-only MP3 in Drive/.test(pg)&&/JAM/i.test(await p.$eval('.seshero',e=>e.textContent)),'the song’s page has the video, the guitars-only MP3 in Drive and the jam track');
 // a second song: Google's sign-in ran out on GitHub → the phone saves the MP3s with one tap
 await p.tap('#paneSession [data-back]');await p.tap('#addSong');await p.waitForTimeout(100);await go('https://drive.google.com/file/d/vid2XyZ12345abcDEF/view');
 const it3=await p.evaluate(()=>window.__mxTest.idx()[0]);const job2=JSON.parse(jobs[it3.id].body);ok(job2.file==='vid2XyZ12345abcDEF'&&job2.ext==='mp4'&&job2.full===true&&job2.folder==='folderB','a video alone: a full MP3 is made from it');
 done[it3.id]={'done.json':JSON.stringify({ok:true,format:'flac'}),...stems,'drive.json':JSON.stringify({ok:false,error:'401 Unauthorized',files:{}}),'full.mp3':Buffer.from('ID3full'),'guitars.mp3':Buffer.from('ID3gtr')};
 await p.evaluate(()=>window.__mxTest.poll());await p.waitForTimeout(600);
 await p.tap('#bnav [data-sec=home]');await p.tap('#bnav [data-sec=learn]');await p.waitForTimeout(200);await p.tap('#learnList .lrow:has-text("Ya")');await p.waitForTimeout(300);
 ok(/The MP3s aren’t in Drive yet/.test(await p.$eval('#sesBox',e=>e.textContent)),'when GitHub couldn’t save them, the page says so');
 await p.tap('[data-dssave]');await p.waitForTimeout(600);
 ok(uploads.length===2&&uploads.every(u=>u.parents==='folderB'&&u.auth==='Bearer drivetok')&&uploads.map(u=>u.name).sort().join('|')==='Tuna - Ya (full).mp3|Tuna - Ya (guitars only).mp3','"Save them": the full and guitars-only MP3s go next to the song in its Drive folder '+JSON.stringify(uploads.map(u=>u.name)));
 ok(/Full song MP3 in Drive/.test(await p.$eval('#sesBox',e=>e.textContent)),'…and show on the song’s page');
 await p.screenshot({path:path.join(OUT,'ds.png'),fullPage:true});
 ok(!errs.length,'no page errors '+JSON.stringify(errs));
 console.log(fail?`${fail} FAILED`:'all passed');await b.close();srv.close();process.exit(fail?1:0)})();
