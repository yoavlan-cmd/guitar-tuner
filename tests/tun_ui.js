const APP=process.env.APP||('file://'+require('path').resolve(__dirname,'../index.html'));
const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch({...(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{})});
 for(const scheme of ['light','dark']){
 const p=await (await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,colorScheme:scheme})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.route(/^https:\/\//,r=>r.abort());
 await p.addInitScript(()=>{localStorage.setItem('tuner.userName','"Yoav"')});
 await p.goto(APP);await p.waitForTimeout(400);if(await p.$('#wSkip:visible'))await p.click('#wSkip');await p.waitForTimeout(300);
 await p.screenshot({path:`tun_idle_${scheme}.png`});
 if(scheme==='light'){
  const labs=await p.$$eval('.peg',x=>x.map(e=>e.innerText.replace(/\s+/g,'')));console.log('labels',labs.join(' '));
  await p.click('.peg[data-i="3"]');console.log('after tap G: target',await p.$eval('.peg.target',e=>e.dataset.i),'chip',await p.$eval('#modeChip',e=>e.textContent),'note',await p.$eval('#note',e=>e.textContent));
  // simulate a flat reading
  await p.evaluate(()=>{__tunerTest.needle(-8);__tunerTest.head('flat');document.getElementById('status').className='status flat';document.getElementById('status').textContent='Tune up ↑ · 8¢'});
  await p.waitForTimeout(120);const mid=await p.$eval('#needle',e=>e.getAttribute('transform'));await p.waitForTimeout(1200);
  console.log('needle mid',mid,'settled',await p.$eval('#needle',e=>e.getAttribute('transform')),'expected',await p.evaluate(()=>__tunerTest.angle(-8).toFixed(2)));
  await p.screenshot({path:require('path').join(__dirname,'out','tun_flat.png')});
  await p.evaluate(()=>{__tunerTest.needle(1);__tunerTest.head('ok');const s=document.getElementById('screen');s.classList.add('ok','locked');document.getElementById('status').className='status ok';document.getElementById('status').textContent='G in tune ✓';__tunerTest.done(3)});
  await p.waitForTimeout(1200);await p.screenshot({path:require('path').join(__dirname,'out','tun_ok.png')});
  await p.click('#tunings [data-id=dropd]');console.log('drop D labels',(await p.$$eval('.peg',x=>x.map(e=>e.innerText.replace(/\s+/g,'')))).join(' '));
  await p.keyboard.press('Tab');
 }
 console.log(scheme,'errors',errs);}
 await b.close()})();
