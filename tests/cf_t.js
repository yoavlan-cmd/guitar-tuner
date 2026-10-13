const APP=process.env.APP||('file://'+require('path').resolve(__dirname,'../index.html'));
const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch({...(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{})});const p=await (await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,colorScheme:'dark'})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));await p.route(/^https:\/\//,r=>r.abort());
 await p.addInitScript(()=>{if(sessionStorage.x)return;sessionStorage.x=1;localStorage.setItem('tuner.userName','"Yoav"')});
 await p.goto(APP);await p.waitForTimeout(300);if(await p.$('#wSkip:visible'))await p.click('#wSkip');
 await p.click('[data-tab=song]');await p.click('#writeNew');await p.fill('#wTitle','My riff');await p.fill('#wLyrics','hello world my song');
 await p.click('#wNext').catch(async()=>{await p.evaluate(()=>{const b=[...document.querySelectorAll('#writeView button')].find(x=>/next|chords/i.test(x.textContent)&&!x.hidden);b&&b.click()})});
 await p.waitForTimeout(300);await p.click('.ww >> nth=0');await p.click('#wPickFind');await p.waitForSelector('#cfWrap:not([hidden])');
 const tap=async(s,fr)=>{await p.click(`#cfBoard .hit[data-s="${s}"][data-fr="${fr}"]`)};const top=async s=>p.click(`#cfBoard .hit[data-top="${s}"]`);
 const res=()=>p.$eval('#cfOut',e=>e.innerText.replace(/\n/g,' | '));
 console.log('all open:',await res());
 await tap(0,3);await tap(1,2);await tap(5,3);console.log('G:',await res(),'| btn',await p.$eval('#cfUse',e=>e.textContent));
 await p.screenshot({path:require('path').join(__dirname,'out','cf_G.png')});
 await p.click('#cfClear');await top(0);await tap(1,3);await tap(2,2);await tap(4,1);console.log('C:',await res());
 await p.click('#cfClear');await tap(0,2);await top(1);await tap(3,2);await tap(4,3);await tap(5,2);console.log('D/F#:',await res());
 // capo 2: real G shape = 5,4,2,2,2,5 -> open strings at capo
 await p.click('#cfClear');await p.click('[data-cs=capo][data-d="1"]');await p.click('[data-cs=capo][data-d="1"]');
 await tap(0,5);await tap(1,4);await tap(5,5);console.log('capo2 G shape:',await res(),'| btn',await p.$eval('#cfUse',e=>e.textContent));
 await p.screenshot({path:require('path').join(__dirname,'out','cf_capo.png')});
 await p.click('[data-cs=capo][data-d="-1"]');await p.click('[data-cs=capo][data-d="-1"]');
 await p.click('#cfClear');await tap(0,3);await tap(1,2);await tap(5,3);
 await p.click('#cfUse');await p.waitForTimeout(200);console.log('chord on word:',await p.$eval('.ww >> nth=0',e=>e.innerText.replace(/\n/g,' ')),'finder closed',await p.$eval('#cfWrap',e=>e.hidden));
 // Drop D power chord: D A D on bottom 3 strings open
 await p.click('.ww >> nth=1');await p.click('#wPickFind');await p.selectOption('#cfTun','dropd');await top(3);await top(4);await top(5);console.log('DropD 000xxx:',await res());
 await p.click('#cfClose');await p.click('#wPickClose').catch(()=>{});
 // book mode
 await p.evaluate(()=>{document.getElementById('cfWrap').hidden=true});
 await p.click('#wDone').catch(()=>{});await p.waitForTimeout(300);
 const sheet=await p.$('#sheetView:not([hidden])');console.log('sheet shown',!!sheet);
 await p.click('[data-tab=chords]');await p.click('#chFind');await top(5);await p.click('#cfClear');await top(0);await tap(1,2);await tap(2,3);await tap(3,2);await tap(4,3);await top(5);console.log('book Bm7b5:',await res());
 await p.click('#cfUse');await p.waitForTimeout(200);console.log('detail:',await p.$eval('#chDetail',e=>e.innerText.slice(0,160).replace(/\n/g,' | ')));
 await p.screenshot({path:require('path').join(__dirname,'out','cf_book.png'),fullPage:false});
 console.log('errors',errs);await b.close()})();
