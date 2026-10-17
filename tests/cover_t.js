// The song's name and its album cover (V2): a live or video upload's name is cleaned ("(חי באולפן …)", "[Official Video]");
// a V1 song-video title "Artist - Song" isn't shown swapped; the cover is looked up in Apple's music catalog only when the artist
// and the song both match, made into the app's sizes, kept on the phone and reused (no second lookup); it shows as a light
// background behind the name on the song's page and as a small picture in the Learn list; "Edit name" fixes the name.
const {chromium,devices}=require('playwright');const path=require('path'),fs=require('fs'),http=require('http');
const ROOT=path.resolve(__dirname,'..'),OUT=path.join(__dirname,'out');fs.mkdirSync(OUT,{recursive:true});
const srv=http.createServer((q,r)=>{const f=path.join(ROOT,decodeURIComponent(q.url.split('?')[0]).replace(/\/$/,'/index.html'));fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);return r.end()}r.writeHead(200,{'content-type':/\.html$/.test(f)?'text/html':'application/octet-stream'});r.end(d)})}).listen(0);
const APP=process.env.APP||`http://localhost:${srv.address().port}/index.html`;
let fail=0;const ok=(c,m)=>{console.log((c?'ok  ':'FAIL')+' '+m);if(!c)fail++};
// an 8×8 red PNG (the "cover")
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEUlEQVR4nGM4YGCAFTEMLQkARmxIAeJ265UAAAAASUVORK5CYII=','base64');
const H={'access-control-allow-origin':'*'};
const CAT={// what the catalog answers, by the words searched
 'במקום בו אני גר':[{artistName:'Cover Band',trackName:'במקום בו אני גר',artworkUrl100:'https://is1.mzstatic.com/x/wrong/100x100bb.jpg'},
  {artistName:'ג\'ימבו ג\'יי',trackName:'במקום בו אני גר',collectionName:'אלבום',artworkUrl100:'https://is1.mzstatic.com/x/jimbo/100x100bb.jpg'}],
 'Wonderwall':[{artistName:'Some Cover Band',trackName:'Wonderwall',artworkUrl100:'https://is1.mzstatic.com/x/wall/100x100bb.jpg'}]};
(async()=>{const b=await chromium.launch({...(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{})});
 const ctx=await b.newContext({...devices['Pixel 7']});const looks=[],arts=[];
 await ctx.route(/^https:\/\//,r=>{const u=r.request().url();
  if(u.startsWith('https://itunes.apple.com/search')){const term=new URL(u).searchParams.get('term');looks.push(term);const k=Object.keys(CAT).find(x=>term.includes(x));
   return r.fulfill({contentType:'application/json',headers:H,body:JSON.stringify({results:k?CAT[k]:[]})})}
  if(u.startsWith('https://is1.mzstatic.com/')){arts.push(u);return r.fulfill({contentType:'image/png',headers:H,body:PNG})}
  return r.abort()});
 await ctx.route(/ideas\.json/,r=>r.abort());
 const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.addInitScript(()=>{if(sessionStorage.x)return;sessionStorage.x=1;const S=(k,v)=>localStorage.setItem('tuner.'+k,JSON.stringify(v));
  S('userName','Yoav');S('profile',{name:'Yoav',onboarding:{done:true}});S('learnLang','he');
  S('ideaOnIt',[{title:'Wonderwall',artist:'Oasis',at:Date.now()-5000}]);
 });
 await p.goto(APP);await p.waitForTimeout(400);
 // names
 const C=await p.evaluate(()=>{const c=window.__cov;return {
  live:c.clean("ג'ימבו ג'יי - במקום בו אני גר (חי באולפן גלגלצ)"),vid:c.clean('Oasis - Wonderwall [Official Video]'),bar:c.clean('Oasis - Wonderwall | Live at Knebworth'),keep:c.clean('Green Day - Good Riddance (Time Of Your Life)'),
  idLive:c.ident("ג'ימבו ג'יי - במקום בו אני גר (חי באולפן גלגלצ).mp4"),idClean:c.ident('Oasis - Wonderwall.mp3'),idBare:c.ident('wonderwall.mp3'),
  swap:c.ana({title:"ג'ימבו ג'יי, אורית טשומה, אברהם לגסה - במקום בו אני גר (חי באולפן גלגלצ)"}),built:c.ana({title:'במקום בו אני גר - ג\'ימבו ג\'יי',artist:'ג\'ימבו ג\'יי'}),
  own:c.ana({title:'x',song:{t:'במקום בו אני גר',a:'ג\'ימבו ג\'יי'}}),k1:c.key('במקום בו אני גר (חי)','ג\'ימבו ג\'יי'),k2:c.key('במקום בו אני גר','ג\'ימבו ג\'יי')}});
 console.log('  '+JSON.stringify(C));
 ok(C.live.s==="ג'ימבו ג'יי - במקום בו אני גר"&&C.live.noisy&&C.vid.s==='Oasis - Wonderwall'&&C.bar.s==='Oasis - Wonderwall','a live or video upload’s name loses "(חי באולפן …)", "[Official Video]", "| Live at …"');
 ok(C.keep.s==='Green Day - Good Riddance (Time Of Your Life)'&&!C.keep.noisy,'a bracket that is part of the song’s name stays');
 ok(!C.idLive.sure&&C.idLive.t==='במקום בו אני גר'&&C.idLive.a==="ג'ימבו ג'יי",'a live upload: song and artist guessed, not sure (Guitaring asks)');
 ok(C.idClean.sure&&C.idClean.t==='Wonderwall'&&C.idClean.a==='Oasis'&&!C.idBare.sure,'a clean "Artist - Song" is sure; a bare song name isn’t');
 ok(C.swap.t==='במקום בו אני גר'&&/אורית טשומה/.test(C.swap.a),'a song video’s "Artist - Song" title is not shown swapped');
 ok(C.built.t==='במקום בו אני גר'&&C.built.a==="ג'ימבו ג'יי"&&C.own.t==='במקום בו אני גר','a session’s own song and artist are used');
 ok(C.k1===C.k2,'the same song with a live tag shares its cover');
 // a song from a live video: its jam track, named by the file
 await p.evaluate(async()=>{const n=44100*2,mk=()=>new Int16Array(n*2);await window.__bk.put('mixdata:m1',{len:n,sr:44100,tracks:[{id:'guitar',name:'Guitars',data:mk()},{id:'drums',name:'Drums',data:mk()}]});
  await window.__bk.put('mixIndex',[{id:'m1',name:"ג'ימבו ג'יי, אורית טשומה, אברהם לגסה - במקום בו אני גר (חי באולפן גלגלצ)",at:Date.now(),src:'cloud',state:'ready'}])});
 await p.reload();await p.waitForTimeout(600);
 await p.tap('#bnav [data-sec=learn]');await p.waitForTimeout(1200);
 const row=await p.$eval('#learnList .lrow',e=>e.querySelector('.ltxt').innerText.replace(/\s+/g,' '));console.log('  '+row);
 ok(/^במקום בו אני גר /.test(row)&&/אורית טשומה/.test(row)&&!/חי באולפן/.test(row),'Learn: the song’s name first, then its artists, no live tag');
 ok(looks.length>=1&&arts.some(u=>/\/jimbo\/600x600bb\./.test(u))&&!arts.some(u=>/wrong/.test(u)),'the cover is looked up and the one whose artist matches is taken, at 600 px '+JSON.stringify({looks,arts}));
 ok(await p.$eval('#learnList .lcov',e=>e.classList.contains('on')&&/blob:/.test(e.style.backgroundImage)),'Learn: the cover’s small picture next to the song');
 const kept=await p.evaluate(async()=>{const v=await window.__bk.get(window.__cov.key('במקום בו אני גר','ג\'ימבו ג\'יי, אורית טשומה, אברהם לגסה'));return v&&{big:v.big&&v.big.size,thumb:v.thumb&&v.thumb.size,color:v.color,album:v.album}});
 ok(kept&&kept.big>0&&kept.thumb>0&&/^rgb\(/.test(kept.color),'the cover is made into the app’s sizes and kept on the phone '+JSON.stringify(kept));
 // the song's page: the light background
 await p.tap('#learnList .lrow');await p.waitForTimeout(800);
 const hero=await p.$eval('.seshero',e=>({cls:e.classList.contains('hascov'),v:e.style.getPropertyValue('--cov'),op:getComputedStyle(e,'::before').opacity,h3:e.querySelector('h3').textContent,art:(e.querySelector('.sesart')||{}).textContent}));
 console.log('  '+JSON.stringify(hero));
 ok(hero.cls&&/blob:/.test(hero.v)&&+hero.op>0&&+hero.op<.6,'the song’s page: the cover as a light background behind the name');
 ok(hero.h3==='במקום בו אני גר'&&/ג'ימבו ג'יי/.test(hero.art),'the page shows the song as its name and the artists under it');
 await p.setViewportSize({width:360,height:740});await p.waitForTimeout(150);
 ok(await p.evaluate(()=>document.documentElement.scrollWidth<=360),'no sideways scroll at 360 px');
 await p.screenshot({path:path.join(OUT,'cover_hero.png')});
 // reused: no second lookup (another visit)
 const n0=looks.length;await p.reload();await p.waitForTimeout(600);await p.tap('#bnav [data-sec=learn]');await p.waitForTimeout(800);
 ok(looks.length===n0&&await p.$eval('#learnList .lcov',e=>e.classList.contains('on')),'the kept cover is reused, no second lookup');
 // a catalog result by another artist: no cover
 ok(await p.evaluate(()=>window.__cov.get('Wonderwall','Oasis'))===null,'a song found only by another artist gets no cover');
 ok(await p.evaluate(async()=>{const v=await window.__bk.get(window.__cov.key('Wonderwall','Oasis'));return !!(v&&v.none)}),'"no cover" is remembered (looked again after a week)');
 // Edit name
 await p.tap('#learnList .lrow:has-text("במקום")');await p.waitForTimeout(500);
 await p.tap('#sesName');await p.waitForTimeout(150);
 ok(await p.$eval('#snT',e=>e.value)==='במקום בו אני גר','Edit name opens with the song’s name');
 await p.fill('#snA',"ג'ימבו ג'יי");await p.tap('#snOk');await p.waitForTimeout(800);
 const after=await p.evaluate(async()=>({art:document.querySelector('.seshero .sesart').textContent,song:(await window.__bk.get('mixIndex')).find(x=>x.id==='m1').song}));
 ok(after.art==="ג'ימבו ג'יי"&&after.song&&after.song.by==='you'&&after.song.a==="ג'ימבו ג'יי",'Edit name: saved as yours, the page follows '+JSON.stringify(after));
 ok(await p.$eval('.seshero',e=>e.classList.contains('hascov')),'the cover for the new name is found');
 ok(!errs.length,'no page errors '+JSON.stringify(errs));
 console.log(fail?`${fail} FAILED`:'all passed');await b.close();srv.close();process.exit(fail?1:0)})();
