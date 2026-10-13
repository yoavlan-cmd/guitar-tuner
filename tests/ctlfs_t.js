// My gear › Controls: crowded marks get readable numbers (no two numbers on top of each other in full screen), the full-screen
// viewer zooms (double tap, stepping to a control), steps across photos, places marks, and hands back the same photo and control.
const {chromium,devices}=require('playwright');const path=require('path'),fs=require('fs'),http=require('http');
const ROOT=path.resolve(__dirname,'..'),OUT=path.join(__dirname,'out');fs.mkdirSync(OUT,{recursive:true});
const srv=http.createServer((q,r)=>{const f=path.join(ROOT,decodeURIComponent(q.url.split('?')[0]).replace(/\/$/,'/index.html'));fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);return r.end()}r.writeHead(200,{'content-type':/\.html$/.test(f)?'text/html':'application/octet-stream'});r.end(d)})}).listen(0);
const APP=process.env.APP||`http://localhost:${srv.address().port}/index.html`;
const W=+(process.env.W||390);
let fail=0;const ok=(c,m)=>{console.log((c?'ok  ':'FAIL')+' '+m);if(!c)fail++};
(async()=>{const b=await chromium.launch({...(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{})});
 const ctx=await b.newContext({...devices['Pixel 7'],viewport:{width:W,height:800},colorScheme:'dark'});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await ctx.route(/^https:\/\//,r=>r.abort());await p.route(/ideas\.json/,r=>r.abort());
 // an amp like the user's: a long, narrow control panel with 17 knobs (number 2 not marked yet) and buttons close together, and 5 more on a second photo
 await p.addInitScript(()=>{if(sessionStorage.x)return;sessionStorage.x=1;
  const mk=(w,h,col)=>{const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d');g.fillStyle=col;g.fillRect(0,0,w,h);return c.toDataURL('image/jpeg',.8)};
  const photo=mk(1200,400,'#333'),back=mk(800,600,'#553');
  const controls=Array.from({length:23},(_,i)=>({name:'Control '+(i+1),kind:'knob',what:'What control '+(i+1)+' does.',tip:'Tip '+(i+1)}));
  const ctlPos={};for(let i=0;i<18;i++)if(i!==1)ctlPos['Control '+(i+1)]=[+(.06+i*.05).toFixed(3),i%2?.32:.27,'main'];
  for(let i=18;i<23;i++)ctlPos['Control '+(i+1)]=[.2+(i-18)*.12,.5,'gback'];
  localStorage.setItem('tuner.userName','"Yoav"');
  localStorage.setItem('tuner.instruments',JSON.stringify([{id:'a1',type:'elamp',name:'Catalyst',brand:'Boss',model:'Catalyst 100',specs:{ampkind:'modeling'},photo,photos:[{id:'gback',at:1}],controls,ctlPos}]));
  window.__back=back});
 await p.goto(APP);await p.waitForTimeout(400);if(await p.$('#wSkip:visible'))await p.tap('#wSkip');
 await p.evaluate(async()=>{await window.__mxTest.put('gearphoto:gback',window.__back)});
 await p.tap('[data-tab=gear]');await p.tap('[data-open=a1]');await p.waitForTimeout(400);await p.tap('[data-gt=controls]');await p.waitForTimeout(400);
 // where each number sits: the ring centre + its offset
 const labels=sel=>p.$$eval(sel,l=>l.filter(e=>!e.classList.contains('nolab')).map(e=>{const r=e.getBoundingClientRect(),cs=getComputedStyle(e),w=e.dataset.n.length>1?26:20;
  const x=r.left+r.width/2+parseFloat(cs.getPropertyValue('--lx')),y=r.top+r.height/2+parseFloat(cs.getPropertyValue('--ly'));return {n:+e.dataset.n,b:[x-w/2,y-10,x+w/2,y+10],r:r.width/2}}));
 const clashes=L=>{let k=0;for(let i=0;i<L.length;i++)for(let j=i+1;j<L.length;j++){const a=L[i].b,c=L[j].b;if(a[0]<c[2]-1&&c[0]<a[2]-1&&a[1]<c[3]-1&&c[1]<a[3]-1)k++}return k};
 const inl=await labels('#ctlPhoto .pb');
 ok(inl.length===17,`17 marks on the first photo (${inl.length})`);
 ok(inl.filter(x=>x.r<12).length>=15,`crowded rings are drawn smaller (${inl.filter(x=>x.r<12).length} of ${inl.length} under full size)`);
 console.log('  numbers on top of each other on the page:',clashes(inl));
 // open full screen with the button
 await p.tap('#ctlFull');await p.waitForTimeout(300);
 ok(!!await p.$('.ctlfs')&&/photo 1 of 2/.test(await p.$eval('#cfTitle',e=>e.textContent)),'"Full screen" opens the photo full screen');
 let L=await labels('.cfmarks .pb');const hid0=+await p.$eval('.ctlfs',e=>e.dataset.hidden);
 ok(clashes(L)===0,`full screen: no number covers another (${L.length} shown, ${hid0} waiting for a zoom)`);
 // tap a number: what it is
 const m5=await p.$eval('.cfmarks .pb[data-n="5"]',e=>{const r=e.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}});await p.touchscreen.tap(m5.x,m5.y);await p.waitForTimeout(150);
 ok(/Control 5/.test(await p.$eval('.cfinfo',e=>e.textContent))&&/What control 5 does/.test(await p.$eval('.cfinfo',e=>e.textContent)),'tapping number 5 says what it is');
 ok(await p.$eval('.cfmarks',e=>e.classList.contains('focus'))&&await p.$eval('.cfmarks .pb[data-n="5"]',e=>e.classList.contains('on')),'it stands out, the others fade');
 // › steps to 6 and zooms in on it; every number is shown at that zoom, still without overlaps
 await p.tap('.cfnext');await p.waitForTimeout(500);let st=await p.evaluate(()=>window.__ctlFs.state());
 ok(st.sel===5&&st.z>=2.4,`› goes to number 6 and zooms in (zoom ${st.z.toFixed(2)})`);
 L=await labels('.cfmarks .pb');ok(clashes(L)===0,`zoomed in: no overlaps (${L.length} numbers in view)`);
 const m6=await p.$eval('.cfmarks .pb[data-n="6"]',e=>{const r=e.getBoundingClientRect(),s=document.querySelector('.cfstage').getBoundingClientRect();return Math.abs(r.left+r.width/2-(s.left+s.width/2))<4});
 ok(m6,'number 6 is in the middle of the screen (side to side; a wide photo stays centred top to bottom)');
 // stepping past 18 moves to the second photo
 for(let i=0;i<13;i++)await p.tap('.cfnext');await p.waitForTimeout(600);st=await p.evaluate(()=>window.__ctlFs.state());
 ok(st.sel===18&&st.pid==='gback'&&/photo 2 of 2/.test(await p.$eval('#cfTitle',e=>e.textContent)),`› from 18 to 19 moves to photo 2 (${st.sel+1}, ${st.pid})`);
 // double tap zooms out and in again
 await p.tap('.shotprev');await p.waitForTimeout(300);st=await p.evaluate(()=>window.__ctlFs.state());ok(st.pid==='main'&&st.z===1,'photo ‹ goes back to photo 1, whole photo in view');
 const sb=await p.$eval('.cfstage',e=>{const r=e.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height*.8}});
 await p.touchscreen.tap(sb.x,sb.y);await p.waitForTimeout(80);await p.touchscreen.tap(sb.x,sb.y);await p.waitForTimeout(400);
 st=await p.evaluate(()=>window.__ctlFs.state());ok(st.z>2,`double tap zooms in (${st.z.toFixed(2)})`);
 await p.touchscreen.tap(sb.x,sb.y);await p.waitForTimeout(80);await p.touchscreen.tap(sb.x,sb.y);await p.waitForTimeout(400);
 st=await p.evaluate(()=>window.__ctlFs.state());ok(st.z===1,'double tap again zooms back out');
 await p.screenshot({path:path.join(OUT,`ctlfs_${W}.png`)});
 // close: back on the page, same photo, number 19's explanation picked
 await p.tap('.cfnext');await p.waitForTimeout(300);
 const pick=await p.evaluate(()=>window.__ctlFs.state().sel);
 await p.tap('.ctlfs .shotx');await p.waitForTimeout(300);
 ok(!await p.$('.ctlfs')&&await p.$eval(`.ctllist li[data-c="${pick}"]`,e=>e.classList.contains('on')),`✕ closes it and the same control is picked on the page (${pick+1})`);
 // placing in full screen: zoom in, tap the spot
 await p.tap('#ctlHand');await p.tap('.ctllist li[data-c="0"]');await p.tap('#ctlFull');await p.waitForTimeout(300);
 ok(/Control 1/.test(await p.$eval('.cfinfo',e=>e.textContent))&&await p.$eval('.cfdone',e=>!e.hidden),'placing carries over to full screen');
 st=await p.evaluate(()=>window.__ctlFs.state());const s2=await p.$eval('.cfstage',e=>{const r=e.getBoundingClientRect();return {x:r.left,y:r.top}});
 const fx=.5,fy=.75,ph=await p.evaluate(()=>window.__ctlFs.state().pid);
 await p.touchscreen.tap(s2.x+st.ox+st.tx+fx*st.bw*st.z,s2.y+st.oy+st.ty+fy*st.bh*st.z);await p.waitForTimeout(300);
 const pos=await p.evaluate(()=>JSON.parse(localStorage.getItem('tuner.instruments'))[0].ctlPos['Control 1']);
 ok(pos&&Math.abs(pos[0]-fx)<.02&&Math.abs(pos[1]-fy)<.02&&pos[2]===ph,`the mark lands where tapped (${JSON.stringify(pos)})`);
 ok(/Control 2/.test(await p.$eval('.cfinfo',e=>e.textContent)),'and it moves on to the next control without a mark (2)');
 await p.tap('.cfdone');ok(await p.$eval('.cfdone',e=>e.hidden)&&!await p.evaluate(()=>!!document.querySelector('#ctlPhoto.placing')),'Done ends placing');
 await p.tap('.ctlfs .shotx');await p.waitForTimeout(200);
 // tapping the photo itself opens full screen; the phone's back button closes it
 const pb=await p.$eval('#ctlPhoto',e=>{const r=e.getBoundingClientRect();return {x:r.left+r.width*.5,y:r.top+r.height*.9}});await p.touchscreen.tap(pb.x,pb.y);await p.waitForTimeout(300);
 ok(!!await p.$('.ctlfs'),'tapping the photo opens it full screen');
 await p.goBack();await p.waitForTimeout(300);ok(!await p.$('.ctlfs')&&!!await p.$('#ctlPhoto'),'the back button closes it and stays on the gear page');
 await p.screenshot({path:path.join(OUT,`ctl_inline_${W}.png`)});
 ok(!errs.length,'no page errors '+JSON.stringify(errs));
 console.log(fail?`${fail} FAILED`:'all passed');await b.close();srv.close();process.exit(fail?1:0)})();
