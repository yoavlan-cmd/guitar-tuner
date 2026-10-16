// Songs › My library › I'm learning: one row per song from every source, five tiles for what it has, filters, details, suggestions apart.
const {chromium,devices}=require('playwright');const path=require('path'),fs=require('fs'),http=require('http');
const ROOT=path.resolve(__dirname,'..');
const srv=http.createServer((q,r)=>{const f=path.join(ROOT,decodeURIComponent(q.url.split('?')[0]).replace(/\/$/,'/index.html'));fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);return r.end()}r.writeHead(200,{'content-type':/\.html$/.test(f)?'text/html':'application/octet-stream'});r.end(d)})}).listen(0);
const APP=process.env.APP||`http://localhost:${srv.address().port}/index.html`;
let fail=0;const ok=(c,m)=>{console.log((c?'ok  ':'FAIL')+' '+m);if(!c)fail++};
(async()=>{const b=await chromium.launch({...(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{})});
 const p=await (await b.newContext({...devices['Pixel 7']})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.route(/^https:\/\//,r=>r.abort());
 await p.route(/ideas\.json/,r=>r.abort());// keep the repo's real daily file out of this test
 await p.addInitScript(()=>{if(sessionStorage.x)return;sessionStorage.x=1;const S=(k,v)=>localStorage.setItem('tuner.'+k,JSON.stringify(v));
  S('userName','Yoav');
  S('sheetIndex',[{title:'Good Riddance (Time Of Your Life)',artist:'Green Day',capo:0,tuning:'Standard',chords:['G','C','D'],level:1,url:'https://drive.google.com/file/d/abc/view',at:'2026-10-12T05:50:07Z'}]);
  S('songIndex',{at:Date.now(),src:'daily',artists:['Green Day','Tuna'],songs:[{a:'Green Day',t:'Good Riddance (Time Of Your Life)',ch:[]},{a:'Tuna',t:'יא',ch:[]},{a:'Eviatar Banai',t:'עד מתי',ch:[]}]});
  S('vlinks',[{id:'v1',url:'https://youtu.be/abcdefghijk',key:'yt:abcdefghijk',yt:'abcdefghijk',src:'YouTube',title:'Good Riddance guitar lesson',song:'Good Riddance',artist:'Green Day',at:Date.now()-1000}]);
  S('ideaOnIt',[{title:'Wonderwall',artist:'Oasis',at:Date.now()-5000}]);
  S('lib',[{id:'l1',name:'עד מתי',saved:Date.now()-9000,data:{kind:'lyrics',title:'עד מתי',artist:'אביתר בנאי',lc:[{t:'שלום',ch:{0:'Am'}}],segs:[],play:{tun:'std',capo:0}}}]);
  S('ideas',{at:Date.now(),src:'daily',date:'2026-10-13',level:'',list:[{title:'Creep',artist:'Radiohead',style:'Rock',difficulty:2,chords:['G','B','C','Cm'],capo:0,tuning:'Standard',why:'x'}]});
 });
 await p.goto(APP);await p.waitForTimeout(400);await p.waitForSelector('#wSkip',{state:'visible',timeout:2000}).then(()=>p.tap('#wSkip')).catch(()=>{});
 // a practice-mixer split named the way files usually are: "Artist - Song"
 await p.evaluate(async()=>{const M=window.__mxTest;await M.put('mixdata:m1',{len:10,sr:44100,tracks:[]});M.add({id:'m1',name:'Green Day - Good Riddance',at:Date.now(),src:'cloud',state:'ready'})});
 await p.tap('[data-tab=song]');await p.waitForTimeout(300);
 const grab=()=>p.$$eval('#learnList .lrow',l=>l.map(r=>({t:r.querySelector('b').textContent,a:r.querySelector('small').textContent,lit:r.querySelectorAll('.lres .pd:not(.off),.lres .ltag:not(.none)').length,label:r.querySelector('.lres').getAttribute('aria-label')})));
 // one language at a time: Hebrew or English (a switch, one always chosen)
 await p.tap('[data-lang=en]');const en=await grab();await p.tap('[data-lang=he]');const he=await grab();await p.tap('[data-lang=en]');
 const rows=en.concat(he);
 ok(en.length===2&&he.length===2&&en.every(r=>!/[\u0590-\u05FF]/.test(r.t))&&he.every(r=>/[\u0590-\u05FF]/.test(r.t)),`the language switch shows English songs (${en.map(r=>r.t)}) or Hebrew songs (${he.map(r=>r.t)}), never mixed`);
 ok(await p.evaluate(()=>JSON.parse(localStorage.getItem('tuner.learnLang')))==='en','the chosen language is remembered');
 console.log(JSON.stringify(rows));
 const gr=rows.filter(r=>/good riddance/i.test(r.t));
 ok(rows.length===4,`four songs in I'm learning (${rows.map(r=>r.t).join(' / ')})`);
 ok(gr.length===1&&gr[0].lit===4,`Good Riddance is one row with sheet, folder, lesson and mixer lit (${gr[0]&&gr[0].label})`);
 ok(rows.some(r=>r.t==='Wonderwall'&&r.lit===0),'a song marked "On it" shows with nothing lit yet');
 ok(rows.filter(r=>r.t==='עד מתי').length===1&&rows.some(r=>r.t==='עד מתי'&&r.lit===2),'a phone sheet (אביתר בנאי) and a Drive file (Eviatar Banai) of the same song are one row');
 ok(rows.some(r=>r.t==='יא'&&/Drive sheets/.test(r.label)),'a song only in the Drive folder shows the folder tile');
 // filters: lesson → have it → missing → off
 await p.tap('[data-lf=lesson]');let n=await p.$$eval('#learnList .lrow',l=>l.map(r=>r.querySelector('b').textContent));
 ok(n.length===1&&/Good Riddance/.test(n[0]),`"Video lesson · have it" shows only Good Riddance (${n})`);
 await p.tap('[data-lf=lesson]');n=await p.$$eval('#learnList .lrow',l=>l.length);ok(n===1,`"Video lesson · missing" shows the other English song (${n})`);
 await p.tap('[data-lf=lesson]');n=await p.$$eval('#learnList .lrow',l=>l.length);ok(n===2,'third tap clears the filter');
 // search
 await p.fill('#learnQ','oasis');n=await p.$$eval('#learnList .lrow',l=>l.map(r=>r.querySelector('b').textContent));ok(n.length===1&&n[0]==='Wonderwall','search finds by artist');await p.fill('#learnQ','');
 // details: a song opens its song session, which lists what it has and what's missing
 await p.tap('#learnList .lrow:has-text("Good Riddance")');await p.waitForTimeout(200);
 const det=await p.$eval('#sesBox .ldet',d=>d.innerText.replace(/\s+/g,' '));console.log('detail:',det);
 ok(/Guitaring sheet in Drive/.test(det)&&/Watch/.test(det)&&/Split on GitHub/.test(det)&&/No chords from a video yet/.test(det),'details list what it has and what is missing');
 await p.tap('#paneSession [data-back]');await p.waitForTimeout(200);await p.tap('#learnList .lrow:has-text("Wonderwall")');await p.waitForTimeout(200);
 const det2=await p.$eval('#sesBox .ldet',d=>d.innerText.replace(/\s+/g,' '));
 ok(/No chord sheet yet/.test(det2)&&/Write it/.test(det2)&&/Not learning it any more/.test(det2),'an "On it" song offers to write the sheet, find a lesson, or drop it');
 await p.tap('#sesBox [data-la=drop]');await p.waitForTimeout(200);n=await p.$$eval('#learnList .lrow',l=>l.map(r=>r.querySelector('b').textContent));ok(!n.includes('Wonderwall'),'"Not learning it any more" removes it');
 // opening a phone sheet from the list
 await p.tap('[data-lang=he]');await p.tap('#learnList .lrow:has-text("עד מתי")');await p.waitForTimeout(200);await p.tap('#sesBox .ldet [data-la=lib]');await p.waitForTimeout(300);
 ok(await p.$eval('#sheetView',e=>!e.hidden),'Open on a phone sheet shows the chord sheet');
 await p.tap('[data-tab=tune]');await p.tap('[data-tab=song]');await p.waitForTimeout(200);
 // suggestions sit in their own card, closed; the Add part hides both
 ok(await p.$eval('#suggCard',e=>getComputedStyle(e).display!=='none'&&!!e.querySelector('#ideaBox')&&!e.querySelector('#ideaBox').open),'suggestions are their own card, closed until opened');
 ok(!(await p.$eval('#ideaBox',e=>e.innerHTML)).includes('data-unwant'),'suggestions no longer repeat the I\'m learning list');
 await (await p.$('#bnav')?p.tap('#bnav [data-sec=write]'):p.tap('#songSeg [data-s=add]'));ok(await p.$eval('#libCard',e=>getComputedStyle(e).display==='none')&&await p.$eval('#suggCard',e=>getComputedStyle(e).display==='none'),'Write (Add a song before V2) hides the library and the suggestions');
 await (await p.$('#bnav')?p.tap('#bnav [data-sec=learn]'):p.tap('#songSeg [data-s=lib]'));
 await p.screenshot({path:path.join(__dirname,'out','learn.png'),fullPage:true});
 ok(!errs.length,'no page errors '+JSON.stringify(errs));
 console.log(fail?`${fail} FAILED`:'all passed');await b.close();srv.close();process.exit(fail?1:0)})();
