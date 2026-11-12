'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {Transform,Readable}=require('node:stream');
const {promisify}=require('node:util');
const {contentRevision,validateEnvelope,MAX_CATALOG_BYTES}=require('./catalog-channel.cjs');
const {sanitize:sanitizeLauncher}=require('./launcher-design');
const scrypt=promisify(crypto.scrypt),REPO='KoviumStudios/Kovsafio-Launcher';
const fail=(status,message)=>Object.assign(Error(message),{status});
const digest=value=>crypto.createHash('sha256').update(String(value)).digest('hex');
function equal(a,b){return crypto.timingSafeEqual(Buffer.from(digest(a)),Buffer.from(digest(b)));}
async function hashPassword(password){
 if(typeof password!=='string'||password.length<10||Buffer.byteLength(password)>256)throw Error('La contraseña necesita entre 10 y 256 caracteres.');
 const salt=crypto.randomBytes(24),derived=await scrypt(password,salt,64,{N:16384,r:8,p:1,maxmem:64*1024*1024});
 return ['scrypt',16384,8,1,salt.toString('base64url'),derived.toString('base64url')].join('$');
}
function parsePasswordHash(value){
 const m=/^scrypt\$16384\$8\$1\$([A-Za-z0-9_-]{32})\$([A-Za-z0-9_-]{86})$/.exec(value||'');
 return m?{salt:Buffer.from(m[1],'base64url'),key:Buffer.from(m[2],'base64url')}:null;
}
async function readBody(req,max=MAX_CATALOG_BYTES){
 const length=Number(req.headers['content-length']);if(Number.isFinite(length)&&length>max){req.resume();throw fail(413,'La solicitud es demasiado grande.');}
 const chunks=[];let bytes=0;for await(const chunk of req.iterator({destroyOnReturn:false})){bytes+=chunk.length;if(bytes>max){req.resume();throw fail(413,'La solicitud es demasiado grande.');}chunks.push(Buffer.from(chunk));}return Buffer.concat(chunks,bytes);
}
async function readJSON(req,max){try{return JSON.parse((await readBody(req,max)).toString('utf8'));}catch(error){if(error.status)throw error;throw fail(400,'Solicitud JSON no válida.');}}
function json(res,status,value){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});res.end(JSON.stringify(value));}
function createAdminAccess({file,passwordHash,githubToken,signingKeyBase64,publicKey,legacyToken,fetchImpl=fetch,now=Date.now,maxAssetBytes=2*1024**3}){
 const password=parsePasswordHash(passwordHash),epoch=digest(passwordHash||''),sessionMs=30*86400000,rates=new Map();let sessions={},checking=0,uploads=0,privateKey,configurationError='';
 try{sessions=JSON.parse(fs.readFileSync(file,'utf8'));if(!sessions||Array.isArray(sessions)||typeof sessions!=='object')throw Error();}catch(error){if(error.code!=='ENOENT')throw Error('No se pudo leer el acceso administrativo.');}
 try{if(signingKeyBase64){privateKey=crypto.createPrivateKey(Buffer.from(signingKeyBase64,'base64'));const actual=crypto.createPublicKey(privateKey).export({type:'spki',format:'der'}),expected=(publicKey?.type==='public'?publicKey:crypto.createPublicKey(publicKey)).export({type:'spki',format:'der'});if(!actual.equals(expected))throw Error();}}catch{configurationError='La clave del servidor no corresponde al canal de Kovium.';privateKey=null;}
 function save(){fs.mkdirSync(path.dirname(file),{recursive:true,mode:0o700});const tmp=file+'.'+crypto.randomBytes(8).toString('hex')+'.tmp';try{fs.writeFileSync(tmp,JSON.stringify(sessions),{flag:'wx',mode:0o600});fs.renameSync(tmp,file);}finally{fs.rmSync(tmp,{force:true});}}
 function sweep(){let changed=false;for(const [key,s]of Object.entries(sessions))if(s.epoch!==epoch||s.expiresAt<=now()){delete sessions[key];changed=true;}for(const [key,r]of rates)if(r.until<=now())rates.delete(key);if(changed)save();}
 function rate(key,max,ms=60000){const r=rates.get(key);if(!r||r.until<=now())rates.set(key,{count:1,until:now()+ms});else if(++r.count>max)throw fail(429,'Demasiados intentos. Espera un minuto y vuelve a intentarlo.');}
 function ready(){return !!(githubToken&&privateKey&&!configurationError);}
 function requireReady(){if(!ready())throw fail(503,configurationError||'La publicación compartida todavía necesita terminar su configuración en el servidor.');}
 function authorize(req){
  const header=String(req.headers.authorization||'');if(legacyToken&&legacyToken.length>=32&&equal(header,'Bearer '+legacyToken))return {legacy:true};
  const match=/^Bearer (ka_[A-Za-z0-9_-]{43})$/.exec(header),id=match&&digest(match[1]),session=id&&sessions[id];
  if(!session||session.epoch!==epoch||session.expiresAt<=now())return null;
  return {id,...session};
 }
 function requireAdmin(req){const session=authorize(req);if(!session)throw fail(401,'Conecta el Administrador con su contraseña para publicar.');return session;}
 function validTag(value){if(typeof value!=='string'||!/^pack(?:delta)?-[a-zA-Z0-9][a-zA-Z0-9._-]{0,235}$/.test(value)&&value!=='channel')throw fail(400,'Destino de recursos no permitido.');return value;}
 function validAsset(tag,name){if(typeof name!=='string'||name.length>180||name.includes('..')||!(/^[a-f0-9]{64}\.bin$/.test(name)||/^manifest-[a-f0-9]{64}\.json$/.test(name)||/^[a-z0-9][a-zA-Z0-9._-]*\.zip$/.test(name)||tag==='channel'&&name==='projects.json'))throw fail(400,'Nombre de recurso no permitido.');if(tag==='channel'&&name!=='projects.json')throw fail(400,'Ese canal no se modifica desde el Administrador.');return name;}
 async function github(route,options={}){
  requireReady();if(!route.startsWith('/repos/'+REPO+'/'))throw fail(400,'Repositorio no permitido.');
  const res=await fetchImpl('https://api.github.com'+route,{...options,headers:{Accept:'application/vnd.github+json',Authorization:'Bearer '+githubToken,'X-GitHub-Api-Version':'2022-11-28','User-Agent':'Kovium-Publisher',...(options.body&&!(options.body instanceof Readable)?{'Content-Type':'application/json'}:{}),...options.headers},signal:AbortSignal.timeout(options.timeout||180000),redirect:'error'});
  if(!res.ok){await res.body?.cancel();throw fail(res.status===404?404:res.status===409?409:502,'El alojamiento de archivos respondió HTTP '+res.status+'.');}
  const text=await res.text();if(Buffer.byteLength(text)>6000000)throw fail(502,'El alojamiento devolvió demasiados datos.');if(!text)return {};try{return JSON.parse(text);}catch{throw fail(502,'El alojamiento devolvió una respuesta no válida.');}
 }
 const release=tag=>github('/repos/'+REPO+'/releases/tags/'+encodeURIComponent(validTag(tag)));
 async function createRelease(value){
  const tag=validTag(value.tag);try{return await release(tag);}catch(error){if(error.status!==404)throw error;}
  return github('/repos/'+REPO+'/releases',{method:'POST',body:JSON.stringify({tag_name:tag,name:String(value.title||tag).slice(0,180),body:String(value.notes||'Contenido de Kovium.').slice(0,1000),draft:false,prerelease:false,make_latest:'false'})});
 }
 function contentPath(value){if(value==='channel/projects.json')return value;if(typeof value==='string'&&/^launcher-assets\/images\/imagen-[a-f0-9]{64}\.(?:png|jpg|jpeg|webp)$/.test(value))return value;throw fail(400,'Archivo del repositorio no permitido.');}
 async function content(value){
  const name=contentPath(value.path),route='/repos/'+REPO+'/contents/'+name;
  if(value.method==='GET')return github(route+'?ref=main');
  if(value.method!=='PUT'||!value.input||value.input.branch!=='main'||typeof value.input.content!=='string'||value.input.content.length>11000000||!/^[A-Za-z0-9+/]*={0,2}$/.test(value.input.content))throw fail(400,'Contenido de publicación no válido.');
  const bytes=Buffer.from(value.input.content,'base64');
  if(name==='channel/projects.json'){if(bytes.length>MAX_CATALOG_BYTES)throw fail(413,'El catálogo es demasiado grande.');try{validateEnvelope(JSON.parse(bytes),publicKey);}catch{throw fail(400,'El catálogo no supera la comprobación de firma.');}}
  else if(bytes.length>8000000||crypto.createHash('sha256').update(bytes).digest('hex')!==/imagen-([a-f0-9]{64})/.exec(name)[1])throw fail(400,'La imagen no coincide con su huella.');
  return github(route,{method:'PUT',body:JSON.stringify({message:String(value.input.message||'Publicar recurso de Kovium').slice(0,200),branch:'main',content:bytes.toString('base64'),...(typeof value.input.sha==='string'&&/^[a-f0-9]{40}$/.test(value.input.sha)?{sha:value.input.sha}:{})})});
 }
 function signedCatalog(value){
  requireReady();if(!value||value.schemaVersion!==2||!value.projects||Array.isArray(value.projects)||typeof value.projects!=='object'||Object.keys(value.projects).length>200)throw fail(400,'Catálogo no válido.');
  for(const [id,p]of Object.entries(value.projects)){if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)||id.length>80||!p||Array.isArray(p)||typeof p!=='object'||typeof p.name!=='string'||!p.name.trim()||p.name.length>4000)throw fail(400,'Instancia no válida.');if(p.pack){for(const url of [p.pack.url,p.pack.manifest?.url].filter(Boolean)){let u;try{u=new URL(url);}catch{}if(!u||u.protocol!=='https:'||u.username||u.password)throw fail(400,'El contenido debe usar enlaces HTTPS.');}if(p.pack.sha256&&!/^[a-f0-9]{64}$/.test(p.pack.sha256))throw fail(400,'Huella del contenido no válida.');}}
  const clean={schemaVersion:2,projects:value.projects,...(value.integrations!==undefined?{integrations:value.integrations}:{}),...(value.launcher!==undefined?{launcher:sanitizeLauncher(value.launcher)}:{}),revision:value.revision,publishedAt:value.publishedAt};
  if(!/^[a-f0-9]{64}$/.test(clean.revision||'')||clean.revision!==contentRevision(clean)||typeof clean.publishedAt!=='string'||!Number.isFinite(Date.parse(clean.publishedAt))||new Date(clean.publishedAt).toISOString()!==clean.publishedAt)throw fail(400,'La revisión del catálogo no es válida.');
  const payload=Buffer.from(JSON.stringify(clean));if(payload.length>MAX_CATALOG_BYTES/2)throw fail(413,'El catálogo es demasiado grande.');const signed={...clean,signedPayload:payload.toString('base64'),signature:crypto.sign('RSA-SHA256',payload,privateKey).toString('base64')};return validateEnvelope(signed,publicKey);
 }
 async function upload(req,url){
  requireReady();if(uploads>=3){req.resume();throw fail(429,'Ya se están subiendo tres archivos. Espera a que terminen.');}
  const tag=validTag(url.searchParams.get('tag')),name=validAsset(tag,url.searchParams.get('name'));
  const length=Number(req.headers['content-length']),expected=String(req.headers['x-content-sha256']||'');if(!Number.isSafeInteger(length)||length<1||length>maxAssetBytes||!/^[a-f0-9]{64}$/.test(expected)){req.resume();throw fail(400,'El tamaño o la huella del recurso no son válidos.');}
  if((/^manifest-/.test(name)||/\.bin$/.test(name))&&!name.includes(expected)){req.resume();throw fail(400,'El nombre del recurso no coincide con su huella.');}
  const r=await release(tag),old=r.assets?.find(a=>a.name===name);
  if(old&&old.size===length&&old.digest==='sha256:'+expected){req.resume();return old;}
  if(old&&tag!=='channel'){req.resume();throw fail(409,'Ya existe otro archivo en esa dirección. No se reemplazó.');}
  let source=req;
  if(tag==='channel'){
   const bytes=await readBody(req,MAX_CATALOG_BYTES);if(crypto.createHash('sha256').update(bytes).digest('hex')!==expected)throw fail(400,'El catálogo recibido no coincide con su huella.');try{validateEnvelope(JSON.parse(bytes),publicKey);}catch{throw fail(400,'El catálogo no supera la comprobación de firma.');}source=Readable.from(bytes);
  }
  if(old)await github('/repos/'+REPO+'/releases/assets/'+old.id,{method:'DELETE'});
  const hash=crypto.createHash('sha256');let size=0,streamError;const checked=new Transform({highWaterMark:1024*1024,transform(chunk,_encoding,done){size+=chunk.length;if(size>length)return done(fail(413,'El archivo supera su tamaño anunciado.'));hash.update(chunk);done(null,chunk);}});
  source.on('error',error=>{streamError=error;checked.destroy(error);});source.pipe(checked);uploads++;
  try{
   const response=await fetchImpl('https://uploads.github.com/repos/'+REPO+'/releases/'+r.id+'/assets?name='+encodeURIComponent(name),{method:'POST',duplex:'half',body:checked,headers:{Authorization:'Bearer '+githubToken,'User-Agent':'Kovium-Publisher','X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/octet-stream','Content-Length':String(length)},signal:AbortSignal.timeout(30*60000),redirect:'error'});
   const text=await response.text();if(text.length>200000)throw fail(502,'Respuesta de alojamiento no válida.');if(!response.ok)throw fail(502,'No se pudo subir el archivo (HTTP '+response.status+').');let asset;try{asset=JSON.parse(text);}catch{throw fail(502,'El alojamiento no confirmó el archivo.');}
   if(streamError||size!==length||hash.digest('hex')!==expected||asset.size!==length||asset.digest&&asset.digest!=='sha256:'+expected){if(Number.isSafeInteger(asset.id))try{await github('/repos/'+REPO+'/releases/assets/'+asset.id,{method:'DELETE'});}catch{}throw fail(400,'El archivo no coincide con su huella. La publicación actual se conservó.');}return asset;
  }finally{uploads--;source.unpipe(checked);checked.destroy();if(!req.complete)req.resume();}
 }
 async function handle(req,res,url,ip){
  if(!url.pathname.startsWith('/v1/admin/auth/')&&!url.pathname.startsWith('/v1/admin/publishing/'))return false;
  if(req.method==='POST'&&url.pathname==='/v1/admin/auth/login'){
   rate('login:'+ip,8);rate('login-global',30);if(!password)throw fail(503,'El acceso por contraseña todavía no está configurado.');if(checking>=2)throw fail(429,'Espera un momento y vuelve a intentarlo.');
   const b=await readJSON(req,2000);if(typeof b.password!=='string'||Buffer.byteLength(b.password)>256)throw fail(400,'Contraseña no válida.');let valid=false;checking++;
   try{const value=await scrypt(b.password,password.salt,password.key.length,{N:16384,r:8,p:1,maxmem:64*1024*1024});valid=crypto.timingSafeEqual(value,password.key);}finally{checking--;}
   if(!valid)throw fail(401,'La contraseña del Administrador no es correcta.');sweep();if(Object.keys(sessions).length>=256)throw fail(429,'Hay demasiados equipos conectados. Contacta con el propietario.');
   const value='ka_'+crypto.randomBytes(32).toString('base64url'),expiresAt=now()+sessionMs;sessions[digest(value)]={createdAt:now(),expiresAt,epoch};save();json(res,200,{ok:true,sessionToken:value,expiresAt,publishingReady:ready()});return true;
  }
  const session=requireAdmin(req);rate('admin:'+(session.id||ip),600);
  if(req.method==='GET'&&url.pathname==='/v1/admin/auth/session'){json(res,200,{ok:true,expiresAt:session.expiresAt||null,publishingReady:ready(),...(configurationError?{reason:configurationError}:{})});return true;}
  if(req.method==='POST'&&url.pathname==='/v1/admin/auth/revoke'){if(session.id){delete sessions[session.id];save();}json(res,200,{ok:true});return true;}
  if(req.method==='POST'&&url.pathname==='/v1/admin/publishing/sign'){json(res,200,{ok:true,catalog:signedCatalog(await readJSON(req))});return true;}
  if(req.method==='POST'&&url.pathname==='/v1/admin/publishing/github'){
   const value=await readJSON(req,12000000);let result;
   if(value.operation==='getRelease')result=await release(value.tag);
   else if(value.operation==='createRelease')result=await createRelease(value);
   else if(value.operation==='content')result=await content(value);
   else throw fail(400,'Operación de publicación no permitida.');
   json(res,200,{ok:true,result});return true;
  }
  if(req.method==='POST'&&url.pathname==='/v1/admin/publishing/asset'){json(res,200,{ok:true,result:await upload(req,url)});return true;}
  throw fail(404,'Operación administrativa no disponible.');
 }
 return {handle,authorize,sweep,ready,signedCatalog};
}
module.exports={createAdminAccess,hashPassword,parsePasswordHash,readBody};
