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
  ok(r.bottom<=r.lim+1&&r.minH>=72&&r.joke>20,`${tag}: all four tiles are fully visible (bottom ${Math.round(r.bottom)} ≤ ${Math.round(r.lim)}, smallest ${Math.round(r.minH)} px tall)`);
  if(w===390||(busy&&w===360&&h===640))await p.screenshot({path:path.join(OUT,`home_${w}x${h}${busy?'_busy':''}.png`)});
  if(!busy&&w===390){await p.tap('#bnav [data-sec=learn]');await p.waitForTimeout(300);ok(await p.evaluate(()=>document.scrollingElement.scrollHeight>innerHeight+50),'other sections still scroll');
   await p.tap('#bnav [data-sec=home]');await p.waitForTimeout(200);ok(await p.evaluate(()=>scrollY===0&&document.scrollingElement.scrollHeight<=innerHeight+1),'back on Home it fits again')}
  await ctx.close()}
 ok(!errs.length,'no page errors '+JSON.stringify(errs));
 console.log(fail?`${fail} FAILED`:'all passed');await b.close();srv.close();process.exit(fail?1:0)})();
