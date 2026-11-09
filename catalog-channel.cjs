'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const MAX_CATALOG_BYTES=2*1024*1024;
const failure=(status,message,extra={})=>Object.assign(Error(message),{status,...extra});
function canonicalJSON(value){
 if(value===null||typeof value!=='object')return JSON.stringify(value);
 if(Array.isArray(value))return '['+value.map(canonicalJSON).join(',')+']';
 return '{'+Object.keys(value).filter(key=>value[key]!==undefined).sort().map(key=>JSON.stringify(key)+':'+canonicalJSON(value[key])).join(',')+'}';
}
function contentRevision(value){return crypto.createHash('sha256').update(canonicalJSON({schemaVersion:2,projects:value.projects,...(value.integrations!==undefined?{integrations:value.integrations}:{})})).digest('hex');}
function validateEnvelope(value,publicKey){
 if(!value||typeof value!=='object'||Array.isArray(value)||value.schemaVersion!==2||!value.projects||typeof value.projects!=='object'||Array.isArray(value.projects))throw failure(400,'Catálogo no válido.');
 if(typeof value.signedPayload!=='string'||typeof value.signature!=='string'||!value.signedPayload||value.signedPayload.length>MAX_CATALOG_BYTES||!/^[A-Za-z0-9+/]+={0,2}$/.test(value.signedPayload)||!/^[A-Za-z0-9+/]+={0,2}$/.test(value.signature))throw failure(400,'Falta una firma válida del catálogo.');
 const payload=Buffer.from(value.signedPayload,'base64');
 if(!crypto.verify('RSA-SHA256',payload,publicKey,Buffer.from(value.signature,'base64')))throw failure(400,'La firma del catálogo no es válida.');
 let signed;try{signed=JSON.parse(payload.toString('utf8'));}catch{throw failure(400,'El contenido firmado no es JSON válido.');}
 if(signed.schemaVersion!==2||JSON.stringify(signed.projects)!==JSON.stringify(value.projects)||JSON.stringify(signed.integrations)!==JSON.stringify(value.integrations)||signed.revision!==value.revision||signed.publishedAt!==value.publishedAt)throw failure(400,'El catálogo fue modificado después de firmarlo.');
 if(value.integrations!==undefined&&(!value.integrations||typeof value.integrations!=='object'||Array.isArray(value.integrations)))throw failure(400,'Conexiones del catálogo no válidas.');
 if(value.revision!==undefined||value.publishedAt!==undefined){
  if(!/^[a-f0-9]{64}$/.test(value.revision||'')||typeof value.publishedAt!=='string'||!Number.isFinite(Date.parse(value.publishedAt)))throw failure(400,'Los datos de publicación no son válidos.');
  if(contentRevision(value)!==value.revision)throw failure(400,'La revisión no coincide con el catálogo firmado.');
 }
 return {schemaVersion:2,projects:value.projects,...(value.integrations!==undefined?{integrations:value.integrations}:{}),...(value.revision!==undefined?{revision:value.revision,publishedAt:value.publishedAt}:{}),signedPayload:value.signedPayload,signature:value.signature};
}
function readCatalogBody(req){
 return new Promise((resolve,reject)=>{
  let bytes=0,chunks=[],done=false;
  const rejectOnce=error=>{if(done)return;done=true;chunks=[];reject(error);};
  const length=Number(req.headers['content-length']);
  if(Number.isFinite(length)&&length>MAX_CATALOG_BYTES){req.resume();rejectOnce(failure(413,'El catálogo supera 2 MB.'));return;}
  req.on('data',chunk=>{if(done)return;bytes+=chunk.length;if(bytes>MAX_CATALOG_BYTES){rejectOnce(failure(413,'El catálogo supera 2 MB.'));return;}chunks.push(Buffer.from(chunk));});
  req.once('error',()=>rejectOnce(failure(400,'No se pudo recibir el catálogo.')));
  req.once('aborted',()=>rejectOnce(failure(400,'La publicación fue interrumpida.')));
  req.once('end',()=>{if(done)return;done=true;try{resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));}catch{reject(failure(400,'JSON de catálogo no válido.'));}chunks=[];});
 });
}
function createCatalogChannel({file,publicKey}){
 const key=publicKey?.type==='public'?publicKey:crypto.createPublicKey(publicKey);
 if(key.asymmetricKeyType!=='rsa')throw Error('La clave pública del catálogo debe ser RSA.');
 function read(){
  let data;try{const stat=fs.lstatSync(file);if(stat.isSymbolicLink()||!stat.isFile()||stat.size>MAX_CATALOG_BYTES)throw Error('Archivo inválido.');data=fs.readFileSync(file,'utf8');}catch(error){if(error.code==='ENOENT')throw failure(404,'Todavía no hay un catálogo publicado.');throw failure(503,'El catálogo guardado no está disponible.');}
  try{return validateEnvelope(JSON.parse(data),key);}catch{throw failure(503,'El catálogo guardado no supera la verificación.');}
 }
 function write(value,ifMatch){
  const clean=validateEnvelope(value,key);let current=null;try{current=read();}catch(error){if(error.status!==404)throw error;}
  const revision=current?(current.revision||contentRevision(current)):null,expected=typeof ifMatch==='string'?ifMatch.trim().replace(/^"([a-f0-9]{64})"$/,'$1'):null;
  if(current?expected!==revision:expected!==null)throw failure(409,'El catálogo cambió. Recarga la versión publicada antes de volver a publicar.',{currentRevision:revision});
  const bytes=Buffer.from(JSON.stringify(clean));if(bytes.length>MAX_CATALOG_BYTES)throw failure(413,'El catálogo supera 2 MB.');
  fs.mkdirSync(path.dirname(file),{recursive:true,mode:0o700});const temporary=file+'.tmp-'+crypto.randomBytes(8).toString('hex');let fd;
  try{fd=fs.openSync(temporary,'wx',0o600);fs.writeFileSync(fd,bytes);fs.fsyncSync(fd);fs.closeSync(fd);fd=undefined;fs.renameSync(temporary,file);}finally{if(fd!==undefined)fs.closeSync(fd);fs.rmSync(temporary,{force:true});}
  return {envelope:clean,revision:clean.revision||contentRevision(clean)};
 }
 return {read,write,revision:value=>value.revision||contentRevision(value)};
}
module.exports={MAX_CATALOG_BYTES,canonicalJSON,contentRevision,validateEnvelope,readCatalogBody,createCatalogChannel};
