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
 const FILES={aud3XyZ12345abcDEF:{id:'aud3XyZ12345abcDEF',name:'Band C - Song C.mp3',mimeType:'audio/mpeg',parents:['folderC'],webViewLink:'https://drive.google.com/file/d/aud3XyZ12345abcDEF/view'},vid1XyZ12345abcDEF:{id:'vid1XyZ12345abcDEF',name:'Amir Dadon - Leftovers.mp4',mimeType:'video/mp4',parents:['folderA'],webViewLink:'https://drive.google.com/file/d/vid1XyZ12345abcDEF/view'},
  aud1XyZ12345abcDEF:{id:'aud1XyZ12345abcDEF',name:'Amir Dadon - Leftovers.mp3',mimeType:'audio/mpeg',parents:['folderA'],webViewLink:'https://drive.google.com/file/d/aud1XyZ12345abcDEF/view'},
  vid2XyZ12345abcDEF:{id:'vid2XyZ12345abcDEF',name:'Tuna - Ya.mp4',mimeType:'video/mp4',parents:['folderB'],webViewLink:'https://drive.google.com/file/d/vid2XyZ12345abcDEF/view'},
  vid5XyZ12345abcDEF:{id:'vid5XyZ12345abcDEF',name:"ג'ימבו ג'יי - במקום בו אני גר (חי באולפן גלגלצ).mp4",mimeType:'video/mp4',parents:['folderE'],webViewLink:'https://drive.google.com/file/d/vid5XyZ12345abcDEF/view'},
  doc1XyZ12345abcDEF:{id:'doc1XyZ12345abcDEF',name:'Notes.docx',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',parents:['folderA']}};
 await ctx.route(/^https:\/\/www\.googleapis\.com\//,async r=>{const q=r.request(),u=q.url();if(q.method()==='OPTIONS')return r.fulfill({status:204,headers:H});
  // a folder's videos (an MP3 given alone: its video is looked for next to it)
  if(/drive\/v3\/files\?q=/.test(u)){const q=decodeURIComponent(u);return r.fulfill({status:200,headers:{...H,'content-type':'application/json'},body:JSON.stringify({files:/folderC/.test(q)?[{id:'vid3XyZ12345abcDEF',name:'Band C - Song C.mp4',webViewLink:'https://drive.google.com/file/d/vid3XyZ12345abcDEF/view'}]:
   /folderD1234567/.test(q)?[{id:'fullD',name:'Band D - Song D (full).mp3',mimeType:'audio/mpeg',parents:['folderD1234567']},{id:'gtrD',name:'Band D - Song D (guitars only).mp3',mimeType:'audio/mpeg',parents:['folderD1234567']},
    {id:'vidD',name:'Band D - Song D.mp4',mimeType:'video/mp4',parents:['folderD1234567'],webViewLink:'https://drive.google.com/file/d/vidD/view'},{id:'audD',name:'Band D - Song D.mp3',mimeType:'audio/mpeg',parents:['folderD1234567']}]:[]})})}
  const m=u.match(/drive\/v3\/files\/([\w-]+)\?fields/);if(m){const f=FILES[m[1]];return r.fulfill({status:f?200:404,headers:{...H,'content-type':'application/json'},body:JSON.stringify(f||{error:{message:'File not found'}})})}
  if(/upload\/drive\/v3\/files\?uploadType=multipart/.test(u)){const body=q.postData()||'';const name=(body.match(/"name":"([^"]+)"/)||[])[1];uploads.push({name,parents:(body.match(/"parents":\["([^"]+)"/)||[])[1],auth:q.headers()['authorization']});return r.fulfill({status:200,headers:{...H,'content-type':'application/json'},body:JSON.stringify({id:'up'+uploads.length,name,webViewLink:'https://drive.google.com/file/d/up'+uploads.length+'/view'})})}
  return r.fulfill({status:404,headers:H,body:'{}'})});
 // ---- GitHub ----
 const jobs={},done={},runState={};let dispatches=0,blobs={};
 // Actions secrets (the Drive key goes as one, sealed; the app deletes it when the parts are back)
 const nacl=require('./vendor/nacl.min.js'),ghKp=nacl.box.keyPair(),secrets={},secretsDel=[];
 const J=(r,st,o)=>r.fulfill({status:st,contentType:'application/json',headers:H,body:JSON.stringify(o||{})});
 await ctx.route('https://api.github.com/**',async r=>{const q=r.request(),u=q.url().replace('https://api.github.com/repos/me/split',''),m=q.method();
  if(m==='OPTIONS')return r.fulfill({status:204,headers:H});
  if(m==='GET'&&u==='')return J(r,200,{default_branch:'main',private:true});
  if(m==='GET'&&u==='/actions/secrets/public-key')return J(r,200,{key:Buffer.from(ghKp.publicKey).toString('base64'),key_id:'k1'});
  {const sm=u.match(/^\/actions\/secrets\/(\w+)$/);if(sm&&m==='PUT'){secrets[sm[1]]=JSON.parse(q.postData());return r.fulfill({status:201,headers:H,body:''})}if(sm&&m==='DELETE'){secretsDel.push(sm[1]);return r.fulfill({status:204,headers:H,body:''})}}
  if(u.startsWith('/contents/.github/workflows/split.yml'))return m==='GET'?J(r,404,{message:'Not Found'}):J(r,201,{});
  if(u==='/git/blobs'){const c=JSON.parse(q.postData()).content,sha='b'+Object.keys(blobs).length;blobs[sha]=Buffer.from(c,'base64').toString();return J(r,201,{sha})}
  if(u==='/git/trees'){const t=JSON.parse(q.postData()).tree[0];return J(r,201,{sha:'t:'+t.path+':'+t.sha})}
  if(u==='/git/commits')return J(r,201,{sha:'c:'+JSON.parse(q.postData()).tree});
  if(u==='/git/refs'){const d=JSON.parse(q.postData()),id=d.ref.replace('refs/heads/j-',''),[,path,b]=d.sha.replace('c:t:','').match(/^(.*):(b\d+)$/)||[];jobs[id]={path,body:blobs[b]};return J(r,201,{})}
  if(u.endsWith('/dispatches')){dispatches++;return r.fulfill({status:204,headers:H,body:''})}
  if(u.startsWith('/git/ref/heads/r-')){const id=u.split('r-')[1];return done[id]?J(r,200,{object:{sha:'x'}}):J(r,404,{message:'Not Found'})}
  if(u.startsWith('/git/refs/heads/'))return r.fulfill({status:204,headers:H,body:''});
  const jm=u.match(/^\/actions\/runs\/(\w+)\/jobs/);if(jm){const st=runState[jm[1]]||{};return J(r,200,{jobs:[{steps:st.steps||[]}]})}
  if(u.startsWith('/actions/runs'))return J(r,200,{workflow_runs:Object.entries(runState).map(([id,st])=>({id,name:'Split song',display_title:'split '+id,status:st.status,run_started_at:new Date(Date.now()-600000).toISOString(),updated_at:new Date().toISOString()}))});
  const c=u.match(/^\/contents\/([\w.]+)\?ref=r-(\w+)/);if(c&&done[c[2]]){const f=done[c[2]][c[1]];if(f==null)return J(r,404,{message:'Not Found'});return r.fulfill({status:200,headers:{...H,'content-type':'application/octet-stream'},body:typeof f==='string'?f:Buffer.from(f)})}
  return J(r,404,{message:'Not Found'})});
 await ctx.route(/^https:\/\/(?!www\.googleapis\.com|accounts\.google\.com|api\.github\.com)/,r=>r.abort());
 await ctx.route(/cdnjs\.cloudflare\.com\/ajax\/libs\/tweetnacl\/1\.0\.3\/nacl\.min\.js/,r=>r.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(__dirname,'vendor','nacl.min.js'))}));await ctx.route(/ideas\.json/,r=>r.abort());
 const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.addInitScript(()=>{window.__GD_CLIENT='test.apps.googleusercontent.com';window.__mxWaitScale=0.001;window.__mxPollMs=1e9;window.__dsTickMs=250;window.__notes=[];
  window.Notification=class{static get permission(){return 'granted'}static requestPermission(){return Promise.resolve('granted')}constructor(t,o){window.__notes.push(t);window.__noteData=o&&o.data}};
  if(window.ServiceWorkerRegistration)ServiceWorkerRegistration.prototype.showNotification=function(t,o){window.__notes.push(t);window.__noteData=o&&o.data;return Promise.resolve()};
  if(sessionStorage.x)return;sessionStorage.x=1;localStorage.setItem('tuner.userName','"Yoav"');localStorage.setItem('tuner.profile',JSON.stringify({name:'Yoav',onboarding:{done:true}}));localStorage.setItem('tuner.learnLang','"en"')});
 await p.goto(APP);await p.waitForTimeout(500);
 await p.tap('#bnav [data-sec=learn]');await p.waitForTimeout(200);
 ok(await p.$eval('#addSong',e=>!!e.offsetWidth&&/Create a song session/.test(e.textContent)),'Learn has a "Create a song session" tile');
 await p.tap('#addSong');await p.waitForTimeout(150);ok(await p.$eval('#dsDlg',e=>!e.hidden)&&!!await p.$('#dsL1'),'it asks for a link to the video or audio in Drive');
 const go=async(l1,l2)=>{await p.fill('#dsL1',l1);if(l2){await p.evaluate(()=>document.querySelector('.dsmore').open=true);await p.fill('#dsL2',l2)}await p.tap('#dsGo');await p.waitForTimeout(500);return p.$eval('#dsMsg',e=>e.textContent).catch(()=>'(closed)')};
 let m=await go('https://youtu.be/abcdefghijk');ok(/YouTube links can’t be turned into song files/.test(m)&&!!await p.$('#dsAsLesson'),'a YouTube link: explains, and offers to keep it as a video lesson');
 m=await go('https://example.com/song.mp3');ok(/doesn’t look like a Google Drive link/.test(m),'a non-Drive link: says how to copy the Drive link');
 m=await go('https://drive.google.com/file/d/vid1XyZ12345abcDEF/view?usp=sharing');ok(/connect your GitHub/i.test(m),'without GitHub: asks to connect it first');
 await p.evaluate(()=>localStorage.setItem('guitaring.gh',JSON.stringify({repo:'me/split',token:'t',branch:'main'})));
 m=await go('https://drive.google.com/file/d/doc1XyZ12345abcDEF/view');ok(/isn’t a video or audio file/.test(m),'a document: says it isn’t a video or audio file');
 // video + audio of the same song
 m=await go('https://drive.google.com/file/d/vid1XyZ12345abcDEF/view?usp=sharing','https://drive.google.com/open?id=aud1XyZ12345abcDEF');
 ok(!!await p.$('#dsDlg .dsprog')&&/Making the song/.test(await p.$eval('#dsDlg',e=>e.textContent)),'with both links it’s sent and the sheet turns into a progress view');
 const scopes1=await p.evaluate(()=>window.__scopes);ok(scopes1.includes('https://www.googleapis.com/auth/drive'),'it asks Google for Drive access ('+scopes1.join(',')+')');
 const ids=Object.keys(jobs);const job=JSON.parse(jobs[ids[0]].body||'{}');console.log('  job:',jobs[ids[0]].path,JSON.stringify({...job,token:job.token&&'…'}));
 ok(jobs[ids[0]].path==='drive.json'&&job.file==='aud1XyZ12345abcDEF'&&job.ext==='mp3'&&job.full===false&&job.folder==='folderA'&&job.base==='Amir Dadon - Leftovers'&&!job.token&&job.tokenIn==='secret'&&dispatches===1,
  'GitHub gets a job, not the song: the audio as the source, no MP3 made of an MP3, the folder, the name; the split is started');
 {const sec=secrets['DRIVE_'+ids[0].toUpperCase()];let opened='';try{const c=Buffer.from(sec.encrypted_value,'base64'),epk=c.subarray(0,32),nonce=Buffer.from(require('child_process').execFileSync('python3',['-c','import hashlib,sys;print(hashlib.blake2b(bytes.fromhex(sys.argv[1]),digest_size=24).hexdigest())',Buffer.concat([epk,Buffer.from(ghKp.publicKey)]).toString('hex')]).toString().trim(),'hex');opened=Buffer.from(nacl.box.open(new Uint8Array(c.subarray(32)),new Uint8Array(nonce),new Uint8Array(epk),ghKp.secretKey)).toString()}catch(e){}
  ok(sec&&sec.key_id==='k1'&&opened==='drivetok'&&!/drivetok/.test(jobs[ids[0]].body),'Google\u2019s Drive key goes as a sealed Actions secret (DRIVE_<id>), never in the job file in the repository');}
 ok(job.video==='vid1XyZ12345abcDEF'&&job.vext==='mp4','the job names the song’s video too (GitHub takes stills from it for the chord check)');
 const it1=await p.evaluate(()=>window.__mxTest.idx()[0]);ok(it1.state==='wait'&&it1.drive&&it1.drive.video&&it1.drive.video.id==='vid1XyZ12345abcDEF','the song waits for its parts and remembers the video');
 // the progress follows GitHub's own steps
 const now=()=>p.$eval('.dssteps li.now',e=>e.textContent).catch(()=>'');const eta=()=>p.$eval('.dseta',e=>e.textContent).catch(()=>'');const pct=()=>p.$eval('.dsbar',e=>+e.getAttribute('aria-valuenow')).catch(()=>-1);
 runState[it1.id]={status:'queued'};await p.waitForTimeout(700);ok(/Waiting for a free GitHub computer/.test(await now()),'queued: "Waiting for a free GitHub computer" ('+await now()+')');
 const ago=m=>new Date(Date.now()-m*60000).toISOString();
 runState[it1.id]={status:'in_progress',steps:[{name:'Set up job',status:'completed'},{name:'Install the separation model',status:'completed'},{name:'Get the song',status:'in_progress',started_at:ago(.2)}]};await p.waitForTimeout(700);
 ok(/Getting the song from your Drive/.test(await now()),'then "Getting the song from your Drive"');const p1=await pct();
 await p.evaluate(()=>localStorage.setItem('tuner.dsSplitMin','14'));
 runState[it1.id]={status:'in_progress',steps:[{name:'Set up job',status:'completed'},{name:'Install the separation model',status:'completed'},{name:'Get the song',status:'completed'},{name:'Split it',status:'in_progress',started_at:ago(7)}]};await p.waitForTimeout(700);
 const p2=await pct(),e2=await eta();console.log('  split:',p2+'%',e2,'|',await now());
 await p.screenshot({path:path.join(OUT,'ds_progress.png')});ok(/Splitting it into parts/.test(await now())&&/50%/.test(await now())&&p2>p1&&p2>=50&&p2<=56&&/About 9 min left/.test(e2),'splitting halfway (7 of 14 min): the bar is about half way, “About 9 min left”');
 runState[it1.id]={status:'in_progress',steps:[{name:'Get the song',status:'completed'},{name:'Split it',status:'completed',started_at:ago(13),completed_at:ago(1)},{name:'Make the MP3s and save them to Google Drive',status:'in_progress'}]};await p.waitForTimeout(700);
 ok(/Saving the full and guitars-only MP3s/.test(await now())&&/Almost done/.test(await eta()),'then "Saving the MP3s to your Drive", almost done');
 ok(Math.abs(await p.evaluate(()=>+JSON.parse(localStorage.getItem('tuner.dsSplitMin')))-(14*.6+12*.4))<.2,'it learns how long a split takes on your GitHub (for the next estimate)');
 // close it, open "Add a song" again: the progress is back; "Add another song" gives the form
 await p.tap('#dsHide');await p.waitForTimeout(150);await p.tap('#addSong');await p.waitForTimeout(300);ok(!!await p.$('#dsDlg .dsprog'),'closing is fine: Add a song shows the progress again');
 await p.tap('#dsAnother');await p.waitForTimeout(150);ok(!!await p.$('#dsL1'),'"Add another song" opens the form');await p.tap('#dsX');await p.tap('#addSong');await p.waitForTimeout(300);
 // the parts come back, MP3s saved by GitHub
 const flac=Buffer.from([0x66,0x4c,0x61,0x43,0,0,0,0]);const stems=Object.fromEntries(['drums','bass','other','vocals','guitar','piano'].map(s=>[s+'.flac',flac]));
 done[it1.id]={'done.json':JSON.stringify({ok:true,format:'flac',stems:['drums','bass','other','vocals','guitar','piano']}),...stems,'drive.json':JSON.stringify({ok:true,files:{guitars:{id:'g9',name:'Amir Dadon - Leftovers (guitars only).mp3',url:'https://drive.google.com/file/d/g9/view'}}}),
  'stills.json':JSON.stringify({every:2,n:3,idx:[[0,0,4],[2,4,4],[4,8,4]]}),'stills.bin':Buffer.from('JPG1JPG2JPG3')};
 await p.waitForTimeout(900);
 ok(/Ready/.test(await p.$eval('#dsDlg',e=>e.textContent))&&!!await p.$('#dsOpen'),'when it’s done the progress says Ready with “Open the song”');
 ok(await p.$eval('#dsDlg .dsbar',b=>{const i=b.querySelector('i'),r=b.getBoundingClientRect();return !b.classList.contains('done')&&r.height<=12&&i.getBoundingClientRect().width>=r.width-2}),'Ready: the bar is full (the tuner’s “done” card style doesn’t take it over)');
 const it2=await p.evaluate(()=>window.__mxTest.idx()[0]);ok(it2.state==='ready'&&it2.drive.ok&&it2.drive.out.guitars.id==='g9','the parts are back and the guitars-only MP3 GitHub saved in Drive is linked');
 ok(secretsDel.includes('DRIVE_'+it1.id.toUpperCase()),'…and the Drive key\u2019s secret is deleted');
 const sti=await p.evaluate(async id=>{const v=await window.__bk.get('mixstills:'+id);return v&&{n:v.idx.length,size:v.bin.size}},it1.id);
 ok(sti&&sti.n===3&&sti.size===12,'the video stills come back with the parts and are kept on the phone '+JSON.stringify(sti));
 ok((await p.evaluate(()=>window.__notes)).some(t=>/is split|is ready/.test(t)),'a phone notification says it’s split (its session follows)');
 ok(await p.evaluate(()=>{const d=window.__noteData;return !!(d&&d.url&&d.url.split('#')[0]===location.href.split('#')[0])}),'the notification carries the app’s address (a tap on it opens this app: sw.js notificationclick)');
 // the song's page, from "Open the song"
 await p.tap('#dsOpen');await p.waitForTimeout(400);ok(await p.evaluate(()=>window.__v2.cur())==='session','“Open the song” opens its page');
 const pg=await p.$eval('#sesBox',e=>e.innerText.replace(/\s+/g,' '));
 ok(/The video in Drive/.test(pg)&&/Guitars-only MP3 in Drive/.test(pg)&&/JAM/i.test(await p.$eval('.seshero',e=>e.textContent)),'the song’s page has the video, the guitars-only MP3 in Drive and the jam track');
 // a second song: Google's sign-in ran out on GitHub → the phone saves the MP3s with one tap
 await p.tap('#paneSession [data-back]');await p.tap('#addSong');await p.waitForTimeout(100);await go('https://drive.google.com/file/d/vid2XyZ12345abcDEF/view');await p.tap('#dsHide').catch(()=>{});
 const it3=await p.evaluate(()=>window.__mxTest.idx()[0]);const job2=JSON.parse(jobs[it3.id].body);ok(job2.file==='vid2XyZ12345abcDEF'&&job2.ext==='mp4'&&job2.full===true&&job2.folder==='folderB','a video alone: a full MP3 is made from it');
 ok(!('video' in job2),'a video alone: no separate video (GitHub takes the stills from the song itself)');
 // an MP3 alone: the song's video is found in the same folder and named in the job
 await p.tap('#addSong').catch(()=>{});await p.waitForTimeout(150);if(await p.$('#dsAnother'))await p.tap('#dsAnother');await p.waitForTimeout(100);await go('https://drive.google.com/file/d/aud3XyZ12345abcDEF/view');await p.tap('#dsHide').catch(()=>{});
 {const it5=await p.evaluate(()=>window.__mxTest.idx().find(x=>x.drive&&x.drive.file==='aud3XyZ12345abcDEF'));const job5=it5&&jobs[it5.id]?JSON.parse(jobs[it5.id].body):{};
  ok(job5.video==='vid3XyZ12345abcDEF'&&it5.drive.video&&it5.drive.video.id==='vid3XyZ12345abcDEF','an MP3 alone: its video in the same folder is found and named in the job');}
 // the song's folder link: its video and audio are picked (the MP3s made before are left out)
 await p.tap('#addSong').catch(()=>{});await p.waitForTimeout(150);if(await p.$('#dsAnother'))await p.tap('#dsAnother');await p.waitForTimeout(100);
 await go('https://drive.google.com/drive/folders/folderD1234567?usp=sharing');await p.tap('#dsHide').catch(()=>{});
 {const it6=await p.evaluate(()=>window.__mxTest.idx().find(x=>x.drive&&x.drive.folder==='folderD1234567'));const job6=it6&&jobs[it6.id]?JSON.parse(jobs[it6.id].body):{};console.log('  folder job:',JSON.stringify({file:job6.file,video:job6.video,base:job6.base}));
  ok(job6.file==='audD'&&job6.video==='vidD'&&job6.base==='Band D - Song D','a folder link: the song’s audio and video in it are used (not the MP3s made before)');}
 // a live video's name: Guitaring isn't sure of the song, so it asks (and keeps what you say)
 ok(it1.song&&it1.song.t==='Leftovers'&&it1.song.a==='Amir Dadon'&&it1.song.by==='name','a clean "Artist - Song" name: the song and artist are taken without asking');
 await p.tap('#addSong').catch(()=>{});await p.waitForTimeout(150);if(await p.$('#dsAnother'))await p.tap('#dsAnother');await p.waitForTimeout(100);
 {const n0=Object.keys(jobs).length;m=await go('https://drive.google.com/file/d/vid5XyZ12345abcDEF/view');
  ok(/Which song is it\?/.test(m)&&await p.$eval('#dsT',e=>e.value)==='במקום בו אני גר'&&await p.$eval('#dsA',e=>e.value)==="ג'ימבו ג'יי"&&Object.keys(jobs).length===n0,'a live video’s name: it asks for the song and the artist first (filled with its guess), nothing sent yet');
  await p.fill('#dsA',"ג'ימבו ג'יי, אורית טשומה");await p.tap('#dsOk');await p.waitForTimeout(600);await p.tap('#dsHide').catch(()=>{});
  const it7=await p.evaluate(()=>window.__mxTest.idx().find(x=>x.drive&&x.drive.file==='vid5XyZ12345abcDEF'));
  ok(it7&&jobs[it7.id]&&it7.song&&it7.song.t==='במקום בו אני גר'&&it7.song.a==="ג'ימבו ג'יי, אורית טשומה"&&it7.song.by==='you','…then sends it, keeping the song and artist you gave '+JSON.stringify(it7&&it7.song));}
 done[it3.id]={'done.json':JSON.stringify({ok:true,format:'flac'}),...stems,'drive.json':JSON.stringify({ok:false,error:'401 Unauthorized',files:{}}),'full.mp3':Buffer.from('ID3full'),'guitars.mp3':Buffer.from('ID3gtr')};
 for(let k=0;k<3;k++){await p.evaluate(()=>window.__mxTest.poll());await p.waitForTimeout(400)}
  await p.tap('#bnav [data-sec=home]');await p.tap('#bnav [data-sec=learn]');await p.waitForTimeout(200);await p.tap('#learnList .lrow:has-text("Ya")');await p.waitForTimeout(300);
 ok(/The MP3s aren’t in Drive yet/.test(await p.$eval('#sesBox',e=>e.textContent)),'when GitHub couldn’t save them, the page says so');
 await p.tap('[data-dssave]');await p.waitForTimeout(600);
 ok(uploads.length===2&&uploads.every(u=>u.parents==='folderB'&&u.auth==='Bearer drivetok')&&uploads.map(u=>u.name).sort().join('|')==='Tuna - Ya (full).mp3|Tuna - Ya (guitars only).mp3','"Save them": the full and guitars-only MP3s go next to the song in its Drive folder '+JSON.stringify(uploads.map(u=>u.name)));
 ok(/Full song MP3 in Drive/.test(await p.$eval('#sesBox',e=>e.textContent)),'…and show on the song’s page');
 await p.screenshot({path:path.join(OUT,'ds.png'),fullPage:true});
 ok(!errs.length,'no page errors '+JSON.stringify(errs));
 console.log(fail?`${fail} FAILED`:'all passed');await b.close();srv.close();process.exit(fail?1:0)})();
