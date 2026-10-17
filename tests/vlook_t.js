// Sound and video together (V2 phase 4): building a song's session also looks at its video in Drive, when Claude is on.
// The guitar part (generated) is C#m · A · E · F#, its F# with a clear major 3rd (so the sound alone keeps it major). The song's video
// (generated, in its Drive folder) is shown to a stand-in Claude that sees capo 4 and the shapes Am · F · C · Dm (= C#m A E F#m), and
// one frame where the hand plays something else. First built without Drive (the video is skipped, the guide says so and offers
// a check); then "Rebuild and check the video": the capo comes from the video, F# becomes F#m, the disagreement is named.
const {chromium}=require('playwright');const path=require('path'),fs=require('fs'),http=require('http');const {execFileSync}=require('child_process');
const ROOT=path.resolve(__dirname,'..'),OUT=path.join(__dirname,'out');fs.mkdirSync(OUT,{recursive:true});
const srv=http.createServer((q,r)=>{const f=path.join(ROOT,decodeURIComponent(q.url.split('?')[0]).replace(/\/$/,'/index.html'));fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);return r.end()}r.writeHead(200,{'content-type':/\.html$/.test(f)?'text/html':'application/octet-stream'});r.end(d)})}).listen(0);
const APP=process.env.APP||`http://localhost:${srv.address().port}/index.html`;
// a JPEG's width and height from its frame header
const jpgSize=b64=>{const d=Buffer.from(b64,'base64');for(let i=2;i<d.length-9;){if(d[i]!==0xFF){i++;continue}const m=d[i+1];if(m>=0xC0&&m<=0xC3)return d.readUInt16BE(i+7)+'x'+d.readUInt16BE(i+5);i+=2+d.readUInt16BE(i+2)}return ''};
let fail=0;const ok=(c,m)=>{console.log((c?'ok  ':'FAIL')+' '+m);if(!c)fail++};
// a guitar part like the one that met this ("במקום בו אני גר", guitars only): C#m · A · E · F#m, 4.6 s each, mostly root and 5th;
// each minor 3rd is faint, and the root's own overtone on the major 3rd is a little louder (so the 3rd alone would say "major")
const N=(n,o)=>440*Math.pow(2,(({C:0,'C#':1,D:2,Eb:3,E:4,F:5,'F#':6,G:7,Ab:8,A:9,Bb:10,B:11})[n]-9)/12+(o-4));
const V={'C#m':[[N('C#',3),1],[N('Ab',3),1],[N('C#',4),.9],[N('Ab',4),.6],[N('E',4),.5]],
 A:[[N('A',2),1],[N('E',3),1],[N('A',3),.9],[N('E',4),.6],[N('C#',4),.3]],
 E:[[N('E',2),1],[N('B',2),1],[N('E',3),.9],[N('B',3),.6],[N('Ab',3),.3]],
 'F#':[[N('F#',2),1],[N('C#',3),1],[N('F#',3),.9],[N('C#',4),.6],[N('Bb',3),.5]]};
const seq=['C#m','A','E','F#','C#m','A','E','F#','C#m','A','E','F#'];
const expr=seq.map((c,i)=>{const t0=i*4.6;return V[c].map(([f,a])=>`${a}*between(t,${t0},${t0+4.6})*sin(2*PI*${f.toFixed(2)}*t)*exp(-1.5*mod(t-${t0},0.58))`).join('+')}).join('+');
const GTR=path.join(OUT,'vl_gtr.flac');execFileSync('ffmpeg',['-y','-v','error','-f','lavfi','-i',`aevalsrc='(${expr})*0.07':s=44100:d=${seq.length*4.6}`,'-ac','2',GTR]);
const VID=path.join(OUT,'vl_video.webm');execFileSync('ffmpeg',['-y','-v','error','-f','lavfi','-i',`testsrc=size=320x240:rate=10:duration=${seq.length*4.6}`,'-c:v','libvpx','-b:v','200k',VID]);
const SHAPE={'C#m':'Am',A:'F',E:'C','F#':'Dm'};// what the stand-in Claude "sees" with capo 4
(async()=>{const b=await chromium.launch({...(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{})});
 const ctx=await b.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});await ctx.route(/ideas\.json/,r=>r.abort());
 const calls={list:0,media:0,claude:0,images:0,prompt:'',find:0,nohand:false};const vbytes=fs.readFileSync(VID);
 await ctx.route(/^https:\/\//,async r=>{const u=r.request().url(),H={'access-control-allow-origin':'*'};
  if(/googleapis\.com\/drive\/v3\/files\?/.test(u)){calls.list++;return r.fulfill({contentType:'application/json',headers:H,body:JSON.stringify({files:[{id:'vid1',name:'Test Band - Video Song.webm',webViewLink:'https://drive.google.com/file/d/vid1/view'},{id:'oth',name:'Another song.mp4'}]})})}
  if(/googleapis\.com\/drive\/v3\/files\/vid1\?alt=media/.test(u)){calls.media++;return r.fulfill({contentType:'video/webm',headers:H,body:vbytes})}
  if(/api\.anthropic\.com\/v1\/messages/.test(u)){calls.claude++;const body=JSON.parse(r.request().postData()||'{}'),c=body.messages[0].content,txt=(c.find(x=>x.type==='text')||{}).text||'';calls.images+=c.filter(x=>x.type==='image').length;
   if(/contact sheets/.test(txt)){const n=c.filter(x=>x.type==='image').length;calls.find++;calls.sheets=n;calls.sheetSize=jpgSize(c.find(x=>x.type==='image').source.data);calls.tilesSaid=(txt.match(/up to (\d+) tiles/)||[])[1];return r.fulfill({contentType:'application/json',headers:H,body:JSON.stringify({content:[{type:'text',text:JSON.stringify({tiles:[...Array(n)].flatMap((_,si)=>[...Array(9)].map((_,k)=>({sheet:si+1,tile:k+1,clear:!calls.nohand,box:calls.nohand?null:[.2,.2,.8,.8],quality:calls.nohand?null:'high'})))})}]})})}
   calls.prompt=txt;
   const ts=((txt.match(/taken at ([^\n]+?)\.\n/)||[])[1]||'').split(',').map(x=>parseFloat(x));let lastE=-1;ts.forEach((t,i)=>{if(seq[Math.floor(t/4.6)]==='E')lastE=i});
   const frames=ts.map((t,i)=>({t,shape:i===lastE?'G':SHAPE[seq[Math.floor(t/4.6)]],conf:'high'}));
   return r.fulfill({contentType:'application/json',headers:H,body:JSON.stringify({content:[{type:'text',text:JSON.stringify({capo:4,capo_conf:'high',frames})}]})})}
  return r.abort()});
 const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.addInitScript(()=>{window.__mxPollMs=1e9;window.__notes=[];window.Notification=class{static get permission(){return 'granted'}static requestPermission(){return Promise.resolve('granted')}constructor(t){window.__notes.push(t)}};
  if(window.ServiceWorkerRegistration)ServiceWorkerRegistration.prototype.showNotification=function(t){window.__notes.push(t);return Promise.resolve()};
  if(sessionStorage.x)return;sessionStorage.x=1;localStorage.setItem('tuner.userName','"Yoav"');localStorage.setItem('tuner.profile',JSON.stringify({name:'Yoav',level:'intermediate',onboarding:{done:true}}));localStorage.setItem('tuner.learnLang','"en"');localStorage.setItem('tuner.apiKey','"sk-test"')});
 await p.goto(APP);await p.waitForTimeout(400);
 const b64=fs.readFileSync(GTR).toString('base64');
 await p.evaluate(async b64=>{const u=Uint8Array.from(atob(b64),c=>c.charCodeAt(0)),gtr=new Blob([u],{type:'audio/flac'});
  await window.__bk.put('mixdata:v1',{stems:{guitar:gtr}});
  await window.__bk.put('mixIndex',[{id:'v1',name:'Test Band - Video Song',at:Date.now(),src:'cloud',state:'ready',sess:'queued',drive:{file:'a1',folder:'fold1',ok:true}}])},b64);
 const done=()=>p.waitForFunction(()=>{const it=window.__mxTest.idx().find(x=>x.id==='v1');return it&&(it.sess==='done'||it.sess==='failed')},null,{timeout:180000}).catch(()=>{});
 const ana=()=>p.evaluate(()=>JSON.parse(localStorage.getItem('tuner.song.mix_v1')||'null'));
 // ---- 1. built after a restart: Drive isn't signed in during this visit, so the video is skipped and the guide says so ----
 await p.reload();await p.waitForTimeout(300);await done();let a=await ana();
 ok(a&&a.video&&a.video.skip==='drive'&&calls.media===0&&calls.claude===0,'without Drive this visit: the session is built from the sound, the video skipped ('+JSON.stringify(a&&a.video)+')');
 await p.tap('#bnav [data-sec=learn]');await p.waitForTimeout(300);await p.tap('#learnList .lrow:has-text("Video Song")');await p.waitForTimeout(500);
 if(await p.$eval('[data-gd=full]',e=>e.getAttribute('aria-pressed'))!=='true'){await p.tap('[data-gd=full]');await p.waitForTimeout(150)}
 ok(/video wasn’t looked at/.test(await p.$eval('#sesGuide',e=>e.textContent))&&!!await p.$('#vlCheck'),'the guide says the video wasn’t looked at, and offers “Rebuild and check the video”');
 ok(/and the video/.test(await p.$eval('#sesRebuild',e=>e.textContent)),'Rebuild says it uses the video too');
 const before=await p.$$eval('#gdBody .seschords svg .dgName',l=>l.map(x=>x.textContent));console.log('  sound only:',await p.$eval('.gdbig b',e=>e.textContent),'|',before.join(' '));
 ok(before.includes('F#')&&!before.includes('F#m'),'from the sound only, the F# (clear major 3rd) stays F#');
 // ---- 2. rebuild with the video (Drive signed in) ----
 await p.evaluate(()=>window.__vl.setTok('tok'));
 await p.tap('#vlCheck');await p.waitForTimeout(100);
 let lab='';for(let i=0;i<200&&!/video/.test(lab);i++){lab=await p.$eval('#mxBar',e=>e.hidden?'':e.innerText.replace(/\s+/g,' ')).catch(()=>'');if(!/video/.test(lab))await p.waitForTimeout(150)}
 console.log('  bar:',lab);ok(/Looking at the song’s video/.test(lab),'while it looks, the bar says “Looking at the song’s video”');
 await done();await p.waitForTimeout(400);a=await ana();console.log('  video:',JSON.stringify(a.video&&{capo:a.video.capo,agree:a.video.agree,differ:a.video.differ,fixed:a.video.fixed,asked:a.video.asked}));
 {const asked=(await ana()).video.asked;console.log('  find: '+calls.sheets+' sheets of '+calls.sheetSize+', '+asked+' moments');
  ok(calls.sheetSize==='1440x810'&&calls.tilesSaid==='4'&&calls.sheets===Math.ceil(asked/4),'the hand is looked for on sheets of 4 tiles, each 720 wide (a hand in a wide shot stays big enough)');}
 ok(calls.list===1&&calls.media===1&&calls.claude===2&&calls.find===1,`the video was found in the song’s folder, read once; two Claude calls (find the hand, then read the close-ups), ${calls.images} pictures in all`);
 ok(!/heard|C#m|E · |\bF#\b(?!m)/.test(calls.prompt)&&(calls.prompt.match(/F#m/g)||[]).length===1,'Claude isn’t told what the sound heard (only the example shape name is in the question)');
 ok(a.video.capo===4&&a.play.capoBy==='video','the capo comes from the video: 4');
 const R=['C','C#','D','Eb','E','F','F#','G','Ab','A','Bb','B'],T=['','m','7','m7','maj7','sus2','sus4','add9'],nm=c=>R[Math.floor(c/8)]+T[c%8];
 const names=[...new Set(a.segs.filter(s=>s[2]<96).map(s=>nm(s[2])))];console.log('  chords now:',names.join(' '));
 ok(names.includes('F#m')&&!names.includes('F#')&&a.video.fixed.some(x=>/F# → F#m/.test(x)),'the hand shows F#m where the sound heard F#: set to F#m');
 ok(a.video.differ.length===1&&a.video.differ[0].heard==='E'&&a.video.differ[0].seen==='B','the one frame where the hand plays something else is kept as a disagreement (heard E, seen B)');
 // the guide
 if(await p.$eval('[data-gd=full]',e=>e.getAttribute('aria-pressed'))!=='true'){await p.tap('[data-gd=full]');await p.waitForTimeout(150)}
 const ch=await p.$$eval('#gdBody .seschords svg .dgName',l=>l.map(x=>x.textContent)),cp=await p.$eval('.gdbig b',e=>e.textContent);console.log('  guide:',cp,'|',ch.join(' '));
 ok(cp==='Capo 4'&&['Am','F','C','Dm'].every(n=>ch.includes(n)),'Full: Capo 4 · Am F C Dm, the shapes in the video');
 const lv=await p.$$eval('.gdsure li',l=>Object.fromEntries(l.map(x=>[x.querySelector('span').textContent,[x.querySelector('.gdlv').className.split(' ')[1],x.querySelector('small').textContent]])));
 ok(lv['Capo and shapes'][0]==='solid'&&/Seen in the song’s video/.test(lv['Capo and shapes'][1]),'How sure: capo solid, seen in the video');
 ok(/video shows something else at \d:\d\d \(heard E, the hand plays B\)/.test(lv['Chords and order'][1]),'How sure names where the video disagrees: '+lv['Chords and order'][1]);
 ok(/Checked against the video: the hand was clear at \d+ of \d+ moments; capo on fret 4/.test(await p.$eval('.vlnote',e=>e.textContent).catch(()=>'')),'the guide says it was checked against the video');
 await p.screenshot({path:path.join(OUT,'vlook.png'),fullPage:true});
 // ---- 3. a video where the guitarist's hand is never shown clearly: one Claude call only (no close-ups), and the guide says so ----
 calls.nohand=true;const before3=calls.claude;await p.evaluate(()=>window.__vl.setTok('tok'));await p.tap('#sesRebuild');await done();await p.waitForTimeout(400);
 const a3=await ana();console.log('  no hand:',JSON.stringify(a3.video&&{nohand:a3.video.nohand,asked:a3.video.asked,frames:a3.video.frames.length}));
 ok(calls.claude-before3===1&&a3.video.nohand&&a3.play.capoBy!=='video','a video that never shows the hand clearly: one Claude call only, nothing taken from it');
 if(await p.$eval('[data-gd=full]',e=>e.getAttribute('aria-pressed'))!=='true'){await p.tap('[data-gd=full]');await p.waitForTimeout(150)}
 const src3=await p.$$eval('.gdsrc li',l=>l.map(x=>[x.className,x.textContent]));const v3=src3.find(x=>/The video/.test(x[1]))||[];console.log('  video line:',JSON.stringify(v3));
 ok(v3[0]==='n'&&/fretting hand isn’t shown clearly/.test(v3[1]),'Built from lists the video as not helping, and why');
 ok(!errs.length,'no page errors '+JSON.stringify(errs));
 console.log(fail?`${fail} FAILED`:'all passed');await b.close();srv.close();process.exit(fail?1:0)})();
