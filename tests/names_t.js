// The parts are joined into one app script, so two top-level functions (or consts) with the same name in different parts clash
// silently (the later one wins): "vlSheets" in the video check once replaced the video lessons' sheet list. Every name is unique.
const fs=require('fs'),path=require('path');const d=path.join(__dirname,'..','src','parts');const seen={};
for(const f of fs.readdirSync(d).sort()){const s=fs.readFileSync(path.join(d,f),'utf8');for(const m of s.matchAll(/^(?:async )?function (\w+)\(|^(?:const|let) (\w+)=/gm)){const n=m[1]||m[2];(seen[n]=seen[n]||[]).push(f)}}
const dup=Object.entries(seen).filter(([,l])=>l.length>1);
console.log((dup.length?'FAIL':'ok  ')+' every top-level name in the parts is unique'+(dup.length?' '+JSON.stringify(dup):''));
console.log(dup.length?'1 FAILED':'all passed');process.exit(dup.length?1:0);
