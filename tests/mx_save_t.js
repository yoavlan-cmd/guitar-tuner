// Practice mixer › Save this mix / guitars for chord analysis: the file has exactly the chosen parts, never silently empty.
const {chromium}=require('playwright');const path=require('path'),fs=require('fs'),http=require('http');
const ROOT=path.resolve(__dirname,'..');
const srv=http.createServer((q,r)=>{const f=path.join(ROOT,decodeURIComponent(q.url.split('?')[0]).replace(/\/$/,'/index.html'));fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);return r.end()}r.writeHead(200,{'content-type':/\.html$/.test(f)?'text/html':'application/octet-stream'});r.end(d)})}).listen(0);
const APP=process.env.APP||`http://localhost:${srv.address().port}/index.html`;
let fail=0;const ok=(c,m)=>{console.log((c?'ok  ':'FAIL')+' '+m);if(!c)fail++};
(async()=>{const b=await chromium.launch({...(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{}),args:['--autoplay-policy=no-user-gesture-required']});
 const ctx=await b.newContext({viewport:{width:390,height:844},acceptDownloads:true});await ctx.route(/^https:\/\//,r=>r.abort());
 const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.addInitScript(()=>{localStorage.setItem('tuner.userName','"Yoav"')});
 await p.goto(APP);await p.waitForTimeout(300);if(await p.$('#wSkip:visible'))await p.click('#wSkip');
 // three saved songs, 3 s at 44.1 kHz: guitars = 3000-level square wave L/R, drums = 9000, vocals = 5000
 //  s1: normal · s2: the guitar parts are silent · s3: the bass part is shorter than the song
 await p.evaluate(async()=>{const M=window.__mxTest,sr=44100,n=sr*3,mk=v=>{const a=new Int16Array(n*2);for(let i=0;i<n*2;i++)a[i]=((i>>6)&1?v:-v);return a};
  const song=(g,short)=>({len:n,sr,tracks:[{id:'gL',name:'Guitar · left',data:mk(g)},{id:'gR',name:'Guitar · right',data:mk(g)},{id:'vocals',name:'Vocals',data:mk(5000)},{id:'drums',name:'Drums',data:mk(9000)},{id:'bass',name:'Bass',data:short?mk(4000).slice(0,n):mk(4000)}]});
  await M.put('mixdata:s1',song(3000));M.add({id:'s1',name:'Song one',at:3,src:'phone',state:'ready'});
  await M.put('mixdata:s2',song(0));M.add({id:'s2',name:'Song two',at:2,src:'phone',state:'ready'});
  await M.put('mixdata:s3',song(3000,true));M.add({id:'s3',name:'Song three',at:1,src:'phone',state:'ready'});});
 const openSong=async id=>{await p.evaluate(async id=>{const M=window.__mxTest;M.reset();await M.open(id);const sh=document.getElementById('mxSheet');sh.hidden=false;sh.classList.add('open')},id);await p.waitForTimeout(200)};
 // Save: resolves with the file, or null when the app shows a message instead (whichever comes first)
 const save=async()=>{await p.evaluate(()=>{const t=document.getElementById('toast');if(t)t.hidden=true});
  const dl=p.waitForEvent('download',{timeout:10000}).then(async d=>{const buf=fs.readFileSync(await d.path());const x=[];for(let i=44;i+1<buf.length;i+=2)x.push(buf.readInt16LE(i));return {sr:buf.readUInt32LE(24),x}}).catch(()=>null);
  const msg=p.waitForFunction(()=>{const t=document.getElementById('toast');return t&&!t.hidden&&t.textContent},null,{timeout:10000}).then(()=>null).catch(()=>null);
  await p.click('#mxSave');return Promise.race([dl,msg])};
 const peak=x=>x.reduce((m,v)=>Math.max(m,Math.abs(v)),0);
 // 1. Guitars only, after playing for a moment (the way it is used), then Save
 await openSong('s1');await p.click('#mxPlay');await p.waitForTimeout(800);await p.click('[data-pre=gtr]');await p.waitForTimeout(300);await p.click('#mxPlay');
 let f=await save();
 ok(f&&f.sr===44100&&f.x.length===44100*3*2,`a full-length 44.1 kHz file is saved (${f&&f.x.length} samples)`);
 ok(f&&peak(f.x)===6000,`it holds exactly the two guitar parts (peak ${f&&peak(f.x)}, expected 3000+3000)`);
 // 2. the same after switching back to Everything: all parts
 await p.click('[data-pre=all]');f=await save();ok(f&&peak(f.x)===Math.min(32767,6000+5000+9000+4000),`"Everything" holds all parts (peak ${f&&peak(f.x)})`);
 // 3. a song whose guitar parts are silent: a message instead of an empty file
 await openSong('s2');await p.click('[data-pre=gtr]');f=await save();
 const toast=await p.$eval('#toast',e=>e.hidden?'':e.textContent).catch(()=>'');
 ok(!f&&/silent/.test(toast),'silent guitars: no empty file, and the app says why ('+toast+')');
 // 4. everything muted
 await openSong('s1');for(let k=0;k<5;k++)await p.click(`[data-mute="${k}"]`);f=await save();
 const toast2=await p.$eval('#toast',e=>e.hidden?'':e.textContent).catch(()=>'');ok(!f&&/muted/.test(toast2),'all parts muted: says so ('+toast2+')');
 // 5. a part shorter than the song doesn't wipe the file
 await openSong('s3');await p.click('[data-pre=all]');f=await save();
 const tail=f&&f.x.slice(f.x.length-2000);ok(f&&peak(tail)>0,'a shorter part leaves the rest of the mix intact to the end');
 // 6. guitars for chord analysis goes through the same render
 await openSong('s1');await p.click('#mxChords');await p.waitForTimeout(800);
 ok(await p.$eval('#readyCard',e=>!e.hidden)&&/\(guitars\)\.wav/.test(await p.$eval('#readyFile',e=>e.textContent)),'"Find the chords from the guitars only" hands a guitars file to the analysis');
 ok(!errs.length,'no page errors '+JSON.stringify(errs));
 console.log(fail?`${fail} FAILED`:'all passed');await b.close();srv.close();process.exit(fail?1:0)})();
