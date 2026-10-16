// Practice mixer: a file with no sound in it is stopped before it is split (GitHub or phone), and a split whose parts all came back
// silent says why instead of playing nothing.
const {chromium}=require('playwright');const path=require('path'),fs=require('fs'),http=require('http');
const ROOT=path.resolve(__dirname,'..');
const srv=http.createServer((q,r)=>{const f=path.join(ROOT,decodeURIComponent(q.url.split('?')[0]).replace(/\/$/,'/index.html'));fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);return r.end()}r.writeHead(200,{'content-type':/\.html$/.test(f)?'text/html':'application/octet-stream'});r.end(d)})}).listen(0);
const APP=process.env.APP||`http://localhost:${srv.address().port}/index.html`;
let fail=0;const ok=(c,m)=>{console.log((c?'ok  ':'FAIL')+' '+m);if(!c)fail++};
(async()=>{const b=await chromium.launch({...(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{})});
 const ctx=await b.newContext({viewport:{width:390,height:844}});let ghCalls=0;
 await ctx.route('https://api.github.com/**',r=>{ghCalls++;r.fulfill({status:500,headers:{'access-control-allow-origin':'*'},body:'{}'})});
 await ctx.route(/^https:\/\/(?!api\.github\.com)/,r=>r.abort());
 const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.addInitScript(()=>{localStorage.setItem('tuner.userName','"Yoav"');localStorage.setItem('guitaring.gh',JSON.stringify({repo:'me/split',token:'t',branch:'main'}));window.__mxWaitScale=0.001;window.__mxPollMs=1e9;
  // 16-bit stereo WAV, 44.1 kHz; level 0 = silence
  window.__wav=(sec,level)=>{const sr=44100,n=sr*sec,h=new DataView(new ArrayBuffer(44)),w=(o,s)=>{for(let i=0;i<s.length;i++)h.setUint8(o+i,s.charCodeAt(i))},d=new Int16Array(n*2);
   for(let i=0;i<n;i++)d[2*i]=d[2*i+1]=Math.round(level*Math.sin(i*2*Math.PI*220/sr));
   w(0,'RIFF');h.setUint32(4,36+n*4,true);w(8,'WAVE');w(12,'fmt ');h.setUint32(16,16,true);h.setUint16(20,1,true);h.setUint16(22,2,true);h.setUint32(24,sr,true);h.setUint32(28,sr*4,true);h.setUint16(32,4,true);h.setUint16(34,16,true);w(36,'data');h.setUint32(40,n*4,true);
   return new Blob([h.buffer,d.buffer],{type:'audio/wav'})}});
 await p.goto(APP);await p.waitForTimeout(300);await p.waitForSelector('#wSkip',{state:'visible',timeout:2000}).then(()=>p.click('#wSkip')).catch(()=>{});
 const toast=()=>p.$eval('#toast',e=>({t:e.hidden?'':e.textContent,err:e.classList.contains('err')})).catch(()=>({t:'',err:false}));
 // 1. GitHub: a silent WAV (like the silent "(my mix).wav") is not sent
 const n0=await p.evaluate(()=>window.__mxTest.idx().length);
 await p.evaluate(async()=>{await window.__mxTest.send(new File([window.__wav(3,0)],'Tuna (my mix).wav',{type:'audio/wav'}))});
 let t=await toast();
 ok(await p.evaluate(()=>window.__mxTest.idx().length)===n0&&ghCalls===0,'a silent file is not sent to GitHub');
 ok(t.err&&/no sound/.test(t.t),'and a red message says it has no sound: '+t.t);
 // 2. a file with sound goes ahead (GitHub answers 500 here, so it fails later — but it was sent)
 await p.evaluate(async()=>{await window.__mxTest.send(new File([window.__wav(3,4000)],'Real song.wav',{type:'audio/wav'}))});
 ok(ghCalls>0&&await p.evaluate(()=>window.__mxTest.idx().length)===n0+1,'a file with sound is sent');
 // 3. a file the phone can't read is still sent (GitHub may read it)
 ghCalls=0;await p.evaluate(async()=>{await window.__mxTest.send(new File([new Uint8Array(2048)],'odd.mp3',{type:'audio/mpeg'}))});ok(ghCalls>0,'a file the phone can’t check is still sent');
 // 4. on the phone: a silent file stops before the model download
 await p.evaluate(()=>{window.__mxTest.start(new File([window.__wav(3,0)],'silent.wav',{type:'audio/wav'}))});await p.waitForTimeout(1500);
 ok(/no sound/.test(await p.$eval('#mixView',e=>e.textContent)),'splitting on the phone says the file has no sound');
 // 5. an earlier split whose parts all came back silent says why when opened
 await p.evaluate(async()=>{const M=window.__mxTest,st={};for(const s of ['drums','bass','other','vocals','guitar','piano'])st[s]=window.__wav(2,0);await M.put('mixdata:z1',{stems:st});M.add({id:'z1',name:'Silent one',at:1,src:'cloud',state:'ready'});M.reset&&M.reset();await M.open('z1')});
 await p.waitForTimeout(500);t=await toast();
 ok(t.err&&/Every part of this song is silent/.test(t.t),'opening an all-silent split says why: '+t.t);
 ok(!errs.length,'no page errors '+JSON.stringify(errs));
 console.log(fail?`${fail} FAILED`:'all passed');await b.close();srv.close();process.exit(fail?1:0)})();
