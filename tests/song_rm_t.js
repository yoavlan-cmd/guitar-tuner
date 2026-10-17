// Remove a song from my songs (Oct 2026): from the song's page; by default it's only hidden (everything kept, "Hidden songs" at the
// end of Learn shows it again, Undo too); "Also delete what's saved on this phone" deletes its jam track (parts, video, stills),
// chord analyses, phone sheets and video lesson links; Drive files stay (the song stays hidden then); kept after a reload;
// Home's "Back to your jam" leaves a hidden song out; adding the song again shows it again.
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
  S('sheetIndex',[{title:'Hallelujah',artist:'Leonard Cohen',capo:0,chords:['C','Am'],url:'https://drive.google.com/file/d/h1/view',at:'2026-10-12T05:50:07Z'}]);
  S('ideaOnIt',[{title:'Wonderwall',artist:'Oasis',at:Date.now()-5000},{title:'Hallelujah',artist:'Leonard Cohen',at:Date.now()-6000}]);
  S('vlinks',[{id:'v1',url:'https://youtu.be/abcdefghijk',key:'yt:abcdefghijk',yt:'abcdefghijk',src:'YouTube',title:'Good Riddance lesson',song:'Good Riddance',artist:'Green Day',at:Date.now()-1000}]);
  S('lib',[{id:'l1',name:'Good Riddance',saved:Date.now()-9000,data:{kind:'lyrics',title:'Good Riddance',artist:'Green Day',lc:[{t:'x',ch:{0:'G'}}],segs:[],play:{tun:'std',capo:0}}}]);
  S('song.mix_m1',{title:'Good Riddance - Green Day',artist:'Green Day',dur:10,bpm:100,offset:0,tuning:{id:'std'},segs:[[0,5,0],[5,10,8]],play:{tun:'std',capo:0},v:2,at:Date.now(),from:'guitars',mix:'m1'});S('songs',['mix_m1']);
 });
 await p.goto(APP);await p.waitForTimeout(400);
 await p.evaluate(async()=>{const n=44100,mk=()=>new Int16Array(n*2);await window.__bk.put('mixdata:m1',{len:n,sr:44100,tracks:[{id:'guitar',name:'Guitars',data:mk()},{id:'drums',name:'Drums',data:mk()}]});
  await window.__bk.put('mixvideo:m1',{blob:new Blob(['v'])});await window.__bk.put('mixIndex',[{id:'m1',name:'Green Day - Good Riddance',at:Date.now(),src:'phone',state:'ready'}])});
 await p.reload();await p.waitForTimeout(600);
 const rows=()=>p.$$eval('#learnList .lrow',l=>l.map(r=>r.querySelector('.ltxt b').textContent));
 const learn=async()=>{await p.evaluate(()=>window.__v2.goSec('learn'));await p.waitForTimeout(300)};
 const open=async t=>{await learn();await p.tap(`#learnList .lrow:has-text("${t}")`);await p.waitForTimeout(400)};
 await p.evaluate(()=>window.__v2.goSec('learn'));await p.evaluate(()=>window.__v2.goSec('home'));await p.waitForTimeout(300);console.log('  home:',await p.$eval('#homeCont',e=>e.textContent));
 ok(/Back to your jam/.test(await p.$eval('#homeCont',e=>e.textContent)),'Home: “Back to your jam” for Good Riddance');
 await learn();ok((await rows()).length===3,'three songs in Learn '+JSON.stringify(await rows()));
 // 1. hide (the default): kept, hidden, shown again; Undo
 await open('Wonderwall');ok(!!await p.$('#sesRm'),'a song’s page has “Remove from my songs”');
 await p.tap('#sesRm');await p.waitForTimeout(150);const txt=await p.$eval('.sesrm',e=>e.textContent);
 ok(/Nothing is deleted/.test(txt)&&/Hidden songs/.test(txt),'the confirm says nothing is deleted, and where to find it again');
 await p.tap('#rmGo');await p.waitForTimeout(400);
 ok(await p.evaluate(()=>window.__v2.cur())==='learn'&&!(await rows()).includes('Wonderwall'),'removed: back in Learn, Wonderwall isn’t listed');
 ok(/Hidden songs \(1\)/.test(await p.$eval('#learnHidT',e=>e.textContent)),'“Hidden songs (1)” at the end of Learn');
 await p.tap('#rmUndo');await p.waitForTimeout(300);ok((await rows()).includes('Wonderwall')&&!await p.$('#learnHidT'),'Undo puts it back');
 await open('Wonderwall');await p.tap('#sesRm');await p.tap('#rmGo');await p.waitForTimeout(400);
 await p.reload();await p.waitForTimeout(500);await learn();ok(!(await rows()).includes('Wonderwall'),'still hidden after a reload');
 await p.tap('#learnHidT');await p.waitForTimeout(150);await p.tap('[data-hshow="0"]');await p.waitForTimeout(300);
 ok((await rows()).includes('Wonderwall'),'“Show again” from Hidden songs puts it back');
 // 2. remove and delete the phone data: jam track (parts, video), analysis, phone sheet, lesson link
 await open('Good Riddance');await p.tap('#sesRm');await p.waitForTimeout(150);
 const what=await p.$eval('.rmdel',e=>e.textContent);console.log('  delete:',what.replace(/\s+/g,' ').trim());
 ok(/1 jam track/.test(what)&&/1 chord analysis/.test(what)&&/1 sheet saved on this phone/.test(what)&&/1 video lesson link/.test(what),'the confirm lists what would be deleted from the phone');
 await p.$eval('.sesrm',e=>e.scrollIntoView({block:'center'}));await p.screenshot({path:path.join(OUT,'song_rm_confirm.png')});
 await p.check('#rmDel');ok(await p.$eval('#rmGo',e=>e.textContent==='Remove and delete'&&e.classList.contains('rmdanger')),'ticking “Also delete” turns the button into “Remove and delete”');await p.tap('#rmGo');await p.waitForTimeout(800);
 const gone=await p.evaluate(async()=>({data:!!await window.__bk.get('mixdata:m1'),video:!!await window.__bk.get('mixvideo:m1'),idx:((await window.__bk.get('mixIndex'))||[]).length,
  ana:localStorage.getItem('tuner.song.mix_m1'),songs:JSON.parse(localStorage.getItem('tuner.songs')),lib:JSON.parse(localStorage.getItem('tuner.lib')).length,vl:JSON.parse(localStorage.getItem('tuner.vlinks')).length,hid:JSON.parse(localStorage.getItem('tuner.songHidden')||'[]').length}));
 console.log('  after:',JSON.stringify(gone));
 ok(!gone.data&&!gone.video&&gone.idx===0&&!gone.ana&&gone.songs.length===0&&gone.lib===0&&gone.vl===0,'its jam track (parts and video), analysis, phone sheet and lesson link are deleted');
 ok(!(await rows()).includes('Good Riddance')&&gone.hid===0,'nothing left for it: it isn’t kept as hidden (adding it again shows it)');
 ok(!/Back to your jam/.test(await p.evaluate(()=>{window.__v2.goSec('home');return document.getElementById('homeCont').textContent})),'Home: no “Back to your jam” for it');
 // 3. a song with a Drive sheet: deleting keeps the Drive file, so it stays, hidden
 await open('Hallelujah');await p.tap('#sesRm');await p.waitForTimeout(150);
 ok(/Files in your Google Drive stay where they are/.test(await p.$eval('.sesrm',e=>e.textContent)),'a song with Drive files: the confirm says they stay');
 if(await p.$('#rmDel'))await p.check('#rmDel');await p.tap('#rmGo');await p.waitForTimeout(500);
 ok(!(await rows()).includes('Hallelujah')&&JSON.parse(await p.evaluate(()=>localStorage.getItem('tuner.songHidden'))).some(h=>h.t==='Hallelujah'),'…it leaves the list and stays hidden (the Drive sheet is still there)');
 // its page from Hidden songs: "Show it in my songs again"
 await p.tap('#learnHidT');await p.waitForTimeout(150);await p.tap('[data-hopen="0"]');await p.waitForTimeout(400);
 ok(!!await p.$('#sesShow'),'a hidden song’s page offers “Show it in my songs again”');await p.tap('#sesShow');await p.waitForTimeout(200);await learn();
 ok((await rows()).includes('Hallelujah'),'…and it’s back');
 await p.screenshot({path:path.join(OUT,'song_rm.png'),fullPage:true});
 ok(!errs.length,'no page errors '+JSON.stringify(errs));
 console.log(fail?`${fail} FAILED`:'all passed');await b.close();srv.close();process.exit(fail?1:0)})();
