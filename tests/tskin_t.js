// Tuner skins (Oct 2026): the guitar you tune (from My gear) gets its own headstock and meter look: a Les Paul → lp (brand
// text, "Les Paul", the model on the truss-rod cover), a Lava → lava ("LAVA ME"), an acoustic → wood (a Taylor with the crown
// notch), any other electric → gloss; no guitars → wood for acoustic, gloss for electric. Picking another guitar switches the
// look at once; the six string buttons stay (low E bottom-left), tapping one still picks that string; fits 360 px.
const {chromium,devices}=require('playwright');const path=require('path'),fs=require('fs'),http=require('http');
const ROOT=path.resolve(__dirname,'..'),OUT=path.join(__dirname,'out');fs.mkdirSync(OUT,{recursive:true});
const srv=http.createServer((q,r)=>{const f=path.join(ROOT,decodeURIComponent(q.url.split('?')[0]).replace(/\/$/,'/index.html'));fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);return r.end()}r.writeHead(200,{'content-type':/\.html$/.test(f)?'text/html':'application/octet-stream'});r.end(d)})}).listen(0);
const APP=`http://localhost:${srv.address().port}/index.html`;
let fail=0;const ok=(c,m)=>{console.log((c?'ok  ':'FAIL')+' '+m);if(!c)fail++};
const G=[{id:'g1',name:'Epiphone Les Paul Muse',brand:'Epiphone',model:'Les Paul Muse',type:'electric',specs:{}},{id:'g2',name:'Lava Me 3',brand:'Lava',model:'Me 3',type:'acoustic',specs:{}},
 {id:'g3',name:'Taylor 314ce',brand:'Taylor',model:'314ce',type:'electroacoustic',specs:{}},{id:'g4',name:'Fender Stratocaster',brand:'Fender',model:'Stratocaster',type:'electric',specs:{}},
 {id:'g5',name:'Yamaha C40',brand:'Yamaha',model:'C40',type:'classical',specs:{}}];
(async()=>{const b=await chromium.launch({...(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{})});
 const ctx=await b.newContext({...devices['Pixel 7'],viewport:{width:360,height:740}});await ctx.route(/^https:\/\//,r=>r.abort());
 const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.addInitScript(G=>{if(sessionStorage.x)return;sessionStorage.x=1;localStorage.setItem('tuner.userName','"Yoav"');localStorage.setItem('tuner.profile',JSON.stringify({name:'Yoav',onboarding:{done:true}}));
  localStorage.setItem('tuner.instruments',JSON.stringify(G));localStorage.setItem('tuner.tuneInst','"g1"')},G);
 await p.goto(APP);await p.waitForTimeout(700);await p.evaluate(()=>window.__v2.goSec('tuner'));await p.waitForTimeout(400);
 const look=()=>p.evaluate(()=>{const h=document.querySelector('#strings .hs');return {skin:document.getElementById('paneTune').dataset.skin,hs:h&&h.className,txt:[...document.querySelectorAll('#strings svg text')].map(t=>t.textContent).join('|'),pegs:document.querySelectorAll('#strings .peg').length}});
 const pick=async id=>{await p.evaluate(id=>document.querySelector(`#inst [data-g="${id}"]`).click(),id);await p.waitForTimeout(250)};
 let L=await look();console.log('  lp:',JSON.stringify(L));
 ok(L.skin==='lp'&&/\blp\b/.test(L.hs)&&/Epiphone/.test(L.txt)&&/Les Paul/.test(L.txt)&&/Muse/.test(L.txt)&&L.pegs===6,'Les Paul Muse: the lp look, “Epiphone”, “Les Paul”, “Muse” on the truss-rod cover, six string buttons');
 await pick('g2');L=await look();ok(L.skin==='lava'&&/LAVA ME/.test(L.txt)&&L.pegs===6,'Lava Me 3: the lava look, “LAVA ME”');
 await pick('g3');L=await look();ok(L.skin==='wood'&&/Taylor/.test(L.txt)&&await p.evaluate(()=>window.__tskin.kind().crown===true),'Taylor 314ce: the wood look with the crown notch, “Taylor”');
 await pick('g4');L=await look();ok(L.skin==='gloss'&&/Fender/.test(L.txt),'any other electric (Fender Strat): the gloss look with its brand');
 await pick('g5');L=await look();ok(L.skin==='wood'&&/Yamaha/.test(L.txt)&&await p.evaluate(()=>!window.__tskin.kind().crown),'a classical (Yamaha): the wood look without the crown');
 // the strings: low E bottom-left, high E bottom-right; tapping a string still picks it
 const pos=await p.$$eval('#strings .peg',l=>l.map(e=>({i:+e.dataset.i,x:e.getBoundingClientRect().x,y:e.getBoundingClientRect().y})));
 const at=i=>pos.find(q=>q.i===i);ok(at(0).x<at(5).x&&Math.abs(at(0).y-at(5).y)<2&&at(2).y<at(0).y,'low E bottom-left, high E bottom-right, D at the top');
 await p.click('#strings .peg[data-i="3"]');ok(await p.$eval('#strings .peg.target',e=>e.dataset.i)==='3'&&await p.$eval('#strings .sline.on',e=>e.dataset.s)==='3','tapping G picks that string (its string glows)');
 ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no sideways scroll at 360 px');
 await p.screenshot({path:path.join(OUT,'tskin.png'),fullPage:true});
 ok(!errs.length,'no page errors '+JSON.stringify(errs));await ctx.close();
 // no guitars in My gear: acoustic → wood, electric → gloss
 const c2=await b.newContext({...devices['Pixel 7']});await c2.route(/^https:\/\//,r=>r.abort());const q=await c2.newPage();
 await q.addInitScript(()=>{localStorage.setItem('tuner.userName','"Dana"');localStorage.setItem('tuner.profile',JSON.stringify({name:'Dana',onboarding:{done:true}}))});
 await q.goto(APP);await q.waitForTimeout(700);await q.evaluate(()=>window.__v2.goSec('tuner'));await q.waitForTimeout(300);
 const s1=await q.evaluate(()=>document.getElementById('paneTune').dataset.skin);await q.evaluate(()=>document.querySelector('#inst [data-g="electric"]').click());await q.waitForTimeout(200);
 const s2=await q.evaluate(()=>document.getElementById('paneTune').dataset.skin);ok(s1==='wood'&&s2==='gloss','no guitars: Acoustic → wood, Electric → gloss '+s1+'/'+s2);
 await c2.close();
 console.log(fail?`${fail} FAILED`:'all passed');await b.close();srv.close();process.exit(fail?1:0)})();
