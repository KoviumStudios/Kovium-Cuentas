(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.koviumRunner=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const HZ=60,DT=1/HZ,MAX_INPUTS=12000,MAX_REPLAY_TICKS=108000,ACTIONS=new Set(['left','right','jump','duck']),clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
 const BIOMES=[{id:'meadow',name:'Pradera dorada'},{id:'desert',name:'Desierto del sol'},{id:'snow',name:'Cumbre nevada'},{id:'sunset',name:'Estación del atardecer'}];
 function seededRandom(seed){let state=seed>>>0;return()=>{state=(state+0x6D2B79F5)>>>0;let t=state;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
 function createRunnerModel(seedOrRandom=Date.now()>>>0){
  let seed,rng,tick,lane,x,height,velocity,duck,queuedDuck,jumpBuffer,distance,coins,points,streak,shield,magnet,invincible,ended,entities,row,untilRow,flash,event,accumulator,inputs,overflow,dodges,lean,lastBoss;
  const rand=()=>clamp(Number(rng())||0,0,.999999999);
  function spawnRow(z=112){
   row++;const free=Math.floor(rand()*3),blocked=[0,1,2].filter(n=>n!==free),boss=row>=9&&row-lastBoss>=7&&rand()<.23,both=boss||row>2&&rand()<.76,chosen=both?blocked:[blocked[Math.floor(rand()*2)]];
   if(boss){lastBoss=row;event='¡GUARDIÁN! Busca la vía libre';flash=2.5;}
   for(const n of chosen){const chance=rand(),kind=boss?'boss':row<3?'block':chance<.35?'hurdle':chance<.68?'beam':'block';entities.push({row,free,lane:n,z,kind,hit:false,avoided:false});}
   for(let i=0;i<6;i++)entities.push({row,free,lane:free,z:z+8+i*3,kind:'coin',hit:false});
   if(row%2===0)for(const n of blocked)entities.push({row,free,lane:n,z:z+22,kind:'coin',hit:false});
   if(row%7===3)entities.push({row,free,lane:free,z:z+13,kind:'magnet',hit:false});
   if(row%9===5)entities.push({row,free,lane:free,z:z+17,kind:'shield',hit:false});
  }
  function reset(value=seedOrRandom){seed=typeof value==='function'?0:Number(value)>>>0;rng=typeof value==='function'?value:seededRandom(seed);tick=0;lane=x=1;height=velocity=duck=jumpBuffer=distance=coins=points=streak=shield=magnet=invincible=flash=accumulator=dodges=lean=lastBoss=0;queuedDuck=ended=overflow=false;entities=[];row=0;untilRow=24;event='';inputs=[];spawnRow(45);}
  function action(value){
   if(ended||!ACTIONS.has(value))return false;
   if(inputs.length<MAX_INPUTS)inputs.push({tick,action:value});else overflow=true;
   if(value==='left'){lane=Math.max(0,lane-1);return true;}if(value==='right'){lane=Math.min(2,lane+1);return true;}
   if(value==='jump'){if(height===0){duck=0;velocity=7.6;return true;}jumpBuffer=.12;return false;}
   jumpBuffer=0;if(height>0){velocity=Math.min(velocity,-9);queuedDuck=true;return true;}duck=.78;return true;
  }
  function fixedStep(){
   if(ended)return;tick++;const speed=14+Math.min(16,distance/180),travel=speed*DT;
   distance+=travel;untilRow-=travel;duck=Math.max(0,duck-DT);magnet=Math.max(0,magnet-DT);jumpBuffer=Math.max(0,jumpBuffer-DT);invincible=Math.max(0,invincible-DT);flash=Math.max(0,flash-DT);
   const priorX=x;x+=clamp(lane-x,-DT*8,DT*8);lean+=(clamp((x-priorX)/DT/8,-1,1)-lean)*.22;
   if(height>0||velocity!==0){height=Math.max(0,height+velocity*DT-10.5*DT*DT);velocity-=21*DT;if(height===0){velocity=0;if(queuedDuck){duck=.78;queuedDuck=false;}if(jumpBuffer>0){duck=0;velocity=7.6;jumpBuffer=0;}}}
   if(untilRow<=0){spawnRow();untilRow+=23+rand()*7;}
   for(const e of entities){
    e.z-=travel;if(e.hit)continue;const inLane=Math.abs(e.lane-x)<.52;
    if(e.kind==='coin'){
     if(Math.abs(e.z)<.75&&inLane||magnet>0&&e.z<11&&e.z>-.75){e.hit=true;coins++;streak++;points+=25*Math.min(5,1+Math.floor(streak/15));event=magnet>0?'¡IMÁN! + MONEDA':'+ MONEDA';flash=.18;}
     else if(e.z<-.8)e.hit=true;continue;
    }
    if(e.kind==='magnet'||e.kind==='shield'){
     if(Math.abs(e.z)<.85&&inLane){e.hit=true;if(e.kind==='magnet'){magnet=8;event='¡IMÁN DE MONEDAS! · 8 s';}else{shield=1;event='¡ESCUDO ACTIVADO!';}flash=1.5;}
     else if(e.z<-.9)e.hit=true;continue;
    }
    if(e.z<-.65){e.hit=true;if(e.avoided){dodges++;points+=50;event=e.kind==='hurdle'?'¡BUEN SALTO!':'¡BUENA DERRAPADA!';flash=.45;}continue;}
    if(e.z>.65||!inLane)continue;
    const safe=e.kind==='hurdle'&&height>.82||e.kind==='beam'&&height+(duck>0?.67:1.72)<1.12;
    if(safe){e.avoided=true;continue;}if(invincible>0){e.hit=true;continue;}
    if(shield){shield=0;invincible=1.35;streak=0;e.hit=true;event='¡TE SALVÓ EL ESCUDO!';flash=.75;}
    else{ended=true;event=e.kind==='hurdle'?'Salta las barreras de obras':e.kind==='beam'?'Deslízate bajo las barras amarillas':e.kind==='boss'?'El guardián bloqueó esa vía. Busca el carril libre.':'Esquiva los trenes cambiando de vía';break;}
   }
   entities=entities.filter(e=>e.z>-3&&!(['coin','magnet','shield'].includes(e.kind)&&e.hit));
  }
  function step(seconds){if(ended)return;const secondsValue=Number(seconds);if(!Number.isFinite(secondsValue)||secondsValue<=0)return;accumulator+=Math.min(secondsValue,.12);let iterations=0;while(accumulator+1e-10>=DT&&iterations++<8&&!ended){fixedStep();accumulator-=DT;}if(accumulator<0)accumulator=0;}
  function advanceTicks(count){if(!Number.isSafeInteger(count)||count<0||count>MAX_REPLAY_TICKS)throw Error('Número de pasos no válido.');for(let i=0;i<count&&!ended;i++)fixedStep();}
  const summary=()=>{const biome=BIOMES[Math.floor(distance/500)%BIOMES.length],boss=entities.find(e=>e.kind==='boss'&&!e.hit&&e.z>0&&e.z<80);return{seed,tick,ticks:tick,time:tick/HZ,lane,x,height,velocity,duck,lean,distance,coins,dodges,streak,shield,magnet,invincible,ended,speed:14+Math.min(16,distance/180),score:Math.floor(distance*4)+points,multiplier:Math.min(5,1+Math.floor(streak/15)),biome:biome.id,biomeName:biome.name,bossWarning:boss?{free:boss.free,z:boss.z}:null,event,flash,inputCount:inputs.length,replayable:!overflow&&tick<=MAX_REPLAY_TICKS};};
  reset();return Object.freeze({step,advanceTicks,action,reset,snapshot:()=>({...summary(),entities:entities.map(e=>({...e}))}),exportRun:()=>{const s=summary();return{seed,ticks:tick,inputs:inputs.filter(i=>i.tick<tick).map(i=>({...i})),score:s.score,distance,coins,duration:tick/HZ,ended,replayable:s.replayable};}});
 }
 return Object.freeze({HZ,MAX_INPUTS,MAX_REPLAY_TICKS,BIOMES,seededRandom,createRunnerModel});
});
