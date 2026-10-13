// Practice mixer › sending a song to GitHub (API mocked): starts after a fresh splitter install even if GitHub refuses for a moment,
// and when something does fail the message names the step and quotes GitHub.
const {chromium}=require('playwright');const path=require('path'),fs=require('fs'),http=require('http');
const ROOT=path.resolve(__dirname,'..');
const srv=http.createServer((q,r)=>{const f=path.join(ROOT,decodeURIComponent(q.url.split('?')[0]).replace(/\/$/,'/index.html'));fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);return r.end()}r.writeHead(200,{'content-type':/\.html$/.test(f)?'text/html':'application/octet-stream'});r.end(d)})}).listen(0);
const APP=process.env.APP||`http://localhost:${srv.address().port}/index.html`;
let fail=0;const ok=(c,m)=>{console.log((c?'ok  ':'FAIL')+' '+m);if(!c)fail++};
(async()=>{const b=await chromium.launch({...(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{})});
 const ctx=await b.newContext({viewport:{width:390,height:844}});
 // a fake GitHub: mode decides how it misbehaves
 let mode='',calls=[],dispatches=0,refs=new Set();
 const J0=(r,st,o)=>r.fulfill({status:st,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(o||{})});
 const J=(r,st,o)=>J0(r,st,o);
 await ctx.route('https://api.github.com/**',async r=>{const q=r.request(),u=q.url().replace('https://api.github.com/repos/me/split',''),m=q.method();calls.push(m+' '+u.split('?')[0]);
  if(mode==='badkey'&&!/Bearer good/.test(q.headers()['authorization']||''))return J(r,401,{message:'Bad credentials'});
  if(m==='GET'&&u==='')return J(r,200,{default_branch:'main',private:true});
  if(u.startsWith('/contents/.github/workflows/split.yml'))return m==='GET'?J(r,404,{message:'Not Found'}):J(r,201,{});
  if(u==='/git/blobs')return mode==='bigblob'?J(r,422,{message:'Sorry, the blob is too large'}):J(r,201,{sha:'b1'});
  if(u==='/git/trees')return J(r,201,{sha:'t1'});if(u==='/git/commits')return J(r,201,{sha:'c1'});
  if(u==='/git/refs'){const ref=JSON.parse(q.postData()).ref;if(refs.has(ref))return J(r,422,{message:'Reference already exists'});refs.add(ref);return J(r,201,{})}
  if(u.startsWith('/git/refs/heads/')){const ref='refs/heads/'+u.split('/git/refs/heads/')[1];if(m==='DELETE'){await new Promise(x=>setTimeout(x,150));refs.delete(ref);return r.fulfill({status:204,headers:{'access-control-allow-origin':'*'},body:''})}return J(r,200,{})}
  if(u.endsWith('/dispatches')){dispatches++;if(mode==='late'&&dispatches<=2||mode==='never')return J(r,422,{message:"Workflow does not have 'workflow_dispatch' trigger"});return r.fulfill({status:204,headers:{'access-control-allow-origin':'*'},body:''})}
  if(u.startsWith('/git/ref/heads/'))return J(r,404,{message:'Not Found'});
  if(u.startsWith('/actions/runs'))return J(r,200,{workflow_runs:[]});
  return J(r,404,{message:'Not Found'})});
 const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.addInitScript(()=>{localStorage.setItem('tuner.userName','"Yoav"');localStorage.setItem('guitaring.gh',JSON.stringify({repo:'me/split',token:'t',branch:'main'}));window.__mxWaitScale=0.001;window.__mxPollMs=1e9});
 await p.goto(APP);await p.waitForTimeout(300);if(await p.$('#wSkip:visible'))await p.click('#wSkip');
 const send=async(name)=>p.evaluate(async n=>{const f=new File([new Uint8Array(2048)],n,{type:'audio/mpeg'});await window.__mxTest.send(f);const it=window.__mxTest.idx()[0];return {state:it.state,err:it.err||'',id:it.id}},name);
 // 1. first send after the splitter is (re)installed: GitHub refuses to start it twice, then accepts
 mode='late';let r=await send('Tuna יא.mp3');
 ok(calls.some(c=>c.startsWith('PUT /contents/.github/workflows/split.yml')),'the splitter is installed first');
 ok(r.state==='wait'&&dispatches===3,`it keeps trying to start the split and gets going (state ${r.state}, ${dispatches} tries)`);
 // 2. GitHub never starts it: the message says which step and what GitHub said
 mode='never';dispatches=0;r=await send('second.mp3');
 ok(r.state==='failed'&&dispatches===4,`gives up after 4 tries (${dispatches})`);
 ok(/wouldn’t start the splitter/.test(r.err)&&/workflow_dispatch/.test(r.err),'the message names the step and quotes GitHub: '+r.err);
 // 3. Try again clears the old branches before uploading again, and works once GitHub behaves
 mode='';dispatches=0;const before=calls.length;await p.evaluate(id=>window.__mxTest.retry(id),r.id);const it=await p.evaluate(()=>window.__mxTest.idx()[0]);
 const seq=calls.slice(before).filter(c=>/refs/.test(c));console.log('retry:',seq.join(' → '));
 const del=seq.findIndex(c=>c.startsWith('DELETE /git/refs/heads/j-')),mk=seq.findIndex(c=>c==='POST /git/refs');
 ok(del>=0&&mk>del,'Try again deletes the old song branch before making the new one');
 ok(it.state==='wait'&&refs.has('refs/heads/j-'+r.id),'and the new upload is still there afterwards');
 // 4. the song itself is refused: says so, with GitHub's reason
 mode='bigblob';r=await send('huge.mp3');
 ok(r.state==='failed'&&/refused the song file/.test(r.err)&&/blob is too large/.test(r.err),'a refused upload says so, with GitHub\'s reason: '+r.err);
 // 5. the key stops working: a red row with "Fix the GitHub key"; connecting a new key retries it by itself
 mode='badkey';r=await send('טונה - י"א 2.mp3');
 ok(r.state==='failed'&&/didn’t accept the access key/.test(r.err)&&/Bad credentials/.test(r.err),'a rejected key says so: '+r.err);
 await p.evaluate(()=>{const sh=document.getElementById('mxSheet');sh.hidden=false;sh.classList.add('open')});await p.evaluate(()=>window.__mxTest.lib&&window.__mxTest.lib());
 await p.evaluate(()=>document.querySelector('#mxSheet')&&window.__mxTest.home());await p.waitForTimeout(200);
 const row=await p.$eval('.mxit.failed',e=>({fix:!!e.querySelector('[data-fixkey]'),bc:getComputedStyle(e).borderColor}));
 ok(row.fix&&/224, 103, 95/.test(row.bc),'the failed row has a red frame and "Fix the GitHub key" ('+row.bc+')');
 await p.click('[data-fixkey]');await p.fill('#mxTok','good-token');calls=[];await p.click('#mxConn');await p.waitForTimeout(800);
 const it5=await p.evaluate(id=>window.__mxTest.idx().find(x=>x.id===id),r.id);
 ok(it5&&it5.state==='wait'&&calls.some(c=>c==='POST /git/blobs'),'after connecting a new key it is sent again by itself');
 // 6. key fails while GitHub is already splitting: Try again picks it up, it is not uploaded again
 await p.evaluate(()=>{const c=JSON.parse(localStorage.getItem('guitaring.gh'));c.token='old';localStorage.setItem('guitaring.gh',JSON.stringify(c))});
 await p.evaluate(()=>window.__mxTest.poll());await p.waitForTimeout(300);
 const it6=await p.evaluate(id=>window.__mxTest.idx().find(x=>x.id===id),r.id);ok(it6.state==='failed'&&it6.errKind==='key'&&/still finish/.test(it6.err),'a key failure while waiting keeps the split: '+it6.err);
 await p.evaluate(()=>{const c=JSON.parse(localStorage.getItem('guitaring.gh'));c.token='good-token';localStorage.setItem('guitaring.gh',JSON.stringify(c))});
 calls=[];await p.evaluate(id=>window.__mxTest.retry(id),r.id);const it7=await p.evaluate(id=>window.__mxTest.idx().find(x=>x.id===id),r.id);
 ok(it7.state==='wait'&&!calls.some(c=>c==='POST /git/blobs'),'Try again picks it up without sending the song again');
 // 7. a ready song has a green frame
 await p.evaluate(()=>{window.__mxTest.add({id:'rdy',name:'Ready one',at:Date.now(),src:'cloud',state:'ready'});window.__mxTest.home()});await p.waitForTimeout(150);
 ok(/102, 187, 106/.test(await p.$eval('.mxit.ready',e=>getComputedStyle(e).borderColor))&&/Ready ·/.test(await p.$eval('.mxit.ready small',e=>e.textContent)),'a ready song has a green frame and says Ready');
 ok(!errs.length,'no page errors '+JSON.stringify(errs));
 console.log(fail?`${fail} FAILED`:'all passed');await b.close();srv.close();process.exit(fail?1:0)})();
