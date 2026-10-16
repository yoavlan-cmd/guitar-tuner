// Song session (V2 phase 3): a song in My learning library opens its own page: title, artist, tuning / capo, what it has, one
// Practise button that opens the best material (play-along › jam track › sheet › lesson), status, the song's chords as diagrams,
// quick jam buttons (guitars only / without / whole band), everything linked, the chord finder, notes saved in the song record;
// ‹ and the phone's back button return to Learn.
const {chromium,devices}=require('playwright');const path=require('path'),fs=require('fs'),http=require('http');
const ROOT=path.resolve(__dirname,'..'),OUT=path.join(__dirname,'out');fs.mkdirSync(OUT,{recursive:true});
const srv=http.createServer((q,r)=>{const f=path.join(ROOT,decodeURIComponent(q.url.split('?')[0]).replace(/\/$/,'/index.html'));fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);return r.end()}r.writeHead(200,{'content-type':/\.html$/.test(f)?'text/html':'application/octet-stream'});r.end(d)})}).listen(0);
const APP=process.env.APP||`http://localhost:${srv.address().port}/index.html`;
let fail=0;const ok=(c,m)=>{console.log((c?'ok  ':'FAIL')+' '+m);if(!c)fail++};
(async()=>{const b=await chromium.launch({...(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{})});
 const ctx=await b.newContext({...devices['Pixel 7']});await ctx.route(/^https:\/\//,r=>r.abort());await ctx.route(/ideas\.json/,r=>r.abort());
 const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.addInitScript(()=>{if(sessionStorage.x)return;sessionStorage.x=1;const S=(k,v)=>localStorage.setItem('tuner.'+k,JSON.stringify(v));
  S('userName','Yoav');S('profile',{name:'Yoav',onboarding:{done:true}});S('learnLang','en');
  S('sheetIndex',[{title:'Good Riddance (Time Of Your Life)',artist:'Green Day',capo:0,tuning:'Standard',chords:['G','Cadd9','D'],level:1,url:'https://drive.google.com/file/d/abc/view',at:'2026-10-12T05:50:07Z'}]);
  S('vlinks',[{id:'v1',url:'https://youtu.be/abcdefghijk',key:'yt:abcdefghijk',yt:'abcdefghijk',src:'YouTube',title:'Good Riddance guitar lesson',song:'Good Riddance',artist:'Green Day',at:Date.now()-1000}]);
  S('ideaOnIt',[{title:'Wonderwall',artist:'Oasis',at:Date.now()-5000}]);
  S('lib',[{id:'l1',name:'Creep',saved:Date.now()-9000,data:{kind:'lyrics',title:'Creep',artist:'Radiohead',lc:[{t:'when you were here',ch:{0:'G',5:'B'}},{t:'x',ch:{0:'C',2:'Cm'}}],segs:[],play:{tun:'std',capo:2}}}]);
 });
 await p.goto(APP);await p.waitForTimeout(400);
 await p.evaluate(async()=>{const n=44100*4,mk=()=>new Int16Array(n*2);await window.__bk.put('mixdata:m1',{len:n,sr:44100,tracks:[{id:'guitar',name:'Guitars',data:mk()},{id:'drums',name:'Drums',data:mk()},{id:'vocals',name:'Vocals',data:mk()}]});await window.__bk.put('mixIndex',[{id:'m1',name:'Green Day - Good Riddance',at:Date.now(),src:'cloud',state:'ready'}])});
 await p.reload();await p.waitForTimeout(600);
 await p.tap('#bnav [data-sec=learn]');await p.waitForTimeout(200);
 await p.tap('#learnList .lrow:has-text("Good Riddance")');await p.waitForTimeout(300);
 const cur=()=>p.evaluate(()=>window.__v2.cur());
 ok(await cur()==='session'&&await p.$eval('#paneSession',e=>!e.hidden),'a song opens its song session page');
 const hero=await p.$eval('.seshero',e=>e.innerText.replace(/\s+/g,' '));console.log('  '+hero);
 ok(/Good Riddance/i.test(hero)&&/Green Day/.test(hero)&&/Tuning: Standard/.test(hero)&&/No capo/.test(hero),'title, artist, tuning and capo');
 ok(/SHEET/i.test(hero)&&/LESSON/i.test(hero)&&/JAM/i.test(hero),'what the song has');
 ok(/Practise with the jam track/.test(await p.$eval('#sesGo',e=>e.textContent)),'Practise picks the jam track (no play-along yet)');
 ok((await p.$$('.seschords .sesdg svg')).length===3,'the song’s chords as diagrams with fingers (G, Cadd9, D)');
 // status and notes
 await p.tap('.seshero [data-st=learned]');await p.waitForTimeout(150);
 ok(await p.evaluate(()=>JSON.parse(localStorage.getItem('tuner.songs2')).find(r=>/Good Riddance/.test(r.title)).status)==='learned'&&await p.$eval('.seshero [data-st=learned]',e=>e.getAttribute('aria-pressed'))==='true','status is set on the page');
 await p.fill('#sesNotes','Strum D-DU-UDU, watch the Cadd9 change');await p.waitForTimeout(700);
 ok(await p.evaluate(()=>JSON.parse(localStorage.getItem('tuner.songs2')).find(r=>/Good Riddance/.test(r.title)).notes)==='Strum D-DU-UDU, watch the Cadd9 change','notes are saved in the song record');
 // jam along: guitars only
 await p.tap('[data-jam=gtr]');await p.waitForTimeout(800);
 const g=await p.evaluate(()=>window.__mx.gains());ok(g&&g[0]===1&&g[1]===0&&g[2]===0,'"Guitars only" opens the jam track with only the guitars up '+JSON.stringify(g));
 await p.evaluate(()=>{const x=document.getElementById('mxClose');if(x)x.click()});await p.waitForTimeout(300);
 await p.tap('[data-jam=drums]');await p.waitForTimeout(500);let g2=await p.evaluate(()=>window.__mx.gains());ok(JSON.stringify(g2)==='[0,1,0]','"Drums only (rhythm)" from the song session '+JSON.stringify(g2));
 await p.evaluate(()=>{const x=document.getElementById('mxClose');if(x)x.click()});await p.waitForTimeout(300);
 await p.tap('[data-jam=drumsvox]');await p.waitForTimeout(500);g2=await p.evaluate(()=>window.__mx.gains());ok(JSON.stringify(g2)==='[0,1,1]','"Drums + vocals" from the song session '+JSON.stringify(g2));
 await p.evaluate(()=>{const x=document.getElementById('mxClose');if(x)x.click()});await p.waitForTimeout(300);
 // chord finder
 await p.tap('#sesFind');await p.waitForTimeout(200);ok(await p.$eval('#cfWrap',e=>!e.hidden&&getComputedStyle(e).display!=='none'),'the chord finder opens from the session');
 await p.evaluate(()=>{const c=document.getElementById('cfClose')||document.querySelector('#cfWrap [aria-label=Close]');if(c)c.click()});await p.waitForTimeout(200);
 // back
 await p.tap('#paneSession [data-back]');await p.waitForTimeout(300);ok(await cur()==='learn','‹ goes back to Learn');
 await p.tap('#learnList .lrow:has-text("Wonderwall")');await p.waitForTimeout(300);
 ok(/Nothing to practise from yet/.test(await p.$eval('#sesBox',e=>e.textContent))&&!(await p.$('#sesGo')),'a song with nothing yet says so');
 await p.goBack();await p.waitForTimeout(300);ok(await cur()==='learn','the phone’s back button goes back to Learn');
 // a phone sheet: Practise opens it; capo shown
 await p.tap('#learnList .lrow:has-text("Creep")');await p.waitForTimeout(300);
 ok(/Capo 2/.test(await p.$eval('.seshero',e=>e.textContent))&&(await p.$$('.seschords .sesdg')).length===4,'a phone sheet gives the capo and its chords');
 await p.screenshot({path:path.join(OUT,'session.png'),fullPage:true});
 await p.tap('#sesGo');await p.waitForTimeout(300);ok(await p.$eval('#sheetView',e=>!e.hidden),'Practise opens the chord sheet');
 ok(!errs.length,'no page errors '+JSON.stringify(errs));
 console.log(fail?`${fail} FAILED`:'all passed');await b.close();srv.close();process.exit(fail?1:0)})();
