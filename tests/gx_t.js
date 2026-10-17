// Pedals and accessories (V2 phase 5): listed under the guitars and amps; add a pedal (type, what it does and where to start, its
// knobs), an accessory (capo; strings with a gauge); edit; remove (two taps); a capo tells the Easy guide you have one; a guitar's
// form or page hides the list; kept in its own key (tuner.gearExtra), the guitars untouched.
const {chromium,devices}=require('playwright');const path=require('path'),fs=require('fs'),http=require('http');
const ROOT=path.resolve(__dirname,'..'),OUT=path.join(__dirname,'out');fs.mkdirSync(OUT,{recursive:true});
const srv=http.createServer((q,r)=>{const f=path.join(ROOT,decodeURIComponent(q.url.split('?')[0]).replace(/\/$/,'/index.html'));fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);return r.end()}r.writeHead(200,{'content-type':/\.html$/.test(f)?'text/html':'application/octet-stream'});r.end(d)})}).listen(0);
const APP=process.env.APP||`http://localhost:${srv.address().port}/index.html`;
let fail=0;const ok=(c,m)=>{console.log((c?'ok  ':'FAIL')+' '+m);if(!c)fail++};
(async()=>{const b=await chromium.launch({...(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{})});
 const ctx=await b.newContext({...devices['Pixel 7']});await ctx.route(/^https:\/\//,r=>r.abort());await ctx.route(/ideas\.json/,r=>r.abort());
 const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.addInitScript(()=>{if(sessionStorage.x)return;sessionStorage.x=1;const S=(k,v)=>localStorage.setItem('tuner.'+k,JSON.stringify(v));
  S('userName','Yoav');S('profile',{name:'Yoav',onboarding:{done:true}});
  S('instruments',[{id:'i1',name:'Taylor',type:'acoustic',brand:'Taylor',model:'GS Mini',year:'',specs:{},strings:'',added:1}])});
 await p.goto(APP);await p.waitForTimeout(400);await p.tap('#bnav [data-sec=gear]');await p.waitForTimeout(300);
 ok(await p.$eval('#gearExtra',e=>!e.hidden&&/Pedals & accessories/.test(e.textContent))&&/Taylor/.test(await p.$eval('#gearOut',e=>e.textContent)),'Gear: “Pedals and accessories” under the guitars and amps');
 // a pedal
 await p.tap('#gxAdd');await p.waitForTimeout(150);
 ok(await p.$eval('#gearOut',e=>e.hidden)&&/What it does:.*Where to start:/s.test(await p.$eval('.gxhow',e=>e.textContent)),'adding: the form takes the page; an overdrive says what it does and where to start its knobs');
 await p.tap('[data-gt=delay]');await p.waitForTimeout(100);ok(/Echoes/.test(await p.$eval('.gxhow',e=>e.textContent)),'picking Delay changes the advice');
 await p.tap('[data-gt=overdrive]');await p.fill('#gxBrand','Boss');await p.fill('#gxModel','SD-1');await p.fill('#gxCtl','Level, Tone, Drive');await p.tap('#gxOk');await p.waitForTimeout(200);
 const L1=await p.evaluate(()=>JSON.parse(localStorage.getItem('tuner.gearExtra')));
 ok(L1.length===1&&L1[0].kind==='pedal'&&L1[0].type==='overdrive'&&L1[0].name==='Boss SD-1'&&L1[0].controls==='Level, Tone, Drive','saved in its own key, named from brand and model, with its knobs');
 ok(await p.$eval('[data-gx] .itxt span',e=>e.textContent)==='Overdrive','the row’s second line doesn’t repeat the name (Boss SD-1 · Overdrive)');
 ok(await p.$eval('.gxhead',h=>{const a=h.querySelector('h2').getBoundingClientRect(),b=h.querySelector('.btn').getBoundingClientRect();return Math.abs(a.top+a.height/2-(b.top+b.height/2))<12}),'“+ Add” sits on the heading’s line');
 ok(/Boss SD-1/.test(await p.$eval('#gearExtra',e=>e.textContent))&&/Overdrive/.test(await p.$eval('#gearExtra',e=>e.textContent))&&await p.$eval('#gearOut',e=>!e.hidden),'it shows under Pedals, the guitars list is back');
 // accessories: strings with a gauge, a capo (the Easy guide then knows you have one)
 await p.tap('#gxAdd');await p.tap('[data-gk=acc]');await p.waitForTimeout(100);await p.tap('[data-gt=strings]');await p.waitForTimeout(100);
 await p.fill('#gxBrand',"D'Addario");await p.fill('#gxGauge','12-53');await p.tap('#gxOk');await p.waitForTimeout(150);
 ok(/12-53/.test(await p.$eval('#gearExtra',e=>e.textContent)),'strings with their gauge');
 ok(await p.evaluate(()=>!JSON.parse(localStorage.getItem('tuner.profile')).capo),'(no capo choice yet)');
 await p.tap('#gxAdd');await p.tap('[data-gk=acc]');await p.waitForTimeout(100);await p.tap('#gxOk');await p.waitForTimeout(150);
 ok(await p.evaluate(()=>JSON.parse(localStorage.getItem('tuner.profile')).capo)==='yes','adding a capo: the Easy guide opens with its capo version');
 ok(await p.$$eval('#gearExtra .gxh',l=>l.map(x=>x.textContent).join('|'))==='Pedals|Accessories','listed as Pedals and Accessories');
 await p.screenshot({path:path.join(OUT,'gx.png'),fullPage:true});
 // edit, then remove (two taps)
 await p.tap('[data-gx]:has-text("Boss SD-1")');await p.waitForTimeout(150);await p.fill('#gxName','Blues drive');await p.tap('#gxOk');await p.waitForTimeout(150);
 ok(/Blues drive/.test(await p.$eval('#gearExtra',e=>e.textContent))&&(await p.evaluate(()=>JSON.parse(localStorage.getItem('tuner.gearExtra')).length))===3,'editing keeps it one item');
 await p.tap('[data-gx]:has-text("Blues drive")');await p.waitForTimeout(150);await p.tap('#gxDel');await p.waitForTimeout(100);
 ok((await p.evaluate(()=>JSON.parse(localStorage.getItem('tuner.gearExtra')).length))===3&&/Tap again/.test(await p.$eval('#gxDel',e=>e.textContent)),'removing asks for a second tap');
 await p.tap('#gxDel');await p.waitForTimeout(150);ok((await p.evaluate(()=>JSON.parse(localStorage.getItem('tuner.gearExtra')).length))===2,'…then removes it');
 // a guitar's page hides the list; the guitars are untouched
 await p.tap('#gearOut [data-open]');await p.waitForTimeout(300);ok(await p.$eval('#gearExtra',e=>e.hidden),'a guitar’s page hides the pedals list');
 ok(await p.evaluate(()=>JSON.parse(localStorage.getItem('tuner.instruments')).length===1),'the guitars and amps are untouched');
 await p.setViewportSize({width:360,height:740});await p.evaluate(()=>window.__v2.goSec('home'));await p.tap('#bnav [data-sec=gear]');await p.waitForTimeout(200);
 ok(await p.evaluate(()=>document.documentElement.scrollWidth<=360),'no sideways scroll at 360 px');
 ok(!errs.length,'no page errors '+JSON.stringify(errs));
 console.log(fail?`${fail} FAILED`:'all passed');await b.close();srv.close();process.exit(fail?1:0)})();
