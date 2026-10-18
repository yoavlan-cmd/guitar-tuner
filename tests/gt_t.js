// Gear for this song (V2 phase 5; reworked 17 Oct 2026 to the user's aim: as close as possible to the song's sound with the gear you
// have, never "you can't practise without other gear"). An acoustic song: acoustic advice only (no pickups, drive or pedals); an
// amplified acoustic (a Lava's built-in effects, an acoustic amp, a reverb pedal) adds a bonus. An electric song: your electric, the
// pickup, the amp, your drive pedal; on an acoustic, how to get closest. No "not in your gear"; no capo → the Easy guide's version.
const {chromium,devices}=require('playwright');const path=require('path'),fs=require('fs'),http=require('http');
const ROOT=path.resolve(__dirname,'..'),OUT=path.join(__dirname,'out');fs.mkdirSync(OUT,{recursive:true});
const srv=http.createServer((q,r)=>{const f=path.join(ROOT,decodeURIComponent(q.url.split('?')[0]).replace(/\/$/,'/index.html'));fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);return r.end()}r.writeHead(200,{'content-type':/\.html$/.test(f)?'text/html':'application/octet-stream'});r.end(d)})}).listen(0);
const APP=process.env.APP||`http://localhost:${srv.address().port}/index.html`;
let fail=0;const ok=(c,m)=>{console.log((c?'ok  ':'FAIL')+' '+m);if(!c)fail++};
const FULL=[{id:'i1',name:'Lava',type:'electroacoustic',brand:'Lava',model:'Me 3',specs:{},added:1},{id:'i2',name:'Les Paul',type:'electric',brand:'Gibson',model:'Les Paul',specs:{pickups:'humbucker'},added:2},
 {id:'i3',name:'Strat',type:'electric',brand:'Fender',model:'Stratocaster',specs:{pickups:'single'},added:3},{id:'i4',name:'Katana',type:'elamp',brand:'Boss',model:'Katana 50',specs:{},added:4}];
const PEDALS=[{id:'g1',kind:'pedal',type:'distortion',name:'DS-1',brand:'Boss',model:'DS-1'},{id:'g2',kind:'pedal',type:'delay',name:'DD-3',brand:'Boss',model:'DD-3'},{id:'g3',kind:'acc',type:'picks',name:'Picks',thick:'0.6'}];
(async()=>{const b=await chromium.launch({...(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{})});
 const run=async(ins,gx,video)=>{const ctx=await b.newContext({...devices['Pixel 7']});await ctx.route(/^https:\/\//,r=>r.abort());await ctx.route(/ideas\.json/,r=>r.abort());
  const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.addInitScript(([ins,gx,video])=>{if(sessionStorage.x)return;sessionStorage.x=1;const S=(k,v)=>localStorage.setItem('tuner.'+k,JSON.stringify(v));
   S('userName','Yoav');S('profile',{name:'Yoav',onboarding:{done:true}});S('learnLang','en');S('instruments',ins);S('gearExtra',gx);
   const segs=[];for(let i=0;i<16;i++)segs.push([i*3,i*3+3,[0,56,72,80][i%4]]);
   S('song.mix_m1',{title:'Test Song - Test Band',artist:'Test Band',dur:48,bpm:80,offset:0,tuning:{id:'std',conf:'high'},segs,play:{tun:'std',capo:2,capoBy:'video'},video:{at:1,name:'v.mp4',capo:2,frames:[{t:1,shape:'C',conf:'high',heard:'D',seen:'D'}],asked:4,agree:1,differ:[],fixed:[]},v:2,at:Date.now(),from:'guitars',mix:'m1',
    ...(video?{video:{asked:12,frames:[{t:3,shape:'C'}],who:video,others:[],fixed:[],capo:2}}:{}),tone:{cent:900,dist:.6,drive:'crunch'}});S('songs',['mix_m1'])},[ins,gx,video]);
  await p.goto(APP);await p.waitForTimeout(500);await p.evaluate(()=>window.__v2.goSec('learn'));await p.waitForTimeout(300);
  await p.tap('#learnList .lrow:has-text("Test Song")');await p.waitForTimeout(500);return {p,ctx,errs}};
 const card=p=>p.$eval('#sesGear',e=>({open:e.querySelector('details').open,_:(e.dataset.wasOpen=e.querySelector('details').open)&&0,txt:(()=>{const d=e.querySelector('details'),o=d.open;d.open=true;const t=e.innerText.replace(/\s+/g,' ');d.open=o;return t})(),lines:Object.fromEntries([...e.querySelectorAll('.gtl dt')].map(dt=>[dt.textContent,dt.nextElementSibling.textContent])),bonus:[...e.querySelectorAll('.gtbonus li')].map(x=>x.textContent)}));
 // 1. an acoustic song (from the video), with a Lava, electrics, an amp and pedals
 let {p,ctx,errs}=await run(FULL,PEDALS,'acoustic');let c=await card(p);console.log('  acoustic:',JSON.stringify(c.lines),'| bonus:',JSON.stringify(c.bonus));
 ok(/Lava/.test(c.lines.Guitar||'')&&/gets you right there/.test(c.txt),'an acoustic song: your amplified acoustic (the Lava), and why');
 ok(!c.lines.Pickup&&!c.lines.Amp&&!c.lines.Drive&&!/humbucker|bridge pickup|DS-1|drive channel/i.test(c.txt),'nothing electric: no pickup, amp, drive or distortion pedal');
 ok(!await p.$('[data-gtd]')&&!c.open,'no Clean / Crunch / Distorted question for an acoustic; the card is folded (nothing to ask)');
 ok(c.bonus.some(x=>/Lava’s built-in effects \(reverb, delay and chorus\)/.test(x)&&/375 ms/.test(x))&&c.bonus.some(x=>/DD-3: 375 ms/.test(x)),'bonus: the Lava’s built-in effects, and your delay timed to the song');
 ok(/No capo at hand\? The Easy guide has a version without one/.test(c.lines.Capo||'')&&!/not in your gear|would get closer/i.test(c.txt),'no capo: the Easy guide’s version, never “not in your gear”');
 await p.evaluate(()=>document.querySelector('#sesGear details').open=true);await p.$eval('#sesGear',e=>e.scrollIntoView());await p.screenshot({path:path.join(OUT,'gt_acoustic.png')});
 // 2. the same song on an electric, distorted: the electric's sound
 await p.tap('[data-gtk=electric]');await p.waitForTimeout(300);ok(!!await p.$('[data-gtd]')&&(await card(p)).open,'an electric song asks how it sounds');
 await p.tap('[data-gtd=distorted]');await p.waitForTimeout(300);c=await card(p);console.log('  electric:',JSON.stringify(c.lines));
 ok(/Les Paul.*humbuckers/.test(c.lines.Guitar||'')&&/bridge/.test(c.lines.Pickup||'')&&/DS-1 \(Distortion\)/.test(c.lines.Drive||'')&&/DS-1 gives the drive/.test(c.lines.Amp||''),'distorted electric: humbucker guitar, bridge pickup, the amp clean with your distortion pedal giving the drive');
 await p.tap('[data-gtd=clean]');await p.waitForTimeout(300);c=await card(p);
 ok(/Strat/.test(c.lines.Guitar||'')&&/neck/.test(c.lines.Pickup||'')&&c.bonus.some(x=>/DD-3: 375 ms/.test(x)),'clean electric: the single-coil guitar, the neck pickup; the delay as a bonus');
 ok(!errs.length,'no page errors '+JSON.stringify(errs));await ctx.close();
 // 3. an electric, distorted song with only an acoustic: how to get closest, no shopping list
 ({p,ctx,errs}=await run([{id:'a1',name:'Yamaha',type:'acoustic',brand:'Yamaha',model:'FG800',specs:{},added:1}],[],'electric'));
 await p.tap('[data-gtd=distorted]');await p.waitForTimeout(300);c=await card(p);console.log('  only an acoustic:',JSON.stringify(c.lines),'|',(c.txt.match(/The song is played[^.]*\./)||[''])[0]);
 ok(/Yamaha/.test(c.lines.Guitar||'')&&/power chords/.test(c.lines['Closest sound']||'')&&/gets close with the tips below, and the chords and strumming are exactly the same/.test(c.txt),'only an acoustic for a distorted electric song: power chords and palm-muting; the chords and strumming are the same');
 ok(!/not in your gear|would get closer|you need/i.test(c.txt),'no shopping list');
 await p.setViewportSize({width:360,height:740});await p.waitForTimeout(150);ok(await p.evaluate(()=>document.documentElement.scrollWidth<=360),'no sideways scroll at 360 px');
 ok(!errs.length,'no page errors '+JSON.stringify(errs));await ctx.close();
 // 4. an acoustic song with a plain acoustic: no bonus, no electric
 ({p,ctx,errs}=await run([{id:'a1',name:'Yamaha',type:'acoustic',brand:'Yamaha',model:'FG800',specs:{},added:1},{id:'i2',name:'Les Paul',type:'electric',brand:'Gibson',model:'Les Paul',specs:{pickups:'humbucker'},added:2}],PEDALS,'acoustic'));
 c=await card(p);ok(/Yamaha/.test(c.lines.Guitar||'')&&!c.bonus.length&&!/DS-1|DD-3|pickup/i.test(c.txt),'an acoustic song with a plain acoustic: your acoustic, no electric suggestions and no bonus');
 ok(!errs.length,'no page errors '+JSON.stringify(errs));await ctx.close();
 console.log(fail?`${fail} FAILED`:'all passed');await b.close();srv.close();process.exit(fail?1:0)})();
