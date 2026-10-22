// Studio audio plus video for the capo (Oct 2026, the user: "Make sessions use studio audio plus video for capo"): a split with no
// video of its own (a studio MP3) takes the capo from the video of another split of the same song (a live MP4), and the session's
// guide is built from the studio split. Only when the studio recording sounds played that way (open shapes with that capo).
const {chromium}=require('playwright');const path=require('path'),fs=require('fs'),http=require('http');
const ROOT=path.resolve(__dirname,'..');
const srv=http.createServer((q,r)=>{const f=path.join(ROOT,decodeURIComponent(q.url.split('?')[0]).replace(/\/$/,'/index.html'));fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);return r.end()}r.writeHead(200,{'content-type':/\.html$/.test(f)?'text/html':/\.js$/.test(f)?'text/javascript':'application/octet-stream'});r.end(d)})});
let fail=0;const ok=(c,m)=>{console.log((c?'ok  ':'FAIL')+' '+m);if(!c)fail++};
const NT=8,ch=(r,t)=>r*NT+t;
const song=(pat,video)=>{let t=0;const segs=[];for(let i=0;i<24;i++)for(const c of pat){segs.push([+t.toFixed(2),+(t+2).toFixed(2),c]);t+=2}
 return {title:'עכשיו',dur:t,bpm:71,offset:0,tuning:{id:'std'},segs,play:{tun:'std',capo:0},v:2,at:1,from:'guitars',song:{t:'עכשיו',a:''},...(video?{video}:{})}};
// heard F Am7 G F = C Em7 D C with capo 5; heard Bb Eb F Gm = G C D Em with capo 3 (another key: with capo 5 only half open shapes)
const CAPO5=[ch(5,0),ch(9,3),ch(7,0),ch(5,0)],CAPO3=[ch(10,0),ch(3,0),ch(5,0),ch(7,1)];
const LIVE={at:1,name:'עכשיו live.mp4',url:'',capo:5,frames:[],asked:27,agree:0,differ:[],fixed:[],nohand:true,from:'stills',raw:{capo:5,capo_conf:'high',frames:[],nohand:true,neck:true,scan:true},vkey:'stills:3',ver:0};
srv.listen(0,async()=>{const APP=process.env.APP||`http://localhost:${srv.address().port}/index.html`;
 const b=await chromium.launch({...(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{})});
 const ctx=await b.newContext();await ctx.route(/^https:\/\//,r=>r.abort());await ctx.route(/ideas\.json/,r=>r.abort());
 const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.addInitScript(()=>{window.__mxPollMs=1e9;window.__lsMs=1e9});await p.goto(APP);await p.waitForTimeout(500);
 // two splits of the song: the studio MP3 (s1, no stills) and the live MP4 (v1, stills, newer)
 const setup=async(studio,live)=>p.evaluate(async([studio,live])=>{
  const cv=document.createElement('canvas');cv.width=320;cv.height=180;const g=cv.getContext('2d');g.fillStyle='#864';g.fillRect(0,0,320,180);
  const jpg=await new Promise(r=>cv.toBlob(r,'image/jpeg',.8)),n=jpg.size,bin=new Blob([jpg,jpg,jpg],{type:'application/octet-stream'});
  await window.__bk.put('mixstills:v1',{every:3,idx:[[0,0,n],[3,n,n],[6,2*n,n]],bin});
  await window.__bk.put('mixIndex',[{id:'v1',name:'עכשיו live',at:2000,src:'cloud',state:'ready',sess:'done',song:{t:'עכשיו',a:''}},{id:'s1',name:'עכשיו',at:1000,src:'cloud',state:'ready',sess:'done',song:{t:'עכשיו',a:''}}]);
  localStorage.setItem('tuner.song.mix_s1',JSON.stringify(studio));if(live)localStorage.setItem('tuner.song.mix_v1',JSON.stringify(live));else localStorage.removeItem('tuner.song.mix_v1');
  localStorage.setItem('tuner.songs',JSON.stringify(live?['mix_v1','mix_s1']:['mix_s1']))},[studio,live]);
 const VER=await p.evaluate(()=>window.__vl.other.ver);LIVE.ver=VER;
 const guide=k=>p.evaluate(k=>{const G=window.__gd.build(k);const c=G.sure.find(x=>/Capo/.test(x.k))||{};return {capo:G.capo,by:G.capoBy,full:G.full,lv:c.lv,why:c.why}},k);
 // 1. the live split's session was built after the studio's: the studio one takes its capo (no Claude call)
 await setup(song(CAPO5,null),{...song(CAPO5,null),title:'עכשיו live',video:LIVE});await p.reload();await p.waitForTimeout(600);
 await p.evaluate(()=>window.__vl.other.share('v1'));
 let r=await guide('mix_s1');console.log('  studio:',JSON.stringify(r));
 ok(r.capo===5&&r.by==='video'&&r.lv==='solid'&&/video of “עכשיו live”, another recording of this song: capo on fret 5\. The chords are from this recording/.test(r.why),'the studio split takes capo 5 from the live split’s video, and How sure says where it came from');
 ok(r.full.includes('C')&&r.full.some(n=>/^Em/.test(n))&&!r.full.includes('F'),'its Full shows the capo-5 shapes (C, Em7, D) of the studio chords');
 const key=await p.evaluate(()=>window.__vl.other.anaKey('s1'));
 ok(key==='mix_s1','the session’s guide is built from the studio split, though the live split is newer ('+key+')');
 // 2. the studio split built later: its own session build reads the other split's kept reading
 await setup(song(CAPO5,null),{...song(CAPO5,null),title:'עכשיו live',video:LIVE});await p.reload();await p.waitForTimeout(600);
 r=(await p.evaluate(()=>window.__vl.other.look('s1','mix_s1'))).video;
 ok(r&&r.capo===5&&r.from==='other'&&r.other==='v1'&&r.raw&&/^other:v1:3$/.test(r.vkey),'building the studio session: the capo comes from the live split’s video, kept with the session');
 // 3. a live version in another key: the studio recording doesn't sound played with capo 5, so the sound decides
 await setup(song(CAPO3,null),{...song(CAPO5,null),title:'עכשיו live',video:LIVE});await p.reload();await p.waitForTimeout(600);
 await p.evaluate(()=>window.__vl.other.share('v1'));r=await guide('mix_s1');console.log('  other key:',r.why);
 ok(r.capo===3&&r.by==='sound'&&/shows capo 5, but this recording doesn’t sound played that way/.test(r.why),'a live version in another key: its video’s capo 5 isn’t taken; the sound’s capo 3 is, and How sure says why');
 // 4. the live split has no reading yet: the studio session scans its stills (two Claude calls), capo only
 await setup(song(CAPO5,null),null);await p.reload();await p.waitForTimeout(600);
 r=await p.evaluate(async()=>{const asked=[];const fn=async()=>({text:'',truncated:false});fn.limits=async()=>({images:{maxCount:10}});
  fn.json=async(pr,o)=>{asked.push(pr.slice(0,40));return /grids of stills/.test(pr)?{stills:[{grid:1,still:1,box:[.1,.1,.9,.9],capo:'yes'},{grid:1,still:2,box:[.1,.1,.9,.9],capo:'yes'}]}:{each:[{t:0,capo:5},{t:6,capo:5}],capo:5,capo_conf:'high'}};
  window.__vl.other.claude(fn);const a=await window.__vl.other.look('s1','mix_s1');return {v:a.video,asked,capo:a.play.capo}});
 ok(r.v&&r.v.capo===5&&r.v.from==='other'&&r.capo===5&&r.asked.length===2&&/grids of stills/.test(r.asked[0]),'no reading yet: the live split’s stills are scanned for the capo (2 Claude calls), capo 5');
 // 5. a song with only the studio split: nothing changes
 r=await p.evaluate(()=>{window.__vl.other.forget('v1');return window.__vl.other.sibs('s1').length});
 ok(r===0,'with no other split, there is no other video');
 ok(!errs.length,'no page errors '+JSON.stringify(errs));await b.close();srv.close();console.log(fail?fail+' FAILED':'all passed');process.exit(fail?1:0)});
