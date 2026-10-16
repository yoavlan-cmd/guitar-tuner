// My gear › Controls on the player's own photo: place marks by hand, Claude finds them (API mocked), drawing toggle, persistence.
const {chromium,devices}=require('playwright');const path=require('path'),fs=require('fs'),http=require('http');
const ROOT=path.resolve(__dirname,'..');
const srv=http.createServer((q,r)=>{const f=path.join(ROOT,decodeURIComponent(q.url.split('?')[0]).replace(/\/$/,'/index.html'));fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);return r.end()}r.writeHead(200,{'content-type':/\.html$/.test(f)?'text/html':'application/octet-stream'});r.end(d)})}).listen(0);
const APP=process.env.APP||`http://localhost:${srv.address().port}/index.html`;
const PHOTO=process.env.PHOTO&&fs.existsSync(process.env.PHOTO)?'data:image/jpeg;base64,'+fs.readFileSync(process.env.PHOTO).toString('base64'):null;// optional real photo for screenshots
let fail=0;const ok=(c,m)=>{console.log((c?'ok  ':'FAIL')+' '+m);if(!c)fail++};
(async()=>{const b=await chromium.launch({...(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{})});
 const ctx=await b.newContext({...devices['Pixel 7'],colorScheme:'dark'});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 // Claude (phone key): answer the "find the controls" question with fixed positions, everything else with an empty object
 let sawImage=false;
 await ctx.route(/^https:\/\//,async r=>{const u=r.request().url();
  if(/api\.anthropic\.com\/v1\/messages/.test(u)){const body=JSON.parse(r.request().postData()||'{}'),c=body.messages&&body.messages[0].content||[],txt=(c.find(x=>x.type==='text')||{}).text||'';
   let out='{}';if(/Find each of these controls/.test(txt)){sawImage=c.some(x=>x.type==='image');out=JSON.stringify({positions:[{n:1,x:.275,y:.045},{n:2,x:.71,y:.78},{n:3,x:.71,y:.95},{n:4,x:.84,y:.69},{n:5,x:.83,y:.88},null]})}
   return r.fulfill({contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify({content:[{type:'text',text:out}]})})}
  return r.abort()});
 await p.route(/ideas\.json/,r=>r.abort());
 await p.addInitScript(photo=>{if(sessionStorage.x)return;sessionStorage.x=1;
  if(!photo){const c=document.createElement('canvas');c.width=400;c.height=372;const g=c.getContext('2d');g.fillStyle='#2a6fb0';g.fillRect(0,0,400,372);g.fillStyle='#ddd';[[110,17],[284,290],[284,353],[336,257],[332,327]].forEach(([x,y])=>{g.beginPath();g.arc(x,y,14,0,7);g.fill()});photo=c.toDataURL('image/jpeg',.8)}
  localStorage.setItem('tuner.userName','"Yoav"');
  localStorage.setItem('tuner.instruments',JSON.stringify([{id:'m1',type:'electric',name:'Muse',brand:'Epiphone',model:'Les Paul Muse',year:'2020',specs:{pickups:'humbucker',bridge:'fixed',body:'solid'},photo,strings:'2026-05-01'}]))},PHOTO);
 await p.goto(APP);await p.waitForTimeout(400);await p.waitForSelector('#wSkip',{state:'visible',timeout:2000}).then(()=>p.tap('#wSkip')).catch(()=>{});
 await p.tap('[data-tab=gear]');await p.tap('[data-open=m1]');await p.tap('[data-gt=controls]');await p.waitForTimeout(200);
 ok(await p.$('#ctlPhoto img')!==null,'Controls opens on your own photo');
 ok(await p.$eval('[data-cv=photo]',b=>b.getAttribute('aria-pressed')==='true'),'"Your photo" is selected');
 const items=await p.$$eval('.ctllist li',l=>l.map(x=>x.querySelector('b').textContent));console.log('controls:',items.join(' | '));
 ok((await p.$$('.ctllist li.unplaced')).length===items.length,'every control says it is not on the photo yet');
 // place by hand: first number, then tap the photo
 await p.tap('#ctlHand');ok(await p.$eval('#ctlPhoto',e=>e.classList.contains('placing')),'"Place them myself" turns on placing');
 const box=await p.$eval('#ctlPhoto',e=>{const r=e.getBoundingClientRect();return {x:r.left,y:r.top,w:r.width,h:r.height}});
 await p.tap('#ctlPhoto',{position:{x:box.w*.3,y:box.h*.4}});await p.waitForTimeout(100);
 const pos1=await p.evaluate(()=>JSON.parse(localStorage.getItem('tuner.instruments'))[0].ctlPos);console.log('after 1 tap:',JSON.stringify(pos1));
 const k1=items[0];ok(pos1&&pos1[k1]&&Math.abs(pos1[k1][0]-.3)<.02&&Math.abs(pos1[k1][1]-.4)<.02,`mark 1 (${k1}) saved where tapped`);
 ok(await p.$eval('.ctllist li.sel',l=>+l.dataset.c)===1,'placing moves on to the next control');
 await p.tap('.ctllist li[data-c="3"]');await p.tap('#ctlPhoto',{position:{x:box.w*.8,y:box.h*.7}});
 ok((await p.$$('#ctlPhoto .pb')).length===2,'two marks on the photo');
 // move mark 1 by selecting it and tapping elsewhere
 await p.tap('.ctllist li[data-c="0"]');await p.tap('#ctlPhoto',{position:{x:box.w*.5,y:box.h*.2}});
 const pos2=await p.evaluate(()=>JSON.parse(localStorage.getItem('tuner.instruments'))[0].ctlPos);ok(Math.abs(pos2[k1][0]-.5)<.02&&Math.abs(pos2[k1][1]-.2)<.02,'tapping a new spot moves a mark');
 await p.tap('.ctllist li[data-c="3"]');await p.tap('#ctlUnmark');ok((await p.$$('#ctlPhoto .pb')).length===1,'"Remove mark" takes one off');
 await p.tap('#ctlHand');ok(!(await p.$eval('#ctlPhoto',e=>e.classList.contains('placing'))),'"Done" ends placing');
 // tapping a mark highlights its explanation
 await p.tap('#ctlPhoto .pb');ok(await p.$eval('.ctllist li[data-c="0"]',l=>l.classList.contains('on')),'tapping a mark highlights its explanation');
 // drawing toggle
 await p.tap('[data-cv=draw]');ok(await p.$('.ctlpic svg')!==null&&await p.$('#ctlPhoto')===null,'"Drawing" shows the drawn guitar');
 await p.tap('[data-cv=photo]');
 // persistence across reload
 await p.reload();await p.waitForTimeout(400);await p.waitForSelector('#wSkip',{state:'visible',timeout:2000}).then(()=>p.tap('#wSkip')).catch(()=>{});await p.tap('[data-tab=gear]');await p.tap('[data-open=m1]');await p.tap('[data-gt=controls]');
 ok((await p.$$('#ctlPhoto .pb')).length===1,'marks are still there after reopening the app');
 // Claude finds them (phone key, API mocked)
 await p.evaluate(()=>localStorage.setItem('tuner.apiKey','"sk-test"'));await p.reload();await p.waitForTimeout(400);await p.waitForSelector('#wSkip',{state:'visible',timeout:2000}).then(()=>p.tap('#wSkip')).catch(()=>{});
 await p.tap('[data-tab=gear]');await p.tap('[data-open=m1]');await p.tap('[data-gt=controls]');
 ok(await p.$('#ctlFind')!==null,'with Claude on, "Find them on my photo" is offered');
 await p.tap('#ctlFind');await p.waitForSelector('#ctlMsg:has-text("Claude marked")',{timeout:5000}).catch(()=>{});
 const msg=await p.$eval('#ctlMsg',e=>e.textContent);console.log('msg:',msg);
 ok(sawImage,'the photo was sent with the question');
 ok((await p.$$('#ctlPhoto .pb')).length===5&&/marked 5 of 6/.test(msg),'Claude marks the five it can see and leaves the one out of frame');
 ok((await p.$$('.ctllist li.unplaced')).length===1,'the unmarked one says it is not on the photo');
 await p.screenshot({path:path.join(__dirname,'out','ctl_photo.png'),fullPage:false});
 ok(!errs.length,'no page errors '+JSON.stringify(errs));
 console.log(fail?`${fail} FAILED`:'all passed');await b.close();srv.close();process.exit(fail?1:0)})();
