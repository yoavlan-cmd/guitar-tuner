// Jam: Band breakdown only creates a new split (a song on the phone, a song in Google Drive, the slow on-phone split, the
// GitHub connection, and what is being split); the Jamming player is the one place to pick a split song (its list, nothing to
// create there); no song list on the Jam page; My Library › My jam tracks opens the player.
const {chromium}=require('playwright');const path=require('path'),fs=require('fs'),http=require('http');
const ROOT=path.resolve(__dirname,'..'),OUT=path.join(__dirname,'out');fs.mkdirSync(OUT,{recursive:true});
const srv=http.createServer((q,r)=>{const f=path.join(ROOT,decodeURIComponent(q.url.split('?')[0]).replace(/\/$/,'/index.html'));fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);return r.end()}r.writeHead(200,{'content-type':/\.html$/.test(f)?'text/html':'application/octet-stream'});r.end(d)})}).listen(0);
const APP=process.env.APP||`http://localhost:${srv.address().port}/index.html`;
let fail=0;const ok=(c,m)=>{console.log((c?'ok  ':'FAIL')+' '+m);if(!c)fail++};
(async()=>{const b=await chromium.launch({...(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{})});
 const ctx=await b.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});await ctx.route(/^https:\/\//,r=>r.abort());await ctx.route(/ideas\.json/,r=>r.abort());
 const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.addInitScript(()=>{window.__mxPollMs=1e9;if(sessionStorage.x)return;sessionStorage.x=1;localStorage.setItem('tuner.userName','"Yoav"');localStorage.setItem('tuner.profile',JSON.stringify({name:'Yoav',onboarding:{done:true}}))});
 await p.goto(APP);await p.waitForTimeout(400);
 const vis=s=>p.$eval(s,e=>!!e.offsetWidth&&!e.closest('[hidden]')).catch(()=>false);
 // no songs yet
 await p.tap('#bnav [data-sec=jam]');await p.waitForTimeout(200);
 ok(await vis('#mixNew')&&await vis('#jamOpen')&&!(await p.$('#jamBox')),'Jam: the Band breakdown and Jamming player tiles, no song list on the page');
 await p.tap('#jamOpen');await p.waitForTimeout(200);
 ok(/Your split songs/i.test(await p.$eval('#mixView',e=>e.textContent))&&/No split songs yet/.test(await p.$eval('#mixView',e=>e.textContent)),'the player with no songs says so');
 await p.tap('#mxToCreate');await p.waitForTimeout(150);ok(/Split a new song/.test(await p.$eval('#mixView',e=>e.textContent)),'…and points to Band breakdown');
 ok(/one-time setup/.test(await p.$eval('#mixView',e=>e.textContent)),'without GitHub, Band breakdown mentions the one-time setup');
 await p.tap('#mxClose');await p.waitForTimeout(300);
 // songs: two ready, one being split, one failed
 await p.evaluate(async()=>{localStorage.setItem('guitaring.gh',JSON.stringify({repo:'me/split',token:'t',branch:'main'}));const n=44100*3,mk=()=>new Int16Array(n*2);
  await window.__bk.put('mixdata:a1',{len:n,sr:44100,tracks:[{id:'guitar',name:'Guitars',data:mk()},{id:'drums',name:'Drums',data:mk()}]});await window.__bk.put('mixdata:a2',{len:n,sr:44100,tracks:[{id:'guitar',name:'Guitars',data:mk()}]});
  await window.__bk.put('mixIndex',[{id:'a1',name:'Green Day - Good Riddance',at:3,src:'cloud',state:'ready'},{id:'a2',name:'Tuna - Ya',at:2,src:'cloud',state:'ready'},{id:'p1',name:'Oasis - Wonderwall',at:Date.now(),src:'cloud',state:'wait',sent:Date.now(),drive:{file:'x',folder:'f'}},{id:'f1',name:'Radiohead - Creep',at:1,src:'cloud',state:'failed',err:'The split stopped on GitHub.'}])});
 await p.reload();await p.waitForTimeout(600);await p.tap('#bnav [data-sec=jam]');await p.waitForTimeout(200);
 ok(/2 split songs: pick one and play/.test(await p.$eval('#jamOpen',e=>e.textContent))&&/1 being split/.test(await p.$eval('#mixNew',e=>e.textContent)),'the tiles say what’s ready to play and what’s being split');
 // Band breakdown: creation only
 await p.tap('#mixNew');await p.waitForTimeout(200);const bd=await p.$eval('#mixView',e=>e.innerText.replace(/\s+/g,' '));console.log('  breakdown:',bd.slice(0,300));
 ok(/Split a new song/i.test(bd)&&await vis('#mxcPhone')&&await vis('#mxcDrive')&&await vis('#mxLocal')&&await vis('#mxGhEdit'),'Band breakdown: a song on this phone, a song in Google Drive, the slow on-phone split, the GitHub connection');
 ok(!(await p.$('#mixView [data-open]'))&&!/Good Riddance/.test(bd),'Band breakdown lists no songs to play');
 ok(/Being split/i.test(bd)&&/Wonderwall/.test(bd)&&/Creep/.test(bd)&&!!await p.$('#mixView [data-dsprog="p1"]')&&!!await p.$('#mixView [data-retry="f1"]'),'it shows what’s being split (with its progress) and what failed (Try again)');
 await p.screenshot({path:path.join(OUT,'jam_breakdown.png')});
 await p.tap('#mxcDrive');await p.waitForTimeout(200);ok(await vis('#dsL1'),'"A song in your Google Drive" opens the Drive form');await p.tap('#dsX');
 // the player: the only place to pick
 await p.tap('#jamOpen');await p.waitForTimeout(200);const pl=await p.$eval('#mixView',e=>e.innerText.replace(/\s+/g,' '));
 ok(/Your split songs/i.test(pl)&&(await p.$$('#mixView [data-open]')).length===4&&!(await p.$('#mxcPhone'))&&!(await p.$('#mxAdd'))&&!/Split a new song/i.test(pl),'the player: the list of split songs, nothing to create');
 await p.screenshot({path:path.join(OUT,'jam_player.png')});
 await p.tap('#mixView [data-open="a1"]');await p.waitForTimeout(600);
 ok(!!await p.$('#mxRows')&&/Your split songs \(4\): play another/.test(await p.$eval('#mxMore summary',e=>e.textContent)),'a song opens in the player, which keeps the list to play another');
 await p.tap('#mxClose');await p.waitForTimeout(300);
 // My Library › My jam tracks opens the player
 await p.tap('#hLib');await p.waitForTimeout(200);await p.tap('.libgo[data-sec=jam]');await p.waitForTimeout(400);
 ok(await p.evaluate(()=>window.__v2.cur())==='jam'&&await vis('#mxSheet')&&!!await p.$('#mixView [data-open], #mxRows'),'My Library › My jam tracks opens the player');
 ok(!errs.length,'no page errors '+JSON.stringify(errs));
 console.log(fail?`${fail} FAILED`:'all passed');await b.close();srv.close();process.exit(fail?1:0)})();
