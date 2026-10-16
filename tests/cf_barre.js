const APP=process.env.APP||('file://'+require('path').resolve(__dirname,'../index.html'));
const {chromium,devices}=require('playwright');
(async()=>{const b=await chromium.launch({...(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{})});const p=await (await b.newContext({...devices['Pixel 7'],colorScheme:'dark'})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));await p.route(/^https:\/\//,r=>r.abort());
 await p.addInitScript(()=>{if(sessionStorage.x)return;sessionStorage.x=1;localStorage.setItem('tuner.userName','"Yoav"')});
 await p.goto(APP);await p.waitForTimeout(300);await p.waitForSelector('#wSkip',{state:'visible',timeout:2000}).then(()=>p.tap('#wSkip')).catch(()=>{});
 await (await p.$('#hLib:visible')?p.tap('#hLib').then(()=>p.tap('.libgo[data-sec=chords]')):p.tap('[data-tab=chords]'));await p.tap('#chFind');await p.waitForTimeout(200);
 const T=async sel=>{const el=await p.$('#cfBoard '+sel);const bb=await el.boundingBox();await p.touchscreen.tap(bb.x+bb.width/2,bb.y+bb.height/2);await p.waitForTimeout(80)};
 const res=()=>p.$eval('#cfOut',e=>e.innerText.replace(/\n/g,' | '));
 await T('.hit[data-barre="1"]');await T('.hit[data-s="1"][data-fr="3"]');await T('.hit[data-s="2"][data-fr="3"]');await T('.hit[data-s="3"][data-fr="2"]');console.log('F barre:',await res());await p.screenshot({path:require('path').join(__dirname,'out','barreF.png')});
 await p.tap('#cfClear');await T('.hit[data-top="0"]');await T('.hit[data-barre="2"]');await T('.hit[data-s="2"][data-fr="4"]');await T('.hit[data-s="3"][data-fr="4"]');await T('.hit[data-s="4"][data-fr="3"]');console.log('Bm:',await res());
 await p.tap('#cfClear');await T('.hit[data-top="0"]');await T('.hit[data-s="1"][data-fr="3"]');await T('.hit[data-s="2"][data-fr="2"]');await T('.hit[data-s="3"][data-fr="3"]');await T('.hit[data-s="4"][data-fr="1"]');console.log('C7 (4 fingers):',await res());
 // barre at fret 5 (A shape barre at 5 = D? E-shape barre 5 = A)
 await p.tap('#cfClear');for(let k=0;k<4;k++)await p.tap('[data-cs=pos][data-d="1"]');await T('.hit[data-barre="5"]');await T('.hit[data-s="1"][data-fr="7"]');await T('.hit[data-s="2"][data-fr="7"]');await T('.hit[data-s="3"][data-fr="6"]');console.log('A barre 5:',await res());
 await p.tap('#cfUse');await p.waitForTimeout(200);console.log('detail first:',await p.$eval('#chDetail .voice',e=>e.innerText.replace(/\n/g,' ')));
 await p.screenshot({path:require('path').join(__dirname,'out','barreBook.png')});console.log(errs);await b.close()})();
