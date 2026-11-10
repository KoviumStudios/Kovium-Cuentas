'use strict';
// Solo distribuye actualizaciones del editor; esta capacidad nunca permite publicar.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const fail=(status,message)=>Object.assign(Error(message),{status});
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
function payload(m){return JSON.stringify(['kovium-admin-update-v1',m.version,m.runtimeMajor,m.url,m.sha256,m.size,m.archiveSha256,m.helperSha256]);}
function verify(m,key){
 if(!m||m.schemaVersion!==1||m.product!=='kovium-admin'||!/^\d+\.\d+\.\d+$/.test(m.version)||m.runtimeMajor!==45||!Number.isSafeInteger(m.size)||m.size<100||m.size>80000000||![m.sha256,m.archiveSha256,m.helperSha256].every(x=>/^[a-f0-9]{64}$/.test(x||'')))throw fail(400,'Actualización privada no válida.');
 const u=new URL(m.url);if(u.origin!=='https://github.com'||u.username||u.password||u.search||u.hash||u.pathname!=='/KoviumStudios/Kovsafio-Launcher/releases/download/admin-'+m.version+'/admin-update.enc')throw fail(400,'Origen de actualización privada no válido.');
 if(!crypto.verify('RSA-SHA256',Buffer.from(payload(m)),key,Buffer.from(m.signature||'','base64')))throw fail(400,'Firma privada no válida.');
 return {schemaVersion:1,product:'kovium-admin',version:m.version,runtimeMajor:m.runtimeMajor,url:m.url,sha256:m.sha256,size:m.size,archiveSha256:m.archiveSha256,helperSha256:m.helperSha256,signature:m.signature};
}
function createDesktopUpdate({file,publicKey}){
 function read(){try{const st=fs.lstatSync(file);if(!st.isFile()||st.isSymbolicLink()||st.size>12000)throw Error();const d=JSON.parse(fs.readFileSync(file,'utf8'));verify(d.metadata,publicKey);if(!/^[a-f0-9]{64}$/.test(d.capabilityHash||'')||Buffer.from(d.contentKey||'','base64').length!==32)throw Error();return d;}catch(e){if(e.code==='ENOENT')return null;throw fail(503,'El canal privado necesita revisión.');}}
 function write(d){const metadata=verify(d?.metadata,publicKey);if(!/^[a-f0-9]{64}$/.test(d.capabilityHash||'')||! /^[A-Za-z0-9+/]{43}=$/.test(d.contentKey||'')||Buffer.from(d.contentKey,'base64').length!==32)throw fail(400,'Configuración privada no válida.');const old=read();if(old&&old.capabilityHash!==d.capabilityHash)throw fail(409,'La capacidad privada existente debe conservarse.');fs.mkdirSync(path.dirname(file),{recursive:true,mode:0o700});const temp=file+'.tmp-'+crypto.randomBytes(8).toString('hex');try{fs.writeFileSync(temp,JSON.stringify({metadata,capabilityHash:d.capabilityHash,contentKey:d.contentKey}),{flag:'wx',mode:0o600});fs.renameSync(temp,file);}finally{fs.rmSync(temp,{force:true});}return {ok:true,version:metadata.version};}
 function get(authorization){const d=read(),match=/^Bearer ([A-Za-z0-9_-]{43})$/.exec(authorization||'');const got=hash(match?.[1]||'');if(!d||!match||!crypto.timingSafeEqual(Buffer.from(got),Buffer.from(d.capabilityHash)))throw fail(401,'Actualizador privado no autorizado.');return {metadata:d.metadata,contentKey:d.contentKey};}
 return {get,write};
}
module.exports={createDesktopUpdate,verify,payload};
