// The Drive key as a GitHub secret (Oct 2026): the app seals Google's short-lived key the way GitHub asks for Actions secrets
// (libsodium sealed box: X25519 + XSalsa20-Poly1305, the nonce BLAKE2b-192 of the two public keys). Checked here: our BLAKE2b
// against Python's own, and a sealed key opened again with the private key (tweetnacl in Node, the nonce from Python).
const {chromium}=require('playwright');const path=require('path'),fs=require('fs'),http=require('http'),{execFileSync}=require('child_process');
const nacl=require('./vendor/nacl.min.js');
const ROOT=path.resolve(__dirname,'..');
const srv=http.createServer((q,r)=>{const f=path.join(ROOT,decodeURIComponent(q.url.split('?')[0]).replace(/\/$/,'/index.html'));fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);return r.end()}r.writeHead(200,{'content-type':/\.html$/.test(f)?'text/html':/\.js$/.test(f)?'text/javascript':'application/octet-stream'});r.end(d)})});
let fail=0;const ok=(c,m)=>{console.log((c?'ok  ':'FAIL')+' '+m);if(!c)fail++};
const py=(code,...a)=>execFileSync('python3',['-c',code,...a]).toString().trim();
srv.listen(0,async()=>{const APP=process.env.APP||`http://localhost:${srv.address().port}/index.html`;
 const b=await chromium.launch({...(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{})});
 const ctx=await b.newContext();await ctx.route(/cdnjs\.cloudflare\.com\/ajax\/libs\/tweetnacl\/1\.0\.3\/nacl\.min\.js/,r=>r.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(__dirname,'vendor','nacl.min.js'))}));
 await ctx.route(/^https:\/\/(?!cdnjs)/,r=>r.abort());
 const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));await p.goto(APP);await p.waitForTimeout(400);
 // BLAKE2b against Python's hashlib (empty, 64 bytes, a 200-byte message over two blocks; 24- and 64-byte outputs)
 const ins=['','00'.repeat(64),[...Array(200)].map((_,i)=>(i*7%256).toString(16).padStart(2,'0')).join('')];let same=true;
 for(const h of ins)for(const n of [24,64]){const mine=await p.evaluate(([h,n])=>window.__ghSeal.blake2b(h,n),[h,n]),ref=py('import hashlib,sys;print(hashlib.blake2b(bytes.fromhex(sys.argv[1]),digest_size=int(sys.argv[2])).hexdigest())',h,String(n));if(mine!==ref){same=false;console.log('  differs',h.length/2,n,mine,ref)}}
 ok(same,'BLAKE2b matches Python\u2019s (6 cases, one and two blocks)');
 // seal with a real key pair, open it again
 const kp=nacl.box.keyPair(),pkB64=Buffer.from(kp.publicKey).toString('base64'),secret='ya29.test-drive-key-\u05e9';
 const sealed=Buffer.from(await p.evaluate(([k,s])=>window.__ghSeal.seal(k,s),[pkB64,secret]),'base64');
 const epk=sealed.subarray(0,32),ct=sealed.subarray(32),nonce=Buffer.from(py('import hashlib,sys;print(hashlib.blake2b(bytes.fromhex(sys.argv[1]),digest_size=24).hexdigest())',Buffer.concat([epk,Buffer.from(kp.publicKey)]).toString('hex')),'hex');
 const open=nacl.box.open(new Uint8Array(ct),new Uint8Array(nonce),new Uint8Array(epk),kp.secretKey);
 ok(open&&Buffer.from(open).toString()===secret&&sealed.length===32+16+Buffer.byteLength(secret),'a sealed key opens again with the private key (libsodium\u2019s sealed box), and nothing else');
 ok(!errs.length,'no page errors '+JSON.stringify(errs));await b.close();srv.close();console.log(fail?fail+' FAILED':'all passed');process.exit(fail?1:0)});
