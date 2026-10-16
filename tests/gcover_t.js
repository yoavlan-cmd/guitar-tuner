// My gear: the preview picture. With no photo, the list shows the guitar / amp picture; once photos are added the first one is the
// preview; the player can pick any photo as the preview (Overview › "Use this photo as the preview in My gear"); the list shows it,
// also after a reload (photos kept in the phone database); editing the details keeps the photos and the choice; removing the
// chosen photo falls back to the next one.
const {chromium,devices}=require('playwright');const path=require('path'),fs=require('fs'),http=require('http');const {execFileSync}=require('child_process');
const ROOT=path.resolve(__dirname,'..'),OUT=path.join(__dirname,'out');fs.mkdirSync(OUT,{recursive:true});
const srv=http.createServer((q,r)=>{const f=path.join(ROOT,decodeURIComponent(q.url.split('?')[0]).replace(/\/$/,'/index.html'));fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);return r.end()}r.writeHead(200,{'content-type':/\.html$/.test(f)?'text/html':'application/octet-stream'});r.end(d)})}).listen(0);
const APP=process.env.APP||`http://localhost:${srv.address().port}/index.html`;
const jpg=(c,n)=>{const f=path.join(OUT,`gc_${n}.jpg`);execFileSync('ffmpeg',['-y','-loglevel','error','-f','lavfi','-i',`color=c=${c}:s=480x360`,'-frames:v','1',f]);return {name:n+'.jpg',mimeType:'image/jpeg',buffer:fs.readFileSync(f)}};
const FRONT=jpg('red','front'),BACK=jpg('blue','back');
let fail=0;const ok=(c,m)=>{console.log((c?'ok  ':'FAIL')+' '+m);if(!c)fail++};
(async()=>{const b=await chromium.launch({...(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{})});
 const ctx=await b.newContext({...devices['Pixel 7']});await ctx.route(/^https:\/\//,r=>r.abort());await ctx.route(/ideas\.json/,r=>r.abort());
 const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.addInitScript(()=>{if(sessionStorage.x)return;sessionStorage.x=1;localStorage.setItem('tuner.userName','"Yoav"');localStorage.setItem('tuner.profile',JSON.stringify({name:'Yoav',onboarding:{done:true}}));
  localStorage.setItem('tuner.instruments',JSON.stringify([{id:'a1',type:'elamp',name:'Black Cube',brand:'Roland',model:'CUBE-10GX',specs:{ampkind:'modeling'}}]))});
 await p.goto(APP);await p.waitForTimeout(400);
 const list=async()=>{await p.tap('#bnav [data-sec=home]');await p.tap('#bnav [data-sec=gear]');if(await p.$('#iBack'))await p.tap('#iBack');await p.waitForTimeout(300)};
 // the colour of the list picture (red front, blue back)
 const thumb=()=>p.evaluate(()=>new Promise(res=>{const im=document.querySelector('[data-open=a1] img.ithumb');if(!im)return res('none');if(!im.offsetWidth)return res('hidden');const go=()=>{const c=document.createElement('canvas');c.width=c.height=4;const g=c.getContext('2d');g.drawImage(im,0,0,4,4);const d=g.getImageData(1,1,1,1).data;res(d[0]>d[2]?'red':'blue')};im.complete?go():im.onload=go}));
 await list();ok(await thumb()==='none'&&!!await p.$('[data-open=a1] .ithumb.none .pd'),'no photo: the list shows the amp picture');
 await p.tap('[data-open=a1]');await p.waitForTimeout(250);
 await p.setInputFiles('.gphead [data-gpadd]',[FRONT,BACK]);await p.waitForTimeout(900);
 await list();ok(await thumb()==='red','with photos, the first one is the preview');
 // pick the second photo as the preview
 await p.tap('[data-open=a1]');await p.waitForTimeout(250);
 ok(/Preview/.test(await p.$eval('.gphead .gpstrip',e=>e.textContent)),'the strip marks which photo is the preview');
 await p.tap('.gphead [data-ovp]:nth-child(2)');await p.waitForTimeout(200);
 ok(/Use this photo as the preview/.test(await p.$eval('#gpCover',e=>e.textContent)),'another photo offers "Use this photo as the preview in My gear"');
 await p.tap('#gpCover');await p.waitForTimeout(200);
 ok(/This photo is the preview/.test(await p.$eval('.gphead',e=>e.textContent)),'…and then says it is the preview');
 await list();ok(await thumb()==='blue','My gear shows the chosen photo');
 await p.reload();await p.waitForTimeout(600);await list();await p.waitForTimeout(300);ok(await thumb()==='blue','…also after reopening the app');
 // editing the details keeps the photos and the choice
 await p.tap('[data-open=a1]');await p.waitForTimeout(250);await p.tap('#iEdit');await p.waitForTimeout(200);await p.fill('#iName','Black Cube amp').catch(()=>{});await p.tap('#iSave');await p.waitForTimeout(400);
 const it=await p.evaluate(()=>JSON.parse(localStorage.getItem('tuner.instruments'))[0]);
 ok(it.photos&&it.photos.length===2&&it.cover===it.photos[1].id,'editing the details keeps the photos and the preview choice '+JSON.stringify({n:it.photos&&it.photos.length,cover:it.cover}));
 // removing the chosen photo: back to the first
 await list();await p.tap('[data-open=a1]');await p.waitForTimeout(250);
 await p.evaluate(id=>document.querySelector(`.ctlbox [data-gph="${id}"]`).click(),it.cover);await p.waitForTimeout(200);await p.evaluate(()=>document.getElementById('gpDel').click());await p.waitForTimeout(100);await p.evaluate(()=>document.getElementById('gpDel').click());await p.waitForTimeout(400);
 const it2=await p.evaluate(()=>JSON.parse(localStorage.getItem('tuner.instruments'))[0]);
 await list();ok(!it2.cover&&it2.photos.length===1&&await thumb()==='red','removing the chosen photo falls back to the other one');
 await p.screenshot({path:path.join(OUT,'gcover.png')});
 ok(!errs.length,'no page errors '+JSON.stringify(errs));
 console.log(fail?`${fail} FAILED`:'all passed');await b.close();srv.close();process.exit(fail?1:0)})();
