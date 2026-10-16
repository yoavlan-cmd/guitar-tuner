// Backup straight to Google Drive (Google sign-in and Drive mocked): one tap → a "Guitaring backups" folder, the file goes up in
// 8 MB pieces and survives a failed piece, it's a valid ZIP, older backups beyond 5 are trashed, a green message and a phone
// notification confirm it; a refused upload says so (red + notification); saving sheets is unchanged (still the share menu).
const {chromium}=require('playwright');const path=require('path'),fs=require('fs'),http=require('http');const {execFileSync}=require('child_process');
const ROOT=path.resolve(__dirname,'..'),OUT=path.join(__dirname,'out');fs.mkdirSync(OUT,{recursive:true});
const srv=http.createServer((q,r)=>{const f=path.join(ROOT,decodeURIComponent(q.url.split('?')[0]).replace(/\/$/,'/index.html'));fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);return r.end()}r.writeHead(200,{'content-type':/\.html$/.test(f)?'text/html':/\.js$/.test(f)?'text/javascript':'application/octet-stream'});r.end(d)})}).listen(0);
const APP=process.env.APP||`http://localhost:${srv.address().port}/index.html`;
let fail=0;const ok=(c,m)=>{console.log((c?'ok  ':'FAIL')+' '+m);if(!c)fail++};
(async()=>{const b=await chromium.launch({...(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{})});
 const ctx=await b.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
 // ---- fake Google ----
 const H={'access-control-allow-origin':'*','access-control-expose-headers':'Location, Range','content-type':'application/json'};
 let mode='ok',got=[],puts=0,failedOnce=false,trashed=[],folders=0,initHeaders=null,size=0;
 await ctx.route('https://accounts.google.com/gsi/client',r=>r.fulfill({contentType:'text/javascript',headers:{'access-control-allow-origin':'*'},body:`window.google={accounts:{oauth2:{initTokenClient:c=>({requestAccessToken(){window.__gis=(window.__gis||0)+1;if(window.__gisHang&&window.__gis===1)return;setTimeout(()=>{window.__tokDone=1;c.callback({access_token:'tok',expires_in:3600})},20)}})}}};`}));
 await ctx.route(/^https:\/\/www\.googleapis\.com\//,async r=>{const q=r.request(),u=q.url(),m=q.method();
  if(m==='OPTIONS')return r.fulfill({status:204,headers:{...H,'access-control-allow-methods':'GET,POST,PUT,PATCH','access-control-allow-headers':'*'}});
  if(/upload\/drive\/v3\/files\?uploadType=resumable/.test(u)){if(mode==='refuse')return r.fulfill({status:403,headers:H,body:JSON.stringify({error:{message:'The user’s Drive storage quota has been exceeded.'}})});
   initHeaders=q.headers();size=+initHeaders['x-upload-content-length'];got=[];return r.fulfill({status:200,headers:{...H,Location:'https://www.googleapis.com/upload/drive/v3/files?upload_id=U1'},body:''})}
  if(/upload_id=U1/.test(u)){const cr=q.headers()['content-range'];
   if(/^bytes \*\//.test(cr)){const have=got.reduce((a,x)=>a+x.length,0);return r.fulfill({status:308,headers:{...H,Range:`bytes=0-${have-1}`},body:''})}
   puts++;if(puts===2&&!failedOnce){failedOnce=true;return r.fulfill({status:503,headers:H,body:'{}'})}// one piece fails
   const buf=q.postDataBuffer();got.push(buf);const have=got.reduce((a,x)=>a+x.length,0);
   if(have>=size)return r.fulfill({status:200,headers:H,body:JSON.stringify({id:'f1',webViewLink:'https://drive.google.com/file/d/f1/view'})});
   return r.fulfill({status:308,headers:{...H,Range:`bytes=0-${have-1}`},body:''})}
  if(/drive\/v3\/files\?q=/.test(u)&&m==='GET'){const qq=decodeURIComponent(u);
   if(/name='Guitaring backups'/.test(qq))return r.fulfill({status:200,headers:H,body:JSON.stringify({files:[]})});
   if(/'dir1' in parents/.test(qq))return r.fulfill({status:200,headers:H,body:JSON.stringify({files:Array.from({length:7},(_,i)=>({id:'old'+i,name:'guitaring-backup-'+i+'.zip'}))})});
   return r.fulfill({status:200,headers:H,body:JSON.stringify({files:[]})})}
  if(/drive\/v3\/files\?fields=id$/.test(u)&&m==='POST'){folders++;return r.fulfill({status:200,headers:H,body:JSON.stringify({id:'dir1'})})}
  if(/drive\/v3\/files\/dir1\?/.test(u))return r.fulfill({status:200,headers:H,body:JSON.stringify({id:'dir1',trashed:false})});
  if(/drive\/v3\/files\/old\d/.test(u)&&m==='PATCH'){trashed.push(u.match(/old\d/)[0]);return r.fulfill({status:200,headers:H,body:'{}'})}
  return r.fulfill({status:404,headers:H,body:'{}'})});
 await ctx.route(/^https:\/\/(?!www\.googleapis\.com|accounts\.google\.com)/,r=>r.abort());
 const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.addInitScript(()=>{window.__GD_CLIENT='test.apps.googleusercontent.com';window.__gdWaitScale=0.001;window.__notes=[];
  window.__perm='default';window.__gisHang=true;window.__asked=[];window.Notification=class{static get permission(){return window.__perm}static requestPermission(){window.__asked.push(window.__tokDone?'after':'before');window.__perm='granted';return Promise.resolve('granted')}constructor(t){window.__notes.push(t)}};
  if(window.ServiceWorkerRegistration)ServiceWorkerRegistration.prototype.showNotification=function(t){window.__notes.push(t);return Promise.resolve()};
  if(sessionStorage.x)return;sessionStorage.x=1;localStorage.setItem('tuner.profile',JSON.stringify({name:'Yoav',onboarding:{done:true}}));localStorage.setItem('tuner.userName','"Yoav"')});
 await p.goto(APP);await p.waitForTimeout(400);
 // a phone with ~12 MB of Band breakdown parts (2 upload pieces)
 await p.evaluate(async()=>{const n=1500000,mk=v=>{const a=new Int16Array(n*2);for(let i=0;i<a.length;i+=97)a[i]=v;return a};await window.__bk.put('mixIndex',[{id:'s1',name:'Song',at:1,src:'phone',state:'ready'}]);await window.__bk.put('mixdata:s1',{len:n,sr:44100,tracks:[{id:'drums',name:'Drums',data:mk(9)},{id:'bass',name:'Bass',data:mk(7)}]})});
 await p.tap('#hMe');await p.evaluate(()=>{document.getElementById('bkBox').open=true});
 ok(!!await p.$('#bkDrive')&&/Back up to Google Drive/.test(await p.$eval('#bkDrive',e=>e.textContent)),'with Drive set up, the box offers "Back up to Google Drive" first');
 // first tap: the Google window never comes up (Google never answers) → after a few seconds it says so and a new tap works
 await p.tap('#bkDrive');await p.waitForTimeout(5600);
 ok(/If no Google window opened, tap/.test(await p.$eval('#bkOut',e=>e.textContent))&&!(await p.$eval('#bkDrive',e=>e.disabled)),'a Google window that never comes up: it says so and the button works again');
 ok((await p.evaluate(()=>window.__asked)).length===0,'nothing else is asked in the same tap as the Google window (no notification prompt)');
 await p.tap('#bkDrive');await p.waitForFunction(()=>/Saved to Google Drive|Couldn’t/.test(document.getElementById('bkOut').textContent),null,{timeout:30000}).catch(()=>{});
 const said=await p.$eval('#bkOut',e=>e.textContent);console.log('  '+said.replace(/\s+/g,' '));
 ok(/Saved to Google Drive/.test(said)&&/Guitaring backups/.test(said),'one tap: it says it was saved in Google Drive › Guitaring backups');
 ok(folders===1,'the Guitaring backups folder was made once');
 ok(initHeaders&&initHeaders['x-upload-content-type']==='application/zip'&&size>8*1024*1024,`it uploads as a zip (${size} bytes, more than one piece)`);
 ok(failedOnce&&got.length>=2,`a failed piece is asked about and resent (${puts} pieces sent, one failed)`);
 const up=Buffer.concat(got),F=path.join(OUT,'bkdrive.zip');fs.writeFileSync(F,up);
 let z='';try{z=execFileSync('python3',['-I','-c','import zipfile,sys,json;z=zipfile.ZipFile(sys.argv[1]);print(z.testzip());print(json.loads(z.read("manifest.json"))["counts"]["songs"])',F]).toString()}catch(e){z=String(e)}
 ok(up.length===size&&/^None\n1/.test(z),'what arrived in Drive is the whole backup and a valid ZIP with the Band breakdown song');
 ok(trashed.length===2,`older backups beyond the newest 5 are trashed (${trashed.length})`);
 ok(await p.$eval('#toast',e=>!e.hidden&&e.classList.contains('ok')),'a green message confirms it');
 ok(JSON.stringify(await p.evaluate(()=>window.__asked))==='["after"]','notifications are asked for once, after Google said yes');
 const notes=await p.evaluate(()=>window.__notes);ok(notes.includes('Guitaring backup saved'),'and a phone notification ('+notes.join(', ')+')');
 ok(await p.evaluate(()=>JSON.parse(localStorage.getItem('tuner.lastBackup')).drive===true)&&/in Google Drive/.test(await p.$eval('#bkLast',e=>e.textContent)),'the box shows the last backup went to Google Drive');
 // Drive refuses (full): red, with Google's reason, and a notification
 mode='refuse';await p.evaluate(()=>{window.__notes=[]});await p.tap('#bkDrive');await p.waitForFunction(()=>/storage quota/.test(document.getElementById('bkOut').textContent),null,{timeout:20000}).catch(()=>{});
 ok(/storage quota/.test(await p.$eval('#bkOut',e=>e.textContent))&&await p.$eval('#toast',e=>e.classList.contains('err')),'a refused upload says why, in red');
 ok((await p.evaluate(()=>window.__notes)).includes('Guitaring backup didn’t finish'),'…with a notification');
 // saving sheets is unchanged: no "save sheets to your Drive" sign-in card, the share menu stays
 await p.tap('#bnav [data-sec=write]');ok(!(await p.$eval('#driveIntro',e=>!e.hidden&&/Connect Google Drive/.test(e.textContent))),'saving sheets is unchanged (no Drive sign-in card in Write)');
 ok(!errs.length,'no page errors '+JSON.stringify(errs));
 console.log(fail?`${fail} FAILED`:'all passed');await b.close();srv.close();process.exit(fail?1:0)})();
