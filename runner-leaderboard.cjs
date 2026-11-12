'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const fail=(message,status=400)=>Object.assign(Error(message),{status});
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const ACTIONS=new Set(['left','right','jump','duck']);
const MAX_TICKS=108000,MAX_INPUTS=12000;
function verifySeasonDescriptor(value,publicKey,expectedModelVersion){
 if(!value||value.schemaVersion!==2||value.game!=='run-kovi-run'||!/^[a-f0-9]{64}$/.test(value.modelVersion||'')||value.season!=='accounts-v2-'+value.modelVersion.slice(0,16)||typeof value.signedPayload!=='string'||value.signedPayload.length>4000||typeof value.signature!=='string')throw fail('La temporada no supera la comprobación.');
 const payload=Buffer.from(value.signedPayload,'base64');let signed;try{if(!crypto.verify('RSA-SHA256',payload,publicKey,Buffer.from(value.signature,'base64')))throw Error();signed=JSON.parse(payload);}catch{throw fail('La firma de la temporada no es válida.');}
 if(signed.schemaVersion!==value.schemaVersion||signed.game!==value.game||signed.season!==value.season||signed.modelVersion!==value.modelVersion||expectedModelVersion&&value.modelVersion!==expectedModelVersion)throw fail('La temporada corresponde a otra versión del juego.');return true;
}
async function readRunnerBody(req){
 const chunks=[];let bytes=0;
 for await(const chunk of req){bytes+=chunk.length;if(bytes>850000)throw fail('La partida supera el límite permitido.',413);chunks.push(chunk);}
 let value;try{value=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw fail('Partida no válida.');}
 if(!value||typeof value!=='object'||Array.isArray(value))throw fail('Partida no válida.');return value;
}
function createRunnerLeaderboard({file,now=Date.now,modelFactory,maxEntries=10000,profileForAccount=()=>null,signingKeyBase64,publicKey}={}){
 if(!file)throw Error('Falta el archivo de clasificación.');
 const tickets=new Map(),rates=new Map();let records=new Map(),wallets=new Map(),redemptions=new Map();
 const modelVersion=hash(fs.readFileSync(path.join(__dirname,'runner-model.js'))),season='accounts-v2-'+modelVersion.slice(0,16),seasonPayload={schemaVersion:2,game:'run-kovi-run',season,modelVersion};let seasonDescriptor={...seasonPayload},rankedReady=false;
 try{if(signingKeyBase64){const key=crypto.createPrivateKey(Buffer.from(signingKeyBase64,'base64'));const payload=Buffer.from(JSON.stringify(seasonPayload)),signature=crypto.sign('RSA-SHA256',payload,key).toString('base64');if(publicKey&&!crypto.verify('RSA-SHA256',payload,publicKey,Buffer.from(signature,'base64')))throw Error();seasonDescriptor={...seasonPayload,signedPayload:payload.toString('base64'),signature};rankedReady=true;}}catch{}
 try{
  const stat=fs.lstatSync(file);if(!stat.isFile()||stat.isSymbolicLink()||stat.size>12000000)throw Error('La clasificación no es un archivo válido.');
  const original=fs.readFileSync(file),stored=JSON.parse(original);if(![1,2,3].includes(stored.schemaVersion)||!Array.isArray(stored.entries)||stored.entries.length>maxEntries)throw Error('Formato de clasificación no válido.');
  if(stored.schemaVersion===3){
   if(!Array.isArray(stored.wallets)||stored.wallets.length>maxEntries||!Array.isArray(stored.redemptions)||stored.redemptions.length>5000)throw Error('Formato de monedas no válido.');
   for(const row of stored.wallets){if(!validWallet(row))throw Error('La cartera guardada no es válida.');if(wallets.has(row.player))throw Error('Hay una cartera duplicada.');wallets.set(row.player,row);}
   for(const row of stored.redemptions){if(!validRedemption(row))throw Error('La partida guardada no es válida.');if(redemptions.has(row.key))throw Error('Hay una partida duplicada.');if(row.expiresAt>now())redemptions.set(row.key,row);}
  }
  if(stored.schemaVersion===1||stored.season!==season||stored.modelVersion!==modelVersion){const backup=file+'.previous-season-'+hash(original).slice(0,16)+'.json';if(!fs.existsSync(backup))fs.writeFileSync(backup,original,{flag:'wx',mode:0o600});else{const stat=fs.lstatSync(backup);if(!stat.isFile()||stat.isSymbolicLink()||stat.size!==original.length||hash(fs.readFileSync(backup))!==hash(original))throw Error('La copia de la temporada anterior no es válida.');}}
  else for(const row of stored.entries){if(!validRecord(row)||records.has(row.player))throw Error('La puntuación guardada no es válida.');records.set(row.player,row);}
 }catch(error){if(error.code!=='ENOENT')throw error;}
 function validRecord(row){return row&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(row.player||'')&&Number.isSafeInteger(row.score)&&row.score>=0&&row.score<=100000000&&Number.isFinite(row.distance)&&row.distance>=0&&Number.isSafeInteger(row.coins)&&row.coins>=0&&Number.isSafeInteger(row.at);}
 function validWallet(row){return row&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(row.player||'')&&Number.isSafeInteger(row.coins)&&row.coins>=0&&row.coins<=1000000000&&Number.isSafeInteger(row.totalRuns)&&row.totalRuns>=0&&row.totalRuns<=1000000000;}
 function validRedemption(row){return validRecord(row)&&/^[a-f0-9]{64}$/.test(row.key||'')&&/^[a-f0-9]{64}$/.test(row.runHash||'')&&typeof row.season==='string'&&/^[a-f0-9]{64}$/.test(row.modelVersion||'')&&Number.isSafeInteger(row.expiresAt)&&typeof row.improved==='boolean';}
 function wallet(player){const row=wallets.get(player);return {coins:row?.coins||0,totalRuns:row?.totalRuns||0};}
 function publicRow(row,index){return {rank:index+1,accountId:row.player,name:profileForAccount(row.player)?.name||'Cuenta retirada',score:row.score,distance:Math.round(row.distance),coins:row.coins,at:row.at};}
 function ordered(){return [...records.values()].filter(row=>profileForAccount(row.player)).sort((a,b)=>b.score-a.score||a.at-b.at||a.player.localeCompare(b.player));}
 function playerOf(session){if(session?.kind!=='kovium'||!profileForAccount(session.accountId))throw fail('Inicia sesión en tu cuenta Kovium para participar en la clasificación global.',401);return session.accountId;}
 function limit(player,kind,max,period){const time=now(),key=kind+':'+player,current=rates.get(key);if(!current||current.until<=time)rates.set(key,{count:1,until:time+period});else if(++current.count>max)throw fail('Espera un momento antes de volver a enviar una partida.',429);}
 function persist(next,nextWallets,nextRedemptions){
  fs.mkdirSync(path.dirname(file),{recursive:true});
  if(fs.existsSync(file)&&fs.lstatSync(file).isSymbolicLink())throw Error('La clasificación no es un archivo normal.');
  const temp=file+'.'+crypto.randomBytes(8).toString('hex')+'.tmp';
  try{const bytes=Buffer.from(JSON.stringify({schemaVersion:3,season,modelVersion,entries:[...next.values()],wallets:[...nextWallets.values()],redemptions:[...nextRedemptions.values()]}));if(bytes.length>12000000)throw fail('El archivo de puntuaciones necesita mantenimiento.',503);fs.writeFileSync(temp,bytes,{flag:'wx',mode:0o600});fs.renameSync(temp,file);}finally{fs.rmSync(temp,{force:true});}
 }
 function get(session){const list=ordered();let own=null,ownWallet=null;if(session?.kind==='kovium'){const id=playerOf(session),index=list.findIndex(row=>row.player===id);if(index>=0)own=publicRow(list[index],index);ownWallet=wallet(id);}return {ok:true,online:true,rankedReady,season,modelVersion,seasonDescriptor,entries:list.slice(0,50).map(publicRow),personalBest:own,wallet:ownWallet};}
 function prune(){const time=now();for(const [key,value]of tickets)if(value.expiresAt<=time)tickets.delete(key);for(const [key,value]of rates)if(value.until<=time)rates.delete(key);for(const [key,value]of redemptions)if(value.expiresAt<=time)redemptions.delete(key);}
 function start(session,payload={}){
  const player=playerOf(session);prune();limit(player,'start',8,60000);
  if(payload.mode!=='arcade')throw fail('Actualiza Kovium Launcher a la versión 1.9.0 para jugar en Arcade y guardar tus monedas.');
  if(!rankedReady)throw fail('La temporada global todavía no está configurada.',503);
  const abandon=payload.abandon===undefined?[]:payload.abandon;
  if(!Array.isArray(abandon)||abandon.length>8||new Set(abandon).size!==abandon.length||abandon.some(id=>typeof id!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(id)))throw fail('La lista de carreras abandonadas no es válida.');
  const abandonedKeys=[];for(const id of abandon){const key=hash(id),entry=tickets.get(key);if(entry&&entry.player!==player)throw fail('Sólo puedes abandonar carreras de tu propia cuenta.',403);if(entry)abandonedKeys.push(key);}
  // Validate every ID before changing any outstanding ticket; receipts are never removed.
  for(const key of abandonedKeys)tickets.delete(key);
  if(tickets.size>=5000)throw fail('Hay demasiadas partidas activas. Inténtalo más tarde.',503);
  if([...tickets.values()].filter(value=>value.player===player).length>=8)throw fail('Tienes ocho carreras pendientes. Termina una o espera a que caduque antes de empezar otra.',429);
  const ticket=crypto.randomBytes(32).toString('base64url'),seed=crypto.randomBytes(4).readUInt32LE(0),issuedAt=now(),expiresAt=issuedAt+35*60000;
  tickets.set(hash(ticket),{player,seed,issuedAt,expiresAt,season,modelVersion,mode:'arcade'});return {ok:true,online:true,ticket,seed,expiresAt,season,modelVersion,seasonDescriptor,mode:'arcade',wallet:wallet(player)};
 }
 function submit(session,payload){
  const player=playerOf(session);prune();limit(player,'submit',12,60000);
  if(payload.mode!=='arcade')throw fail('Las partidas de espera no guardan puntuaciones ni monedas.');
  if(payload.season!==season||payload.modelVersion!==modelVersion)throw fail('Actualiza Run Kovi, Run para participar en esta temporada.',409);
  if(!/^[A-Za-z0-9_-]{43}$/.test(payload.ticket||''))throw fail('La partida global no es válida. Inicia otra.');
  const key=hash(payload.ticket),ticket=tickets.get(key),run=payload.run||payload;
  const runHash=hash(JSON.stringify({ticks:run.ticks,inputs:run.inputs,score:run.score,distance:run.distance,coins:run.coins})),redeemed=redemptions.get(key);
  if(redeemed){if(redeemed.player!==player||redeemed.runHash!==runHash||redeemed.season!==payload.season||redeemed.modelVersion!==payload.modelVersion)throw fail('Esta partida ya fue guardada con otro resultado.',409);return {...get(session),improved:redeemed.improved,acceptedScore:redeemed.score,acceptedCoins:redeemed.coins,idempotent:true};}
  if(!ticket||ticket.player!==player||ticket.expiresAt<=now()||ticket.mode!=='arcade')throw fail('La partida global caducó. Inicia otra.',409);
  if(!Number.isSafeInteger(run.ticks)||run.ticks<1||run.ticks>MAX_TICKS||run.ticks/60*1000>now()-ticket.issuedAt+2500)throw fail('La duración de la partida no es válida.');
  if(!Array.isArray(run.inputs)||run.inputs.length>MAX_INPUTS)throw fail('Los movimientos de la partida no son válidos.');
  let previous=-1;
  for(const input of run.inputs){if(!input||!Number.isSafeInteger(input.tick)||input.tick<0||input.tick>=run.ticks||input.tick<previous||!ACTIONS.has(input.action))throw fail('Los movimientos de la partida no son válidos.');previous=input.tick;}
  tickets.delete(key); // A replay can be redeemed once, including failed simulations.
  const factory=modelFactory||require('./runner-model.js').createRunnerModel;
  const model=factory(ticket.seed);let cursor=0;
  for(const input of run.inputs){
   if(input.tick>cursor){model.advanceTicks(input.tick-cursor);cursor=input.tick;const current=model.snapshot();if(current.tick!==cursor||current.ended)throw fail('La partida continúa después de terminar.');}
   model.action(input.action);
  }
  model.advanceTicks(run.ticks-cursor);
  const state=model.snapshot();
  if(state.tick!==run.ticks)throw fail('La partida continúa después de terminar.');
  if(state.ended!==true&&state.tick!==MAX_TICKS)throw fail('Termina la carrera antes de guardar la puntuación y las monedas.');
  if(!Number.isSafeInteger(state.score)||state.score<0||state.score>100000000||!Number.isFinite(state.distance)||state.distance<0||!Number.isSafeInteger(state.coins)||state.coins<0)throw fail('La puntuación no es válida.');
  if(run.score!==undefined&&run.score!==state.score||run.coins!==undefined&&run.coins!==state.coins||run.distance!==undefined&&(!Number.isFinite(run.distance)||Math.abs(run.distance-state.distance)>0.05))throw fail('La puntuación no coincide con los movimientos de la partida.');
  const previousBest=records.get(player),improved=!previousBest||state.score>previousBest.score;
  const next=new Map(records),nextWallets=new Map(wallets),nextRedemptions=new Map(redemptions);
  if(improved){
   next.set(player,{player,score:state.score,distance:state.distance,coins:state.coins,at:now()});
   if(next.size>maxEntries){const retained=[...next.values()].sort((a,b)=>b.score-a.score||a.at-b.at).slice(0,maxEntries);next.clear();for(const row of retained)next.set(row.player,row);}
  }
  const before=wallet(player);if(before.coins+state.coins>1000000000||before.totalRuns>=1000000000)throw fail('Tu cartera alcanzó el límite permitido.',409);
  if(nextWallets.size>=maxEntries&&!nextWallets.has(player))throw fail('La cartera necesita mantenimiento.',503);
  nextWallets.set(player,{player,coins:before.coins+state.coins,totalRuns:before.totalRuns+1});
  if(nextRedemptions.size>=5000)throw fail('Hay demasiadas partidas terminando. Inténtalo en unos minutos.',503);
  nextRedemptions.set(key,{key,runHash,player,score:state.score,distance:state.distance,coins:state.coins,at:now(),expiresAt:ticket.expiresAt,season,modelVersion,improved});
  try{persist(next,nextWallets,nextRedemptions);}catch(error){tickets.set(key,ticket);throw error;}
  records=next;wallets=nextWallets;redemptions=nextRedemptions;
  return {...get(session),improved,acceptedScore:state.score,acceptedCoins:state.coins,idempotent:false};
 }
 return {get,start,submit,prune,wallet};
}
module.exports={createRunnerLeaderboard,verifySeasonDescriptor,readRunnerBody,MAX_TICKS,MAX_INPUTS};
