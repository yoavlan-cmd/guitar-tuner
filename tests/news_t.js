// What's new in your sessions (Oct 2026): the daily check's list (learn: daily/latest.json) shows on Home as a card while it has
// changes you haven't opened, and as a page: what Guitaring learned (with its reason), per song where the chords would change, how
// much of the song, and whether it agrees better with your edits / the video / the chord model. Fits 390 and 360 px wide.
const {chromium}=require('playwright');const path=require('path'),fs=require('fs'),http=require('http');
const ROOT=path.resolve(__dirname,'..');
const srv=http.createServer((q,r)=>{const f=path.join(ROOT,decodeURIComponent(q.url.split('?')[0]).replace(/\/$/,'/index.html'));fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);return r.end()}r.writeHead(200,{'content-type':/\.html$/.test(f)?'text/html':/\.js$/.test(f)?'text/javascript':'application/octet-stream'});r.end(d)})});
let fail=0;const ok=(c,m)=>{console.log((c?'ok  ':'FAIL')+' '+m);if(!c)fail++};
const REP={date:'2026-10-19',engine:{now:'1.1',base:{edits:{n:1,ok:0}},tried:[{k:'keyFix',what:'how readily a chord\u2019s major or minor follows the song\u2019s key',from:.6,to:.66,taken:true,ok:true},{k:'keyFix',from:.6,to:.54,taken:false,ok:false}],changes:[]},
 learned:{id:'1.1',kind:'learned',plain:'Changed how readily a chord\u2019s major or minor follows the song\u2019s key (keyFix 0.6 \u2192 0.66). Test songs: sharit: exact 95.5\u219296.1%; none got worse.'},
 songs:[{key:'mix_s1',title:'\u05e9\u05d0\u05e8\u05d9\u05d5\u05ea \u05e9\u05dc \u05d4\u05d7\u05d9\u05d9\u05dd - \u05d0\u05de\u05d9\u05e8 \u05d3\u05d3\u05d5\u05df',was:'1.0',now:'1.1',status:'changed',level:'moderate',share:4.2,verdict:'better',score:3,other:[],ed:{old:{n:1,ok:0},new:{n:1,ok:1}},
  spans:[{t0:3.9,t1:6.8,from:'Bm7',to:'Am',better:3,ev:{old:{edit:0,video:0,btc:0,n:{edit:1,video:0,btc:3}},new:{edit:1,video:0,btc:2,n:{edit:1,video:0,btc:3}}}}],cause:[{id:'1.1',kind:'learned',plain:'Changed how readily\u2026'}]},
  {key:'mix_s2',title:'Old Song',status:'no-parts',note:'its parts aren\u2019t kept on GitHub yet: tap Rebuild once on the song\u2019s page'}],summary:{sessions:2,changed:1,better:1,worse:0}};
srv.listen(0,async()=>{const APP=process.env.APP||`http://localhost:${srv.address().port}/index.html`;
 const b=await chromium.launch({...(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{})});
 for(const w of [390,360]){const ctx=await b.newContext({viewport:{width:w,height:780},hasTouch:true,isMobile:true});
  const H={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,PUT,PATCH,DELETE'};
  await ctx.route('https://api.github.com/**',r=>{const u=r.request().url();if(r.request().method()==='OPTIONS')return r.fulfill({status:204,headers:H});
   if(/contents\/daily\/latest\.json\?ref=learn/.test(u))return r.fulfill({status:200,headers:{...H,'content-type':'application/json'},body:JSON.stringify(REP)});
   return r.fulfill({status:404,headers:{...H,'content-type':'application/json'},body:'{"message":"Not Found"}'})});
  await ctx.route(/^https:\/\/(?!api\.github\.com)/,r=>r.abort());await ctx.route(/ideas\.json/,r=>r.abort());
  const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.addInitScript(()=>{window.__lsMs=0;window.__mxPollMs=1e9;window.Notification=class{static get permission(){return 'granted'}static requestPermission(){return Promise.resolve('granted')}constructor(t){(window.__notes=window.__notes||[]).push(t)}};
   if(window.ServiceWorkerRegistration)ServiceWorkerRegistration.prototype.showNotification=function(t){(window.__notes=window.__notes||[]).push(t);return Promise.resolve()};
   if(sessionStorage.x)return;sessionStorage.x=1;localStorage.setItem('tuner.profile',JSON.stringify({name:'Yoav',level:'intermediate',onboarding:{done:true}}));localStorage.setItem('guitaring.gh',JSON.stringify({repo:'me/split',token:'t',branch:'main'}))});
  await p.goto(APP);await p.waitForTimeout(1500);await p.evaluate(()=>window.__v2.goSec('home'));await p.waitForTimeout(300);
  const card=await p.$eval('#homeCont',e=>e.textContent).catch(()=>'');
  ok(/New versions of your sessions/.test(card)&&/1 song would change/.test(card),`${w}px: Home shows the card while the list has changes you haven\u2019t opened`);
  await p.tap('#homeCont .hcont:has-text("New versions")');await p.waitForTimeout(500);
  const t=await p.$eval("#lnDlg",e=>e.textContent);
  ok(/What Guitaring learned/.test(t)&&/keyFix 0\.6 \u2192 0\.66/.test(t)&&/Bm7 \u2192 Am/.test(t)&&/0:03\u20130:06/.test(t)&&/Agrees with your edits 1\/1/.test(t)&&/4\.2% of the song/.test(t)&&/Better/.test(t)&&/Medium change/.test(t),`${w}px: the page says what was learned and why, where the chords change, how much, and the evidence`);
  ok(/tap Rebuild once/.test(t)&&/Nothing on your phone changes/.test(t),`${w}px: a song without kept parts says what to do; nothing on the phone changes`);
  const ov=await p.evaluate(()=>{const d=document.querySelector('#lnDlg');return d.scrollWidth-d.clientWidth});ok(ov<=1,`${w}px: no sideways scrolling (${ov})`);
  await p.tap('#lnDlg .lnx');await p.waitForTimeout(200);await p.evaluate(()=>window.__v2.goSec('home'));await p.waitForTimeout(200);
  const card2=await p.$eval('#homeCont',e=>e.textContent).catch(()=>'');ok(!/New versions of your sessions/.test(card2),`${w}px: once opened, the card goes`);
  if(w===390){const n=await p.evaluate(()=>window.__notes||[]);ok(n.some(x=>/New versions of your sessions/.test(x)),'a notification for the new list, once')}
  ok(!errs.length,'no page errors '+JSON.stringify(errs));await ctx.close()}
 await b.close();srv.close();console.log(fail?fail+' FAILED':'all passed');process.exit(fail?1:0)});
