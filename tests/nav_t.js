// V2 navigation: every V1 feature is reachable in the new structure (nothing silently disappears), the tuner opens in one tap from
// every section and stops listening when closed, header pages close with ✕ / ‹ and the phone's back button, and the app opens on Home.
const {chromium,devices}=require('playwright');const path=require('path'),fs=require('fs'),http=require('http');
const ROOT=path.resolve(__dirname,'..'),OUT=path.join(__dirname,'out');fs.mkdirSync(OUT,{recursive:true});
const srv=http.createServer((q,r)=>{const f=path.join(ROOT,decodeURIComponent(q.url.split('?')[0]).replace(/\/$/,'/index.html'));fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);return r.end()}r.writeHead(200,{'content-type':/\.html$/.test(f)?'text/html':'application/octet-stream'});r.end(d)})}).listen(0);
const APP=process.env.APP||`http://localhost:${srv.address().port}/index.html`;
let fail=0;const ok=(c,m)=>{console.log((c?'ok  ':'FAIL')+' '+m);if(!c)fail++};
(async()=>{const b=await chromium.launch({...(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{}),args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream']});
 const ctx=await b.newContext({...devices['Pixel 7']});await ctx.route(/^https:\/\//,r=>r.abort());await ctx.route(/ideas\.json/,r=>r.abort());
 const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.addInitScript(()=>{if(sessionStorage.x)return;sessionStorage.x=1;const S=(k,v)=>localStorage.setItem('tuner.'+k,JSON.stringify(v));
  S('userName','Yoav');S('profile',{name:'Yoav',onboarding:{done:true}});
  S('sheetIndex',[{title:'Good Riddance',artist:'Green Day',capo:0,tuning:'Standard',chords:['G','C','D'],level:1,url:'https://drive.google.com/file/d/abc/view',at:'2026-10-12T05:50:07Z'}]);
  S('writeDraft',{kind:'lyrics',title:'My draft song',lyrics:'la la',lc:[{t:'la la',ch:{}}],segs:[],play:{tun:'std',capo:0},edited:Date.now()});
  S('chordbook',{Am:{added:1,songs:[]}})});
 await p.goto(APP);await p.waitForTimeout(500);
 const vis=sel=>p.$eval(sel,e=>{const r=e.getBoundingClientRect(),cs=getComputedStyle(e);return r.width>0&&r.height>0&&cs.visibility!=='hidden'&&!e.closest('[hidden]')}).catch(()=>false);
 const sec=()=>p.evaluate(()=>window.__v2.cur());
 ok(await sec()==='home'&&await vis('#paneHome')&&!(await vis('#paneTune')),'the app opens on Home (not the tuner)');
 ok(/Hey, Yoav\./.test(await p.$eval('#homeHero',e=>e.textContent))&&(await p.$eval('#hJoke',e=>e.textContent)).length>20,'Home: greeting by name and a joke');
 const j1=await p.$eval('#hJoke',e=>e.textContent);await p.tap('#hMore');ok(await p.$eval('#hJoke',e=>e.textContent)!==j1,'Home: "Another one" changes the joke');
 ok(/Continue your sheet/.test(await p.$eval('#homeCont',e=>e.textContent)),'Home: Continue shortcut to the unfinished sheet');
 ok((await p.$$('.hometiles .htile')).length===4,'Home: the four sections as tiles');
 // every V1 feature, in its V2 place: [what, how to get there, what must be visible]
 const go=async s=>{if(s==='tuner')await p.tap('#hTuner');else if(s==='library')await p.tap('#hLib');else if(s==='profile')await p.tap('#hMe');else if(s==='chords'){await p.tap('#hLib');await p.tap('.libgo[data-sec=chords]')}else await p.tap(`#bnav [data-sec=${s}]`);await p.waitForTimeout(150)};
 const FEATURES=[
  ['Tuner (meter, pegs, Listen)','tuner',['#screen','#strings','#listen']],
  ['Tunings','tuner',['#tunings']],
  ['Song video → chords','learn',['#drop']],
  ['I’m learning list','learn',['#learnBox']],
  ['New songs to learn (daily ideas)','learn',['#ideaBox']],
  ['Write a sheet','write',['#writeNew']],
  ['Sheet from screenshots or PDF','write',['#shotNew']],
  ['Chord finder','write',['#findNew']],
  ['Chord finder in Learn too','learn',['#findNew']],
  ['Unfinished sheet (draft)','write',['#draftCard']],
  ['Band breakdown','jam',['#mixNew']],
  ['Jamming player','jam',['#jamOpen']],
  ['My gear','gear',['#gearOut']],
  ['Chord book','chords',['#chGrid','#chSearch']],
  ['Chord finder from the chord book','chords',['#chFind']],
  ['My chord sheets (catalog)','library',['#catBox']],
  ['My video lessons','library',['#vidBox']],
  ['Saved on this phone','library',['#libSaved']],
  ['Claude features','profile',['#apiCard']],
  ['Songs folder link','profile',['#folderCfg']],
  ['GitHub for Band breakdown','profile',['#ghCfg']],
  ['Backup and restore','profile',['#bkBox']],
  ['My profile answers','profile',['#profCard']]];
 for(const [what,where,sels] of FEATURES){await p.evaluate(()=>window.__v2.goSec('home'));await go(where);
  let seen=true;for(const s of sels){let any=false;for(const one of s.split(','))if(await vis(one.trim()))any=true;if(!any){seen=false;console.log('   not visible:',s)}}
  ok(seen,`${what}: reachable in ${where}`)}
 // a feature actually works from its new place
 await go('write');await p.tap('#findNew');await p.waitForTimeout(200);ok(await vis('#cfWrap'),'the chord finder opens from Write');await p.evaluate(()=>{const c=document.getElementById('cfClose')||document.querySelector('#cfWrap [aria-label=Close]');if(c)c.click()});
 await go('library');await p.evaluate(()=>{const d=document.getElementById('libSaved');d.open=true});ok(await vis('#libList'),'Saved on this phone opens in My Library');
 // every open list can be closed: ✕ on its title (stays on top) and Close at the bottom
 await p.tap('#vidBox>summary');await p.waitForTimeout(150);ok(await vis('#vidBox>.foldx'),'an open list has a Close button at the bottom');
 await p.tap('#vidBox>.foldx');await p.waitForTimeout(150);ok(!(await p.$eval('#vidBox',e=>e.open)),'Close closes it');
 await p.tap('#vidBox>summary');await p.evaluate(()=>window.scrollBy(0,400));await p.waitForTimeout(100);
 ok(await p.$eval('#vidBox>summary',e=>getComputedStyle(e).position==='sticky'&&getComputedStyle(e,'::after').content.includes('✕')),'its title stays at the top with a ✕');
 await p.tap('#vidBox>summary');ok(!(await p.$eval('#vidBox',e=>e.open)),'tapping the title (✕) closes it');
 // the tuner: one tap from every section; closing stops listening
 for(const s of ['home','learn','write','jam','gear']){await p.evaluate(x=>window.__v2.goSec(x),s);await p.tap('#hTuner');await p.waitForTimeout(100);
  const shown=await vis('#screen');await p.tap('#paneTune [data-back]');await p.waitForTimeout(250);ok(shown&&await sec()===s,`tuner opens in one tap from ${s} and ✕ goes back to ${s}`)}
 await p.tap('#hTuner');await p.tap('#listen');await p.waitForTimeout(800);
 const isOn=()=>p.evaluate(()=>!/^Listen$/.test(document.getElementById('listenTxt').textContent.trim()));const lis=await isOn();
 await p.tap('#paneTune [data-back]');await p.waitForTimeout(300);
 const lis2=await isOn();
 ok(lis===true&&lis2===false,`closing the tuner stops listening (was ${lis}, now ${lis2})`);
 // header pages: the phone's back button
 await p.evaluate(()=>window.__v2.goSec('jam'));await p.tap('#hLib');await p.goBack();await p.waitForTimeout(300);ok(await sec()==='jam','back button closes My Library and returns to Jam');
 await p.tap('#hMe');await p.tap('#paneProfile [data-back]');await p.waitForTimeout(300);ok(await sec()==='jam','‹ closes My profile');
 await p.tap('#hLib');await p.tap('.libgo[data-sec=chords]');await p.tap('#paneChords [data-back]');await p.waitForTimeout(300);ok(await sec()==='library','‹ in My chords goes back to My Library');
 // the bottom bar marks the section; tapping around doesn't jump the page
 await p.tap('#bnav [data-sec=gear]');ok(await p.$eval('#bnav [data-sec=gear]',e=>e.getAttribute('aria-current'))==='page','the bottom bar marks the current section');
 await p.tap('#bnav [data-sec=learn]');await p.evaluate(()=>window.scrollTo(0,600));const y0=await p.evaluate(()=>scrollY);await p.tap('#learnBox',{position:{x:5,y:5}}).catch(()=>{});
 ok(await p.evaluate(()=>scrollY)>0||y0===0,'tapping inside a page doesn’t scroll it back to the top');
 // nothing in the app still opens the old tab bar
 ok(!(await p.$('#tabs')),'the old tab bar is gone');
 await p.evaluate(()=>window.__v2.goSec('home'));await p.screenshot({path:path.join(OUT,'nav_home.png')});
 // a link shared into the app (Share › Guitaring) opens My Library with the video-lesson form, even on a first open (setup waits)
 const c2=await b.newContext({...devices['Pixel 7']});await c2.route(/^https:\/\//,r=>r.abort());const p2=await c2.newPage();p2.on('pageerror',e=>errs.push(e.message));
 await p2.goto(APP+'?text='+encodeURIComponent('Great lesson https://youtu.be/ddddddddddd'));await p2.waitForTimeout(1200);
 const sh=await p2.evaluate(()=>({sec:window.__v2.cur(),open:document.getElementById('vidBox').open,form:!!document.getElementById('vlSong'),onb:!document.getElementById('onb').hidden,clean:!location.search}));
 ok(sh.sec==='library'&&sh.open&&sh.form&&!sh.onb&&sh.clean,'a shared link opens My Library with the lesson form, and the setup waits '+JSON.stringify(sh));await c2.close();
 ok(!errs.length,'no page errors '+JSON.stringify(errs));
 console.log(fail?`${fail} FAILED`:'all passed');await b.close();srv.close();process.exit(fail?1:0)})();
