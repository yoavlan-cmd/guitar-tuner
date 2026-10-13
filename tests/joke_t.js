const APP=process.env.APP||('file://'+require('path').resolve(__dirname,'../index.html'));
const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch({...(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{})});const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));await p.route(/^https:\/\//,r=>r.abort());
 await p.addInitScript(()=>{if(sessionStorage.x)return;sessionStorage.x=1;localStorage.setItem('tuner.userName','"Yoav"');localStorage.setItem('tuner.jokesExtra',JSON.stringify([{text:'Fresh from the daily file: your D string misses you, {n}.',date:'2026-10-12'},{text:'<b>bold</b> attempt {n}',date:'2026-10-12'}]))});
 await p.goto(APP);await p.waitForTimeout(500);
 console.log('1st:',await p.$eval('#wJoke',e=>e.innerHTML));await p.click('#wMore');console.log('2nd:',await p.$eval('#wJoke',e=>e.innerHTML));
 for(let k=0;k<5;k++){await p.click('#wMore');console.log(' more:',await p.$eval('#wJoke',e=>e.textContent))}
 await p.screenshot({path:require('path').join(__dirname,'out','welcome.png')});
 await p.reload();await p.waitForTimeout(400);console.log('after reload (fresh used up → random):',await p.$eval('#wJoke',e=>e.textContent));
 console.log('errors',errs);await b.close()})();
