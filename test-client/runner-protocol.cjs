'use strict';
const crypto=require('node:crypto');
function verifySeasonDescriptor(value,key,modelVersion){
 if(!value||value.schemaVersion!==2||value.game!=='run-kovi-run'||value.modelVersion!==modelVersion||!/^[a-f0-9]{64}$/.test(value.modelVersion||'')||value.season!=='accounts-v2-'+value.modelVersion.slice(0,16)||typeof value.signedPayload!=='string'||value.signedPayload.length>4000||typeof value.signature!=='string'||value.signature.length>2000)throw Error('Esta temporada necesita otra versión de Run Kovi, Run. Actualiza el launcher.');
 const bytes=Buffer.from(value.signedPayload,'base64');let signed;try{if(!crypto.verify('RSA-SHA256',bytes,key,Buffer.from(value.signature,'base64')))throw Error();signed=JSON.parse(bytes);}catch{throw Error('La firma de la temporada no es válida.');}
 for(const field of ['schemaVersion','game','season','modelVersion'])if(signed[field]!==value[field])throw Error('La temporada de la clasificación no es válida.');
 return{season:value.season,modelVersion:value.modelVersion};
}
function verifyContinuousDescriptor(value,key,modelVersion){
 const physics='74d84cc162dae26d15b5f813a8fb8af981584dd05cbb37b7a7d9d929f1b0e948';
 if(!value||value.schemaVersion!==3||value.game!=='run-kovi-run'||value.protocol!=='continuous-v1'||value.physicsVersion!==physics||value.modelVersion!==modelVersion||!/^[a-f0-9]{64}$/.test(modelVersion||'')||value.season!=='accounts-v2-'+physics.slice(0,16)||typeof value.signedPayload!=='string'||value.signedPayload.length>4000||typeof value.signature!=='string'||value.signature.length>2000)throw Error('La versión continua necesita actualizarse.');
 let signed;try{const bytes=Buffer.from(value.signedPayload,'base64');if(!crypto.verify('RSA-SHA256',bytes,key,Buffer.from(value.signature,'base64')))throw Error();signed=JSON.parse(bytes);}catch{throw Error('La firma del motor continuo no es válida.');}for(const field of ['schemaVersion','game','protocol','physicsVersion','modelVersion','season'])if(signed[field]!==value[field])throw Error('La temporada continua no supera la comprobación.');return{protocol:value.protocol,physicsVersion:physics,modelVersion,season:value.season};
}
function continuousChunkHash(p){return crypto.createHash('sha256').update(JSON.stringify({sequence:p.sequence,fromTick:p.fromTick,toTick:p.toTick,inputs:p.inputs.map(({tick,action})=>({tick,action})),final:p.final===true})).digest('hex');}
module.exports={verifySeasonDescriptor,verifyContinuousDescriptor,continuousChunkHash};
