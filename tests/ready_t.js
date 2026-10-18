// The song's session is ready (Oct 2026): no "Ready · Open the song" step in between. Opening the progress of a song whose session
// is built goes straight to its session; a progress sheet left open while the session builds turns into the session when it's done.
const {chromium}=require('playwright');const path=require('path'),fs=require('fs'),http=require('http');
const ROOT=path.resolve(__dirname,'..');
const srv=http.createServer((q,r)=>{const f=path.join(ROOT,decodeURIComponent(q.url.split('?')[0]).replace(/\/$/,'/index.html'));fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);return r.end()}r.writeHead(200,{'content-type':/\.html$/.test(f)?'text/html':'application/octet-stream'});r.end(d)})}).listen(0);
const APP=process.env.APP||`http://localhost:${srv.address().port}/index.html`;
let fail=0;const ok=(c,m)=>{console.log((c?'ok  ':'FAIL')+' '+m);if(!c)fail++};
const T='שאריות של החיים',A='אמיר דדון';
(async()=>{const b=await chromium.launch({...(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{})});
 const ctx=await b.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});await ctx.route(/^https:\/\//,r=>r.abort());await ctx.route(/ideas\.json/,r=>r.abort());
 const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.addInitScript(([T,A])=>{window.__mxPollMs=1e9;window.__dsTickMs=300;if(sessionStorage.x)return;sessionStorage.x=1;const S=(k,v)=>localStorage.setItem('tuner.'+k,JSON.stringify(v));
  S('userName','Yoav');S('profile',{name:'Yoav',onboarding:{done:true}});S('learnLang','he');
  S('song.mix_m1',{title:T+' - '+A,artist:A,dur:10,bpm:100,offset:0,tuning:{id:'std'},segs:[[0,5,0],[5,10,8]],play:{tun:'std',capo:0},v:2,at:Date.now(),from:'guitars',mix:'m1',song:{t:T,a:A}});S('songs',['mix_m1'])},[T,A]);
 await p.goto(APP);await p.waitForTimeout(400);
 const idx=sess=>p.evaluate(async([T,A,sess])=>{await window.__bk.put('mixIndex',[{id:'m1',name:A+' - '+T,at:Date.now(),src:'cloud',state:'ready',sess,anaKey:sess==='done'?'mix_m1':undefined,song:{t:T,a:A}}])},[T,A,sess]);
 await idx('done');await p.reload();await p.waitForTimeout(600);
 const st=()=>p.evaluate(()=>({sec:window.__v2.cur(),sheet:!document.getElementById('dsDlg').hidden,ready:/Ready/.test(document.getElementById('dsDlg').textContent),title:(document.querySelector('#paneSession')||{}).textContent||''}));
 // 1. the progress of a song whose session is built: straight to its session
 await p.evaluate(()=>window.__ds.progress('m1'));await p.waitForTimeout(500);let s=await st();console.log('  ',JSON.stringify({...s,title:s.title.slice(0,40)}));
 ok(s.sec==='session'&&!s.sheet&&s.title.includes(T),'its session is built: tapping it opens the song’s session (no “Ready · Open the song” in between)');
 // 2. the progress left open while the session builds: when it's done, the session opens by itself
 await p.evaluate(()=>window.__v2.goSec('home'));await idx('building');await p.reload();await p.waitForTimeout(600);
 await p.evaluate(()=>{const it=window.__mxTest.idx().find(x=>x.id==='m1');it.sess='building';window.__ds.progress('m1')});await p.waitForTimeout(300);s=await st();
 ok(s.sheet&&s.sec==='home','while it builds, the progress shows');
 await p.evaluate(()=>{const it=window.__mxTest.idx().find(x=>x.id==='m1');it.sess='done';it.anaKey='mix_m1'});await p.waitForTimeout(1200);s=await st();
 ok(s.sec==='session'&&!s.sheet,'when the session is built, the progress turns into the song’s session');
 ok(!errs.length,'no page errors '+JSON.stringify(errs));
 console.log(fail?`${fail} FAILED`:'all passed');await b.close();srv.close();process.exit(fail?1:0)})();
