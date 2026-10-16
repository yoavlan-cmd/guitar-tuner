// V2 phase 2: song records (tuner.songs2, migration M2) and My learning library. M2 makes one record per learning-list song that only
// points to the V1 data (same rows before and after, every item linked to exactly one record, V1 keys unchanged, a safety copy first,
// runs once); status (learning / learned / idea) and artist filters; a song added later gets its record when touched; My Library links to it;
// the backup file carries the records.
const {chromium,devices}=require('playwright');const path=require('path'),fs=require('fs'),http=require('http');
const ROOT=path.resolve(__dirname,'..');
const srv=http.createServer((q,r)=>{const f=path.join(ROOT,decodeURIComponent(q.url.split('?')[0]).replace(/\/$/,'/index.html'));fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);return r.end()}r.writeHead(200,{'content-type':/\.html$/.test(f)?'text/html':'application/octet-stream'});r.end(d)})}).listen(0);
const APP=process.env.APP||`http://localhost:${srv.address().port}/index.html`;
let fail=0;const ok=(c,m)=>{console.log((c?'ok  ':'FAIL')+' '+m);if(!c)fail++};
const V1=['sheetIndex','songIndex','vlinks','ideaOnIt','lib','userName'];
(async()=>{const b=await chromium.launch({...(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{})});
 const ctx=await b.newContext({...devices['Pixel 7']});await ctx.route(/^https:\/\//,r=>r.abort());await ctx.route(/ideas\.json/,r=>r.abort());
 const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.addInitScript(()=>{if(sessionStorage.x)return;sessionStorage.x=1;const S=(k,v)=>localStorage.setItem('tuner.'+k,JSON.stringify(v));
  S('userName','Yoav');S('profile',{name:'Yoav',onboarding:{done:true}});
  S('sheetIndex',[{title:'Good Riddance (Time Of Your Life)',artist:'Green Day',capo:0,tuning:'Standard',chords:['G','C','D'],level:1,url:'https://drive.google.com/file/d/abc/view',at:'2026-10-12T05:50:07Z'}]);
  S('songIndex',{at:Date.now(),src:'daily',artists:['Green Day','Tuna'],songs:[{a:'Green Day',t:'Good Riddance (Time Of Your Life)',ch:[]},{a:'Tuna',t:'יא',ch:[]},{a:'Eviatar Banai',t:'עד מתי',ch:[]}]});
  S('vlinks',[{id:'v1',url:'https://youtu.be/abcdefghijk',key:'yt:abcdefghijk',yt:'abcdefghijk',src:'YouTube',title:'Good Riddance guitar lesson',song:'Good Riddance',artist:'Green Day',at:Date.now()-1000}]);
  S('ideaOnIt',[{title:'Wonderwall',artist:'Oasis',at:Date.now()-5000}]);
  S('lib',[{id:'l1',name:'עד מתי',saved:Date.now()-9000,data:{kind:'lyrics',title:'עד מתי',artist:'אביתר בנאי',lc:[{t:'שלום',ch:{0:'Am'}}],segs:[],play:{tun:'std',capo:0}}}]);
 });
 await p.goto(APP);await p.waitForTimeout(400);
 // a jam track, there before the update (M2 waits for the jam list)
 await p.evaluate(async()=>{await window.__bk.put('mixdata:m1',{len:10,sr:44100,tracks:[]});await window.__bk.put('mixIndex',[{id:'m1',name:'Green Day - Good Riddance',at:Date.now(),src:'cloud',state:'ready'}]);
  const l=JSON.parse(localStorage.getItem('tuner.v2mig')||'{"done":[]}');l.done=l.done.filter(x=>x!=='M2');localStorage.setItem('tuner.v2mig',JSON.stringify(l));localStorage.removeItem('tuner.songs2')});
 const v1=()=>p.evaluate(K=>K.map(k=>localStorage.getItem('tuner.'+k)).join('\n'),V1);const before=await v1();
 const safe0=await p.evaluate(async()=>(await window.__bk.keys()).filter(k=>/^backup:pre-M2:/.test(k)).length);
 await p.reload();await p.waitForFunction(()=>(JSON.parse(localStorage.getItem('tuner.v2mig')||'{}').done||[]).includes('M2'),null,{timeout:5000}).catch(()=>{});
 const st=await p.evaluate(async()=>({recs:JSON.parse(localStorage.getItem('tuner.songs2')||'null'),log:JSON.parse(localStorage.getItem('tuner.v2mig')||'{}'),safe:(await window.__bk.keys()).filter(k=>/^backup:pre-M2:/.test(k)).length}));
 await p.tap('#bnav [data-sec=learn]');await p.waitForTimeout(300);
 const rows=()=>p.$$eval('#learnList .lrow',l=>l.map(r=>r.querySelector('b').textContent));
 await p.tap('[data-lang=en]');const r0=(await rows()).concat(await p.tap('[data-lang=he]').then(rows));await p.tap('[data-lang=en]');
 ok(st.log.done&&st.log.done.includes('M2')&&!st.log.warn,'M2 ran and passed its check '+JSON.stringify(st.log.report&&st.log.report.M2||st.log.warn));
 ok(st.recs&&st.recs.length===r0.length&&r0.length===4,`one record per song in the list (${st.recs&&st.recs.length} records, ${r0.length} rows)`);
 const gr=(st.recs||[]).find(r=>/Good Riddance/.test(r.title));
 ok(gr&&gr.links.sheets.length===1&&gr.links.folder&&gr.links.videos[0]==='https://youtu.be/abcdefghijk'&&gr.links.jam[0]==='m1','a record points to its sheet, Drive folder file, video lesson and jam track '+JSON.stringify(gr&&gr.links));
 const em=(st.recs||[]).find(r=>r.title==='עד מתי');ok(em&&em.links.sheets[0].lib==='l1'&&em.links.folder,'the phone sheet and the Drive file of the same song share one record');
 ok((st.recs||[]).every(r=>r.status==='learning'&&/^s_/.test(r.id)),'every song starts as "learning"');
 ok(await v1()===before,'nothing in the V1 data changed');
 ok(st.safe===safe0+1,'a safety copy was taken before writing');
 // runs once
 await p.reload();await p.waitForTimeout(600);ok(await p.evaluate(()=>localStorage.getItem('tuner.songs2'))===JSON.stringify(st.recs),'running again changes nothing');
 // status
 await p.tap('#bnav [data-sec=learn]');await p.waitForTimeout(200);
 await p.tap('#learnList .lrow:has-text("Good Riddance")');await p.tap('.ldet [data-la=st][data-v=learned]');await p.waitForTimeout(150);
 ok(await p.evaluate(()=>JSON.parse(localStorage.getItem('tuner.songs2')).find(r=>/Good Riddance/.test(r.title)).status)==='learned'&&/Learned/i.test(await p.$eval('#learnList .lrow:has-text("Good Riddance")',e=>e.textContent)),'"Learned" is saved and shown on the row');
 await p.tap('#learnList .lrow:has-text("Wonderwall")');await p.tap('.ldet [data-la=st][data-v=idea]');await p.waitForTimeout(150);
 await p.tap('[data-ls=learned]');let n=await rows();ok(n.length===1&&/Good Riddance/.test(n[0]),`filter Learned (${n})`);
 await p.tap('[data-ls=idea]');n=await rows();ok(n.length===1&&n[0]==='Wonderwall',`filter Ideas (${n})`);
 await p.tap('[data-ls=learning]');n=await rows();ok(n.length===0,`filter Learning: no English song left (${n})`);
 await p.tap('[data-lang=he]');n=await rows();ok(n.length===2,`filter Learning in Hebrew (${n})`);
 await p.tap('[data-ls=""]');n=await rows();ok(n.length===2,'All shows every Hebrew song');
 await p.tap('[data-lang=en]');await p.tap('#learnList .lrow:has-text("Good Riddance")');await p.screenshot({path:path.join(__dirname,'out','lib2.png'),fullPage:true});await p.tap('#learnList .lrow:has-text("Good Riddance")');
 // artist
 await p.selectOption('#learnArt',{label:'Oasis (1)'});n=await rows();ok(n.length===1&&n[0]==='Wonderwall',`filter by artist (${n})`);await p.selectOption('#learnArt','');await p.tap('[data-lang=en]');
 // a song added after M2: shows at once, gets a record when touched
 await p.evaluate(()=>{const v=JSON.parse(localStorage.getItem('tuner.vlinks'));v.push({id:'v2',url:'https://youtu.be/bbbbbbbbbbb',key:'yt:bbbbbbbbbbb',yt:'bbbbbbbbbbb',src:'YouTube',title:'Creep lesson',song:'Creep',artist:'Radiohead',at:Date.now()});localStorage.setItem('tuner.vlinks',JSON.stringify(v))});
 await p.tap('#bnav [data-sec=write]');await p.tap('#bnav [data-sec=learn]');await p.waitForTimeout(200);
 n=await rows();const c0=await p.evaluate(()=>JSON.parse(localStorage.getItem('tuner.songs2')).length);
 ok(n.includes('Creep')&&c0===4,'a new song shows up before it has a record');
 await p.tap('#learnList .lrow:has-text("Creep")');await p.tap('.ldet [data-la=st][data-v=learned]');await p.waitForTimeout(150);
 const cr=await p.evaluate(()=>JSON.parse(localStorage.getItem('tuner.songs2')).find(r=>r.title==='Creep'));
 ok(cr&&cr.status==='learned'&&cr.links.videos[0]==='https://youtu.be/bbbbbbbbbbb','…and gets one the first time it is touched');
 // My Library
 await p.tap('#hLib');await p.waitForTimeout(200);const sub=await p.$eval('#libLearnSub',e=>e.textContent);
 ok(/5 songs · 2 learned/.test(sub),'My Library shows the learning songs ('+sub+')');
 await p.tap('.libgo[data-sec=learn]');await p.waitForTimeout(200);ok(await p.evaluate(()=>window.__v2.cur())==='learn','…and opens them');
 // the backup carries the records
 const inBk=await p.evaluate(async()=>{const {zip}=await window.__bk.make({parts:false,keys:false});const o=await window.__bk.open(zip);return JSON.parse(await o.txt('local.json'))['tuner.songs2']||''});
 ok(/Creep/.test(inBk),'the backup file holds the song records');
 // "Undo the new version's data" removes the records too (the update then runs again from the V1 data)
 await p.tap('#hMe');await p.evaluate(()=>{document.getElementById('v2Box').open=true});ok(/5 songs got a record|songs got a record/.test(await p.$eval('#v2Box',e=>e.textContent)),'My profile says what M2 did');
 const nav=p.waitForEvent('load',{timeout:8000}).catch(()=>{});await p.tap('#v2Undo');await p.tap('#v2Undo');await nav;
 await p.waitForFunction(()=>(JSON.parse(localStorage.getItem('tuner.v2mig')||'{}').done||[]).includes('M2'),null,{timeout:5000}).catch(()=>{});
 ok(await p.evaluate(()=>JSON.parse(localStorage.getItem('tuner.songs2')||'[]').every(r=>r.status==='learning')),'undo removes the statuses (records rebuilt fresh)');
 ok(!errs.length,'no page errors '+JSON.stringify(errs));
 console.log(fail?`${fail} FAILED`:'all passed');await b.close();srv.close();process.exit(fail?1:0)})();
