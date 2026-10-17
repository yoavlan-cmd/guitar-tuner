// All sources together (V2 phase 4): the guitars-only part (main), the whole song (every split part but the drums), the video's
// stills that GitHub took during the split (splitter v5; no Drive or download on the phone), and a chord sheet as a check.
// The guitar part is C#m · A · E · B, its B's 3rd faint (the guitar can't tell, and the song's key would say B major); a piano part
// plays Bm clearly (a borrowed chord), so the whole song settles it. The stills are made by the splitter's own step (its Python, run here on a generated video) and shown to a stand-in
// Claude (capo 0, the shapes as heard). The guide lists what it was built from: all four.
const {chromium}=require('playwright');const path=require('path'),fs=require('fs'),http=require('http');const {execFileSync}=require('child_process');
const ROOT=path.resolve(__dirname,'..'),OUT=path.join(__dirname,'out');fs.mkdirSync(OUT,{recursive:true});
const srv=http.createServer((q,r)=>{const f=path.join(ROOT,decodeURIComponent(q.url.split('?')[0]).replace(/\/$/,'/index.html'));fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);return r.end()}r.writeHead(200,{'content-type':/\.html$/.test(f)?'text/html':'application/octet-stream'});r.end(d)})}).listen(0);
const APP=process.env.APP||`http://localhost:${srv.address().port}/index.html`;
let fail=0;const ok=(c,m)=>{console.log((c?'ok  ':'FAIL')+' '+m);if(!c)fail++};
// a guitar part like the one that met this ("במקום בו אני גר", guitars only): C#m · A · E · F#m, 4.6 s each, mostly root and 5th;
// each minor 3rd is faint, and the root's own overtone on the major 3rd is a little louder (so the 3rd alone would say "major")
const N=(n,o)=>440*Math.pow(2,(({C:0,'C#':1,D:2,Eb:3,E:4,F:5,'F#':6,G:7,Ab:8,A:9,Bb:10,B:11})[n]-9)/12+(o-4));
const seq=['C#m','A','E','B','C#m','A','E','B','C#m','A','E','B'];
const G={'C#m':[[N('C#',3),1],[N('Ab',3),1],[N('C#',4),.9],[N('Ab',4),.6],[N('E',4),.45]],A:[[N('A',2),1],[N('E',3),1],[N('A',3),.9],[N('E',4),.6],[N('C#',4),.4]],
 E:[[N('E',2),1],[N('B',2),1],[N('E',3),.9],[N('B',3),.6],[N('Ab',3),.4]],B:[[N('B',2),1],[N('F#',3),1],[N('B',3),.9],[N('F#',4),.6],[N('D',4),.2],[N('Eb',4),.23]]};
const P={'C#m':['C#','E','Ab'],A:['A','C#','E'],E:['E','Ab','B'],B:['B','D','F#']};// the piano: Bm clearly (D natural)
const gen=(fn,amp,file)=>{const expr=seq.map((c,i)=>{const t0=i*4.6;return fn(c).map(([f,a])=>`${a}*between(t,${t0},${t0+4.6})*sin(2*PI*${f.toFixed(2)}*t)*exp(-1.2*mod(t-${t0},1.15))`).join('+')}).join('+');
 execFileSync('ffmpeg',['-y','-v','error','-f','lavfi','-i',`aevalsrc='(${expr})*${amp}':s=44100:d=${seq.length*4.6}`,'-ac','2',file]);return file};
const GTR=gen(c=>G[c],.07,path.join(OUT,'all_gtr.flac')),PNO=gen(c=>P[c].map(n=>[N(n,4),1]),.09,path.join(OUT,'all_pno.flac'));
// the drums: a kick on every beat (0.575 s, 104 BPM), so the beat is clear
const DRM=path.join(OUT,'all_drm.flac');execFileSync('ffmpeg',['-y','-v','error','-f','lavfi','-i',`aevalsrc='0.6*sin(2*PI*55*t)*exp(-25*mod(t,0.575))+0.3*(random(0)-0.5)*exp(-60*mod(t,0.575))':s=44100:d=${seq.length*4.6}`,'-ac','2',DRM]);
// the stills, made by the splitter's own step on a generated video
const W=path.join(OUT,'all_wf');fs.mkdirSync(path.join(W,'job'),{recursive:true});fs.mkdirSync(path.join(W,'res'),{recursive:true});
execFileSync('ffmpeg',['-y','-v','error','-f','lavfi','-i',`testsrc=size=320x240:rate=10:duration=${seq.length*4.6}`,'-c:v','libx264','-pix_fmt','yuv420p',path.join(W,'job','song.mp4')]);
{const wf=fs.readFileSync(path.join(__dirname,'..','src','parts','15-splitter-workflow.html'),'utf8'),i=wf.indexOf('- name: Take stills from the video'),run=wf.slice(i,wf.indexOf('- name: Report a failure',i));
 const py=run.slice(run.indexOf("<<'PY' 2>&1 | tee -a log.txt\n")+29,run.lastIndexOf('PY')).split('\n').map(l=>l.slice(10)).join('\n');fs.writeFileSync(path.join(W,'stills.py'),py);
 execFileSync('python3',['-I',path.join(W,'stills.py')],{cwd:W})}
const STJ=JSON.parse(fs.readFileSync(path.join(W,'res','stills.json'))),STB=fs.readFileSync(path.join(W,'res','stills.bin'));
const SHAPE={'C#m':'C#m',A:'A',E:'E',B:'Bm'};// the stand-in Claude sees no capo and these shapes
const SHEET={title:'Video Song',artist:'Test Band',capo:0,tuning:'Standard',chords:['C#m','A','E','Bm'],src:'phone',at:'2026-10-11'};
(async()=>{const b=await chromium.launch({...(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{})});
 const ctx=await b.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});await ctx.route(/ideas\.json/,r=>r.abort());
 const calls={drive:0,claude:0,images:0,find:0,read:0,readImgs:0};
 await ctx.route(/^https:\/\//,async r=>{const u=r.request().url(),H={'access-control-allow-origin':'*'};
  if(/googleapis\.com\/(drive|upload)/.test(u)){calls.drive++;return r.abort()}
  if(/api\.anthropic\.com\/v1\/messages/.test(u)){calls.claude++;const body=JSON.parse(r.request().postData()||'{}'),c=body.messages[0].content,txt=(c.find(x=>x.type==='text')||{}).text||'';calls.images+=c.filter(x=>x.type==='image').length;
   // step 1 (find): every tile shows the hand, in its middle
   if(/contact sheets/.test(txt)){const n=c.filter(x=>x.type==='image').length;calls.find++;return r.fulfill({contentType:'application/json',headers:H,body:JSON.stringify({content:[{type:'text',text:JSON.stringify({tiles:[...Array(n)].flatMap((_,si)=>[...Array(9)].map((_,k)=>({sheet:si+1,tile:k+1,clear:true,box:[.3,.3,.7,.7],quality:'high'})))})}]})})}
   calls.read++;calls.readImgs=c.filter(x=>x.type==='image').length;
   const ts=((txt.match(/taken at ([^\n]+?)\.\n/)||[])[1]||'').split(',').map(x=>parseFloat(x));
   return r.fulfill({contentType:'application/json',headers:H,body:JSON.stringify({content:[{type:'text',text:JSON.stringify({capo:0,capo_conf:'high',frames:ts.map(t=>({t,shape:SHAPE[seq[Math.min(seq.length-1,Math.floor(t/4.6))]],conf:'high'}))})}]})})}
  return r.abort()});
 const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.addInitScript(SH=>{window.__mxPollMs=1e9;window.__notes=[];window.Notification=class{static get permission(){return 'granted'}static requestPermission(){return Promise.resolve('granted')}constructor(t){window.__notes.push(t)}};
  if(window.ServiceWorkerRegistration)ServiceWorkerRegistration.prototype.showNotification=function(t){window.__notes.push(t);return Promise.resolve()};
  if(sessionStorage.x)return;sessionStorage.x=1;const S=(k,v)=>localStorage.setItem('tuner.'+k,JSON.stringify(v));S('userName','Yoav');S('profile',{name:'Yoav',level:'intermediate',onboarding:{done:true}});S('learnLang','en');S('apiKey','sk-test');S('sheetCat',[SH])},SHEET);
 await p.goto(APP);await p.waitForTimeout(400);
 const B=f=>fs.readFileSync(f).toString('base64');
 await p.evaluate(async([g,pn,stj,stb,dr])=>{const bl=(b,t)=>new Blob([Uint8Array.from(atob(b),c=>c.charCodeAt(0))],{type:t});
  await window.__bk.put('mixdata:w1',{stems:{guitar:bl(g,'audio/flac'),other:bl(pn,'audio/flac'),drums:bl(dr,'audio/flac')}});
  await window.__bk.put('mixstills:w1',{every:stj.every,idx:stj.idx,bin:bl(stb,'application/octet-stream')});
  await window.__bk.put('mixIndex',[{id:'w1',name:'Test Band - Video Song',at:Date.now(),src:'cloud',state:'ready',sess:'queued',drive:{file:'a1',folder:'fold1',ok:true,video:{id:'v1',name:'Test Band - Video Song.mp4',url:'u'}}}])},[B(GTR),B(PNO),STJ,STB.toString('base64'),B(DRM)]);
 await p.reload();await p.waitForTimeout(300);
 let steps=new Set();for(let i=0;i<1200;i++){const t=await p.$eval('#mxBar',e=>e.hidden?'':e.innerText).catch(()=>'');if(/Listening to the guitars/.test(t))steps.add('guitar');if(/whole song/.test(t))steps.add('whole');if(/video/.test(t))steps.add('video');
  const st=await p.evaluate(()=>{const it=window.__mxTest.idx().find(x=>x.id==='w1');return it&&it.sess});if(st==='done'||st==='failed')break;await p.waitForTimeout(150)}
 const a=await p.evaluate(()=>JSON.parse(localStorage.getItem('tuner.song.mix_w1')||'null'));
 console.log('  steps on the bar:',[...steps].join(' → '));console.log('  whole:',JSON.stringify(a&&a.whole),'| video:',JSON.stringify(a&&a.video&&{from:a.video.from,capo:a.video.capo,agree:a.video.agree,fixed:a.video.fixed,asked:a.video.asked}));
 ok(steps.has('guitar')&&steps.has('whole'),'the bar shows the steps: the guitars, the whole song (the video step is quick with stills)');
 {const kick=t=>Math.abs(t/0.575-Math.round(t/0.575))*0.575,off=(a.beats||[]).slice(4,40).map(kick).sort((x,y)=>x-y);console.log('  beat from:',a.beatFrom,'bpm',a.bpm,'| median distance to a kick',Math.round((off[off.length>>1]||9)*1000),'ms');
  ok(a.beatFrom==='drums'&&Math.abs(a.bpm-104)<=2&&off[off.length>>1]<.04,'the beat is taken from the drums part (104 BPM, on the kicks)')}
 ok(a&&a.whole&&!a.whole.skip&&a.whole.agree>=.7,'the whole song (every part but the drums) was listened to, and hears the same roots');
 ok(a.whole.fixed.some(x=>/^B → Bm$/.test(x)),'where the guitar’s 3rd was faint, the whole song settled it: B → Bm (the key alone would have said B)');
 ok(a.video&&a.video.from==='stills'&&calls.drive===0,'the video came from the stills GitHub took (no Drive, no download on the phone)');
 ok(calls.find===1&&calls.read===1&&calls.readImgs>=4&&calls.readImgs<=9,`two Claude calls: find the hand (contact sheets), then read ${calls.readImgs-1} close-ups and one whole still`);
 ok(a.video.agree>=3&&!a.video.differ.length,'the hand in the stills agrees with the chords');
 // the guide
 await p.tap('#bnav [data-sec=learn]');await p.waitForTimeout(300);await p.tap('#learnList .lrow:has-text("Video Song")');await p.waitForTimeout(500);
 if(await p.$eval('[data-gd=full]',e=>e.getAttribute('aria-pressed'))!=='true'){await p.tap('[data-gd=full]');await p.waitForTimeout(150)}
 const src=await p.$$eval('.gdsrc li',l=>l.map(x=>[x.className,x.textContent]));console.log('  built from:',JSON.stringify(src));
 ok(src.length===4&&src.every(x=>x[0]==='y'),'Built from: the guitars-only part, the whole song, the video and the chord sheet, all ✓');
 const ch=await p.$$eval('#gdBody .seschords svg .dgName',l=>l.map(x=>x.textContent));console.log('  chords:',await p.$eval('.gdbig b',e=>e.textContent),'|',ch.join(' '));
 ok(ch.includes('Bm')&&!ch.includes('B')&&['C#m','A','E'].every(n=>ch.includes(n)),'the guide: C#m · A · E · Bm');
 await p.screenshot({path:path.join(OUT,'allsrc.png'),fullPage:true});
 ok(!errs.length,'no page errors '+JSON.stringify(errs));
 console.log(fail?`${fail} FAILED`:'all passed');await b.close();srv.close();process.exit(fail?1:0)})();
