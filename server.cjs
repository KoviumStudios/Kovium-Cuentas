'use strict';
const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const {pipeline}=require('stream/promises');
const {createCatalogChannel,readCatalogBody}=require('./catalog-channel.cjs');
const {createDesktopUpdate}=require('./desktop-update.cjs');
const {createAdminAccess}=require('./admin-access.cjs');
const {createRunnerLeaderboard,readRunnerBody}=require('./runner-leaderboard.cjs');
const token=()=>crypto.randomBytes(32).toString('base64url');
const digest=s=>crypto.createHash('sha256').update(s).digest('hex');
const challenge=s=>crypto.createHash('sha256').update(s).digest('base64url');
function equal(a,b){return crypto.timingSafeEqual(Buffer.from(digest(String(a))),Buffer.from(digest(String(b))));}
function createPackStorage({root,referenced=()=>[],maxPackBytes=256*1024*1024,totalBudgetBytes=384*1024*1024,reserveBytes=64*1024*1024,diskFreeBytes}){
 const limit=(value,name,allowZero=false)=>{const n=Number(value);if(!Number.isSafeInteger(n)||n<(allowZero?0:1))throw Error('Límite de almacenamiento no válido: '+name);return n;};
 maxPackBytes=limit(maxPackBytes,'archivo');totalBudgetBytes=limit(totalBudgetBytes,'total');reserveBytes=limit(reserveBytes,'reserva',true);root=path.resolve(root);let uploading=false;
 function files(){let count=0;const result=[];function walk(folder){for(const name of fs.readdirSync(folder)){const file=path.join(folder,name),stat=fs.lstatSync(file);if(++count>50000||stat.isSymbolicLink())throw Object.assign(Error('El almacenamiento privado necesita revisión.'),{status:503});if(stat.isDirectory())walk(file);else if(stat.isFile())result.push({file,size:stat.size});else throw Object.assign(Error('Archivo privado no válido.'),{status:503});}}if(fs.existsSync(root))walk(root);return result;}
 function sweep(){if(uploading)return;const keep=new Set(referenced().map(file=>path.resolve(root,file)));for(const item of files()){const name=path.basename(item.file);if((/^\.upload-[A-Za-z0-9_-]{43}\.part$/.test(name)||/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}-[a-f0-9]{64}\.zip$/.test(name))&&!keep.has(item.file))fs.rmSync(item.file,{force:true});}}
 function status(){const usedBytes=files().reduce((sum,item)=>sum+item.size,0);let free=Infinity;try{if(diskFreeBytes)free=diskFreeBytes();else if(fs.statfsSync){const stat=fs.statfsSync(root);free=stat.bavail*stat.bsize;}}catch{throw Object.assign(Error('No se pudo comprobar el espacio del servicio.'),{status:503});}const availableBytes=Math.max(0,Math.min(totalBudgetBytes-usedBytes,free-reserveBytes));return {ok:true,maxPackBytes,totalBudgetBytes,usedBytes,availableBytes,maxUploadBytes:uploading?0:Math.min(maxPackBytes,availableBytes),uploadInProgress:uploading};}
 function begin(size){if(uploading)throw Object.assign(Error('Ya se está subiendo otro pack. Espera a que termine.'),{status:409});sweep();const current=status(),max=current.maxUploadBytes;if(max<4||Number.isFinite(size)&&size>max)throw Object.assign(Error('El pack no cabe en el espacio privado disponible. Reduce su tamaño o utiliza una instancia pública.'),{status:413});uploading=true;return {maxBytes:max,release(){uploading=false;}};}
 return {status,begin,sweep};
}
async function receivePack(req,file,maxBytes,hash){let fd,size=0;try{fd=fs.openSync(file,'wx',0o600);for await(const chunk of req.iterator({destroyOnReturn:false})){size+=chunk.length;if(size>maxBytes)throw Object.assign(Error('El pack supera el espacio privado disponible. Reduce su tamaño.'),{status:413});hash.update(chunk);let offset=0;while(offset<chunk.length){const wrote=fs.writeSync(fd,chunk,offset,chunk.length-offset);if(!wrote)throw Error('No se pudo completar la escritura del pack.');offset+=wrote;}}fs.fsyncSync(fd);return size;}catch(error){req.resume();if(error.code==='ENOSPC'||error.code==='EDQUOT')throw Object.assign(Error('El almacenamiento privado está lleno. El pack actual se conserva.'),{status:413});throw error;}finally{if(fd!==undefined)fs.closeSync(fd);}}
function createAccessServer(config,{fetchImpl=fetch,now=Date.now,catalogPublicKey}={}){
 const publicURL=new URL(config.publicURL);if(publicURL.protocol!=='https:'||publicURL.username||publicURL.password||publicURL.pathname!=='/')throw Error('PUBLIC_URL debe ser el origen HTTPS, sin ruta.');
 if(!/^\d{17,20}$/.test(config.discordClientId||'')||!config.discordClientSecret)throw Error('Faltan DISCORD_CLIENT_ID y DISCORD_CLIENT_SECRET.');
 const key=Buffer.from(config.encryptionKey||'','base64');if(key.length!==32)throw Error('SESSION_ENCRYPTION_KEY debe contener 32 bytes en base64.');
 const packRoot=path.resolve(config.packRoot),policiesFile=path.resolve(config.projectsFile),sessionFile=path.resolve(config.sessionFile);
 fs.mkdirSync(packRoot,{recursive:true});fs.mkdirSync(path.dirname(sessionFile),{recursive:true});
 const desktopUpdates=createDesktopUpdate({file:path.join(path.dirname(sessionFile),'desktop-update.json'),publicKey:catalogPublicKey||fs.readFileSync(path.join(__dirname,'catalog-public-key.pem'),'utf8')});
 const catalogFile=config.catalogFile||path.join(path.dirname(sessionFile),'public-catalog.json'),catalogChannel=createCatalogChannel({file:catalogFile,publicKey:catalogPublicKey||fs.readFileSync(path.join(__dirname,'catalog-public-key.pem'),'utf8')});let catalogCache=null;
 const adminPublishing=createAdminAccess({file:path.join(path.dirname(sessionFile),'admin-publisher-sessions.json'),passwordHash:config.adminPasswordHash,githubToken:config.publishGitHubToken,signingKeyBase64:config.publishSigningKeyBase64,publicKey:catalogPublicKey||fs.readFileSync(path.join(__dirname,'catalog-public-key.pem'),'utf8'),legacyToken:config.adminToken,fetchImpl,now});
 const runner=createRunnerLeaderboard({file:path.join(path.dirname(sessionFile),'runner-leaderboard.json'),now});
 const oauth=new Map(),handoffs=new Map(),tickets=new Map(),admissions=new Map(),rates=new Map(),activeDownloads=new Map(),tokenRefreshes=new Map();let sessions={};
 const sessionIdleMs=30*86400000,sessionAbsoluteMs=90*86400000;
 try{sessions=JSON.parse(fs.readFileSync(sessionFile,'utf8'));}catch(e){if(e.code!=='ENOENT')throw Error('No se pudo leer la base de sesiones.');}
 const seal=value=>{const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',key,iv),ciphertext=Buffer.concat([cipher.update(JSON.stringify(value)),cipher.final()]);return Buffer.concat([iv,cipher.getAuthTag(),ciphertext]).toString('base64');};
 const open=value=>{const b=Buffer.from(value,'base64'),cipher=crypto.createDecipheriv('aes-256-gcm',key,b.subarray(0,12));cipher.setAuthTag(b.subarray(12,28));return JSON.parse(Buffer.concat([cipher.update(b.subarray(28)),cipher.final()]));};
 function save(){let fd;try{fd=fs.openSync(sessionFile+'.tmp','w',0o600);fs.writeFileSync(fd,JSON.stringify(sessions));fs.fsyncSync(fd);}finally{if(fd!==undefined)fs.closeSync(fd);}fs.renameSync(sessionFile+'.tmp',sessionFile);}
 function readPolicies(){try{const value=JSON.parse(fs.readFileSync(policiesFile,'utf8'));if(!value.projects||typeof value.projects!=='object'||Array.isArray(value.projects))throw Error();return value;}catch(e){if(e.code==='ENOENT')return {projects:{}};throw Error('No se pudo leer la política de cupos.');}}
 function writePolicies(value){fs.mkdirSync(path.dirname(policiesFile),{recursive:true});fs.writeFileSync(policiesFile+'.tmp',JSON.stringify(value,null,2));fs.renameSync(policiesFile+'.tmp',policiesFile);}
 function validId(id){if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)||id.length>80)throw Object.assign(Error('Instancia no válida.'),{status:400});return id;}
 function policy(id){validId(id);const projects=readPolicies().projects;return Object.hasOwn(projects,id)?projects[id]:null;}
 function validateAccess(access){
  if(!access||!['public','discord'].includes(access.mode))throw Object.assign(Error('Política no válida.'),{status:400});
  const out={mode:access.mode};if(access.mode==='public')return out;
  if(access.guildId&&!/^\d{17,20}$/.test(access.guildId))throw Object.assign(Error('Servidor Discord no válido.'),{status:400});
  out.guildId=access.guildId||'';out.roleIds=access.roleIds||[];out.members=access.members||[];
  if(!Array.isArray(out.roleIds)||out.roleIds.length>50||!Array.isArray(out.members)||out.members.length>10000||[...out.roleIds,...out.members].some(x=>!/^\d{17,20}$/.test(x)))throw Object.assign(Error('Roles o cupos no válidos.'),{status:400});
  // Incomplete policies remain locked; configuration never defaults to public.
  return out;
 }
 function loopback(value){const u=new URL(value);if(u.protocol!=='http:'||!['localhost','127.0.0.1'].includes(u.hostname)||!u.port||u.pathname!=='/oauth/discord/callback'||u.search||u.hash||u.username||u.password)throw Object.assign(Error('Retorno del launcher no válido.'),{status:400});return u.href;}
 async function api(url,options={}){
  const res=await fetchImpl(url,{...options,signal:AbortSignal.timeout(20000),redirect:'error'});const text=await res.text();if(text.length>1000000)throw Error('Respuesta demasiado grande.');let data;try{data=JSON.parse(text);}catch{throw Error('Discord no devolvió datos válidos.');}
  if(!res.ok)throw Object.assign(Error('Discord no pudo verificar la cuenta.'),{status:res.status===401||data.error==='invalid_grant'?401:res.status===403||res.status===404?403:502,code:data.error==='invalid_grant'?'invalid_grant':undefined});return data;
 }
 const discordForm=body=>api('https://discord.com/api/oauth2/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:config.discordClientId,client_secret:config.discordClientSecret,...body}).toString()});
 const publicUser=user=>({id:String(user.id),name:String(user.global_name||user.username||'Discord').slice(0,100)});
 function session(req){const m=/^Bearer ([A-Za-z0-9_-]{40,200})$/.exec(req.headers.authorization||'');const id=m&&digest(m[1]),s=id&&sessions[id];if(!s||!Number.isSafeInteger(s.expiresAt)||s.expiresAt<=now()||s.createdAt&&s.createdAt+sessionAbsoluteMs<=now()){if(id&&s){delete sessions[id];save();}throw Object.assign(Error('Conecta Discord para verificar tu cupo.'),{status:401});}return {id,...s};}
 async function userToken(s,force=false){
  const current=sessions[s.id];if(!current)throw Object.assign(Error('La sesión fue desconectada.'),{status:401});
  if(s.credentials!==current.credentials){s.credentials=current.credentials;force=false;}
  let value;try{value=open(current.credentials);}catch{delete sessions[s.id];save();throw Object.assign(Error('Vuelve a conectar Discord.'),{status:401});}
  if(force||value.expiresAt<now()+60000){
   if(tokenRefreshes.has(s.id))return tokenRefreshes.get(s.id);
   const pending=(async()=>{try{
    const fresh=await discordForm({grant_type:'refresh_token',refresh_token:value.refreshToken});
    if(typeof fresh.access_token!=='string'||!fresh.access_token||!Number.isFinite(Number(fresh.expires_in))||Number(fresh.expires_in)<=0)throw Object.assign(Error('Discord no devolvió una sesión válida.'),{status:502});
    value={accessToken:fresh.access_token,refreshToken:fresh.refresh_token||value.refreshToken,expiresAt:now()+Math.min(Number(fresh.expires_in),30*86400)*1000};
    if(!sessions[s.id])throw Object.assign(Error('La sesión fue desconectada.'),{status:401});
    sessions[s.id].credentials=seal(value);s.credentials=sessions[s.id].credentials;save();return value.accessToken;
   }catch(e){if(e.status===401&&sessions[s.id]){delete sessions[s.id];save();}throw e;}})().finally(()=>tokenRefreshes.delete(s.id));
   tokenRefreshes.set(s.id,pending);return pending;
  }return value.accessToken;
 }
 async function renewSession(s){
  // Revalidate with Discord before extending a remembered login. Outages never
  // revoke a valid cached session; refresh-token revocation does.
  if(!s.verifiedAt||s.verifiedAt<now()-86400000){
   let user;try{user=await api('https://discord.com/api/v10/users/@me',{headers:{Authorization:'Bearer '+await userToken(s)}});}catch(e){if(e.status!==401||!sessions[s.id])throw e;user=await api('https://discord.com/api/v10/users/@me',{headers:{Authorization:'Bearer '+await userToken(s,true)}});}
   if(user.id!==s.user.id)throw Object.assign(Error('Discord devolvió otra cuenta. Vuelve a conectar.'),{status:401});
   if(!sessions[s.id])throw Object.assign(Error('La sesión fue desconectada.'),{status:401});
   const current=sessions[s.id];current.user=publicUser(user);current.createdAt=current.createdAt||now();current.verifiedAt=now();current.expiresAt=Math.min(now()+sessionIdleMs,current.createdAt+sessionAbsoluteMs);save();
  }
  return sessions[s.id];
 }
 async function entitlement(s,id,attempt=0){
  const catalog=activeCatalog(),p=catalog?(Object.hasOwn(catalog.projects,id)?catalog.projects[id]:null):policy(id);if(!p)return {allowed:false,reason:catalog?'Esta instancia no está publicada o fue retirada.':'Esta instancia no está configurada en el servicio de cupos.'};
  if(!catalog&&p.disabled===true)return {allowed:false,reason:'Esta instancia fue retirada o sus permisos fueron revocados.'};
  const access=validateAccess(p.access||{mode:'public'});if(access.mode==='public')return {allowed:true,reason:''};
  const policyStamp=catalog?'':JSON.stringify(p);
  if(access.members.includes(s.user.id))return {allowed:true,reason:''};
  if(!access.guildId||!access.roleIds.length)return {allowed:false,reason:'Los cupos de esta instancia todavía no están configurados.'};
  try{
   let member;try{member=await api('https://discord.com/api/v10/users/@me/guilds/'+access.guildId+'/member',{headers:{Authorization:'Bearer '+await userToken(s)}});}catch(e){if(e.status!==401)throw e;member=await api('https://discord.com/api/v10/users/@me/guilds/'+access.guildId+'/member',{headers:{Authorization:'Bearer '+await userToken(s,true)}});}
   const result=Array.isArray(member.roles)&&access.roleIds.some(role=>member.roles.includes(role))?{allowed:true,reason:''}:{allowed:false,reason:'Tu cuenta no tiene cupo para esta instancia.'};
   if(result.allowed){const latest=activeCatalog(),unchanged=catalog?latest===catalog:!latest&&JSON.stringify(policy(id))===policyStamp;if(!unchanged)return attempt<1&&(!catalog||latest)?entitlement(s,id,attempt+1):{allowed:false,reason:'Los permisos cambiaron durante la comprobación. Vuelve a intentarlo.'};}return result;
  }catch(e){if(e.status===403)return {allowed:false,reason:'Debes pertenecer al servidor y tener el rol de cupo.'};throw e;}
 }
 function json(res,status,value){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});res.end(JSON.stringify(value));}
 async function body(req){let text='';for await(const chunk of req){text+=chunk;if(Buffer.byteLength(text)>16000)throw Object.assign(Error('Solicitud demasiado grande.'),{status:413});}try{return JSON.parse(text||'{}');}catch{throw Object.assign(Error('JSON no válido.'),{status:400});}}
 function admin(req){if(adminPublishing.authorize(req))return;if(!config.adminToken||config.adminToken.length<32||!equal(req.headers.authorization||'','Bearer '+config.adminToken))throw Object.assign(Error('Acceso administrativo no autorizado.'),{status:401});}
 function serverAccess(req,projectId){
  const match=/^Bearer ([A-Za-z0-9_-]{32,200})$/.exec(req.headers.authorization||'');let entries=[];
  try{entries=JSON.parse(fs.readFileSync(config.serverKeysFile,'utf8')).servers||[];}catch{}
  const hashed=match&&digest(match[1]);if(!hashed||!Array.isArray(entries)||!entries.some(s=>s.projectId===projectId&&s.disabled!==true&&/^[a-f\d]{64}$/i.test(s.keyHash||'')&&equal(s.keyHash.toLowerCase(),hashed)))throw Object.assign(Error('Servidor no autorizado para esta instancia.'),{status:401});
 }
 function minecraftIdentity(value){const input=String(value.minecraftUuid||''),uuid=input.replace(/-/g,'').toLowerCase(),name=String(value.name||'');if(!/^(?:[a-f\d]{32}|[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12})$/i.test(input)||!/^[A-Za-z0-9_]{3,16}$/.test(name))throw Object.assign(Error('Identidad Minecraft no válida.'),{status:400});return {minecraftUuid:uuid,name};}
 function privateFile(file){const resolved=fs.realpathSync(path.resolve(packRoot,file));const base=fs.realpathSync(packRoot);if(!resolved.startsWith(base+path.sep)||!fs.statSync(resolved).isFile())throw Error('Archivo de pack no válido.');return resolved;}
 function catalogResponse(){let stamp='';try{const stat=fs.lstatSync(catalogFile);if(stat.isSymbolicLink()||!stat.isFile())throw Error();stamp=[stat.ino,stat.size,stat.mtimeMs,stat.ctimeMs].join(':');}catch{catalogCache=null;const value=catalogChannel.read();return {body:JSON.stringify(value),revision:catalogChannel.revision(value),envelope:value};}if(!catalogCache||catalogCache.stamp!==stamp){const value=catalogChannel.read();catalogCache={stamp,body:JSON.stringify(value),revision:catalogChannel.revision(value),envelope:value};}return catalogCache;}
 function activeCatalog(){try{return catalogResponse().envelope;}catch(error){if(error.status===404)return null;throw error;}}
 function registeredPack(p,hash,version){const pack=[p?.pack,...Object.values(p?.stagedPacks||{})].find(item=>item?.sha256===hash&&String(item.version)===String(version));return pack||null;}
 function requiredPack(id,p){const catalog=activeCatalog();if(!catalog)return p?.pack||null;const project=Object.hasOwn(catalog.projects,id)?catalog.projects[id]:null;if(!project)throw Object.assign(Error('Esta instancia no está publicada o fue retirada.'),{status:403});if(!project.pack?.sha256)return null;const pack=registeredPack(p,project.pack.sha256,project.pack.version);if(!pack)throw Object.assign(Error('El pack publicado no está disponible. Contacta con la administración.'),{status:503});return pack;}
 function validateCatalogPacks(value){if(!value||typeof value!=='object')return;const policies=readPolicies();for(const [id,p]of Object.entries(value.projects||{})){if(p?.access?.mode!=='discord'||!p.pack?.sha256)continue;const pack=registeredPack(policies.projects[id],p.pack.sha256,p.pack.version);if(!pack)throw Object.assign(Error('Sube primero el pack privado de '+id+' con la misma versión y huella.'),{status:400});try{const file=privateFile(pack.file);if(fs.statSync(file).size!==pack.size)throw Error();}catch{throw Object.assign(Error('El pack privado de '+id+' no está completo. Vuelve a subirlo.'),{status:400});}}}
 function pruneStages(){let catalog;try{catalog=activeCatalog();}catch{return;}const policies=readPolicies();let changed=false;for(const [id,p]of Object.entries(policies.projects)){if(!p.stagedPacks||typeof p.stagedPacks!=='object')continue;const active=catalog?.projects?.[id]?.pack,activeHash=active?.sha256;const entries=Object.values(p.stagedPacks).filter(item=>item&&typeof item.file==='string'&&/^[a-f0-9]{64}$/.test(item.sha256||'')&&(item.sha256===activeHash||Number(item.stagedAt)>now()-86400000)).sort((a,b)=>(Number(b.stagedAt)||0)-(Number(a.stagedAt)||0));const keep=entries.filter(item=>item.sha256===activeHash);for(const item of entries)if(keep.length<3&&!keep.some(other=>other.sha256===item.sha256))keep.push(item);const next=Object.fromEntries(keep.map(item=>[item.sha256,item]));if(JSON.stringify(next)!==JSON.stringify(p.stagedPacks)){p.stagedPacks=next;changed=true;}const current=activeHash&&registeredPack(p,activeHash,active.version);if(current&&p.pack?.sha256!==current.sha256){p.pack={...current};delete p.pack.stagedAt;changed=true;}}if(changed)writePolicies(policies);}
 const packStorage=createPackStorage({root:packRoot,maxPackBytes:config.maxPackBytes,totalBudgetBytes:config.packStorageBudgetBytes,reserveBytes:config.packDiskReserveBytes,referenced:()=>[...Object.values(readPolicies().projects).flatMap(p=>[p.pack?.file,...Object.values(p.stagedPacks||{}).map(item=>item.file)]).filter(Boolean),...Array.from(tickets.values()).filter(t=>t.expiresAt>now()).map(t=>t.file),...activeDownloads.keys()]});
 pruneStages();packStorage.sweep();
 function rate(ip,bucket,max){const key=bucket+':'+ip,r=rates.get(key);if(!r||r.until<now())rates.set(key,{count:1,until:now()+60000});else if(++r.count>max)throw Object.assign(Error('Demasiadas solicitudes. Inténtalo en un minuto.'),{status:429});}
 async function handler(req,res){
  try{
   if(req.headers.origin)throw Object.assign(Error('No se permiten peticiones desde páginas web.'),{status:403});
   const url=new URL(req.url,publicURL),ip=req.socket.remoteAddress||'unknown';if(req.method==='GET'&&url.pathname==='/health'){json(res,200,{ok:true});return;}
   if(await adminPublishing.handle(req,res,url,ip))return;
   if(req.method==='GET'&&url.pathname==='/v1/runner/leaderboard'){rate(ip,'runner',180);let s;try{s=session(req);}catch(error){if(error.status!==401)throw error;}json(res,200,await runner.get(s));return;}
   if(req.method==='POST'&&url.pathname==='/v1/runner/start'){rate(ip,'runner',30);json(res,200,await runner.start(session(req)));return;}
   if(req.method==='POST'&&url.pathname==='/v1/runner/submit'){rate(ip,'runner',30);const s=session(req);json(res,200,await runner.submit(s,await readRunnerBody(req)));return;}
   if(req.method==='GET'&&url.pathname==='/v1/catalog'){
    rate(ip,'catalog',6000);const value=catalogResponse();res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store, no-cache, must-revalidate','Pragma':'no-cache','Expires':'0','ETag':'"'+value.revision+'"','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});res.end(value.body);return;
   }
   rate(ip,'accounts',300);
   if(req.method==='GET'&&url.pathname==='/v1/desktop-update'){json(res,200,desktopUpdates.get(req.headers.authorization));return;}
   if(req.method==='PUT'&&url.pathname==='/v1/admin/desktop-update'){admin(req);json(res,200,desktopUpdates.write(await body(req)));return;}
   if(req.method==='GET'&&url.pathname==='/v1/admin/storage'){admin(req);pruneStages();packStorage.sweep();json(res,200,packStorage.status());return;}
   if(req.method==='PUT'&&url.pathname==='/v1/admin/catalog'){
    admin(req);const value=await readCatalogBody(req);validateCatalogPacks(value);const published=catalogChannel.write(value,req.headers['if-match']);catalogCache=null;json(res,200,{ok:true,revision:published.revision,publishedAt:published.envelope.publishedAt||null});return;
   }
   if(req.method==='POST'&&url.pathname==='/v1/auth/discord/start'){
    const b=await body(req),redirectUri=loopback(b.redirectUri);if(!/^[A-Za-z0-9_-]{43}$/.test(b.challenge||'')||!/^[A-Za-z0-9_-]{32,128}$/.test(b.state||''))throw Object.assign(Error('Solicitud de conexión no válida.'),{status:400});
    const state=token();oauth.set(state,{challenge:b.challenge,launcherState:b.state,redirectUri,expiresAt:now()+300000});
    const target=new URL('https://discord.com/oauth2/authorize');for(const [k,v]of Object.entries({client_id:config.discordClientId,response_type:'code',redirect_uri:publicURL.origin+'/oauth/discord/callback',scope:'identify guilds.members.read',state}))target.searchParams.set(k,v);
    json(res,200,{url:target.href});return;
   }
   if(req.method==='GET'&&url.pathname==='/oauth/discord/callback'){
    const state=url.searchParams.get('state'),attempt=oauth.get(state);oauth.delete(state);if(!attempt||attempt.expiresAt<now())throw Object.assign(Error('La conexión caducó o ya fue utilizada.'),{status:400});
    const target=new URL(attempt.redirectUri);target.searchParams.set('state',attempt.launcherState);
    if(url.searchParams.has('error'))target.searchParams.set('error','access_denied');
    else{const code=url.searchParams.get('code');if(!code||code.length>8192)throw Object.assign(Error('Código no válido.'),{status:400});const result=await discordForm({grant_type:'authorization_code',code,redirect_uri:publicURL.origin+'/oauth/discord/callback'});const user=await api('https://discord.com/api/v10/users/@me',{headers:{Authorization:'Bearer '+result.access_token}});if(!/^\d{17,20}$/.test(user.id||''))throw Error('Perfil Discord no válido.');const handoff=token();handoffs.set(handoff,{challenge:attempt.challenge,user:publicUser(user),credentials:{accessToken:result.access_token,refreshToken:result.refresh_token,expiresAt:now()+(Number(result.expires_in)||3600)*1000},expiresAt:now()+120000});target.searchParams.set('code',handoff);}
    res.writeHead(302,{Location:target.href,'Cache-Control':'no-store','Referrer-Policy':'no-referrer'});res.end();return;
   }
   if(req.method==='POST'&&url.pathname==='/v1/auth/discord/exchange'){
    const b=await body(req),handoff=handoffs.get(b.code);if(!handoff||handoff.expiresAt<now()||!equal(challenge(String(b.verifier||'')),handoff.challenge))throw Object.assign(Error('Conexión no válida o ya utilizada.'),{status:401});handoffs.delete(b.code);
    const sessionToken=token(),expiresAt=now()+sessionIdleMs;sessions[digest(sessionToken)]={user:handoff.user,credentials:seal(handoff.credentials),createdAt:now(),verifiedAt:now(),expiresAt};save();json(res,200,{sessionToken,user:handoff.user,expiresAt});return;
   }
   if(req.method==='GET'&&url.pathname==='/v1/session'){const s=await renewSession(session(req));if(!s)throw Object.assign(Error('La sesión fue desconectada.'),{status:401});json(res,200,{user:s.user,expiresAt:s.expiresAt});return;}
   if(req.method==='POST'&&url.pathname==='/v1/session/revoke'){const s=session(req);delete sessions[s.id];for(const map of [tickets,admissions])for(const [id,t]of map)if(t.session===s.id)map.delete(id);save();json(res,200,{ok:true});return;}
   if(req.method==='POST'&&url.pathname==='/v1/access/check'){const b=await body(req);json(res,200,await entitlement(session(req),validId(String(b.projectId||''))));return;}
   let admissionMatch=/^\/v1\/instances\/([a-z0-9-]+)\/admission$/.exec(url.pathname);
   if(req.method==='POST'&&admissionMatch){
    const id=validId(admissionMatch[1]),s=session(req),identity=minecraftIdentity(await body(req)),allowed=await entitlement(s,id);
    if(!allowed.allowed||!sessions[s.id]||sessions[s.id].expiresAt<=now()){json(res,403,{allowed:false,error:'no_seat',reason:allowed.reason||'La sesión o la instancia fue revocada.'});return;}
    const ticket=token(),expiresAt=now()+60000;admissions.set(ticket,{session:s.id,projectId:id,...identity,expiresAt});
    json(res,200,{ticket,expiresAt,projectId:id,...identity});return;
   }
   if(req.method==='POST'&&url.pathname==='/v1/server/admission/redeem'){
    const b=await body(req),id=validId(String(b.projectId||''));serverAccess(req,id);
    const identity=minecraftIdentity(b);if(!/^[A-Za-z0-9_-]{16,128}$/.test(b.nonce||''))throw Object.assign(Error('Reto de conexión no válido.'),{status:400});
    const t=admissions.get(b.ticket);if(!t||t.projectId!==id||t.expiresAt<=now()||t.minecraftUuid!==identity.minecraftUuid||t.name!==identity.name||!sessions[t.session]||sessions[t.session].expiresAt<=now()){json(res,403,{allowed:false,error:'invalid_admission'});return;}
    // Consume before awaiting Discord: simultaneous redemption cannot reuse it.
    admissions.delete(b.ticket);const s={id:t.session,...sessions[t.session]},allowed=await entitlement(s,id);
    if(!allowed.allowed||!sessions[t.session]||sessions[t.session].expiresAt<=now()){json(res,403,{allowed:false,error:'no_seat',reason:allowed.reason||'La sesión o la instancia fue revocada.'});return;}
    json(res,200,{allowed:true,projectId:id,...identity,nonce:b.nonce,discordId:s.user.id,expiresAt:t.expiresAt});return;
   }
   let match=/^\/v1\/instances\/([a-z0-9-]+)\/grant$/.exec(url.pathname);
   if(req.method==='POST'&&match){const id=validId(match[1]),s=session(req),allowed=await entitlement(s,id);if(!allowed.allowed){json(res,403,{error:'no_seat',reason:allowed.reason});return;}const pack=requiredPack(id,policy(id));if(!pack){json(res,200,{allowed:true});return;}const file=privateFile(pack.file);if(!/^[a-f\d]{64}$/i.test(pack.sha256||''))throw Error('El pack no tiene un hash válido.');const ticket=token();tickets.set(ticket,{session:s.id,projectId:id,file,expiresAt:now()+120000});json(res,200,{allowed:true,pack:{url:publicURL.origin+'/v1/download/'+ticket,version:pack.version,sha256:pack.sha256}});return;}
   match=/^\/v1\/download\/([A-Za-z0-9_-]{43})$/.exec(url.pathname);
   if(req.method==='GET'&&match){
    const t=tickets.get(match[1]);if(!t||t.expiresAt<now()||!sessions[t.session]||sessions[t.session].expiresAt<now())throw Object.assign(Error('La descarga caducó. Vuelve a iniciar la instancia.'),{status:401});tickets.delete(match[1]);
    activeDownloads.set(t.file,(activeDownloads.get(t.file)||0)+1);
    try{const s={id:t.session,...sessions[t.session]},allowed=await entitlement(s,t.projectId);if(!allowed.allowed)throw Object.assign(Error(allowed.reason),{status:403});const size=fs.statSync(t.file).size;res.writeHead(200,{'Content-Type':'application/zip','Content-Length':size,'Cache-Control':'no-store','Content-Disposition':'attachment; filename="instance.zip"','X-Content-Type-Options':'nosniff'});await pipeline(fs.createReadStream(t.file),res);return;}
    finally{const count=(activeDownloads.get(t.file)||1)-1;if(count)activeDownloads.set(t.file,count);else activeDownloads.delete(t.file);try{packStorage.sweep();}catch{}}
   }
   match=/^\/v1\/admin\/projects\/([a-z0-9-]+)(\/pack)?$/.exec(url.pathname);
   if(match){admin(req);const id=validId(match[1]),policies=readPolicies();
    if(req.method==='PUT'&&!match[2]){const b=await body(req);if(b.disabled!==undefined&&typeof b.disabled!=='boolean')throw Object.assign(Error('Estado de instancia no válido.'),{status:400});const old=Object.hasOwn(policies.projects,id)?policies.projects[id]:{};
     if(b.disabled===true&&!b.access)policies.projects[id]={...old,disabled:true};
     else{const access=validateAccess(b.access);policies.projects[id]={...old,access,disabled:b.disabled===false?false:b.disabled===true?true:old.disabled===true};}
     writePolicies(policies);json(res,200,{ok:true,projectId:id});return;}
    if(req.method==='POST'&&match[2]){
     const p=policies.projects[id];if(!p||p.access?.mode!=='discord')throw Object.assign(Error('Configura primero una instancia protegida.'),{status:400});
     const version=String(req.headers['x-pack-version']||''),expected=String(req.headers['x-pack-sha256']||'').toLowerCase();if(!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(version)||!/^[a-f\d]{64}$/.test(expected))throw Object.assign(Error('Versión o SHA-256 no válidos.'),{status:400});
     const folder=path.join(packRoot,id);fs.mkdirSync(folder,{recursive:true});if(fs.lstatSync(folder).isSymbolicLink())throw Error('No se permiten enlaces de archivos.');
     pruneStages();const length=req.headers['content-length']===undefined?NaN:Number(req.headers['content-length']),lease=packStorage.begin(length),dest=path.join(folder,version+'-'+expected+'.zip'),tmp=path.join(folder,'.upload-'+token()+'.part'),h=crypto.createHash('sha256');let size=0;
     try{
      size=await receivePack(req,tmp,lease.maxBytes,h);
      if(size<4||h.digest('hex')!==expected)throw Object.assign(Error('El archivo no coincide con su SHA-256.'),{status:400});
      if(fs.existsSync(dest)){const stat=fs.lstatSync(dest);if(stat.isSymbolicLink()||!stat.isFile()||stat.size!==size)throw Object.assign(Error('El archivo privado existente necesita revisión.'),{status:409});fs.rmSync(tmp,{force:true});}else fs.renameSync(tmp,dest);
      // Reload after the stream: policy edits during an upload must not be lost.
      const latest=readPolicies(),current=latest.projects[id];if(!current||current.disabled===true||current.access?.mode!=='discord')throw Object.assign(Error('La instancia cambió durante la subida. Revisa su configuración.'),{status:409});
      const pack={file:path.relative(packRoot,dest),version,sha256:expected,size},staged=url.searchParams.get('stage')==='1';
      if(staged){current.stagedPacks||={};const active=activeCatalog()?.projects?.[id]?.pack,activeHash=active?.sha256;const alreadyActive=activeHash&&registeredPack(current,activeHash,active.version);if(alreadyActive){current.pack={...alreadyActive};delete current.pack.stagedAt;}const entries=Object.values(current.stagedPacks).filter(item=>item.sha256!==expected&&item.sha256!==activeHash).sort((a,b)=>(Number(b.stagedAt)||0)-(Number(a.stagedAt)||0)).slice(0,activeHash?1:2);if(activeHash&&current.stagedPacks[activeHash])entries.push(current.stagedPacks[activeHash]);entries.push({...pack,stagedAt:now()});current.stagedPacks=Object.fromEntries(entries.map(item=>[item.sha256,item]));}
      else{if(current.pack?.sha256){current.stagedPacks||={};current.stagedPacks[current.pack.sha256]={...current.pack,stagedAt:now()};}current.pack=pack;}
      writePolicies(latest);json(res,200,{ok:true,projectId:id,staged,pack:{version,sha256:expected,size}});return;
     }finally{fs.rmSync(tmp,{force:true});lease.release();try{packStorage.sweep();}catch{}}
    }
   }
   json(res,404,{error:'not_found'});
  }catch(e){if(res.headersSent){res.destroy();return;}json(res,e.status||500,{error:e.status?e.message:'El servicio no pudo completar la solicitud.',...(e.status===409?{currentRevision:e.currentRevision||null}:{})});}
 }
 const cleaner=setInterval(()=>{const time=now();for(const map of [oauth,handoffs,tickets,admissions])for(const [id,item]of map)if(item.expiresAt<time)map.delete(id);for(const [ip,item]of rates)if(item.until<time)rates.delete(ip);try{pruneStages();packStorage.sweep();adminPublishing.sweep();runner.prune();}catch{}},60000);cleaner.unref();
 const server=http.createServer(handler);server.requestTimeout=30*60000;server.headersTimeout=15000;server.maxHeadersCount=30;
 server.once('close',()=>clearInterval(cleaner));return server;
}
function environment(env=process.env){const base=path.resolve(__dirname,'private');return {publicURL:env.PUBLIC_URL,discordClientId:env.DISCORD_CLIENT_ID,discordClientSecret:env.DISCORD_CLIENT_SECRET,encryptionKey:env.SESSION_ENCRYPTION_KEY,adminToken:env.ADMIN_TOKEN,adminPasswordHash:env.ADMIN_PASSWORD_HASH,publishGitHubToken:env.PUBLISH_GITHUB_TOKEN,publishSigningKeyBase64:env.PUBLISH_SIGNING_KEY_PEM_B64,packRoot:env.PACK_ROOT||path.join(base,'packs'),projectsFile:env.PROJECTS_FILE||path.join(base,'projects.json'),sessionFile:env.SESSION_FILE||path.join(base,'sessions.json'),serverKeysFile:env.SERVER_KEYS_FILE||path.join(base,'server-keys.json'),...(env.PACK_STORAGE_BUDGET_BYTES?{packStorageBudgetBytes:env.PACK_STORAGE_BUDGET_BYTES}:{}),...(env.PACK_MAX_UPLOAD_BYTES?{maxPackBytes:env.PACK_MAX_UPLOAD_BYTES}:{}),...(env.PACK_DISK_RESERVE_BYTES?{packDiskReserveBytes:env.PACK_DISK_RESERVE_BYTES}:{})};}
if(require.main===module){try{const server=createAccessServer(environment());server.listen(Number(process.env.PORT)||8787,process.env.BIND_HOST||'127.0.0.1',()=>console.log('Servicio de cupos listo en el puerto '+server.address().port));}catch(e){console.error(e.message);process.exitCode=1;}}
module.exports={createAccessServer,createPackStorage,environment,challenge,digest};
