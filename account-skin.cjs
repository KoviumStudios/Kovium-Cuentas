'use strict';
const zlib=require('zlib');
const fail=message=>Object.assign(Error(message),{status:400});
const table=Uint32Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function crc(bytes){let value=0xffffffff;for(const b of bytes)value=table[(value^b)&255]^(value>>>8);return (value^0xffffffff)>>>0;}
function chunk(name,data){const type=Buffer.from(name),result=Buffer.alloc(12+data.length);result.writeUInt32BE(data.length);type.copy(result,4);data.copy(result,8);result.writeUInt32BE(crc(Buffer.concat([type,data])),8+data.length);return result;}
function validateSkin(skin){
 if(skin===null)return null;
 if(!skin||typeof skin!=='object'||Array.isArray(skin)||typeof skin.data!=='string'||skin.data.length>280000||!['classic','slim'].includes(skin.model||'classic'))throw fail('La skin debe ser un PNG de hasta 200 KB.');
 const encoded=skin.data.startsWith('data:image/png;base64,')?skin.data.slice(22):skin.data;
 if(!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded))throw fail('La skin no contiene un PNG válido.');
 const bytes=Buffer.from(encoded,'base64');if(bytes.length>200000||bytes.length<57||!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))throw fail('La skin debe ser un PNG de hasta 200 KB.');
 let offset=8,header,ended=false,closedIDAT=false,count=0;const parts=[];
 while(offset<bytes.length){
  if(++count>128||offset+12>bytes.length)throw fail('La estructura de la skin no es válida.');const length=bytes.readUInt32BE(offset),type=bytes.toString('ascii',offset+4,offset+8);
  if(length>200000||offset+12+length>bytes.length||!/^\w{4}$/.test(type))throw fail('La estructura de la skin no es válida.');
  const data=bytes.subarray(offset+8,offset+8+length);if(crc(bytes.subarray(offset+4,offset+8+length))!==bytes.readUInt32BE(offset+8+length))throw fail('La skin está dañada.');
  if(!header&&type!=='IHDR')throw fail('La cabecera de la skin no es válida.');
  if(type==='IHDR'){if(header||length!==13)throw fail('La cabecera de la skin no es válida.');header=Buffer.from(data);if(data.readUInt32BE(0)!==64||![32,64].includes(data.readUInt32BE(4))||data[8]!==8||![2,6].includes(data[9])||data[10]!==0||data[11]!==0||data[12]!==0)throw fail('La skin necesita 64×64 o 64×32 píxeles, RGB/RGBA de 8 bits y sin entrelazado.');}
  else if(type==='IDAT'){if(closedIDAT)throw fail('La estructura de la skin no es válida.');parts.push(data);}
  else if(type==='IEND'){if(length||offset+12!==bytes.length)throw fail('La estructura de la skin no es válida.');ended=true;break;}
  else{if(parts.length)closedIDAT=true;if(type==='acTL'||type==='fcTL'||type==='fdAT'||type[0]===type[0].toUpperCase()&&type!=='PLTE')throw fail('La skin no puede estar animada ni contener datos desconocidos.');}
  offset+=12+length;
 }
 if(!ended||!header||!parts.length)throw fail('La skin está incompleta.');
 const height=header.readUInt32BE(4),stride=1+64*(header[9]===6?4:3),expected=stride*height;let pixels;
 try{pixels=zlib.inflateSync(Buffer.concat(parts),{maxOutputLength:expected});}catch{throw fail('Los datos de la skin están dañados.');}
 if(pixels.length!==expected)throw fail('Los datos de la skin están dañados.');for(let row=0;row<height;row++)if(pixels[row*stride]>4)throw fail('Los datos de la skin están dañados.');
 const model=skin.model||'classic';if(model==='slim'&&height!==64)throw fail('El modelo delgado necesita una skin de 64×64 píxeles.');
 const clean=Buffer.concat([bytes.subarray(0,8),chunk('IHDR',header),chunk('IDAT',zlib.deflateSync(pixels,{level:9})),chunk('IEND',Buffer.alloc(0))]);
 return {bytes:clean,model,width:64,height};
}
module.exports={validateSkin};
