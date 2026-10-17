// Song reminders in the Home comments (Oct 2026): a song in Learning for 3+ weeks joins the jokes' random pick (at most 3 songs);
// the card is green-framed with "Practise it" (the song session when it has a play-along or a jam track, else its chord sheet: on
// the phone, or in Drive) and "I can play it" (Learned, dated now); a song shown is left alone for a week; never two reminders in a
// row; My profile › "Song reminders in the comments" turns them off.
const {chromium,devices}=require('playwright');const path=require('path'),fs=require('fs'),http=require('http');
const ROOT=path.resolve(__dirname,'..'),OUT=path.join(__dirname,'out');fs.mkdirSync(OUT,{recursive:true});
const srv=http.createServer((q,r)=>{const f=path.join(ROOT,decodeURIComponent(q.url.split('?')[0]).replace(/\/$/,'/index.html'));fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);return r.end()}r.writeHead(200,{'content-type':/\.html$/.test(f)?'text/html':'application/octet-stream'});r.end(d)})}).listen(0);
const APP=process.env.APP||`http://localhost:${srv.address().port}/index.html`;
let fail=0;const ok=(c,m)=>{console.log((c?'ok  ':'FAIL')+' '+m);if(!c)fail++};
(async()=>{const b=await chromium.launch({...(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{})});
 const ctx=await b.newContext({...devices['Pixel 7']});await ctx.route(/^https:\/\//,r=>r.abort());await ctx.route(/ideas\.json/,r=>r.abort());
 const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.addInitScript(()=>{window.open=u=>{window.__opened=u;return null};if(sessionStorage.x)return;sessionStorage.x=1;const S=(k,v)=>localStorage.setItem('tuner.'+k,JSON.stringify(v));
  const ago=d=>new Date(Date.now()-d*864e5).toISOString();
  S('userName','Yoav');S('profile',{name:'Yoav',onboarding:{done:true}});S('learnLang','en');
  S('sheetIndex',[{title:'Hallelujah',artist:'Leonard Cohen',capo:0,chords:['C','Am'],url:'https://drive.google.com/file/d/h1/view',at:'2026-08-12T05:50:07Z'}]);
  S('lib',[{id:'l1',name:'Good Riddance',saved:Date.now()-9000,data:{kind:'lyrics',title:'Good Riddance',artist:'Green Day',lc:[{t:'x',ch:{0:'G'}}],segs:[],play:{tun:'std',capo:0}}},
   {id:'l2',name:'Let It Be',saved:Date.now()-8000,data:{kind:'lyrics',title:'Let It Be',artist:'The Beatles',lc:[{t:'When I find myself',ch:{0:'C'}}],segs:[],play:{tun:'std',capo:0}}},
   {id:'l3',name:'Wonderwall',saved:Date.now()-7000,data:{kind:'lyrics',title:'Wonderwall',artist:'Oasis',lc:[{t:'y',ch:{0:'Em7'}}],segs:[],play:{tun:'std',capo:0}}},
   {id:'l4',name:'Yesterday',saved:Date.now()-6000,data:{kind:'lyrics',title:'Yesterday',artist:'The Beatles',lc:[{t:'z',ch:{0:'F'}}],segs:[],play:{tun:'std',capo:0}}}]);
  S('song.mix_m1',{title:'Good Riddance - Green Day',artist:'Green Day',dur:10,bpm:100,offset:0,tuning:{id:'std'},segs:[[0,5,0],[5,10,8]],play:{tun:'std',capo:0},v:2,at:Date.now(),from:'guitars',mix:'m1'});S('songs',['mix_m1']);
  const R=(id,t,a,st,d,sd)=>({id,title:t,artist:a,aliases:[],status:st,createdAt:ago(d),...(sd!=null?{statusAt:ago(sd)}:{}),touchedAt:ago(d),links:{},notes:''});
  S('songs2',[R('s1','Good Riddance','Green Day','learning',30),R('s2','Hallelujah','Leonard Cohen','learning',90,40),R('s3','Let It Be','The Beatles','learning',25),
   R('s4','Wonderwall','Oasis','learning',60,5),R('s5','Yesterday','The Beatles','learned',60)]);
 });
 await p.goto(APP);await p.waitForTimeout(600);
 const due=()=>p.evaluate(()=>window.__rem.songs().map(x=>x.g.title).sort());
 ok(JSON.stringify(await due())==='["Good Riddance","Hallelujah","Let It Be"]','due: songs in Learning for 3+ weeks (since the status changed); not a newer one or a Learned one '+JSON.stringify(await due()));
 // only one song due at a time, so the test knows which one comes up; Math.random()=0 picks a reminder
 const only=t=>p.evaluate(t=>{const all={};window.__rem.reset();
  for(const g of [['Good Riddance','Green Day'],['Hallelujah','Leonard Cohen'],['Let It Be','The Beatles']])if(g[0]!==t)all[window.__rem.key(g[0],g[1])]=Date.now();
  localStorage.setItem('tuner.remSeen',JSON.stringify(all))},t);
 const home=async()=>{await p.evaluate(()=>{const r=Math.random;Math.random=()=>0;window.__v2.goSec('home',{force:true});Math.random=r});await p.waitForTimeout(250)};
 await only('Good Riddance');await home();
 const card=await p.$eval('#homeHero .hjbub',e=>({rem:e.classList.contains('hrem'),t:e.textContent,go:!!e.querySelector('#hRemGo'),ok:!!e.querySelector('#hRemOk'),bs:getComputedStyle(e).boxShadow}));
 console.log('  card:',card.t);
 ok(card.rem&&/Good Riddance/.test(card.t)&&/\d+ weeks?/.test(card.t)&&/Yoav/.test(card.t),'a reminder: the song, how long, your name');
 ok(card.go&&card.ok&&/127, 199, 122|rgb\(127/.test(card.bs),'green frame, with “Practise it” and “I can play it”');
 await p.setViewportSize({width:390,height:844});await p.screenshot({path:path.join(OUT,'rem390.png')});
 await p.setViewportSize({width:360,height:740});await p.screenshot({path:path.join(OUT,'rem360.png')});
 const fits=await p.evaluate(()=>{const h=document.querySelector('#homeHero .hremact').getBoundingClientRect();return h.right<=innerWidth&&document.documentElement.scrollWidth<=innerWidth});
 ok(fits,'fits at 360 px');
 ok(await p.evaluate(()=>!window.__rem.songs().some(x=>x.g.title==='Good Riddance')),'a song shown is left alone for a week');
 // Another one: never two reminders in a row
 await p.evaluate(()=>{localStorage.removeItem('tuner.remSeen');const r=Math.random;Math.random=()=>0;document.getElementById('hMore').click();Math.random=r});
 ok(await p.$eval('#homeHero .hjbub',e=>!e.classList.contains('hrem')),'“Another one” after a reminder: a joke');
 // Practise: session (has a play-along), Drive sheet, phone sheet
 await only('Good Riddance');await home();await p.tap('#hRemGo');await p.waitForTimeout(400);
 ok(await p.evaluate(()=>window.__v2.cur())==='session'&&/Good Riddance/.test(await p.$eval('#sesBox',e=>e.textContent)),'Practise: the song session when it has a play-along');
 await only('Hallelujah');await home();await p.tap('#hRemGo');await p.waitForTimeout(300);
 ok(await p.evaluate(()=>window.__opened)==='https://drive.google.com/file/d/h1/view','Practise: the chord sheet in Drive when there’s no session');
 await only('Let It Be');await home();await p.tap('#hRemGo');await p.waitForTimeout(400);
  ok(await p.evaluate(()=>!document.getElementById('paneSong').hidden&&/^Let It BeArtist The Beatles/.test(document.getElementById('paper').textContent)),'Practise: the chord sheet on the phone');
 // I can play it: Learned, dated now
 await only('Let It Be');await home();await p.tap('#hRemOk');await p.waitForTimeout(300);
 const rec=await p.evaluate(()=>JSON.parse(localStorage.getItem('tuner.songs2')).find(r=>r.title==='Let It Be'));
 ok(rec.status==='learned'&&Date.now()-Date.parse(rec.statusAt)<60000,'“I can play it”: the song is Learned, dated now');
 ok(await p.$eval('#homeHero .hjbub',e=>!e.classList.contains('hrem')),'then the next comment is a joke');
 // My profile: the switch turns them off
 await p.evaluate(()=>window.__v2.goSec('profile'));await p.waitForTimeout(300);
 ok(await p.$eval('#remOn',e=>e.checked)&&/Song reminders in the comments/.test(await p.$eval('#remSet',e=>e.textContent)),'My profile: “Song reminders in the comments”, on');
 await p.uncheck('#remOn');await p.waitForTimeout(200);await p.evaluate(()=>localStorage.removeItem('tuner.remSeen'));
 ok(await p.evaluate(()=>window.__v2.profGet().remind===false&&!window.__rem.songs().length),'off: no song is due');
 await home();ok(await p.$eval('#homeHero .hjbub',e=>!e.classList.contains('hrem')),'off: Home shows jokes only');
 await p.reload();await p.waitForTimeout(500);await p.evaluate(()=>window.__v2.goSec('profile'));await p.waitForTimeout(300);
 ok(await p.$eval('#remOn',e=>!e.checked),'still off after a reload');
 ok(!errs.length,'no page errors '+JSON.stringify(errs));
 console.log(fail?`${fail} FAILED`:'all passed');await b.close();srv.close();process.exit(fail?1:0)})();
