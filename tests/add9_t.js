// An add9 chord draws its own shape (Oct 2026: "D and Dadd9 look exactly the same"): the added 9th (the 2nd) is in the diagram,
// so Dadd9 is never drawn as plain D. The shapes keep the ease the plain chords gave them (the capo and tuning guesses use it).
const {chromium}=require('playwright');const path=require('path'),fs=require('fs'),http=require('http');
const ROOT=path.resolve(__dirname,'..');
const srv=http.createServer((q,r)=>{const f=path.join(ROOT,decodeURIComponent(q.url.split('?')[0]).replace(/\/$/,'/index.html'));fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);return r.end()}r.writeHead(200,{'content-type':/\.html$/.test(f)?'text/html':'application/octet-stream'});r.end(d)})});
let fail=0;const ok=(c,m)=>{console.log((c?'ok  ':'FAIL')+' '+m);if(!c)fail++};
const STR=[40,45,50,55,59,64],PC={C:0,D:2,E:4,F:5,G:7,A:9,B:11};
const notes=f=>[...new Set(f.split(',').map((x,i)=>+x<0?null:(STR[i]+ +x)%12).filter(x=>x!=null))].sort((a,b)=>a-b);
const pcs=(root,iv)=>[...new Set(iv.map(i=>(root+i)%12))].sort((a,b)=>a-b);
srv.listen(0,async()=>{const APP=process.env.APP||`http://localhost:${srv.address().port}/index.html`;
 const b=await chromium.launch({...(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{})});
 const ctx=await b.newContext();await ctx.route(/^https:\/\//,r=>r.abort());await ctx.route(/ideas\.json/,r=>r.abort());
 const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));await p.goto(APP);await p.waitForTimeout(400);
 for(const r of ['C','D','E','F','G','A','B','Bb','F#']){const R=(PC[r[0]]+(r[1]==='#'?1:r[1]==='b'?-1:0)+12)%12;
  const [pl,a9]=await p.evaluate(n=>[window.__an.shape(n),window.__an.shape(n+'add9')],r);
  const want=pcs(R,[0,2,4,7]),got=notes(a9.f);
  ok(a9.f!==pl.f&&JSON.stringify(got)===JSON.stringify(want)&&a9.cost<=.3&&Math.max(...a9.f.split(',').map(Number))<=7,`${r}add9 draws ${a9.f} (the notes of ${r}add9, not plain ${r} ${pl.f}; ease ${a9.cost}, low on the neck)`)}
 ok(!errs.length,'no page errors '+JSON.stringify(errs));await b.close();srv.close();console.log(fail?fail+' FAILED':'all passed');process.exit(fail?1:0)});
