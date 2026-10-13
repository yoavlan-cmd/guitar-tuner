// page-side generators for outdoor background sound (20 s, mono)
window.__noiseGen=function(kind,sr){const N=sr*20,d=new Float32Array(N);let b=0,lp=0,lp2=0;const rnd=()=>Math.random()*2-1;
 const env=t=>1;
 if(kind==='wind'){let g=.3,tg=.3,next=0;for(let i=0;i<N;i++){const t=i/sr;if(t>next){tg=.15+Math.random()*.9;next=t+.4+Math.random()*2}g+=(tg-g)*(tg>g?.0004:.00005);lp+=.04*(rnd()-lp);lp2+=.08*(lp-lp2);d[i]=lp2*g*9}}
 if(kind==='traffic'){let car=0;for(let i=0;i<N;i++){const t=i/sr;b=(b+.02*rnd())/1.02;const ph=(t%6)/6;car=Math.exp(-((ph-.5)**2)/.01);d[i]=b*1.2*(.4+car)+(t%9>4&&t%9<4.6?.05*Math.sign(Math.sin(2*Math.PI*415*t))*(.6+.4*Math.sin(2*Math.PI*523*t)):0)}}
 if(kind==='chatter'){let ph=0;for(let i=0;i<N;i++){const t=i/sr,spk=Math.floor(t/2.5)%2,phr=(t%2.5)<2.0,syl=Math.max(0,Math.sin(Math.PI*((t*4.3)%1)))**1.5;
   const f0=(spk?190:115)*(1+.18*Math.sin(2*Math.PI*1.3*t+spk)+.08*Math.sin(2*Math.PI*3.7*t));ph+=f0/sr;const pulse=(ph%1)<.08?1:0;
   lp+=.25*(pulse-lp);lp2+=.05*(lp-lp2);d[i]=(phr?syl:0)*(lp-lp2)*.9+.002*rnd()}}
 if(kind==='birds'){for(let i=0;i<N;i++){const t=i/sr,k=Math.floor(t*3),on=(k*7919%5)<2&&(t*3%1)<.25;d[i]=(on?.08*Math.sin(2*Math.PI*(2800+900*Math.sin(2*Math.PI*14*t))*t):0)+.003*rnd()}}
 if(kind==='street'){const a=__noiseGen('wind',sr),c=__noiseGen('chatter',sr),tr=__noiseGen('traffic',sr),bi=__noiseGen('birds',sr);for(let i=0;i<N;i++)d[i]=.6*a[i]+.8*c[i]+.7*tr[i]+bi[i]}
 return d};
