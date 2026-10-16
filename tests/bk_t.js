// Backup and restore: one file with everything (small data + phone database: photos, Band breakdown parts as typed arrays, Blobs and Files),
// a real ZIP; wipe → restore gives the same data; "Add what's missing" never overwrites; "Replace everything"; keys left out by default;
// without Band breakdown parts; damaged / incomplete / foreign files refused before anything changes.
const {chromium}=require('playwright');const path=require('path'),fs=require('fs'),http=require('http');const {execFileSync}=require('child_process');
const ROOT=path.resolve(__dirname,'..'),OUT=path.join(__dirname,'out');fs.mkdirSync(OUT,{recursive:true});
const srv=http.createServer((q,r)=>{const f=path.join(ROOT,decodeURIComponent(q.url.split('?')[0]).replace(/\/$/,'/index.html'));fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);return r.end()}r.writeHead(200,{'content-type':/\.html$/.test(f)?'text/html':'application/octet-stream'});r.end(d)})}).listen(0);
const APP=process.env.APP||`http://localhost:${srv.address().port}/index.html`;
const noWelcome=pg=>pg.evaluate(()=>{['welcome','onb'].forEach(id=>{const w=document.getElementById(id);if(w)w.hidden=true});document.body.classList.remove('wopen')});
let fail=0;const ok=(c,m)=>{console.log((c?'ok  ':'FAIL')+' '+m);if(!c)fail++};
(async()=>{const b=await chromium.launch({...(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{})});
 const ctx=await b.newContext({viewport:{width:390,height:844},acceptDownloads:true});await ctx.route(/^https:\/\//,r=>r.abort());await ctx.route(/ideas\.json/,r=>r.abort());// the repo's daily file would change the song list mid-test
 const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto(APP);await p.waitForTimeout(300);
 // let the app's own start-up updates finish first (the song records, M2), so they don't land between backup and restore
 await p.waitForFunction(()=>(JSON.parse(localStorage.getItem('tuner.v2mig')||'{}').done||[]).includes('M2'),null,{timeout:5000}).catch(()=>{});
 // a phone with data everywhere
 await p.evaluate(async()=>{const S=(k,v)=>localStorage.setItem('tuner.'+k,JSON.stringify(v));
  S('userName','Yoav');S('apiKey','sk-secret');localStorage.setItem('guitaring.gh',JSON.stringify({repo:'me/split',token:'ghp_secret',branch:'main'}));
  S('instruments',[{id:'m1',type:'electric',name:'Muse',brand:'Epiphone',photos:[{id:'gp1',at:1}]},{id:'a1',type:'elamp',name:'Catalyst',brand:'Boss'}]);
  S('lib',[{id:'l1',name:'יא',saved:1,data:{kind:'lyrics',title:'יא',lc:[{t:'שלום',ch:{0:'Am'}}]}}]);
  S('vlinks',[{id:'v1',url:'https://youtu.be/abcdefghijk',key:'yt:abcdefghijk',title:'Lesson'}]);S('chordbook',{Am:{added:1,songs:['יא']},G:{added:2,songs:[]}});S('tab','gear');
  const B=window.__bk,n=44100,mk=v=>{const a=new Int16Array(n*2);for(let i=0;i<a.length;i++)a[i]=(i*v)%30000-15000;return a};
  await B.put('gearphoto:gp1','data:image/jpeg;base64,'+btoa('photo-bytes-'.repeat(50)));
  await B.put('mixIndex',[{id:'s1',name:'Song one',at:1,src:'phone',state:'ready'},{id:'s2',name:'Song two',at:2,src:'cloud',state:'wait'}]);
  await B.put('mixdata:s1',{len:n,sr:44100,tracks:[{id:'gL',name:'Guitar · left',data:mk(7)},{id:'drums',name:'Drums',data:mk(13)}]});
  await B.put('mixsrc:s2',new File([new Uint8Array(5000).map((_,i)=>i%251)],'Song two.mp3',{type:'audio/mpeg',lastModified:1700000000000}));
  await B.put('mixdata:s3',{stems:{drums:new Blob([new Uint8Array(3000).fill(9)],{type:'audio/flac'})}})});
 await p.reload();await p.waitForTimeout(400);await p.waitForSelector('#wSkip',{state:'visible',timeout:2000}).then(()=>p.click('#wSkip')).catch(()=>{});
 // a fingerprint of everything (Int16Array / Blob / File contents included)
 const snap=()=>p.evaluate(async()=>{const B=window.__bk,h=async v=>{if(v instanceof Blob){const u=new Uint8Array(await v.arrayBuffer());let s=0;for(const x of u)s=(s*31+x)>>>0;return `${v instanceof File?'File:'+v.name+':'+v.lastModified:'Blob'}:${v.type}:${v.size}:${s}`}
   if(ArrayBuffer.isView(v)){let s=0;for(let i=0;i<v.length;i++)s=(s*31+(v[i]&0xffff))>>>0;return v.constructor.name+':'+v.length+':'+s}
   if(Array.isArray(v)){const o=[];for(const x of v)o.push(await h(x));return o}if(v&&typeof v==='object'){const o={};for(const k of Object.keys(v).sort())o[k]=await h(v[k]);return o}return v};
  const idb={};for(const k of (await B.keys()).sort())if(!/^backup:/.test(k))idb[k]=await h(await B.raw(k));
  const local={};Object.keys(localStorage).filter(k=>/^(tuner|guitaring)\./.test(k)&&!/lastBackup|lastRestore|\.tab$|jokesSeen|lastJokeTxt/.test(k)).sort().forEach(k=>{let v=localStorage.getItem(k);if(/\.profile$/.test(k)){const o=JSON.parse(v);delete o.updatedAt;if(o.onboarding)delete o.onboarding.at;v=JSON.stringify(o)}local[k]=v});return {local,idb}});
 const before=await snap();
 // 1. back up everything (default: with Band breakdown parts, without keys)
 await (await p.$('#hMe')?p.click('#hMe'):p.click('[data-tab=song]'));await p.evaluate(()=>{const d=document.getElementById('bkBox');d.open=true;d.scrollIntoView()});
 ok(await p.$eval('#bkParts',e=>e.checked)&&!(await p.$eval('#bkKeys',e=>e.checked)),'parts are in by default, keys are out');
 const dl=p.waitForEvent('download');await p.click('#bkGo');const d=await dl;const F1=path.join(OUT,'bk_full.zip');await d.saveAs(F1);
 ok(/^guitaring-backup-\d{4}-\d\d-\d\d\.zip$/.test(d.suggestedFilename()),'file name: '+d.suggestedFilename());
 await p.waitForSelector('#bkOut b');const said=await p.$eval('#bkOut',e=>e.textContent);console.log('  '+said.replace(/\s+/g,' '));
 ok(/1 sheet/.test(said)&&/2 gear items/.test(said)&&/1 gear photo/.test(said)&&/2 Band breakdown songs/.test(said),'it says what the file holds');
 ok(await p.$eval('#toast',e=>e.classList.contains('ok')),'green confirmation');
 // it is a real ZIP that other tools can open
 let z='';try{z=execFileSync('python3',['-I','-c','import zipfile,sys,json;z=zipfile.ZipFile(sys.argv[1]);print(z.testzip());print(json.loads(z.read("manifest.json"))["counts"]);print("apiKey" in z.read("local.json").decode())',F1]).toString()}catch(e){z=String(e)}
 console.log('  zip: '+z.replace(/\n/g,' | '));ok(/^None\n/.test(z)&&/False\s*$/.test(z),'a valid ZIP (every checksum right), the Claude key is not in it');
 // 2. phone wiped → restore → identical (keys excluded on purpose)
 const wipe=()=>p.evaluate(async()=>{localStorage.clear();await new Promise(r=>{const q=indexedDB.deleteDatabase('guitaring');q.onsuccess=q.onerror=q.onblocked=()=>r()})});
 await wipe();await p.reload();await p.waitForTimeout(400);await p.waitForSelector('#wSkip',{state:'visible',timeout:2000}).then(()=>p.click('#wSkip')).catch(()=>{});
 const restore=async(file,mode)=>{await noWelcome(p);await (await p.$('#hMe')?p.click('#hMe'):p.click('[data-tab=song]'));await p.evaluate(()=>{const d=document.getElementById('bkBox');d.open=true});
  await p.setInputFiles('#bkIn',file);await p.waitForSelector('#bkDo, #bkRes .bkerr',{timeout:15000});
  if(await p.$('#bkRes .bkerr'))return await p.$eval('#bkRes',e=>e.textContent);
  if(mode==='replace'){await p.check('input[name=bkMode][value=replace]');await p.click('#bkDo')}
  const nav=p.waitForEvent('load',{timeout:15000}).catch(()=>{});await p.click('#bkDo');await nav;await p.waitForTimeout(500);await p.waitForSelector('#wSkip',{state:'visible',timeout:2000}).then(()=>p.click('#wSkip')).catch(()=>{});return 'restored'};
 const prev=await (async()=>{await noWelcome(p);await (await p.$('#hMe')?p.click('#hMe'):p.click('[data-tab=song]'));await p.evaluate(()=>{const d=document.getElementById('bkBox');d.open=true});await p.setInputFiles('#bkIn',F1);await p.waitForSelector('#bkDo');return p.$eval('#bkRes',e=>e.textContent)})();
 ok(/Backup from/.test(prev)&&/1 sheet/.test(prev)&&/Add what’s missing/.test(prev),'before restoring it shows what the file holds');
 const nav=p.waitForEvent('load',{timeout:15000}).catch(()=>{});await p.click('#bkDo');await nav;await p.waitForTimeout(500);
 const after=await snap();const exp=JSON.parse(JSON.stringify(before));delete exp.local['tuner.apiKey'];delete exp.local['guitaring.gh'];
 const diff=(a,b)=>{const out=[];const ks=new Set([...Object.keys(a),...Object.keys(b)]);for(const k of ks)if(JSON.stringify(a[k])!==JSON.stringify(b[k]))out.push(k);return out};
 const dl1=diff(exp.local,after.local),di1=diff(exp.idb,after.idb);
 ok(!dl1.length,'small data identical after restore '+JSON.stringify(dl1));if(dl1.length)dl1.forEach(k=>console.log('  want',exp.local[k],'\n  got ',after.local[k]));ok(!di1.length,'phone database identical after restore (Int16Array parts, Blob, File) '+JSON.stringify(di1));
 // 3. "Add what's missing" never overwrites
 await p.evaluate(async()=>{const S=(k,v)=>localStorage.setItem('tuner.'+k,JSON.stringify(v)),G=k=>JSON.parse(localStorage.getItem('tuner.'+k));
  S('userName','Yoni');const l=G('instruments');l[0].name='Muse (renamed)';l.splice(1,1);l.push({id:'n1',type:'acoustic',name:'New one'});S('instruments',l);
  const cb=G('chordbook');delete cb.G;cb.Am.added=99;S('chordbook',cb);await window.__bk.put('gearphoto:gp1','data:changed')});
 await restore(F1,'add');
 const st=await p.evaluate(async()=>({name:JSON.parse(localStorage.getItem('tuner.userName')),inst:JSON.parse(localStorage.getItem('tuner.instruments')),cb:JSON.parse(localStorage.getItem('tuner.chordbook')),ph:await window.__bk.raw('gearphoto:gp1')}));
 ok(st.name==='Yoni','a changed setting is kept (name stays "Yoni")');
 ok(st.inst.length===3&&st.inst.find(x=>x.id==='m1').name==='Muse (renamed)'&&st.inst.some(x=>x.id==='a1')&&st.inst.some(x=>x.id==='n1'),'gear: the renamed item stays renamed, the new one stays, the deleted one comes back');
 ok(st.cb.Am.added===99&&!!st.cb.G,'chord book: changed chord kept, missing chord added');ok(st.ph==='data:changed','a changed photo is kept');
 // 4. "Replace everything": exactly the backup again (two taps)
 await restore(F1,'replace');const after2=await snap();const dl2=diff(exp.local,after2.local),di2=diff(exp.idb,after2.idb);
 ok(!dl2.length&&!di2.length,'Replace everything gives exactly the backup '+JSON.stringify([dl2,di2]));
 ok(await p.evaluate(async()=>(await window.__bk.keys()).some(k=>/^backup:pre-restore/.test(k))),'a safety copy was kept before restoring');
 // 5. without Band breakdown parts, with keys
 await p.evaluate(()=>{localStorage.setItem('tuner.apiKey','"sk-secret"')});
 await noWelcome(p);await (await p.$('#hMe')?p.click('#hMe'):p.click('[data-tab=song]'));await p.evaluate(()=>{document.getElementById('bkBox').open=true});await p.uncheck('#bkParts');await p.check('#bkKeys');
 const dl3=p.waitForEvent('download');await p.click('#bkGo');const F2=path.join(OUT,'bk_small.zip');await (await dl3).saveAs(F2);
 const sz1=fs.statSync(F1).size,sz2=fs.statSync(F2).size;ok(sz2<sz1/3,`without parts the file is much smaller (${sz2} vs ${sz1} bytes)`);
 const z2=execFileSync('python3',['-I','-c','import zipfile,sys,json;z=zipfile.ZipFile(sys.argv[1]);l=json.loads(z.read("local.json"));names=[json.loads(z.read(n))["key"] for n in z.namelist() if n.endswith(".json") and n.startswith("idb/")];print("tuner.apiKey" in l, any(k.startswith("mix") and ":" in k for k in names), [x["id"] for x in json.loads(z.read([n for n in z.namelist() if n.startswith("idb/") and json.loads(z.read(n))["key"]=="mixIndex"][0]))["v"]])',F2]).toString();
 console.log('  small zip: '+z2.trim());ok(/^True False \['s2'\]/.test(z2.trim()),'keys included when ticked; no audio parts; the list keeps only the song still splitting');
 // replacing from the small file keeps the parts on the phone
 await restore(F2,'replace');const has=await p.evaluate(async()=>!!(await window.__bk.raw('mixdata:s1')));ok(has,'Replace from a file without parts keeps the Band breakdown songs on the phone');
 // 6. damaged, incomplete and foreign files are refused before anything changes
 const buf=fs.readFileSync(F1);const bad=Buffer.from(buf);const at=buf.indexOf(Buffer.from('idb/'))+400;bad[at]^=0xff;const F3=path.join(OUT,'bk_bad.zip');fs.writeFileSync(F3,bad);
 const F4=path.join(OUT,'bk_cut.zip');fs.writeFileSync(F4,buf.subarray(0,Math.floor(buf.length*.6)));const F5=path.join(OUT,'bk_other.zip');fs.writeFileSync(F5,'not a zip at all');
 await p.evaluate(()=>localStorage.setItem('tuner.userName','"Marker"'));
 for(const [f,re,what] of [[F3,/damaged/,'damaged'],[F4,/incomplete/,'cut short'],[F5,/isn’t a Guitaring backup/,'not a backup']]){const r=await restore(f,'add');ok(re.test(r),`a ${what} file is refused: "${r.trim()}"`)}
 ok(await p.evaluate(()=>JSON.parse(localStorage.getItem('tuner.userName')))==='Marker','nothing changed after the refused files');
 await p.screenshot({path:path.join(OUT,'bk.png'),fullPage:false});
 ok(!errs.length,'no page errors '+JSON.stringify(errs));
 console.log(fail?`${fail} FAILED`:'all passed');await b.close();srv.close();process.exit(fail?1:0)})();
