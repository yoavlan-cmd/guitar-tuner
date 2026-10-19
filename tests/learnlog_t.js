// The learning log (Oct 2026): each session build notes what it wasn't sure of (the least sure chords, where the video's hand
// disagrees, chords BTC hears that Guitaring can't name yet, e.g. a dim or a 6), as they sound; a rebuild replaces that song's own
// automatic notes and keeps your edits; the log is capped (automatic notes go first); a restore merges both sides' notes.
const {chromium}=require('playwright');const path=require('path'),fs=require('fs'),http=require('http');
const ROOT=path.resolve(__dirname,'..');
const srv=http.createServer((q,r)=>{const f=path.join(ROOT,decodeURIComponent(q.url.split('?')[0]).replace(/\/$/,'/index.html'));fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);return r.end()}r.writeHead(200,{'content-type':/\.html$/.test(f)?'text/html':/\.js$/.test(f)?'text/javascript':'application/octet-stream'});r.end(d)})});
let fail=0;const ok=(c,m)=>{console.log((c?'ok  ':'FAIL')+' '+m);if(!c)fail++};
srv.listen(0,async()=>{const APP=process.env.APP||`http://localhost:${srv.address().port}/index.html`;
 const b=await chromium.launch({...(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{})});
 const ctx=await b.newContext();await ctx.route(/^https:\/\//,r=>r.abort());await ctx.route(/ideas\.json/,r=>r.abort());
 const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));await p.goto(APP);await p.waitForTimeout(400);
 const r=await p.evaluate(()=>{const NT=8,C=0,Am=9*NT+1,G=7*NT,Dm=2*NT+1;
  // BTC: during 4–8 s it hears C#dim (root 1, quality 2 → class 1*14+2) at .7
  const fps=10,frames=[...Array(120)].map((_,j)=>j>=40&&j<80?[[1*14+2,.7],[9*14,.2]]:[[0*14+1,.9]]);
  const a={title:'Test',segs:[{t0:0,t1:4,c:C},{t0:4,t1:8,c:Am},{t0:8,t1:12,c:G},{t0:12,t1:12.5,c:Dm}],conf:[.9,.2,.8,.1],video:{differ:[{t:9,heard:'G',seen:'Em'}]}};
  localStorage.removeItem('tuner.learn');window.__learn.fromBuild('mix_t',a,{fps,frames});const L1=window.__learn.get();
  // you change a chord by hand (an edit note), then the session is built again: the edit stays, the automatic notes are replaced
  window.__learn.edit('mix_t',{t0:4,t1:8,c:4*NT+1},'Am');window.__learn.edit('mix_t',{t0:0,t1:4,c:C},'C');
  a.conf=[.9,.9,.9,.9];a.video={differ:[]};window.__learn.fromBuild('mix_t',a,null);const L2=window.__learn.get();
  return {L1,L2}});
 console.log('  first build:',JSON.stringify(r.L1.map(x=>[x.kind,x.t,x.heard,x.seen||x.btc||x.conf])));
 const k=r.L1.map(x=>x.kind).sort().join(',');
 ok(k==='unknown,unsure,video','a build notes the least sure chord (Am, not the half-second Dm), the video\u2019s disagreement and the chord BTC hears that Guitaring can\u2019t name');
 ok(r.L1.some(x=>x.kind==='unknown'&&x.btc==='C#dim'&&x.heard==='Am'&&x.t===4),'\u2026the unknown chord is BTC\u2019s C#dim over the Am at 0:04');
 ok(r.L1.every(x=>x.eng===1&&x.song==='mix_t'&&x.at),'each note says which song and which engine');
 ok(r.L2.length===1&&r.L2[0].kind==='edit'&&r.L2[0].heard==='Am'&&r.L2[0].fix==='Em','your edit is noted (heard Am, it is Em; an unchanged chord isn\u2019t), and when the song is built again its automatic notes are replaced and your edit stays');
 ok(!errs.length,'no page errors '+JSON.stringify(errs));await b.close();srv.close();console.log(fail?fail+' FAILED':'all passed');process.exit(fail?1:0)});
