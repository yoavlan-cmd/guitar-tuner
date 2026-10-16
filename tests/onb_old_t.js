// Onboarding, existing player (data from V1): the profile is filled in from what the app knows (M1), only the screens with gaps
// are asked, V1 data is not changed, a safety copy is kept, the migration is logged and runs once (also after a reload or a
// half-finished first run), and "Undo the new version's data" removes only V2's data.
const {chromium,devices}=require('playwright');const path=require('path'),fs=require('fs'),http=require('http');
const ROOT=path.resolve(__dirname,'..');
const srv=http.createServer((q,r)=>{const f=path.join(ROOT,decodeURIComponent(q.url.split('?')[0]).replace(/\/$/,'/index.html'));fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);return r.end()}r.writeHead(200,{'content-type':/\.html$/.test(f)?'text/html':'application/octet-stream'});r.end(d)})}).listen(0);
const APP=process.env.APP||`http://localhost:${srv.address().port}/index.html`;
let fail=0;const ok=(c,m)=>{console.log((c?'ok  ':'FAIL')+' '+m);if(!c)fail++};
const V1={userName:'Yoav',ideaPrefs:{lang:'both',bands:['Radiohead'],styles:['folder']},taste:'Acoustic covers',
 instruments:[{id:'m1',type:'electric',name:'Muse',brand:'Epiphone'},{id:'t1',type:'electroacoustic',name:'Taylor'},{id:'a1',type:'elamp',name:'Catalyst'}],
 songIndex:{artists:['Tuna','Mashina','Green Day'],songs:[{a:'Tuna',t:'יא'},{a:'Tuna',t:'שיר'},{a:'Mashina',t:'רכבת'},{a:'Green Day',t:'Good Riddance'}]},
 ideas:{level:'Intermediate: comfortable with open and barre chords',list:[]},
 sheetIndex:[{title:'יא',artist:'Tuna',chords:['Am','F#m','Bm','G'],level:3}],
 lib:[{id:'l1',name:'Song',saved:1,data:{kind:'lyrics',title:'Song',lc:[]}}],vlinks:[{id:'v1',url:'https://youtu.be/abcdefghijk',key:'yt:abcdefghijk'}],chordbook:{Am:{added:1,songs:[]}}};
(async()=>{const b=await chromium.launch({...(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{})});
 const ctx=await b.newContext({...devices['Pixel 7']});await ctx.route(/^https:\/\//,r=>r.abort());await ctx.route(/ideas\.json/,r=>r.abort());
 const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.addInitScript(V1=>{if(sessionStorage.x)return;sessionStorage.x=1;for(const k in V1)localStorage.setItem('tuner.'+k,JSON.stringify(V1[k]))},V1);
 const v1now=()=>p.evaluate(ks=>{const o={};ks.forEach(k=>o[k]=JSON.parse(localStorage.getItem('tuner.'+k)));return o},Object.keys(V1));
 await p.goto(APP);await p.waitForSelector('#onb:not([hidden]) .obcard',{timeout:3000}).catch(()=>{});
 const pr=await p.evaluate(()=>JSON.parse(localStorage.getItem('tuner.profile')));console.log('  prefilled:',JSON.stringify(pr&&pr.onboarding.prefilled));
 ok(pr&&pr.name==='Yoav'&&pr.songLang.join()==='he,en'&&pr.instruments.sort().join()==='acoustic,electric'&&pr.level==='intermediate'&&pr.artists[0]==='Tuna'&&pr.artists.includes('Radiohead')&&pr.skills.includes('barre'),'the profile is filled in from what the app knows (name, languages, instruments, level, artists, chords)');
 ok(JSON.stringify(await v1now())===JSON.stringify(V1),'V1 data is unchanged');
 const mig=await p.evaluate(()=>JSON.parse(localStorage.getItem('tuner.v2mig')));ok(mig&&mig.done.join()==='M1'&&mig.report.M1.existing===true,'the migration is logged (M1)');
 ok(await p.evaluate(async()=>(await window.__bk.keys()).some(k=>/^backup:pre-M1/.test(k))),'a safety copy was kept before it');
 // only the screens with gaps
 const seen=[];await p.tap('#obNext');for(let i=0;i<10;i++){const h=await p.$eval('#onb h2',e=>e.textContent).catch(()=>'');if(!h)break;seen.push(h);if(/will do for you/.test(h))break;await p.tap('#obNext');await p.waitForTimeout(60)}
 console.log('  asked:',seen.join(' › '));
 ok(!seen.includes('About you')&&!seen.includes('Your instruments')&&seen.includes('Your goals')&&seen.includes('How you learn'),'only the screens with something missing are asked');
 const sum=await p.$eval('#onb',e=>e.innerText.replace(/\s+/g,' '));ok(/Hebrew and English/.test(sum)&&/Tuna/.test(sum)&&/intermediate/.test(sum),'the summary uses what was already known');
 await p.tap('#obNext');await p.waitForTimeout(200);
 ok(JSON.stringify(await v1now())===JSON.stringify(V1),'V1 data is still unchanged after finishing the setup');
 ok(await p.$eval('#taste',e=>e.value)==='Acoustic covers','a taste the player wrote is kept');
 // runs once: reload doesn't redo it
 const prof1=await p.evaluate(()=>localStorage.getItem('tuner.profile'));await p.reload();await p.waitForTimeout(700);
 ok(await p.evaluate(()=>localStorage.getItem('tuner.profile'))===prof1&&await p.evaluate(()=>JSON.parse(localStorage.getItem('tuner.v2mig')).done.length)===1,'reopening the app doesn’t run the migration again');
 // a first run that stopped before writing the profile: it simply runs again and gives the same profile
 const strip=s=>{const o=JSON.parse(s);delete o.updatedAt;o.onboarding={prefilled:o.onboarding.prefilled};return JSON.stringify(o)};
 const fresh=await p.evaluate(()=>JSON.stringify(window.__v2.prefill()));
 await p.evaluate(()=>{localStorage.removeItem('tuner.profile');localStorage.removeItem('tuner.v2mig')});await p.reload();await p.waitForTimeout(700);
 const again=await p.evaluate(()=>localStorage.getItem('tuner.profile'));ok(strip(again)===strip(fresh),'an interrupted first run reruns to the same profile');
 await p.waitForSelector('#wSkip',{state:'visible',timeout:2000}).then(()=>p.tap('#wSkip')).catch(()=>{});
 // Undo the new version's data (two taps): only V2 keys go
 await p.tap('#hMe');await p.evaluate(()=>{document.getElementById('v2Box').open=true});ok(/filled in from what the app already knew/.test(await p.$eval('#v2Box',e=>e.textContent)),'My profile says what the update did');
 await p.tap('#v2Undo');const nav=p.waitForEvent('load',{timeout:8000}).catch(()=>{});await p.tap('#v2Undo');await nav;await p.waitForTimeout(700);
 ok(JSON.stringify(await v1now())===JSON.stringify(V1),'"Undo" leaves V1 data exactly as it was');
 ok(await p.$eval('#onb',e=>!e.hidden),'…and the setup starts over');
 ok(!errs.length,'no page errors '+JSON.stringify(errs));
 console.log(fail?`${fail} FAILED`:'all passed');await b.close();srv.close();process.exit(fail?1:0)})();
