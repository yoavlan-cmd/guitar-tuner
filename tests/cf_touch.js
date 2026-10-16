const APP=process.env.APP||('file://'+require('path').resolve(__dirname,'../index.html'));
const {chromium,devices}=require('playwright');
(async()=>{const b=await chromium.launch({...(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{})});const p=await (await b.newContext({...devices['Pixel 7'],colorScheme:'dark'})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));await p.route(/^https:\/\//,r=>r.abort());
 await p.addInitScript(()=>{if(sessionStorage.x)return;sessionStorage.x=1;localStorage.setItem('tuner.userName','"Yoav"')});
 await p.goto(APP);await p.waitForTimeout(300);await p.waitForSelector('#wSkip',{state:'visible',timeout:2000}).then(()=>p.tap('#wSkip')).catch(()=>{});
 await (await p.$('#hLib:visible')?p.tap('#hLib').then(()=>p.tap('.libgo[data-sec=chords]')):p.tap('[data-tab=chords]'));await p.tap('#chFind');await p.waitForTimeout(200);
 const dots=()=>p.$$eval('#cfBoard .dot',x=>x.length);
 for(const [s,fr] of [[2,2],[3,2],[4,2],[1,3],[1,3],[5,1],[5,2],[5,3]]){const el=await p.$(`#cfBoard .hit[data-s="${s}"][data-fr="${fr}"]`);const bb=await el.boundingBox();await p.touchscreen.tap(bb.x+bb.width/2,bb.y+bb.height/2);await p.waitForTimeout(150);console.log('tap',s,fr,'dots',await dots(),'| vis',bb.y.toFixed(0),'| f',await p.evaluate(()=>document.querySelector('#cfOut').innerText.split('\n')[0]))}
 await p.screenshot({path:require('path').join(__dirname,'out','touch.png')});console.log(errs);await b.close()})();
