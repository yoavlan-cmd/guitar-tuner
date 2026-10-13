const APP=process.env.APP||('file://'+require('path').resolve(__dirname,'../index.html'));
const {chromium,devices}=require('playwright');
(async()=>{const b=await chromium.launch({...(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{})});const ctx=await b.newContext({...devices['Pixel 7']});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.route(/^https:\/\//,r=>{const u=r.request().url();
  if(u.includes('youtube.com/oembed')){const id=decodeURIComponent(u).match(/v=([\w-]{11})/)[1];const t={'aaaaaaaaaaa':'אביתר בנאי - עד מתי | שיעור גיטרה','bbbbbbbbbbb':'How to play Wonderwall by Oasis (Easy Guitar Lesson)','ccccccccccc':'Under the Bridge - Red Hot Chili Peppers Guitar Tutorial'}[id]||'Random vlog';return r.fulfill({contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify({title:t,author_name:'Some Teacher',thumbnail_url:''})})}
  return r.abort()});
 await p.addInitScript(()=>{if(sessionStorage.x)return;sessionStorage.x=1;localStorage.setItem('tuner.userName','"Yoav"');
  localStorage.setItem('tuner.sheetIndex',JSON.stringify([{title:'עד מתי',artist:'אביתר בנאי',capo:0,tuning:'Standard',chords:['Am','G'],url:'https://drive.google.com/file/d/X/view'}]));
  localStorage.setItem('tuner.songIndex',JSON.stringify({src:'daily',songs:[{a:'Oasis',t:'Wonderwall',ch:[]}],artists:['Oasis','אביתר בנאי','Red Hot Chili Peppers']}))});
 await p.goto(APP);await p.waitForTimeout(300);if(await p.$('#wSkip:visible'))await p.tap('#wSkip');
 await p.tap('[data-tab=song]');await p.waitForTimeout(200);console.log('summary:',await p.$eval('#vidBox summary',e=>e.innerText.replace(/\n/g,' | ')));
 await p.tap('#vidBox summary');
 const add=async u=>{await p.fill('#vlUrl',u);await p.tap('#vlAdd');await p.waitForTimeout(400)};
 await add('https://youtu.be/aaaaaaaaaaa?si=xyz');console.log('form1:',await p.$eval('#vlSong',e=>e.value),'/',await p.$eval('#vlArt',e=>e.value),'|',await p.$eval('#vlSheetHint',e=>e.innerText));
 await p.screenshot({path:require('path').join(__dirname,'out','form.png')});await p.tap('#vlSave');await p.waitForTimeout(150);console.log('msg:',await p.$eval('#vlMsg',e=>e.innerText));
 await add('https://www.youtube.com/watch?v=bbbbbbbbbbb&t=30');console.log('form2:',await p.$eval('#vlSong',e=>e.value),'/',await p.$eval('#vlArt',e=>e.value),'|',await p.$eval('#vlSheetHint',e=>e.innerText));await p.tap('#vlSave');
 await add('https://m.youtube.com/watch?v=ccccccccccc');console.log('form3:',await p.$eval('#vlSong',e=>e.value),'/',await p.$eval('#vlArt',e=>e.value),'|',await p.$eval('#vlSheetHint',e=>e.innerText));await p.tap('#vlSave');
 await add('https://www.youtube.com/shorts/aaaaaaaaaaa');console.log('dup:',await p.$eval('#vlMsg',e=>e.innerText));
 await add('https://www.instagram.com/reel/XYZ123/?igsh=abc');console.log('insta (no meta):',await p.$eval('#vlSong',e=>e.value)||'(empty)');await p.fill('#vlSong','Hotel California');await p.fill('#vlArt','Eagles');await p.tap('#vlSave');
 await p.waitForTimeout(200);console.log('rows:',await p.$$eval('.vidrow',x=>x.map(r=>r.innerText.replace(/\n/g,' ')).join(' || ')));
 console.log('summary:',await p.$eval('#vidBox summary',e=>e.innerText.replace(/\n/g,' | ')));
 await p.screenshot({path:require('path').join(__dirname,'out','list.png'),fullPage:false});
 // catalog shows 🎬
 const cat=await p.$eval('#catRes',e=>e.innerText.replace(/\n/g,' ')).catch(()=>'n/a');console.log('catalog:',cat);
 // sheet view banner from My songs
 await p.evaluate(()=>{localStorage.setItem('tuner.library',localStorage.getItem('tuner.library')||'[]')});
 // share target
 const p2=await ctx.newPage();p2.on('pageerror',e=>errs.push(e.message));await p2.route(/^https:\/\//,r=>r.abort());
 await p2.goto(''+APP+'?text='+encodeURIComponent('Check this https://youtu.be/ddddddddddd great lesson'));await p2.waitForTimeout(900);
 console.log('share: songs tab',await p2.$eval('#paneSong',e=>!e.hidden),'form shown',!!(await p2.$('#vlSong')),'url clean',p2.url().includes('?')?'no':'yes');
 console.log('errors',errs);await b.close()})();
