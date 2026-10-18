// How sure each chord is (Oct 2026): the analysis keeps, per chord, how far it stood above the closest other chord (conf, 0–1).
// Chords under 0.35 (and 1 s or longer) are named in How sure ("Least sure: Em at 0:06…, check by ear") and drawn dashed in the
// play-along lane; sure chords aren't. Nothing changes the chords themselves (Full stays the same).
const {chromium}=require('playwright');const path=require('path'),fs=require('fs'),http=require('http');
const ROOT=path.resolve(__dirname,'..');
const srv=http.createServer((q,r)=>{const f=path.join(ROOT,decodeURIComponent(q.url.split('?')[0]).replace(/\/$/,'/index.html'));fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);return r.end()}r.writeHead(200,{'content-type':/\.html$/.test(f)?'text/html':'application/octet-stream'});r.end(d)})}).listen(0);
const APP=process.env.APP||`http://localhost:${srv.address().port}/index.html`;
let fail=0;const ok=(c,m)=>{console.log((c?'ok  ':'FAIL')+' '+m);if(!c)fail++};
const NT=8,C=(r,t)=>r*NT+t;// G=7, C=0, D=2, E=4; types '' 0, m 1
(async()=>{const b=await chromium.launch({...(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{})});
 const ctx=await b.newContext();await ctx.route(/^https:\/\//,r=>r.abort());await ctx.route(/ideas\.json/,r=>r.abort());
 const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));await p.goto(APP);await p.waitForTimeout(400);
 const segs=[[0,3,C(7,0)],[3,6,C(0,0)],[6,9,C(2,0)],[9,12,C(4,1)],[12,15,C(7,0)],[15,18,C(0,0)],[18,18.6,C(2,0)],[18.6,21,C(4,1)]];
 const conf=[.9,.95,.88,.2,.91,.3,.1,.92];// the Em at 0:09 and the C at 0:15 are unsure; the D at 0:18 is too short to name
 const beats=[...Array(29)].map((_,i)=>+(i*.75).toFixed(2));
 const r=await p.evaluate(([segs,conf,beats])=>{const a={title:'Conf Song',dur:21,bpm:80,offset:0,tuning:{id:'std'},play:{tun:'std',capo:0},v:2,at:Date.now(),segs,conf,beats};
  localStorage.setItem('tuner.song.cf1',JSON.stringify(a));const G=window.__gd.build('cf1'),K=window.__ka.blocks('cf1');
  const b2={...a};delete b2.conf;localStorage.setItem('tuner.song.cf2',JSON.stringify(b2));const G2=window.__gd.build('cf2');
  return {why:(G.sure.find(s=>s.k==='Chords and order')||{}).why,full:G.full,un:K.blocks.filter(x=>x.u).map(x=>x.n+'@'+x.t0),why2:(G2.sure.find(s=>s.k==='Chords and order')||{}).why,full2:G2.full}},[segs,conf,beats]);
 console.log('  how sure:',r.why);console.log('  dashed:',r.un.join(' '));
 ok(/Least sure: Em at 0:09; C at 0:15\. Check these by ear/.test(r.why),'How sure names the least sure chords with their times (lowest first)');
 ok(r.un.join(' ')==='Em@9 C@15','the play-along lane draws exactly those dashed');
 ok(!/Least sure/.test(r.why2)&&JSON.stringify(r.full2)===JSON.stringify(r.full),'an analysis without confidence: nothing named, and the chords are the same either way');
 ok(!errs.length,'no page errors '+JSON.stringify(errs));
 console.log(fail?`${fail} FAILED`:'all passed');await b.close();srv.close();process.exit(fail?1:0)})();
