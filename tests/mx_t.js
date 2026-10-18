// served over http (the mixer's audio worklet can't load from a file:// page); APP= tests a deployed copy
const http=require('http'),ROOT=require('path').resolve(__dirname,'..');
const srv=http.createServer((q,r)=>{const f=require('path').join(ROOT,decodeURIComponent(q.url.split('?')[0]).replace(/\/$/,'/index.html'));require('fs').readFile(f,(e,d)=>{if(e){r.writeHead(404);return r.end()}r.writeHead(200,{'content-type':/\.html$/.test(f)?'text/html':/\.js$/.test(f)?'text/javascript':'application/octet-stream'});r.end(d)})}).listen(0);
const APP=process.env.APP||`http://localhost:${srv.address().port}/index.html`;
// Practice mixer: sample rate, seams and saved formats, through the real ONNX Runtime Web (from node_modules)
// with a stand-in model of the same shape (fixtures/mx_stub.onnx: guitar = 0.6 × input, drums = 0.4 × input).
const {chromium}=require('playwright');const {execFileSync}=require('child_process');const fs=require('fs'),path=require('path');
const out=path.join(__dirname,'out');fs.mkdirSync(out,{recursive:true});
const ORT=path.join(__dirname,'node_modules/onnxruntime-web/dist/');
// a 10 s stereo test file with a 15 kHz tone (left) and 440 Hz (right), as FLAC and MP3, like the GitHub splitter returns
const mk=(ext,args)=>{const f=path.join(out,'mx_tone.'+ext);execFileSync('ffmpeg',['-y','-loglevel','error','-f','lavfi','-i','sine=f=15000:d=10:sample_rate=44100','-f','lavfi','-i','sine=f=440:d=10:sample_rate=44100','-filter_complex','[0][1]amerge=inputs=2',...args,f]);return fs.readFileSync(f)};
const FLAC=mk('flac',[]),MP3=mk('mp3',['-b:a','320k']);
let fail=0;const ok=(c,m)=>{console.log((c?'ok  ':'FAIL')+' '+m);if(!c)fail++};
(async()=>{const b=await chromium.launch({...(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{}),args:['--autoplay-policy=no-user-gesture-required']});
 const ctx=await b.newContext({viewport:{width:390,height:844}});
 // the runtime and model come from this machine instead of the CDN / Hugging Face
 await ctx.route(/cdn\.jsdelivr\.net\/npm\/onnxruntime-web@[^/]+\/dist\/(.+)$/,r=>{const f=path.join(ORT,r.request().url().match(/dist\/([^?]+)/)[1]);fs.existsSync(f)?r.fulfill({path:f,headers:{'access-control-allow-origin':'*'},contentType:/\.wasm$/.test(f)?'application/wasm':'text/javascript'}):r.fulfill({status:404})});
 await ctx.route('https://models.test/**',r=>r.fulfill({path:path.join(__dirname,'fixtures/mx_stub.onnx'),headers:{'access-control-allow-origin':'*'}}));
 // GitHub: the result branch of a split, as v3 (FLAC) and v2 (MP3, no format in done.json)
 const asked=[];
 await ctx.route('https://api.github.com/**',r=>{const u=r.request().url();asked.push(u);const ref=(u.match(/ref=r-(\w+)/)||[])[1];
  if(/done\.json/.test(u))return r.fulfill({body:JSON.stringify(ref==='c3'?{ok:true,format:'flac'}:{ok:true})});
  if(/\.flac\?/.test(u))return r.fulfill({body:FLAC});if(/\.mp3\?/.test(u))return r.fulfill({body:MP3});
  return r.fulfill({status:204,body:''})});
 const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.addInitScript(()=>{localStorage.setItem('tuner.userName','"Yoav"');localStorage.setItem('guitaring.gh',JSON.stringify({repo:'me/split',token:'t',branch:'main'}));
  window.__mxModelUrl='https://models.test/stub.onnx'});
 await p.goto(APP);await p.waitForTimeout(300);await p.waitForSelector('#wSkip',{state:'visible',timeout:2000}).then(()=>p.click('#wSkip')).catch(()=>{});
 await p.evaluate(()=>{
  // WAV file maker: L = 15 kHz sine, R = 440 Hz sine
  window.__wav=sec=>{const sr=44100,n=sr*sec,h=new DataView(new ArrayBuffer(44+n*4)),w=(o,s)=>{for(let i=0;i<s.length;i++)h.setUint8(o+i,s.charCodeAt(i))};
   w(0,'RIFF');h.setUint32(4,36+n*4,true);w(8,'WAVE');w(12,'fmt ');h.setUint32(16,16,true);h.setUint16(20,1,true);h.setUint16(22,2,true);h.setUint32(24,sr,true);h.setUint32(28,sr*4,true);h.setUint16(32,4,true);h.setUint16(34,16,true);w(36,'data');h.setUint32(40,n*4,true);
   for(let i=0;i<n;i++){h.setInt16(44+4*i,Math.round(Math.sin(2*Math.PI*15000*i/sr)*.5*32767),true);h.setInt16(46+4*i,Math.round(Math.sin(2*Math.PI*440*i/sr)*.5*32767),true)}
   return new File([h.buffer],'tone'+sec+'.wav',{type:'audio/wav'})};
  // level of one frequency in one channel of an int16 stereo track (1 s from a quarter of the way in)
  window.__lvl=(t,ch,f,sr)=>{const n=sr,s0=Math.floor(t.length/8)*2,k=2*Math.cos(2*Math.PI*f/sr);let a=0,b=0;for(let i=0;i<n;i++){const x=t[s0+2*i+ch]/32768,c=x+k*a-b;b=a;a=c}return Math.sqrt(Math.max(0,a*a+b*b-k*a*b))/(n/2)};
  window.__gtr=s=>s.tracks.filter(t=>/^g/.test(t.id));
 });
 const T='window.__mxTest';
 // 1. on-phone split of a short song: full 44.1 kHz, 15 kHz tone kept, no seams between windows
 const r1=await p.evaluate(async()=>{const M=__mxTest,f=__wav(20);await M.start(f);const s=M.song();if(!s||!s.tracks)return {err:document.getElementById('mixView').textContent.slice(0,200)};
  const G=__gtr(s),dv=new DataView(await f.arrayBuffer());let worst=0;
  for(let i=2048;i<s.len-2048;i+=3)for(let ch=0;ch<2;ch++){let sum=0;G.forEach(t=>sum+=t.data[2*i+ch]);worst=Math.max(worst,Math.abs(sum-dv.getInt16(44+4*i+2*ch,true)*.6))}
  const sumT=new Int16Array(G[0].data.length);G.forEach(t=>{for(let i=0;i<sumT.length;i++)sumT[i]+=t.data[i]});
  return {sr:s.sr,len:s.len,ids:s.tracks.map(t=>t.id),hi:__lvl(sumT,0,15000,s.sr),worst}});
 if(r1.err)console.log('split failed:',r1.err);
 ok(r1.sr===44100,`phone split keeps 44.1 kHz (sr ${r1.sr})`);ok(r1.len===20*44100,`whole song kept (${r1.len} samples)`);
 ok(r1.hi>.25,`15 kHz tone survives in the guitar part (level ${(r1.hi||0).toFixed(3)} of 0.3; at the old 22 kHz rate nothing above 11 kHz was kept)`);
 ok(r1.worst<=3,`no seams between the overlapping windows, edges aside (worst error ${r1.worst} of 32768)`);
 // 2. render (save my mix / send the guitars to chord analysis): WAV at the song's rate
 const r2=await p.evaluate(async()=>{const M=__mxTest,s=M.song(),bl=await M.render(s.tracks.map(t=>/^g/.test(t.id)?1:0)),d=new DataView(await bl.arrayBuffer());return {sr:d.getUint32(24,true),bytes:d.getUint32(40,true)}});
 ok(r2.sr===44100&&r2.bytes===20*44100*4,`rendered WAV is 44.1 kHz (${r2.sr} Hz, ${r2.bytes} bytes)`);
 // 3. saved and reopened: keeps its rate, plays at it
 const r3=await p.evaluate(async()=>{const M=__mxTest,id=M.song().id;M.reset();await M.open(id);return {sr:M.song().sr,ctx:await M.rate()}});
 ok(r3.sr===44100&&r3.ctx===44100,`reopened song plays at 44.1 kHz (song ${r3.sr}, player ${r3.ctx})`);
 // 4. a song saved before this change (22.05 kHz, no rate stored) opens at its own rate
 const r4=await p.evaluate(async()=>{const M=__mxTest,n=22050*3;await M.put('mixdata:old1',{len:n,tracks:[{id:'guitar',name:'Guitars',data:new Int16Array(n*2)}]});M.add({id:'old1',name:'Old song',at:1,src:'phone',state:'ready'});
  M.reset();await M.open('old1');const r=await M.rate();return {sr:M.song().sr,ctx:r,time:(document.getElementById('mxT')||{}).textContent}});
 ok(r4.sr===22050&&r4.ctx===22050,`older 22 kHz song still opens at 22 kHz (song ${r4.sr}, player ${r4.ctx}, ${r4.time})`);
 // 5. GitHub parts: FLAC from splitter v3 at full rate; MP3 from v2 still collected
 const r5=await p.evaluate(async()=>{const M=__mxTest,run=async(id)=>{const it={id,name:'Cloud '+id,at:1,src:'cloud',state:'wait'};M.add(it);await M.collect(it);M.reset();await M.open(id);const s=M.song();return {state:it.state,sr:s&&s.sr,hi:s?__lvl(__gtr(s).reduce((a,t)=>{t.data.forEach((v,i)=>a[i]+=v);return a},new Int16Array(__gtr(s)[0].data.length)),0,15000,s.sr):0}};
  return {v3:await run('c3'),v2:await run('c2')}});
 ok(r5.v3.state==="ready"&&r5.v3.sr===44100&&r5.v3.hi>.11,`FLAC parts from GitHub open at 44.1 kHz with the 15 kHz tone (level ${r5.v3.hi.toFixed(3)} of 0.125, ffmpeg’s tone level)`);
 ok(r5.v2.state==='ready'&&asked.filter(u=>/\.flac\?ref=r-c3/.test(u)).length===6&&asked.filter(u=>/\.mp3\?ref=r-c2/.test(u)).length===6,`older MP3 splits still collected (state ${r5.v2.state})`);
 // 6. a song over 5 minutes is kept at 22 kHz so the phone's memory holds
 const r6=await p.evaluate(async()=>{const M=__mxTest;M.reset();await M.start(__wav(305));const s=M.song();return {sr:s&&s.sr,len:s&&s.len}});
 ok(r6.sr===22050&&Math.abs(r6.len-305*22050)<=1,`5+ minute song kept at 22 kHz (sr ${r6.sr}, ${r6.len} samples)`);
 // 7. the splitter the app installs on GitHub is v3: 3 shifts, 50% overlap, FLAC
 const wf=await p.evaluate(()=>document.getElementById('mxWf').textContent);
 ok(/guitaring-split v9/.test(wf)&&/drive\.json/.test(wf)&&/--shifts 3 --overlap 0\.5 --flac/.test(wf)&&/\\"format\\":\\"flac\\"/.test(wf)&&/Take stills from the video/.test(wf)&&/stills\.bin/.test(wf),'GitHub splitter is v9 (3 shifts, 50% overlap, FLAC; can fetch from Google Drive; takes video stills)');
 ok(!errs.length,'no page errors '+JSON.stringify(errs));
 console.log(fail?`${fail} FAILED`:'all passed');await b.close();srv.close();process.exit(fail?1:0)})();
