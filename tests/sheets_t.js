// Chord sheets in the song's Drive folder (Nov 2026, the user): a generic sheet only gives the lyrics (never the chords); Guitaring's
// own sheet is made from the session and saved to the folder; next time that sheet is used as it is, and a big difference from the new
// build is said plainly. Drive is faked here (list, download, export, upload); the PDF makers and reader come from cdnjs (cached).
const {chromium}=require('playwright');const path=require('path'),fs=require('fs'),http=require('http'),{execSync}=require('child_process');
const ROOT=path.resolve(__dirname,'..'),CDN=path.join(__dirname,'out','cdn');fs.mkdirSync(CDN,{recursive:true});
const LIBS={'html2canvas.min.js':'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js','jspdf.umd.min.js':'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
 'pdf.min.js':'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js','pdf.worker.min.js':'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'};
// the same versions the app loads from cdnjs, taken from npm (the package registry is reachable where cdnjs may not be)
const NPM={'html2canvas.min.js':'html2canvas@1.4.1/dist/html2canvas.min.js','jspdf.umd.min.js':'jspdf@2.5.1/dist/jspdf.umd.min.js','pdf.min.js':'pdfjs-dist@3.11.174/build/pdf.min.js','pdf.worker.min.js':'pdfjs-dist@3.11.174/build/pdf.worker.min.js'};
if(Object.keys(LIBS).some(f=>!fs.existsSync(path.join(CDN,f)))){const P=path.join(CDN,'pkg');fs.mkdirSync(P,{recursive:true});
 execSync('npm i --silent --no-save --no-package-lock --prefix '+JSON.stringify(P)+' '+[...new Set(Object.values(NPM).map(x=>x.split('/')[0]))].join(' '),{stdio:'inherit'});
 for(const [f,x] of Object.entries(NPM)){const pk=x.split('/')[0].replace(/@[\d.]+$/,''),rest=x.split('/').slice(1).join('/');fs.copyFileSync(path.join(P,'node_modules',pk,rest),path.join(CDN,f))}}
const srv=http.createServer((q,r)=>{const f=path.join(ROOT,decodeURIComponent(q.url.split('?')[0]).replace(/\/$/,'/index.html'));fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);return r.end()}r.writeHead(200,{'content-type':/\.html$/.test(f)?'text/html':'application/octet-stream'});r.end(d)})});
let fail=0;const ok=(c,m)=>{console.log((c?'ok  ':'FAIL')+' '+m);if(!c)fail++};
const NT=8,ch=(r,t)=>r*NT+t;
// the recording: heard F Am7 F Am7 | G F G F (with capo 5: C Em7 C Em7 | D C D C), 2 s each, twice round
const PAT=[ch(5,0),ch(9,3),ch(5,0),ch(9,3),ch(7,0),ch(5,0),ch(7,0),ch(5,0)];
const song=(pat,capo)=>{let t=1;const segs=[[0,1,96]];for(let k=0;k<2;k++)for(const c of pat){segs.push([+t.toFixed(2),+(t+2).toFixed(2),c]);t+=2}
 return {title:'Test song',dur:t,bpm:120,offset:0,tuning:{id:'std'},segs,play:{tun:'std',capo:0},v:2,at:1,from:'guitars',mix:'s1',song:{t:'Test song',a:'Band'},video:{at:1,name:'v.mp4',url:'',capo,frames:[],asked:20,agree:0,differ:[],fixed:[],raw:{capo,capo_conf:'high'}}}};
// a generic sheet (shapes with capo 5); its chords on the last line are wrong on purpose (Bm F#m): they must never become the session's
const SHEET=`Test song - Band
Capo 5

Verse
C              Em7
Hello my friend how are you
C              Em7
This is the second line
Chorus
D            C
Sing it loud and clear
D            Bm     F#m
Sing it once again tonight`;
srv.listen(0,async()=>{const APP=`http://localhost:${srv.address().port}/index.html`;
 const b=await chromium.launch({...(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{})});
 const ctx=await b.newContext();await ctx.route(/ideas\.json/,r=>r.abort());
 // fake Drive: the song's folder F1
 const D={files:[{id:'v1',name:'Test song.mp4',mimeType:'video/mp4'},{id:'t1',name:'Test song chords.txt',mimeType:'text/plain',body:Buffer.from(SHEET)}],ups:[]};
 await ctx.route(/^https:\/\//,async r=>{const u=new URL(r.request().url());
  if(u.host==='cdnjs.cloudflare.com'){const f=path.join(CDN,path.basename(u.pathname));return fs.existsSync(f)?r.fulfill({body:fs.readFileSync(f),contentType:'text/javascript'}):r.abort()}
  if(u.host!=='www.googleapis.com')return r.abort();
  if(u.pathname==='/drive/v3/files'&&r.request().method()==='GET'){return r.fulfill({json:{files:D.files.map(({body,...f})=>f)}})}
  let m=u.pathname.match(/^\/drive\/v3\/files\/([^/]+)(\/export)?$/);if(m){const f=D.files.find(x=>x.id===m[1]);return f?r.fulfill({body:f.body||Buffer.from(''),contentType:f.mimeType}):r.fulfill({status:404,body:''})}
  if(u.pathname==='/upload/drive/v3/files'&&r.request().method()==='POST'){const body=r.request().postDataBuffer(),ct=r.request().headers()['content-type'],bd='--'+ct.split('boundary=')[1];
   const parts=[];let i=body.indexOf(bd);while(i>=0){const j=body.indexOf(bd,i+bd.length);if(j<0)break;const p=body.slice(i+bd.length,j),h=p.indexOf('\r\n\r\n');parts.push({head:p.slice(0,h).toString(),data:p.slice(h+4,p.length-2)});i=j}
   const meta=JSON.parse(parts[0].data.toString()),f={id:'g'+(D.ups.length+1),name:meta.name,mimeType:meta.mimeType,appProperties:meta.appProperties,parents:meta.parents,body:parts[1].data,webViewLink:'https://drive.google.com/file/d/x/view'};
   D.ups.push(f);return r.fulfill({json:{id:f.id,name:f.name,webViewLink:f.webViewLink}})}
  return r.fulfill({status:404,body:''})});
 const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.addInitScript(()=>{window.__mxPollMs=1e9;window.__lsMs=1e9});await p.goto(APP);await p.waitForTimeout(500);
 const setup=async(a)=>{await p.evaluate(async a=>{await window.__bk.put('mixIndex',[{id:'s1',name:'Test song',at:1,src:'cloud',state:'ready',sess:'done',song:{t:'Test song',a:'Band'},drive:{file:'v1',name:'Test song.mp4',folder:'F1',video:{id:'v1',name:'Test song.mp4',url:''}}}]);
  localStorage.setItem('tuner.song.mix_s1',JSON.stringify(a));localStorage.setItem('tuner.songs',JSON.stringify(['mix_s1']))},a);await p.reload();await p.waitForTimeout(600);await p.evaluate(()=>window.__ss.setTok('test'))};

 // 1. reading a text sheet: chords over the words under them
 const lines=await p.evaluate(t=>window.__ss.textLines(t),SHEET);
 ok(lines.some(L=>L.type==='lyrics'&&L.text==='[C]Hello my friend [Em7]how are you')&&lines.some(L=>L.type==='section'&&/Chorus/.test(L.text)),'a text sheet: each chord sits on the word under it, sections are kept');
 const heb=await p.evaluate(()=>window.__ss.textLines('Am          C\nשלום לך ילדה קטנה'));
 ok(heb[0]&&/\[Am\]/.test(heb[0].text)&&/\[C\]/.test(heb[0].text),'a Hebrew line gets its chords too ('+(heb[0]&&heb[0].text)+')');

 // 2. lyrics placed in time by the chords; the sheet's key is found even when it doesn't say its capo
 await setup(song(PAT,5));
 const al=await p.evaluate(async t=>{const s=await window.__ss.read({id:'t1',name:'x.txt',mimeType:'text/plain'},new Blob([t]));return window.__ss.align('mix_s1',s)},SHEET);
 const L=al.lines.filter(x=>x.w);console.log('  placed:',L.map(x=>x.t+' '+x.w.slice(0,2).join(' ')).join(' | '));
 ok(al.q>=.7&&L.length===4&&L.every((x,i)=>x.t!=null&&(i===0||x.t>L[i-1].t)),'every lyric line is placed, in order ('+al.q+')');
 ok(Math.abs(L[0].t-1)<.6&&Math.abs(L[2].t-9)<.6,'the first line starts with the first F (C with capo 5), the chorus line with the first G (D)');
 const al0=await p.evaluate(async t=>{const s=await window.__ss.read({id:'t1',name:'x.txt',mimeType:'text/plain'},new Blob([t]));return window.__ss.align('mix_s1',s)},SHEET.replace('Capo 5\n',''));
 ok(al0.q>=.7&&al0.key===5,'a sheet that doesn’t say its capo still lines up (found 5 half steps)');

 // 3. the build: lyrics from the generic sheet, the chords untouched, Guitaring's sheet saved to the folder
 const before=JSON.stringify(song(PAT,5).segs);
 let a=await p.evaluate(()=>window.__ss.build('s1','mix_s1'));
 ok(JSON.stringify(a.segs.map(g=>[g.t0,g.t1,g.c]))===before,'the session’s chords are exactly the recording’s: the sheet’s chords (its Bm F#m) are never used');
 ok(a.lyr&&a.lyr.lines&&a.lyr.lines.filter(x=>x.w).length===4&&a.lyr.src.name==='Test song chords.txt','the lyrics went into the session, with where they came from');
 const up=D.ups[0];ok(D.ups.length===1&&up.name==='Test song (Guitaring chords).pdf'&&up.appProperties.guitaring==='sheet'&&up.parents[0]==='F1'&&/^%PDF/.test(up.body.slice(0,4).toString()),'Guitaring’s sheet was saved to the song’s folder as a PDF, marked as Guitaring’s');
 ok(a.sheet&&a.sheet.src==='made'&&up.body.toString('latin1').includes('guitaring-sheet:'),'the session data is inside the PDF');
 let h=await p.evaluate(()=>window.__ss.html('mix_s1','s1'));
 ok(/Lyrics and chords/.test(h)&&/Hello/.test(h)&&/Saved/.test(h)&&/not the sheet’s/.test(h),'the session shows the lyrics with the recording’s chords, and says the sheet was saved');
 const cap=await p.evaluate(()=>{const s=window.__ss.html('mix_s1','s1');const m=s.match(/<span class="ssw"><b dir="ltr">([^<]+)<\/b>Hello/);return m&&m[1]});
 ok(cap==='C','over “Hello”: C, the recording’s chord as played with capo 5 ('+cap+')');
 const now=await p.evaluate(()=>[1.5,9.5,14].map(t=>{const L=window.__ss.lineAt('mix_s1',t);return L?L.w.join(' '):''}));
 ok(now[0]==='Hello my friend how are you'&&now[1]==='Sing it loud and clear'&&now[2]==='Sing it once again tonight','the play-along shows the line being sung ('+now.join(' / ')+')');
 const copy=await p.evaluate(()=>JSON.stringify(window.__ss.strip(JSON.parse(localStorage.getItem('tuner.song.mix_s1')))));
 ok(!/Hello/.test(copy)&&/"placed"/.test(copy),'the session copy sent to GitHub leaves the lyrics out');

 // 4. built again: Guitaring's sheet is in the folder, so it is used as it is and nothing new is made
 D.files.push(up);
 a=await p.evaluate(()=>{const s=JSON.parse(localStorage.getItem('tuner.song.mix_s1'));delete s.lyr;delete s.sheet;localStorage.setItem('tuner.song.mix_s1',JSON.stringify(s));return window.__ss.build('s1','mix_s1')});
 ok(D.ups.length===1&&a.sheet&&a.sheet.src==='ours'&&!a.sheet.big&&a.lyr&&a.lyr.lines,'next build: the sheet is read back and used, no second sheet is made, the lyrics come with it');
 h=await p.evaluate(()=>window.__ss.html('mix_s1','s1'));ok(/follows your chord sheet/.test(h)&&!/hears it differently/.test(h),'it says the session follows that sheet (no warning: the same)');

 // 5. the new build hears it differently (another capo, other chords): the sheet is still used as it is, and the session says so
 const other=[ch(0,0),ch(4,1),ch(7,0),ch(9,1),ch(0,0),ch(4,1),ch(7,0),ch(9,1)];await setup(song(other,0));
 a=await p.evaluate(()=>window.__ss.build('s1','mix_s1'));
 ok(a.sheet.src==='ours'&&a.sheet.big&&JSON.stringify(a.segs.map(g=>[g.t0,g.t1,g.c]))===before,'a different new build: the session keeps the sheet’s chords as they are');
 h=await p.evaluate(()=>window.__ss.html('mix_s1','s1'));console.log('  warning:',(h.match(/hears it differently: ([^.]*)/)||[])[1]);
 ok(/hears it differently/.test(h)&&/no capo instead of capo 5/.test(h)&&/delete that sheet/.test(h),'…and says plainly what differs and what to do');
 const G=await p.evaluate(()=>{const v=window.__gd.build('mix_s1');return {capo:v.capo}});
 const page=await p.evaluate(()=>{window.__v2&&window.__v2.goSec('learn');return true});

 // 6. no Drive sign-in left: nothing is read, the session offers to do it
 await setup(song(PAT,5));a=await p.evaluate(()=>{window.__ss.setTok('');return window.__ss.build('s1','mix_s1')});
 h=await p.evaluate(()=>window.__ss.html('mix_s1','s1'));ok(a.sheets&&a.sheets.todo&&/Get the lyrics and save the chord sheet/.test(h),'Google’s sign-in ran out: a button on the session page does it later');
 // 7. a folder with no chord sheet at all: Guitaring's sheet is made, chords only
 D.files=D.files.filter(f=>f.id==='v1');const n0=D.ups.length;await setup(song(PAT,5));a=await p.evaluate(()=>window.__ss.build('s1','mix_s1'));
 ok(D.ups.length===n0+1&&a.sheet.src==='made'&&!a.lyr,'no sheet in the folder: Guitaring\u2019s chord sheet is made and saved (chords only, no lyrics)');
 // 8. Guitaring's sheet that can't be read back: no second one is made, and it says so
 D.files.push({id:'x9',name:'Test song (Guitaring chords).pdf',mimeType:'application/pdf',appProperties:{guitaring:'sheet'},body:Buffer.from('%PDF-1.4 edited elsewhere')});const n1=D.ups.length;
 await setup(song(PAT,5));a=await p.evaluate(()=>window.__ss.build('s1','mix_s1'));h=await p.evaluate(()=>window.__ss.html('mix_s1','s1'));
 ok(D.ups.length===n1&&a.sheet.src==='unread'&&/can’t be read back/.test(h),'Guitaring\u2019s sheet that can\u2019t be read back: no new one is made, and the session says why');
 ok(!errs.length,'no page errors '+JSON.stringify(errs));await b.close();srv.close();console.log(fail?fail+' FAILED':'all passed');process.exit(fail?1:0)});
