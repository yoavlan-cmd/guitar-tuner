// The guide never makes up a capo (V2 phase 4 fix). A capo can't be heard: an open C#m sounds like an Am shape with capo 4, and the
// guide had shown "Capo 4 · Am F C Dm" for a song played with no capo. Now the capo comes from you (set from the video), else the
// song's chord sheet, else none; with a sheet, each chord heard is matched to the sheet's nearest chord, and the result is saved.
// The fixture is "במקום בו אני גר" as the guitars-only analysis heard it (C#m · A · E · F#m with some minors heard major and
// add9 / sus2 colours, saved with capo 4) and its Guitaring sheet (no capo, F#m · E · C#m · A).
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
const HEB="ג'ימבו ג'יי, אורית טשומה, אברהם לגסה";
const ANA=song({title:'במקום בו אני גר - '+HEB,bpm:104,capo:0,pat:'D·DUDUDU',
 prog:{V:[['C#','m',4],['C#','',4],['A','',4],['A','sus2',4],['E','',4],['E','add9',4],['F#','m',4],['F#','',4]]},form:['V','V','V','V','V','V']});
ANA.play.capo=4;ANA.tuning.conf='medium';ANA.from='guitars';
const SHEET={title:'במקום בו אני גר',artist:HEB,capo:0,tuning:'Standard (E A D G B E)',chords:['F#m','E','C#m','A'],src:'phone',at:'2026-10-11'};
(async()=>{const b=await chromium.launch({...(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{})});
 const run=async(withSheet)=>{const ctx=await b.newContext({...devices['Pixel 7']});await ctx.route(/^https:\/\//,r=>r.abort());await ctx.route(/ideas\.json/,r=>r.abort());
  const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.addInitScript(([ANA,SHEET,withSheet])=>{if(sessionStorage.x)return;sessionStorage.x=1;const S=(k,v)=>localStorage.setItem('tuner.'+k,JSON.stringify(v));
   S('userName','Yoav');S('profile',{name:'Yoav',level:'intermediate',onboarding:{done:true}});S('learnLang','he');
   S('song.mix_d1',ANA);S('songs',['mix_d1']);if(withSheet)S('sheetCat',[SHEET])},[ANA,SHEET,withSheet]);
  await p.goto(APP);await p.waitForTimeout(500);await p.tap('#bnav [data-sec=learn]');await p.waitForTimeout(200);
  await p.tap('#learnList .lrow:has-text("במקום בו אני גר")');await p.waitForTimeout(400);
  if(await p.$eval('[data-gd=full]',e=>e.getAttribute('aria-pressed'))!=='true'){await p.tap('[data-gd=full]');await p.waitForTimeout(150)}
  return {p,ctx,errs}};
 const look=async p=>({capo:await p.$eval('.gdbig b',e=>e.textContent),ch:await p.$$eval('#gdBody .seschords svg .dgName',l=>l.map(x=>x.textContent)),
  lv:await p.$$eval('.gdsure li',l=>Object.fromEntries(l.map(x=>[x.querySelector('span').textContent,[x.querySelector('.gdlv').className.split(' ')[1],x.querySelector('small').textContent]]))),
  map:await p.$$eval('.gdmap .gdch',l=>l.map(x=>x.textContent))});
 // ---- with the song's chord sheet ----
 let {p,ctx,errs}=await run(true);let L=await look(p);console.log('  with the sheet:',L.capo,'|',L.ch.join(' '),'|',JSON.stringify(L.lv['Capo and shapes']),'|',L.map[1]);
 ok(L.capo==='No capo','the capo comes from the sheet: no capo (it was saved as capo 4, a guess)');
 ok(L.ch.length===4&&['C#m','A','E','F#m'].every(n=>L.ch.includes(n)),'the chords are the sheet’s: C#m · A · E · F#m (heard F#, C#, Asus2, Eadd9 set to the nearest sheet chord)');
 ok(L.lv['Capo and shapes'][0]==='solid'&&/chord sheet/.test(L.lv['Capo and shapes'][1]),'How sure: capo solid, from the chord sheet');
 ok(L.lv['Chords and order'][0]==='solid'&&/Matched to your chord sheet/.test(L.lv['Chords and order'][1]),'How sure: chords matched to the chord sheet');
 ok(L.map.length>1&&L.map.every(m=>m.replace(/×\d+/,'').split('·').map(x=>x.trim()).filter(x=>x&&x!=='no guitar').every(x=>['C#m','A','E','F#m'].includes(x))),'the song map uses the same chords');
 const saved=await p.evaluate(()=>JSON.parse(localStorage.getItem('tuner.song.mix_d1')));
 ok(saved.play.capo===0&&saved.play.capoBy==='sheet','the fitted capo is saved with the analysis, so the play-along shows the same');
 // you set the capo you see in the video
 await p.tap('[data-gdcapo="4"]');await p.waitForTimeout(300);if(await p.$eval('[data-gd=full]',e=>e.getAttribute('aria-pressed'))!=='true'){await p.tap('[data-gd=full]');await p.waitForTimeout(150)}
 L=await look(p);console.log('  capo 4 set:',L.capo,'|',L.ch.join(' '));
 ok(L.capo==='Capo 4'&&['Am','F','C','Dm'].every(n=>L.ch.includes(n))&&L.lv['Capo and shapes'][0]==='solid'&&/You set/.test(L.lv['Capo and shapes'][1]),'setting capo 4 from the video shows the shapes with capo 4 (Am F C Dm), marked as yours');
 ok(/Capo 4/.test(await p.$eval('.sesinfo',e=>e.textContent)),'the song’s header follows the capo you set');
 await p.screenshot({path:path.join(OUT,'capo_sheet.png'),fullPage:true});
 ok(!errs.length,'no page errors '+JSON.stringify(errs));await ctx.close();
 // ---- no sheet: the chords as they sound, no capo, and it says a capo can't be heard ----
 ({p,ctx,errs}=await run(false));L=await look(p);console.log('  no sheet:',L.capo,'|',L.ch.join(' '),'|',JSON.stringify(L.lv['Capo and shapes']));
 ok(L.capo==='No capo'&&L.ch.includes('C#m')&&L.ch.includes('F#m')&&!L.ch.includes('Am'),'without a sheet: no capo, the chords as they sound (no made-up capo 4)');
 ok(L.lv['Capo and shapes'][0]==='guess'&&/can’t be heard/.test(L.lv['Capo and shapes'][1])&&!!await p.$('[data-gdcapo]'),'it says a capo can’t be heard and offers to set it from the video');
 ok(!errs.length,'no page errors '+JSON.stringify(errs));await ctx.close();
 console.log(fail?`${fail} FAILED`:'all passed');await b.close();srv.close();process.exit(fail?1:0)})();
