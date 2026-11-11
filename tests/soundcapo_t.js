// The capo when the video doesn't show it clearly (Oct 2026, "עכשיו": capo 5 plain in the video, too small for the stills to read, and
// Full said "No capo"): the sound points to it, near a capo the hand plays open shapes (F Am7 G heard = C Em7 D with capo 5). A
// clear reading of the video wins; a medium one the sound clearly contradicts is taken as misread; a song with open shapes and no
// capo stays without one.
const {chromium}=require('playwright');const path=require('path'),fs=require('fs'),http=require('http');
const ROOT=path.resolve(__dirname,'..');
const srv=http.createServer((q,r)=>{const f=path.join(ROOT,decodeURIComponent(q.url.split('?')[0]).replace(/\/$/,'/index.html'));fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);return r.end()}r.writeHead(200,{'content-type':/\.html$/.test(f)?'text/html':/\.js$/.test(f)?'text/javascript':'application/octet-stream'});r.end(d)})});
let fail=0;const ok=(c,m)=>{console.log((c?'ok  ':'FAIL')+' '+m);if(!c)fail++};
const NT=8,ch=(r,t)=>r*NT+t;// F=5, A=9 (m7=3), G=7, C=0, D=2, E=4 (m=1)
const song=(pat,video)=>{let t=0;const segs=[];for(let i=0;i<24;i++)for(const c of pat){segs.push([+t.toFixed(2),+(t+2).toFixed(2),c]);t+=2}
 return {title:'Test - Band',dur:t,bpm:90,offset:0,tuning:{id:'std'},segs,play:{tun:'std',capo:0},v:2,at:1,from:'guitars',...(video?{video}:{})}};
const CAPO5=[ch(5,0),ch(9,3),ch(7,0),ch(5,0)],OPEN=[ch(0,0),ch(9,1),ch(7,0),ch(2,0)];
srv.listen(0,async()=>{const APP=process.env.APP||`http://localhost:${srv.address().port}/index.html`;
 const b=await chromium.launch({...(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{})});
 const ctx=await b.newContext();await ctx.route(/^https:\/\//,r=>r.abort());await ctx.route(/ideas\.json/,r=>r.abort());
 const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));await p.goto(APP);await p.waitForTimeout(400);
 const G=async(k,a)=>p.evaluate(([k,a])=>{localStorage.setItem('tuner.song.'+k,JSON.stringify(a));const G=window.__gd.build(k);const c=G.sure.find(x=>/Capo/.test(x.k))||{};return {capo:G.capo,by:G.capoBy,full:G.full,lv:c.lv,why:c.why}},[k,a]);
 const vid=(capo,conf)=>({at:1,name:'v.mp4',url:'',capo,frames:[],asked:27,clear:0,agree:0,differ:[],fixed:[],raw:{capo,capo_conf:conf}});
 let r=await G('mix_s1',song(CAPO5,null));console.log('  no video:',JSON.stringify(r));
 ok(r.capo===5&&r.by==='sound'&&r.lv==='likely'&&/With capo 5 the chords heard are the open shapes/.test(r.why)&&/C/.test(r.full.join(' '))&&!r.full.includes('F'),'no clear capo in the video: Full takes capo 5 from the sound (C Em7 D shapes), and How sure says why');
 r=await G('mix_s2',song(CAPO5,{at:1,name:'v.mp4',url:'',capo:null,frames:[],asked:27,clear:0,agree:0,differ:[],fixed:[],nohand:true}));
 ok(r.capo===5&&r.by==='sound'&&/isn\u2019t clear in the video/.test(r.why),'a video where the neck isn\u2019t clear: the same, and it says the video didn\u2019t show it');
 r=await G('mix_s3',song(CAPO5,vid(0,'medium')));console.log('  misread:',r.why);
 ok(r.capo===5&&r.by==='sound'&&/seemed to show no capo, but the sound says otherwise/.test(r.why),'the video read as no capo (medium) while the sound clearly says capo 5: capo 5, and it says so');
 r=await G('mix_s4',song(CAPO5,vid(0,'high')));
 ok(r.capo===0&&r.by==='video','a clear reading of the video wins (no capo, high)');
 r=await G('mix_s5',song(CAPO5,vid(5,'medium')));
 ok(r.capo===5&&r.by==='video','the video and the sound agree: capo 5 from the video');
 // the video and the sound agree: solid (Oct 2026, "עכשיו": the scan saw the capo, one close-up counted 5, the sound says 5)
 const scanned=(each,yes)=>({at:1,name:'v.mp4',url:'',capo:null,frames:[],asked:26,clear:0,agree:0,differ:[],fixed:[],nohand:true,capoScan:{capo:null,conf:'low',each,hint:{yes,maybe:2,necks:12,looked:67}}});
 r=await G('mix_s7',song(CAPO5,scanned([5,null,3],3)));console.log('  both:',r.lv,'|',r.why);
 ok(r.capo===5&&r.by==='both'&&r.lv==='solid'&&/The video shows a capo \(the capo scan saw it in 3 stills\), 1 of 2 close-ups counted fret 5, and the sound agrees/.test(r.why),'the scan saw the capo and a close-up counted fret 5, the sound says 5: capo 5, solid, and it says both');
 r=await G('mix_s8',song(CAPO5,scanned([],3)));
 ok(r.capo===5&&r.by==='both'&&r.lv==='solid','the scan saw a capo in 3 stills but couldn\u2019t count its fret; the sound is clear on 5: solid');
 r=await G('mix_s9',song(CAPO5,scanned([],0)));
 ok(r.capo===5&&r.by==='sound'&&r.lv==='likely','no capo seen by the scan: still the sound\u2019s capo 5, only likely');
 {const h=await p.evaluate(()=>{const d=document.createElement('div');d.innerHTML=window.__gd.html('mix_s9');return [...d.querySelectorAll('.gdsrc li')].map(x=>x.textContent).find(x=>/The video/.test(x))||''});console.log('  built from:',h);
  ok(/the capo scan of the whole video saw the neck in 12 stills, but couldn\u2019t count the capo\u2019s fret/.test(h),'Built from says what the capo scan saw')}
 r=await G('mix_s6',song(OPEN,null));
 ok(r.capo===0&&r.by==='none','open shapes with no capo: no capo');
 ok(!errs.length,'no page errors '+JSON.stringify(errs));await b.close();srv.close();console.log(fail?fail+' FAILED':'all passed');process.exit(fail?1:0)});
