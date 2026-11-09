'use strict';
const fs=require('fs'),path=require('path');
const {createAccessServer,environment}=require('./server.cjs');

function seedFile(file,value){
 fs.mkdirSync(path.dirname(file),{recursive:true});
 try{fs.writeFileSync(file,JSON.stringify(value,null,2),{flag:'wx',mode:0o600});}
 catch(error){if(error.code!=='EEXIST')throw error;}
}
function seedData(config){
 fs.mkdirSync(config.packRoot,{recursive:true});
 seedFile(config.projectsFile,JSON.parse(fs.readFileSync(path.join(__dirname,'projects.example.json'),'utf8')));
 seedFile(config.sessionFile,{});
 seedFile(config.serverKeysFile,{servers:[]});
}
if(require.main===module){
 try{
  process.umask(0o077);
  if(process.env.RAILWAY_ENVIRONMENT_ID&&process.env.RAILWAY_VOLUME_MOUNT_PATH!=='/data')throw Error('Falta montar el volumen persistente de Railway en /data.');
  const config=environment();seedData(config);const server=createAccessServer(config);
  server.listen(Number(process.env.PORT)||8787,process.env.BIND_HOST||'0.0.0.0',()=>console.log('Servicio de cuentas listo.'));
  for(const signal of ['SIGTERM','SIGINT'])process.once(signal,()=>{
   server.close(()=>process.exit(0));setTimeout(()=>process.exit(0),10000).unref();
  });
 }catch(error){console.error(error.message);process.exitCode=1;}
}
module.exports={seedData};
