// Gear for this song (V2 phase 5): a folded card on the song's page. How the guitar sounds comes from your taps (Clean / Crunch /
// Distorted, Acoustic / Electric; kept with the analysis) or, for acoustic / electric, the video; the tip picks from your gear:
// guitar, pickup, amp, pedals (with where to start; a delay's time from the tempo), capo, pick; what's missing would get closer.
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
  S('instruments',[{id:'i1',name:'Taylor',type:'electroacoustic',brand:'Taylor',model:'214ce',specs:{},added:1},{id:'i2',name:'Les Paul',type:'electric',brand:'Gibson',model:'Les Paul',specs:{pickups:'humbucker'},added:2},
   {id:'i3',name:'Strat',type:'electric',brand:'Fender',model:'Stratocaster',specs:{pickups:'single'},added:3},{id:'i4',name:'Katana',type:'elamp',brand:'Boss',model:'Katana 50',specs:{ampkind:'modeling'},added:4}]);
  S('gearExtra',[{id:'g1',kind:'pedal',type:'distortion',name:'DS-1',brand:'Boss',model:'DS-1'},{id:'g2',kind:'pedal',type:'delay',name:'DD-3',brand:'Boss',model:'DD-3'},{id:'g3',kind:'acc',type:'picks',name:'Picks',thick:'0.6'}]);
  const segs=[];for(let i=0;i<16;i++)segs.push([i*3,i*3+3,[0,96+0,56,72][i%4]===96?0:[0,56,72,80][i%4]]);
  S('song.mix_m1',{title:'Test Song - Test Band',artist:'Test Band',dur:48,bpm:80,offset:0,tuning:{id:'std',conf:'high'},segs,play:{tun:'std',capo:2,capoBy:'you'},v:2,at:Date.now(),from:'guitars',mix:'m1',
   video:{asked:12,frames:[{t:3,shape:'C'}],who:'acoustic',others:[],fixed:[],capo:null},tone:{cent:900,hf:.02,flat:.2,crest:2,dist:.6,drive:'crunch',bright:'balanced',kind:''}});S('songs',['mix_m1']);
 });
 await p.goto(APP);await p.waitForTimeout(500);await p.evaluate(()=>window.__v2.goSec('learn'));await p.waitForTimeout(300);
 await p.tap('#learnList .lrow:has-text("Test Song")');await p.waitForTimeout(500);
 const card=()=>p.$eval('#sesGear',e=>({open:e.querySelector('details').open,txt:e.innerText.replace(/\s+/g,' '),lines:Object.fromEntries([...e.querySelectorAll('.gtl dt')].map(dt=>[dt.textContent,dt.nextElementSibling.textContent]))}));
 let c=await card();console.log('  ',JSON.stringify(c.lines),'|',(c.txt.match(/The guitar[^.]*\./)||[''])[0]);
 ok(!!c&&/from the video/.test(c.txt)&&await p.$eval('[data-gtk=acoustic]',e=>e.getAttribute('aria-pressed'))==='true','the card: acoustic preset from the video');
 ok(/Taylor/.test(c.lines.Guitar||'')&&/The guitar is an acoustic \(seen in the video\), so your Taylor/.test(c.txt),'the acoustic part: your electro-acoustic, and why');
 ok(!c.lines.Pedals&&/Tap how it sounds/.test(c.txt)&&!/crunch|distorted/i.test(c.txt.replace(/Clean Crunch Distorted/,'')),'the sound measured on the phone isn’t taken as fact: no drive suggestions until you say');
 ok(/Capo on fret 2/.test(c.lines.Capo||'')&&/a capo would get closer/.test(c.txt),'capo 2, and no capo in your gear: “a capo would get closer”');
 ok(/0.6 mm picks suit strumming/.test(c.lines.Pick||''),'your 0.6 mm picks');
 // your answer: distorted, on an electric
 await p.tap('[data-gtd=distorted]');await p.waitForTimeout(300);await p.tap('[data-gtk=electric]');await p.waitForTimeout(300);c=await card();console.log('  ',JSON.stringify(c.lines));
 ok(/Les Paul.*humbuckers/.test(c.lines.Guitar||'')&&/bridge/.test(c.lines.Pickup||'')&&/drive channel/.test(c.lines.Amp||''),'distorted on an electric: the humbucker guitar, the bridge pickup, the amp’s drive channel');
 ok(/DS-1 \(Distortion\): Gain at 10/.test(c.lines.Pedals||''),'your distortion pedal, with where to start its knobs');
 ok(c.open,'the card stays open after a tap');
 const you=await p.evaluate(()=>JSON.parse(localStorage.getItem('tuner.song.mix_m1')).tone.you);ok(you.drive==='distorted'&&you.kind==='electric','your answer is kept with the song');
 // clean: the delay timed to the tempo (80 BPM → 375 ms), the neck pickup
 await p.tap('[data-gtd=clean]');await p.waitForTimeout(300);c=await card();
 ok(/375 ms/.test(c.lines.Pedals||'')&&/neck/.test(c.lines.Pickup||'')&&/clean channel/.test(c.lines.Amp||''),'clean: neck pickup, clean channel, the delay at 375 ms (an eighth at 80 BPM)');
 ok(/Strat \(its single-coils/.test(c.lines.Guitar||''),'clean on an electric: the single-coil guitar ('+c.lines.Guitar+')');
 await p.reload();await p.waitForTimeout(500);await p.evaluate(()=>window.__v2.goSec('learn'));await p.waitForTimeout(300);await p.tap('#learnList .lrow:has-text("Test Song")');await p.waitForTimeout(500);c=await card();ok(/clean channel/.test(c.lines.Amp||'')&&!c.open,'after a reload: the answers stay, the card is folded with its summary');
 await p.evaluate(()=>document.querySelector('#sesGear details').open=true);await p.$eval('#sesGear',e=>e.scrollIntoView());await p.screenshot({path:path.join(OUT,'gt.png')});
 await p.setViewportSize({width:360,height:740});await p.waitForTimeout(150);ok(await p.evaluate(()=>document.documentElement.scrollWidth<=360),'no sideways scroll at 360 px');
 ok(!errs.length,'no page errors '+JSON.stringify(errs));
 console.log(fail?`${fail} FAILED`:'all passed');await b.close();srv.close();process.exit(fail?1:0)})();
