// Sound first, video second, the chord sheet only as a sanity check (V2 phase 4). A capo can't be heard, so it comes from the video,
// else none; nothing you set changes the Full guide (Oct 2026: no capo picker), and a sheet's capo is only mentioned. The sheet never
// changes a chord (it may be another version): where the sound's 3rd is too faint to be sure, or a clear recording differs, the guide
// says so and keeps the recording.
// The fixture is "במקום בו אני גר" as heard (C#m · C# · A · Asus2 · E · Eadd9 · F#m · F#, saved with capo 4) with its saved notes:
// the C# has a clear major 3rd (this recording plays it), the F# a faint one (too faint to tell); its sheet: F#m · E · C#m · A.
const {chromium,devices}=require('playwright');const path=require('path'),fs=require('fs'),http=require('http');
const ROOT=path.resolve(__dirname,'..'),OUT=path.join(__dirname,'out');fs.mkdirSync(OUT,{recursive:true});
const srv=http.createServer((q,r)=>{const f=path.join(ROOT,decodeURIComponent(q.url.split('?')[0]).replace(/\/$/,'/index.html'));fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);return r.end()}r.writeHead(200,{'content-type':/\.html$/.test(f)?'text/html':'application/octet-stream'});r.end(d)})}).listen(0);
const APP=process.env.APP||`http://localhost:${srv.address().port}/index.html`;
let fail=0;const ok=(c,m)=>{console.log((c?'ok  ':'FAIL')+' '+m);if(!c)fail++};
const NT=8,R={C:0,'C#':1,D:2,Eb:3,E:4,F:5,'F#':6,G:7,Ab:8,A:9,Bb:10,B:11},TY={'':0,m:1,7:2,m7:3,maj7:4,sus2:5,sus4:6,add9:7};
const cc=(root,type,capo)=>((R[root]+capo)%12)*NT+TY[type];// shape name → concert-pitch chord index
function song(o){const bpm=o.bpm,b=60/bpm,beats=[],segs=[];let t=1.0;
 const prog=o.prog;// [[root,type,beats],…] per part
 for(const part of o.form)for(const [r,ty,n] of prog[part]){segs.push([+t.toFixed(2),+(t+n*b).toFixed(2),cc(r,ty,o.capo)]);t+=n*b}
 const dur=t+1;for(let x=1.0;x<dur;x+=b)beats.push(+x.toFixed(3));
 // onsets: hop 256 at 11025 Hz; the pattern D · D U · U D U (eighths 0,2,3,5,6,7 of each bar)
 const h=256,fr=Math.ceil(dur*11025/h),e=new Uint8Array(fr);const hit=(tt,v)=>{const i=Math.round(tt*11025/h);for(let k=-1;k<=1;k++)if(e[i+k]!==undefined)e[i+k]=Math.max(e[i+k],k?v*.6:v)};
 for(let bi=0;bi+4<beats.length;bi+=4)for(let q=0;q<8;q++){const tt=beats[bi]+q*b/2;const on=o.pat[q]!=='·';if(on)hit(tt,200+((q*37+bi)%40));else hit(tt,o.noise||8)}
 return {title:o.title,dur,bpm,offset:0,tuning:{id:'std',conf:o.conf||'high',why:''},segs,play:{tun:'std',capo:o.capo},beats,ons:{h,d:Buffer.from(e).toString('base64')},v:2,at:Date.now()}}
// the analysis' saved notes (feat): per frame (hop 1024 at 11025 Hz) the 12 note strengths; root and 5th strong, the 3rds as set
function feat(a){const hop=1024,off=3584,n=Math.ceil((a.dur*11025-off)/hop),c=new Uint8Array(n*12).fill(20);
 const TH={'C#m':[20,200],'C#':[200,20],'F#':[60,50],'F#m':[20,200]};// [major 3rd, minor 3rd]
 for(let f=0;f<n;f++){const t=(f*hop+off)/11025,g=a.segs.find(s=>t>=s[0]&&t<s[1]);if(!g)continue;const r=Math.floor(g[2]/NT),q=g[2]%NT,nm=Object.keys(R).find(k=>R[k]===r)+['','m','7','m7','maj7','sus2','sus4','add9'][q];
  const o=f*12;c[o+r]=255;c[o+(r+7)%12]=255;const th=TH[nm]||(q===1?[20,200]:[200,20]);c[o+(r+4)%12]=th[0];c[o+(r+3)%12]=th[1]}
 const b=Buffer.from(c).toString('base64');return {n,c:b,b,s:Buffer.from(new Uint8Array(n)).toString('base64'),hop,off}}
const HEB="ג'ימבו ג'יי, אורית טשומה, אברהם לגסה";
const mk=()=>{const a=song({title:'במקום בו אני גר - '+HEB,bpm:104,capo:0,pat:'D·DUDUDU',
 prog:{V:[['C#','m',4],['C#','',4],['A','',4],['A','sus2',4],['E','',4],['E','add9',4],['F#','m',4],['F#','',4]]},form:['V','V','V','V','V','V']});
 a.play.capo=4;a.tuning.conf='medium';a.from='guitars';a.feat=feat(a);return a};
const SHEET={title:'במקום בו אני גר',artist:HEB,capo:0,tuning:'Standard (E A D G B E)',chords:['F#m','E','C#m','A'],src:'phone',at:'2026-10-11'};
(async()=>{const b=await chromium.launch({...(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{})});
 const run=async(ana,sheet)=>{const ctx=await b.newContext({...devices['Pixel 7']});await ctx.route(/^https:\/\//,r=>r.abort());await ctx.route(/ideas\.json/,r=>r.abort());
  const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.addInitScript(([ANA,SHEET])=>{if(sessionStorage.x)return;sessionStorage.x=1;const S=(k,v)=>localStorage.setItem('tuner.'+k,JSON.stringify(v));
   S('userName','Yoav');S('profile',{name:'Yoav',level:'intermediate',onboarding:{done:true}});S('learnLang','he');
   S('song.mix_d1',ANA);S('songs',['mix_d1']);if(SHEET)S('sheetCat',[SHEET])},[ana,sheet]);
  await p.goto(APP);await p.waitForTimeout(500);await p.tap('#bnav [data-sec=learn]');await p.waitForTimeout(200);
  await p.tap('#learnList .lrow:has-text("במקום בו אני גר")');await p.waitForTimeout(400);await full(p);return {p,ctx,errs}};
 const full=async p=>{if(await p.$eval('[data-gd=full]',e=>e.getAttribute('aria-pressed'))!=='true'){await p.tap('[data-gd=full]');await p.waitForTimeout(150)}};
 const look=async p=>({capo:await p.$eval('.gdbig b',e=>e.textContent),ch:await p.$$eval('#gdBody .seschords svg .dgName',l=>l.map(x=>x.textContent)),
  lv:await p.$$eval('.gdsure li',l=>Object.fromEntries(l.map(x=>[x.querySelector('span').textContent,[x.querySelector('.gdlv').className.split(' ')[1],x.querySelector('small').textContent]]))),
  body:await p.$eval('#gdBody',e=>e.textContent)});
 const nm=c=>Object.keys(R).find(k=>R[k]===Math.floor(c/NT))+['','m','7','m7','maj7','sus2','sus4','add9'][c%NT];
 // ---- 1. with the song's chord sheet (no capo) ----
 let {p,ctx,errs}=await run(mk(),SHEET);let L=await look(p);
 console.log('  with the sheet:',L.capo,'|',L.ch.join(' '));console.log('  chords:',L.lv['Chords and order'][1]);console.log('  capo:',L.lv['Capo and shapes'].join(' · '));
 ok(L.capo==='No capo','no capo: a capo can’t be heard, and the saved capo 4 was only a guess');
 ok(L.ch.includes('F#'),'the F# whose 3rd is too faint to tell stays as heard: the sheet (maybe another version) doesn’t change it');
 ok(L.ch.includes('C#')&&L.ch.includes('C#m'),'the C# with a clear major 3rd stays C#: the recording wins over the sheet');
 ok(L.ch.includes('Asus2')&&L.ch.includes('Eadd9'),'the recording’s own voicings stay (Asus2, Eadd9): the sheet doesn’t replace chords');
 ok(/Your chord sheet has F#m where this recording’s 3rd is too faint to be sure; the guide keeps what it heard \(F#\)/.test(L.lv['Chords and order'][1])&&/Your chord sheet has C#m, but this recording clearly plays C#/.test(L.lv['Chords and order'][1])&&!/settled/.test(L.lv['Chords and order'][1]),'How sure says where the sheet differs (a faint 3rd, a clear one) and that the guide keeps the recording');
 ok(L.lv['Capo and shapes'][0]==='likely'&&/your chord sheet has no capo either/.test(L.lv['Capo and shapes'][1]),'capo: “likely”, as the sheet also has no capo');
 const saved=await p.evaluate(()=>JSON.parse(localStorage.getItem('tuner.song.mix_d1')));const sn=[...new Set(saved.segs.map(s=>s[2]).filter(c=>c<96))].map(nm);
 ok(saved.play.capo===0&&saved.play.capoBy==='none'&&sn.includes('F#')&&sn.includes('C#'),'saved: no capo, F# and C# kept as heard ('+sn.join(' ')+')');
 // Easy: the capo version
 await p.tap('[data-gd=easy]');await p.waitForTimeout(150);L=await look(p);const ei=await p.$eval('.gdintro',e=>e.textContent);console.log('  easy:',L.capo,'|',L.ch.join(' '));
 ok(/^Capo [1-7]$/.test(L.capo)&&/easier version: capo \d/.test(ei),'Easy opens with the easiest version, with a capo ('+L.capo+')');
 // both Easy versions: with and without a capo; your pick is kept in your profile and opens next time
 const vers=await p.$$eval('[data-gdever]',l=>l.map(b=>b.textContent+(b.getAttribute('aria-checked')==='true'?'*':'')));console.log('  easy versions:',vers.join(' | '));
 ok(vers.length===2&&/^No capo$/.test(vers[0])&&/^With capo [1-7]\*$/.test(vers[1]),'Easy offers both: no capo, and with a capo (picked)');
 await p.tap('[data-gdever="0"]');await p.waitForTimeout(150);L=await look(p);const ei0=await p.$eval('.gdintro',e=>e.textContent);console.log('  easy, no capo:',L.capo,'|',L.ch.join(' '),'|',ei0);
 ok(L.capo==='No capo'&&L.ch.includes('C#m')&&L.ch.includes('A')&&L.ch.includes('E')&&L.ch.includes('F#m')&&!L.ch.some(n=>/add9|sus/.test(n)),'no capo: the song’s basic chords as they sound (C#m · A · E · F#m)');
 ok(/Still a barre in this version: .*C#m/.test(ei0)&&/F#m/.test(ei0)&&/capo \d avoids/.test(ei0),'…and it says which chords are still barres, and that the capo version avoids them');
 ok(await p.evaluate(()=>JSON.parse(localStorage.getItem('tuner.profile')).capo)==='no','the choice is kept in your profile (no capo)');
 await p.reload();await p.waitForTimeout(500);await p.tap('#bnav [data-sec=learn]');await p.waitForTimeout(200);await p.tap('#learnList .lrow:has-text("במקום בו אני גר")');await p.waitForTimeout(400);
 if(await p.$eval('[data-gd=easy]',e=>e.getAttribute('aria-pressed'))!=='true'){await p.tap('[data-gd=easy]');await p.waitForTimeout(150)}
 ok((await look(p)).capo==='No capo'&&await p.$eval('[data-gdever="0"]',e=>e.getAttribute('aria-checked'))==='true','next time, Easy opens with the version you picked');
 await p.tap('[data-gdever]:not([data-gdever="0"])');await p.waitForTimeout(150);
 ok(/^Capo [1-7]$/.test((await look(p)).capo)&&await p.evaluate(()=>JSON.parse(localStorage.getItem('tuner.profile')).capo)==='yes','picking the capo version keeps “I have a capo”');
 await p.evaluate(()=>window.__v2.goSec('profile'));await p.waitForTimeout(300);
 ok(/I have one/.test(await p.evaluate(()=>document.body.innerText)),'My profile shows it');
 await p.evaluate(()=>window.__v2.goSec('learn'));await p.waitForTimeout(200);await p.tap('#learnList .lrow:has-text("במקום בו אני גר")');await p.waitForTimeout(400);
 await full(p);
 // Full can't be changed by anything you set: no capo picker; an old capo set by hand (before Oct 2026) is ignored
 ok(!await p.$('[data-gdcapo]')&&!await p.$('.gdcapo'),'Full has no capo picker (the same on every build)');
 const f0=await look(p);await p.evaluate(()=>{const k='tuner.song.mix_d1',d=JSON.parse(localStorage.getItem(k));d.play.capo=4;d.play.capoBy='you';localStorage.setItem(k,JSON.stringify(d))});
 await p.reload();await p.waitForTimeout(500);await p.tap('#bnav [data-sec=learn]');await p.waitForTimeout(200);await p.tap('#learnList .lrow:has-text("במקום בו אני גר")');await p.waitForTimeout(400);await full(p);L=await look(p);
 ok(L.capo===f0.capo&&L.ch.join(' ')===f0.ch.join(' '),'a capo set by hand earlier doesn’t change Full ('+L.capo+' | '+L.ch.join(' ')+')');
 await p.screenshot({path:path.join(OUT,'capo_sheet.png'),fullPage:true});
 ok(!errs.length,'no page errors '+JSON.stringify(errs));await ctx.close();
 // ---- 2. a sheet with capo 2 (perhaps another version): offered, not applied ----
 ({p,ctx,errs}=await run(mk(),{...SHEET,capo:2,chords:['Em','D','Bm','G']}));L=await look(p);console.log('  sheet capo 2:',L.capo,'|',L.lv['Capo and shapes'][1]);
 ok(L.capo==='No capo'&&/Your chord sheet says capo 2 \(it may be another version\)/.test(L.lv['Capo and shapes'][1]),'a sheet’s capo 2 isn’t applied; How sure mentions it');
 ok(!await p.$('#gdBody [data-gdcapo]')&&/Your chord sheet says capo 2\. It may be another version: the Full guide follows this recording/.test(await p.$eval('#gdBody',e=>e.textContent)),'the sheet’s capo is mentioned, with no button to apply it');
 ok(!errs.length,'no page errors '+JSON.stringify(errs));await ctx.close();
 // ---- 3. the video saw the hand on the F#: the video wins, the sheet doesn't settle it ----
 {const a=mk();a.video={at:Date.now(),name:'v.mp4',capo:null,frames:[{t:30,shape:'F#',conf:'high',heard:'F#',seen:'F#'}],asked:8,agree:1,differ:[],fixed:[]};
  ({p,ctx,errs}=await run(a,SHEET));L=await look(p);console.log('  video saw F#:',L.ch.join(' '));
  ok(L.ch.includes('F#')&&!/settled it: F#/.test(L.lv['Chords and order'][1]),'where the video saw the hand play F#, the sheet’s F#m doesn’t change it');
  ok(!errs.length,'no page errors '+JSON.stringify(errs));await ctx.close()}
 // ---- 3b. the video was looked at, but the hand wasn't clear in any still: listed as not helping ----
 {const a=mk();a.video={at:Date.now(),name:'v.mp4',capo:null,frames:[],asked:8,agree:0,differ:[],fixed:[]};
  ({p,ctx,errs}=await run(a,SHEET));const src=await p.$$eval('.gdsrc li',l=>l.map(x=>[x.className,x.textContent]));const vs=src.find(x=>/The video/.test(x[1]))||[];console.log('  video line:',JSON.stringify(vs));
  ok(vs[0]==='n'&&/looked at 8 moments, but the guitarist’s fretting hand isn’t shown clearly in any/.test(vs[1]),'a video where the hand was never clear is listed as not helping (no ✓)');await ctx.close()}
 // ---- 4. a guide matched to the sheet by the earlier version says to rebuild ----
 {const a=mk();a.fit={by:'sheet',share:.5,chords:['F#m','E','C#m','A']};({p,ctx,errs}=await run(a,null));L=await look(p);
  ok(/earlier version of Guitaring: rebuild it/.test(L.lv['Chords and order'][1]),'an older sheet-matched guide suggests a rebuild');await ctx.close()}
 // ---- 5. no sheet: the chords as heard, no capo, “can’t be heard” ----
 ({p,ctx,errs}=await run(mk(),null));L=await look(p);console.log('  no sheet:',L.capo,'|',L.ch.join(' '));
 ok(L.capo==='No capo'&&L.ch.includes('F#')&&L.ch.includes('C#')&&!L.ch.includes('Am'),'without a sheet: no capo, the chords as heard');
 ok(L.lv['Capo and shapes'][0]==='guess'&&/can’t be heard/.test(L.lv['Capo and shapes'][1])&&/taken from the song’s video/.test(L.lv['Capo and shapes'][1])&&!await p.$('[data-gdcapo]'),'it says a capo can’t be heard and comes from the song’s video (nothing to set)');
 ok(!errs.length,'no page errors '+JSON.stringify(errs));await ctx.close();
 console.log(fail?`${fail} FAILED`:'all passed');await b.close();srv.close();process.exit(fail?1:0)})();
