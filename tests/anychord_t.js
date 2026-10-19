// Every chord a session shows is drawn as that chord (Oct 2026, the user: "If there is a chord that is not in the existing chords
// sheet - add it… Dont use the closest one existing instead"): a chart's 6, 9, dim, m7b5, 7sus4 or a slash bass gets a diagram that
// sounds exactly its notes, with its bass lowest, in standard tuning, Drop D and with a capo.
const {chromium}=require('playwright');const path=require('path'),fs=require('fs'),http=require('http');
const ROOT=path.resolve(__dirname,'..');
const srv=http.createServer((q,r)=>{const f=path.join(ROOT,decodeURIComponent(q.url.split('?')[0]).replace(/\/$/,'/index.html'));fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);return r.end()}r.writeHead(200,{'content-type':/\.html$/.test(f)?'text/html':/\.js$/.test(f)?'text/javascript':'application/octet-stream'});r.end(d)})});
let fail=0;const ok=(c,m)=>{console.log((c?'ok  ':'FAIL')+' '+m);if(!c)fail++};
const NAMES=['C','Am','F','G7','Dadd9','D6','Am9','Cdim','F#m7b5','A7sus4','Bbmaj9','E9','Cm6','G/B','C/E','D/F#','Am/G','Dm/C','F/C','Asus2/C#','Cadd9/G'];
srv.listen(0,async()=>{const APP=process.env.APP||`http://localhost:${srv.address().port}/index.html`;
 const b=await chromium.launch({...(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{})});
 const ctx=await b.newContext();await ctx.route(/^https:\/\//,r=>r.abort());await ctx.route(/ideas\.json/,r=>r.abort());
 const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));await p.goto(APP);await p.waitForTimeout(400);
 for(const [tun,capo] of [['std',0],['std',3],['dropd',0]]){const bad=[];
  for(const n of NAMES){const r=await p.evaluate(([n,t,c])=>window.__an.seg(n,t,c),[n,tun,capo]);if(!r||!r.ok||r.name!==n||/Diagram shows/.test(r.note))bad.push(n+' '+JSON.stringify(r))}
  ok(!bad.length,`${tun}${capo?' capo '+capo:''}: all ${NAMES.length} chords are drawn as themselves${bad.length?' — not: '+bad.join('; '):''}`)}
 ok(!errs.length,'no page errors '+JSON.stringify(errs));await b.close();srv.close();console.log(fail?fail+' FAILED':'all passed');process.exit(fail?1:0)});
