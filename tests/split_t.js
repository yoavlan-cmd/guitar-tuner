// The source is split into parts (src/parts/NN-name.html) that the build joins in name order into one index.html.
// Checks: the build contains every part verbatim, in order; one app script; the page is complete.
// With LIVE=1 (release PRs): the committed index.html is exactly a fresh build (src and index.html never drift).
const fs=require('fs'),path=require('path'),os=require('os');const {execFileSync}=require('child_process');
const ROOT=path.resolve(__dirname,'..'),P=path.join(ROOT,'src/parts');let fail=0;const ok=(c,m)=>{console.log((c?'ok  ':'FAIL')+' '+m);if(!c)fail++};
const names=fs.readdirSync(P).filter(f=>f.endsWith('.html')).sort();
ok(names.length>=10&&names.every(n=>/^\d\d-[a-z0-9-]+\.html$/.test(n)),`${names.length} parts, all named NN-name.html`);
ok(new Set(names.map(n=>n.slice(0,2))).size===names.length,'no two parts share a number');
ok(!fs.existsSync(path.join(ROOT,'src/guitaring.html')),'the old single source file is gone (no second copy to drift)');
const tmp=path.join(os.tmpdir(),'gt-split-'+process.pid+'.html');execFileSync('bash',[path.join(ROOT,'tools/build.sh')],{env:{...process.env,OUT:tmp}});
const out=fs.readFileSync(tmp,'utf8'),joined=names.map(n=>fs.readFileSync(path.join(P,n),'utf8')).join('');fs.unlinkSync(tmp);
ok(out.includes(joined),'the build holds every part verbatim, in order');
ok(/^<!doctype html>/.test(out)&&/<\/html>\n$/.test(out),'a complete page');
ok((joined.match(/^\(\(\)=>\{$/m)||[]).length===1&&/^\}\)\(\);\n<\/script>\n$/m.test(joined.slice(-40)),'one app script: it opens in 20 and closes at the end of the last part');
for(const n of names){const t=fs.readFileSync(path.join(P,n),'utf8');ok(t.endsWith('\n'),n+' ends with a newline (parts never run into each other)')}
if(process.env.LIVE){ok(fs.readFileSync(path.join(ROOT,'index.html'),'utf8')===out,'the committed index.html is exactly a fresh build')}
console.log(fail?`${fail} FAILED`:'all passed');process.exit(fail?1:0);
