// Home fits one screen: no scrolling, all four tiles fully above the bottom bar (and above the mini-player), on small and large
// phones, with up to three Continue cards; other sections still scroll.
const {chromium}=require('playwright');const path=require('path'),fs=require('fs'),http=require('http');
const ROOT=path.resolve(__dirname,'..'),OUT=path.join(__dirname,'out');fs.mkdirSync(OUT,{recursive:true});
const srv=http.createServer((q,r)=>{const f=path.join(ROOT,decodeURIComponent(q.url.split('?')[0]).replace(/\/$/,'/index.html'));fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);return r.end()}r.writeHead(200,{'content-type':/\.html$/.test(f)?'text/html':'application/octet-stream'});r.end(d)})}).listen(0);
const APP=process.env.APP||`http://localhost:${srv.address().port}/index.html`;
let fail=0;const ok=(c,m)=>{console.log((c?'ok  ':'FAIL')+' '+m);if(!c)fail++};
const SIZES=[[360,560],[360,640],[390,664],[412,740],[412,860]];
(async()=>{const b=await chromium.launch({...(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{})});const errs=[];
 for(const busy of [false,true])for(const [w,h] of SIZES){
  const ctx=await b.newContext({viewport:{width:w,height:h},hasTouch:true,isMobile:true,deviceScaleFactor:2});await ctx.route(/^https:\/\//,r=>r.abort());await ctx.route(/ideas\.json/,r=>r.abort());
  const p=await ctx.newPage();p.on('pageerror',e=>errs.push(e.message));
  await p.addInitScript(busy=>{if(sessionStorage.x)return;sessionStorage.x=1;const S=(k,v)=>localStorage.setItem('tuner.'+k,JSON.stringify(v));S('userName','Yoav');
   S('profile',{name:'Yoav',onboarding:{done:!busy,later:busy}});
   S('sheetIndex',Array.from({length:30},(_,i)=>({title:'Song number '+i,artist:'Band',capo:0,tuning:'Standard',chords:['G'],level:1,url:'https://drive.google.com/file/d/x'+i+'/view',at:'2026-10-12T05:50:07Z'})));
   if(busy)S('writeDraft',{kind:'lyrics',title:'A very long unfinished sheet title that goes on and on',lyrics:'la',lc:[{t:'la',ch:{}}],segs:[],play:{tun:'std',capo:0},edited:Date.now()})},busy);
  await p.goto(APP);await p.waitForTimeout(400);
  if(busy){await p.evaluate(async()=>{await window.__bk.put('mixdata:m1',{len:441000,sr:44100,tracks:[{id:'drums',name:'Drums',data:new Int16Array(882000)}]});await window.__bk.put('mixIndex',[{id:'m1',name:'Green Day - Good Riddance (Time of Your Life) [Official Music Video]',at:Date.now(),src:'cloud',state:'ready'}])});
   await p.reload();await p.waitForTimeout(500);await p.evaluate(()=>window.__mxTest.open('m1'));await p.waitForTimeout(600);await p.evaluate(()=>{const x=document.getElementById('mxClose');if(x)x.click()});
   await p.evaluate(()=>window.__v2.goSec('home'));await p.waitForTimeout(400)}
  const r=await p.evaluate(()=>{const nav=document.getElementById('bnav').getBoundingClientRect().top,bar=document.getElementById('mxBar'),barTop=bar&&!bar.hidden?bar.getBoundingClientRect().top:nav;
   const t=[...document.querySelectorAll('#paneHome .htile')].map(e=>e.getBoundingClientRect());
   return {sh:document.scrollingElement.scrollHeight,ih:innerHeight,lim:Math.min(nav,barTop),bottom:Math.max(...t.map(x=>x.bottom)),minH:Math.min(...t.map(x=>x.height)),cards:document.querySelectorAll('#homeCont .hcont').length,bar:!!(bar&&!bar.hidden),joke:document.getElementById('hJoke').getBoundingClientRect().height}});
  const tag=`${w}×${h}${busy?` with ${r.cards} Continue cards${r.bar?' and the player':''}`:''}`;
  ok(r.sh<=r.ih+1,`${tag}: Home doesn’t scroll (${r.sh} ≤ ${r.ih})`);
  // the four titles line up: the same top and height in every tile, and none wider than its tile; the joke's bubble shows whole lines
  const T=await p.$$eval('#paneHome .htile',l=>l.map(t=>{const b=t.querySelector('b'),tb=t.getBoundingClientRect(),bb=b.getBoundingClientRect(),rg=document.createRange();rg.selectNodeContents(b);return {top:Math.round(bb.top-tb.top),h:Math.round(bb.height),wide:rg.getBoundingClientRect().width>t.clientWidth-20}}));
  ok(T.every(x=>x.top===T[0].top&&x.h===T[0].h&&!x.wide),`${tag}: the four titles line up (top ${T.map(x=>x.top).join('/')}, height ${T.map(x=>x.h).join('/')}) and fit their tiles`);
  ok(await p.$eval('#hJoke',e=>{const lh=parseFloat(getComputedStyle(e).lineHeight);return Math.abs(e.clientHeight/lh-Math.round(e.clientHeight/lh))<.05}),`${tag}: the joke bubble shows whole lines`);
  ok(r.bottom<=r.lim+1&&r.minH>=72&&r.joke>20,`${tag}: all four tiles are fully visible (bottom ${Math.round(r.bottom)} ≤ ${Math.round(r.lim)}, smallest ${Math.round(r.minH)} px tall)`);
  if(w===390||(busy&&w===360&&h===640))await p.screenshot({path:path.join(OUT,`home_${w}x${h}${busy?'_busy':''}.png`)});
  if(!busy&&w===390){await p.tap('#bnav [data-sec=learn]');await p.waitForTimeout(300);ok(await p.evaluate(()=>document.scrollingElement.scrollHeight>innerHeight+50),'other sections still scroll');
   await p.tap('#bnav [data-sec=home]');await p.waitForTimeout(200);ok(await p.evaluate(()=>scrollY===0&&document.scrollingElement.scrollHeight<=innerHeight+1),'back on Home it fits again')}
  await ctx.close()}
 // with the display font (Google Fonts let through): Learn, Write and Jam are about twice as big as "Check my gear", lined up, inside their tiles
 {const ctx=await b.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,deviceScaleFactor:2});await ctx.route(/^https:\/\/(?!fonts\.(googleapis|gstatic)\.com)/,r=>r.abort());await ctx.route(/ideas\.json/,r=>r.abort());
  const p=await ctx.newPage();await p.addInitScript(()=>{if(sessionStorage.x)return;sessionStorage.x=1;localStorage.setItem('tuner.userName','"Yoav"');localStorage.setItem('tuner.profile',JSON.stringify({name:'Yoav',onboarding:{done:true}}))});
  await p.goto(APP);await p.waitForFunction(()=>document.documentElement.classList.contains('fdisp'),null,{timeout:15000}).catch(()=>{});await p.waitForTimeout(300);
  const T=await p.$$eval('#paneHome .htile',l=>l.map(t=>{const x=t.querySelector('b'),tb=t.getBoundingClientRect(),bb=x.getBoundingClientRect(),rg=document.createRange();rg.selectNodeContents(x);return {t:x.textContent,fs:parseFloat(getComputedStyle(x).fontSize),top:Math.round(bb.top-tb.top),w:rg.getBoundingClientRect().width,in:t.clientWidth-20}}));
  console.log('  with the display font:',T.map(x=>`${x.t} ${x.fs.toFixed(0)}px top ${x.top}`).join(' · '));
  if(await p.evaluate(()=>document.documentElement.classList.contains('fdisp')))ok(T.slice(0,3).every(x=>x.fs>=T[3].fs*1.6)&&T.every(x=>x.top===T[0].top&&x.w<=x.in),'with the display font: Learn, Write and Jam about twice as big as “Check my gear”, lined up, inside their tiles');
  else console.log('  (the display font couldn’t load here: skipped)');await ctx.close()}
 ok(!errs.length,'no page errors '+JSON.stringify(errs));
 console.log(fail?`${fail} FAILED`:'all passed');await b.close();srv.close();process.exit(fail?1:0)})();
