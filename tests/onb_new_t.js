// Onboarding, new player: shows on the first open with a progress bar, says the answers stay on the phone, every screen can be skipped,
// "Finish later" leaves a card on Home, answers are saved to the profile and used (greeting, song-idea language), it doesn't come back,
// My profile shows the answers and "Change my answers" opens every screen.
const {chromium,devices}=require('playwright');const path=require('path'),fs=require('fs'),http=require('http');
const ROOT=path.resolve(__dirname,'..'),OUT=path.join(__dirname,'out');fs.mkdirSync(OUT,{recursive:true});
const srv=http.createServer((q,r)=>{const f=path.join(ROOT,decodeURIComponent(q.url.split('?')[0]).replace(/\/$/,'/index.html'));fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);return r.end()}r.writeHead(200,{'content-type':/\.html$/.test(f)?'text/html':'application/octet-stream'});r.end(d)})}).listen(0);
const APP=process.env.APP||`http://localhost:${srv.address().port}/index.html`;
let fail=0;const ok=(c,m)=>{console.log((c?'ok  ':'FAIL')+' '+m);if(!c)fail++};
(async()=>{const b=await chromium.launch({...(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{})});
 const ctx=await b.newContext({...devices['Pixel 7']});await ctx.route(/^https:\/\//,r=>r.abort());await ctx.route(/ideas\.json/,r=>r.abort());
 const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto(APP);await p.waitForSelector('#onb:not([hidden]) .obcard',{timeout:3000}).catch(()=>{});
 ok(await p.$eval('#onb',e=>!e.hidden),'a new player gets the setup on the first open');
 const txt=()=>p.$eval('#onb',e=>e.innerText.replace(/\s+/g,' '));
 ok(/stay on this phone/.test(await txt())&&/private GitHub/.test(await txt()),'the first screen says the answers stay on the phone');
 const step=()=>p.$eval('#onb h2',e=>e.textContent).catch(()=>'');const pct=()=>p.$eval('.obprog',e=>+e.getAttribute('aria-valuenow'));
 // Finish later → Home card → back in
 await p.tap('#wSkip');await p.waitForTimeout(200);ok(await p.$eval('#onb',e=>e.hidden)&&/Finish setting up/.test(await p.$eval('#homeCont',e=>e.textContent)),'"Finish later" closes it and Home offers to finish');
 await p.reload();await p.waitForTimeout(700);ok(await p.$eval('#onb',e=>e.hidden),'after "Finish later" it doesn’t pop up again by itself');
 await p.tap('#homeCont .hcont');await p.waitForTimeout(200);ok(!(await p.$eval('#onb',e=>e.hidden)),'the Home card opens the setup again');
 const chip=async(f,v)=>p.tap(`.obchips[data-f="${f}"] .obchip[data-v="${v}"]`);
 await p.tap('#obNext');// Start
 let n=0;const seen=[],pcts=[];
 const next=async()=>{seen.push(await step());pcts.push(await pct());await p.tap('#obNext');await p.waitForTimeout(80)};
 // About you
 await p.fill('#obName','Dana');await chip('songLang','he');await chip('songLang','en');await next();
 // Your playing
 await chip('years','1-3');await chip('level','improving');await next();
 // Quick check: skip it
 seen.push(await step());await p.tap('#obSkip');await p.waitForTimeout(80);
 // Instruments
 await chip('instruments','acoustic');await chip('instruments','electric');await next();
 // Music: a genre, an artist typed, a dream song typed
 await chip('genres','israeli-rock');await p.fill('#obArtist','Mashina');await p.press('#obArtist','Enter');await p.fill('#obDream','Wonderwall – Oasis');await p.press('#obDream','Enter');await next();
 // Goals
 await chip('goals','campfire');await chip('goals','sing-along');await next();
 // How you learn
 await chip('learnBy','video');await chip('minPerDay','20');await chip('daysPerWeek','4');await chip('context','friends');await next();
 console.log('  screens:',seen.join(' › '));
 ok(seen.length===7&&seen[0]==='About you'&&seen[6]==='How you learn','all question screens shown in order');
 ok(pcts.every((x,i)=>i===0||x>pcts[i-1]),'the progress bar moves forward ('+pcts.join(', ')+')');
 const sum=await txt();console.log('  summary:',sum.slice(0,400));
 ok(/HERE’S WHAT GUITARING WILL DO|Here’s what Guitaring will do/i.test(sum)&&/Hebrew and English/.test(sum)&&/Israeli rock/.test(sum)&&/easy version first/.test(sum)&&/20 min a day, 4 days a week/.test(sum),'the summary says what the app will do with the answers');
 await p.screenshot({path:path.join(OUT,'onb_summary.png')});
 await p.tap('#obNext');await p.waitForTimeout(200);
 const pr=await p.evaluate(()=>JSON.parse(localStorage.getItem('tuner.profile')));
 ok(pr.name==='Dana'&&pr.songLang.join()==='he,en'&&pr.years==='1-3'&&pr.level==='improving'&&pr.instruments.join()==='acoustic,electric'&&pr.genres.includes('israeli-rock')&&pr.artists.includes('Mashina')&&pr.dreamSongs.includes('Wonderwall – Oasis')&&pr.goals.length===2&&pr.time.minPerDay===20&&pr.time.daysPerWeek===4&&pr.onboarding.done&&pr.onboarding.skipped.includes('check'),'every answer is saved in the profile (and the skipped screen is noted)');
 ok(await p.evaluate(()=>JSON.parse(localStorage.getItem('tuner.userName')))==='Dana'&&await p.evaluate(()=>JSON.parse(localStorage.getItem('tuner.ideaPrefs')).lang)==='both','the name and song languages feed the greeting and song ideas');
 ok(/Hey, Dana\./.test(await p.$eval('#homeHero',e=>e.textContent))&&!/Finish setting up/.test(await p.$eval('#homeCont',e=>e.textContent)),'Home greets by the new name; no setup card any more');
 await p.reload();await p.waitForTimeout(700);ok(await p.$eval('#onb',e=>e.hidden),'it doesn’t come back once done');
 // My profile
 await p.tap('#hMe');const prof=await p.$eval('#profCard',e=>e.innerText.replace(/\s+/g,' '));
 ok(/Dana/.test(prof)&&/Hebrew, English/.test(prof)&&/Improving/.test(prof)&&/Israeli rock/.test(prof)&&/Mashina/.test(prof),'My profile shows the answers');
 await p.tap('#profEdit');ok(await step()==='About you'&&await p.$eval('#obName',e=>e.value)==='Dana','"Change my answers" opens the setup on the first question, with the answers in');
 await p.tap('#obNext');await chip('level','intermediate');for(let i=0;i<7;i++){if(!(await p.$('#obNext')))break;await p.tap('#obNext');await p.waitForTimeout(60)}
 ok(await p.evaluate(()=>JSON.parse(localStorage.getItem('tuner.profile')).level)==='intermediate','a changed answer is saved');
 ok(!(await p.content()).includes('Mashina, Aviv Gefen'),'no built-in taste of one particular player in the app');
 ok(!errs.length,'no page errors '+JSON.stringify(errs));
 console.log(fail?`${fail} FAILED`:'all passed');await b.close();srv.close();process.exit(fail?1:0)})();
