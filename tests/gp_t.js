// My gear: more photos per item (Overview strip, Controls strip), marks on any photo, Claude sees all photos (API mocked), amps too, old close-up moved over.
const {chromium,devices}=require('playwright');const path=require('path'),fs=require('fs'),http=require('http');const {execFileSync}=require('child_process');
const ROOT=path.resolve(__dirname,'..'),OUT=path.join(__dirname,'out');fs.mkdirSync(OUT,{recursive:true});
const srv=http.createServer((q,r)=>{const f=path.join(ROOT,decodeURIComponent(q.url.split('?')[0]).replace(/\/$/,'/index.html'));fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);return r.end()}r.writeHead(200,{'content-type':/\.html$/.test(f)?'text/html':'application/octet-stream'});r.end(d)})}).listen(0);
const APP=process.env.APP||`http://localhost:${srv.address().port}/index.html`;
const jpg=(c,n)=>{const f=path.join(OUT,`gp_${n}.jpg`);execFileSync('ffmpeg',['-y','-loglevel','error','-f','lavfi','-i',`color=c=${c}:s=480x360`,'-frames:v','1',f]);return {name:n+'.jpg',mimeType:'image/jpeg',buffer:fs.readFileSync(f)}};
const SIDE=jpg('orange','side'),BACK=jpg('purple','back'),AMP=jpg('gray','amp');
let fail=0;const ok=(c,m)=>{console.log((c?'ok  ':'FAIL')+' '+m);if(!c)fail++};
(async()=>{const b=await chromium.launch({...(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{})});
 const ctx=await b.newContext({...devices['Pixel 7'],colorScheme:'dark'});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 let nImages=0;
 await ctx.route(/^https:\/\//,async r=>{const u=r.request().url();
  if(/api\.anthropic\.com\/v1\/messages/.test(u)){const body=JSON.parse(r.request().postData()||'{}'),c=body.messages&&body.messages[0].content||[],txt=(c.find(x=>x.type==='text')||{}).text||'';let out='{}';
   if(/Find each of these controls/.test(txt)){nImages=c.filter(x=>x.type==='image').length;
    out=JSON.stringify({positions:[{n:1,photo:1,x:.27,y:.05},{n:2,photo:1,x:.7,y:.78},null,null,null,{n:6,photo:2,x:.5,y:.6}],extra:[{name:'Coil split (push-pull)',kind:'knob',what:'Pull the knob up to split the humbucker into a single coil.',tip:'Great for clean funk rhythm.',photo:3,x:.4,y:.4},{name:'Neck volume',kind:'knob',what:'dup',tip:'',photo:1,x:.1,y:.1}]})}
   return r.fulfill({contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify({content:[{type:'text',text:out}]})})}
  return r.abort()});
 await p.route(/ideas\.json/,r=>r.abort());
 await p.addInitScript(()=>{if(sessionStorage.x)return;sessionStorage.x=1;const c=document.createElement('canvas');c.width=400;c.height=300;const g=c.getContext('2d');g.fillStyle='#2a6fb0';g.fillRect(0,0,400,300);const photo=c.toDataURL('image/jpeg',.8);
  localStorage.setItem('tuner.userName','"Yoav"');
  localStorage.setItem('tuner.instruments',JSON.stringify([
   {id:'m1',type:'electric',name:'Muse',brand:'Epiphone',model:'Les Paul Muse',specs:{pickups:'humbucker',bridge:'fixed',body:'solid'},photo},
   {id:'a1',type:'elamp',name:'Katana',brand:'Boss',model:'Katana 50',specs:{ampkind:'modeling'}},
   {id:'o1',type:'electric',name:'Old one',brand:'Fender',model:'Strat',specs:{pickups:'single'},photo,ctlPhoto:photo,ctlPos:{'Output jack':[.5,.5]}}]))});
 const open=async id=>{await p.tap('[data-tab=tune]');await p.tap('[data-tab=gear]');if(await p.$('#iBack'))await p.tap('#iBack');await p.tap(`[data-open=${id}]`);await p.waitForTimeout(250)};
 await p.goto(APP);await p.waitForTimeout(400);if(await p.$('#wSkip:visible'))await p.tap('#wSkip');
 // Overview: strip with the main photo and "Add photos"; add two more
 await open('m1');
 ok((await p.$$('.gphead [data-ovp]')).length===1&&!!await p.$('.gphead .gpadd'),'Overview shows the photo strip with "Add photos"');
 await p.setInputFiles('.gphead [data-gpadd]',[SIDE,BACK]);await p.waitForTimeout(600);
 ok((await p.$$('.gphead [data-ovp]')).length===3,'two more photos added (3 in the strip)');
 const big=await p.$eval('.iphotobig',e=>e.src.length);await p.tap('.gphead [data-ovp]:nth-child(1)');ok(await p.$eval('.iphotobig',e=>e.src.length)!==big,'tapping a photo in the strip shows it big');
 // they live on the phone (IndexedDB) and come back after reopening the app
 await p.reload();await p.waitForTimeout(400);if(await p.$('#wSkip:visible'))await p.tap('#wSkip');await open('m1');await p.waitForTimeout(400);
 ok((await p.$$('.gphead [data-ovp] img')).length===3,'all three photos are back after reopening the app');
 const meta=await p.evaluate(()=>JSON.parse(localStorage.getItem('tuner.instruments'))[0].photos);ok(Array.isArray(meta)&&meta.length===2&&!JSON.stringify(meta).includes('data:'),'only small photo ids are kept in quick storage, the images go to the phone database');
 // Controls: strip, place a mark on photo 2, list says "photo 2", tapping it from photo 1 switches photos
 await p.tap('[data-gt=controls]');ok((await p.$$('[data-gph]')).length===3,'Controls has the same photos in a strip');ok(await p.$eval('.gphead',e=>e.hidden),'the photo above the tabs steps aside on Controls');
 await p.tap('[data-gph]:nth-child(2)');await p.tap('#ctlHand');await p.tap('.ctllist li[data-c="5"]');
 const bx=await p.$eval('#ctlPhoto',e=>{const r=e.getBoundingClientRect();return {w:r.width,h:r.height}});await p.tap('#ctlPhoto',{position:{x:bx.w*.6,y:bx.h*.5}});await p.tap('#ctlHand');
 ok(await p.$eval('.ctllist li[data-c="5"] .gpon',e=>e.textContent)==='photo 2','the output jack is marked on photo 2');
 await p.tap('[data-gph]:nth-child(1)');ok((await p.$$('#ctlPhoto .pb')).length===0,'photo 1 has no marks yet');
 await p.tap('.ctllist li[data-c="5"]');await p.waitForTimeout(150);
 ok(await p.$eval('[data-gph]:nth-child(2)',e=>e.getAttribute('aria-pressed'))==='true'&&(await p.$$('#ctlPhoto .pb.on')).length===1,'tapping the jack in the list jumps to photo 2 and highlights it');
 // Claude sees all photos and adds a control it found that wasn't listed (duplicates ignored)
 await p.evaluate(()=>localStorage.setItem('tuner.apiKey','"sk-test"'));await p.reload();await p.waitForTimeout(400);if(await p.$('#wSkip:visible'))await p.tap('#wSkip');await open('m1');await p.tap('[data-gt=controls]');await p.waitForTimeout(300);
 ok(/Find them on my photos/.test(await p.$eval('#ctlFind',e=>e.textContent))||/Find them again/.test(await p.$eval('#ctlFind',e=>e.textContent)),'"Find them on my photos" is offered');
 await p.tap('#ctlFind');await p.waitForSelector('#ctlMsg:has-text("Claude marked")',{timeout:5000}).catch(()=>{});const msg=await p.$eval('#ctlMsg',e=>e.textContent);console.log('msg:',msg);
 ok(nImages===3,`all three photos were sent (${nImages})`);
 const names=await p.$$eval('.ctllist li b',l=>l.map(x=>x.childNodes[0].textContent.trim()));
 ok(names.length===7&&names.includes('Coil split (push-pull)')&&names.filter(n=>n==='Neck volume').length===1,`the coil split joins the list, the duplicate doesn't (${names.length} controls)`);
 ok(/found 1 more: Coil split/.test(msg),'the message says what Claude found');
 const pos=await p.evaluate(()=>JSON.parse(localStorage.getItem('tuner.instruments'))[0].ctlPos);const ids=JSON.parse(await p.evaluate(()=>JSON.stringify(JSON.parse(localStorage.getItem('tuner.instruments'))[0].photos.map(x=>x.id))));
 ok(pos['3-way toggle'][2]==='main'&&pos['Output jack'][2]===ids[0]&&pos['Coil split (push-pull)'][2]===ids[1],'each mark is stored with the photo it is on');
 // remove photo 3: its marks go with it (two taps)
 await p.tap('[data-gph]:nth-child(3)');await p.tap('#gpDel');await p.tap('#gpDel');await p.waitForTimeout(300);
 ok((await p.$$('[data-gph]')).length===2,'photo removed');
 const pos2=await p.evaluate(()=>JSON.parse(localStorage.getItem('tuner.instruments'))[0].ctlPos);ok(!pos2['Coil split (push-pull)'],'its marks are removed too');
 // an amp without a main photo: drawing + "Add photos", then its photo view
 await open('a1');await p.tap('[data-gt=controls]');ok(!!await p.$('.ctlpic svg')&&!!await p.$('.ctlbox [data-gpadd]'),'an amp with no photo shows the drawing and "Add photos"');
 await p.setInputFiles('.ctlbox [data-gpadd]',[AMP]);await p.waitForTimeout(500);ok(!!await p.$('#ctlPhoto img'),'after adding a photo the amp\'s controls show on it');
 // a close-up added before this change (ctlPhoto) becomes one of the photos, with its mark
 await open('o1');await p.waitForTimeout(400);const o1=await p.evaluate(()=>JSON.parse(localStorage.getItem('tuner.instruments')).find(x=>x.id==='o1'));
 ok(!o1.ctlPhoto&&o1.photos&&o1.photos.length===1&&o1.ctlPos['Output jack'][2]===o1.photos[0].id,'the older close-up moved into the photos, its mark kept');
 await p.screenshot({path:path.join(OUT,'gp.png')});
 ok(!errs.length,'no page errors '+JSON.stringify(errs));
 console.log(fail?`${fail} FAILED`:'all passed');await b.close();srv.close();process.exit(fail?1:0)})();
