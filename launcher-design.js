(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.KoviumDesign=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const definitions=Object.freeze({
  "global-background": {
    "name": "Fondo del launcher",
    "view": "global",
    "selector": "#main",
    "image": true,
    "background": true,
    "container": true
  },
  "global-sidebar": {
    "name": "Barra de navegación",
    "view": "global",
    "selector": ".sidebar",
    "container": true
  },
  "global-brand": {
    "name": "Logo del launcher",
    "view": "global",
    "selector": ".brand",
    "image": true
  },
  "global-header": {
    "name": "Barra superior",
    "view": "global",
    "selector": "#main > header",
    "container": true
  },
  "nav-home": {
    "name": "Navegación · Inicio",
    "view": "global",
    "selector": ".nav-btn[data-view=\"home\"]",
    "container": true
  },
  "nav-projects": {
    "name": "Navegación · Instancias",
    "view": "global",
    "selector": ".nav-btn[data-view=\"projects\"]",
    "container": true
  },
  "nav-skins": {
    "name": "Navegación · Skins",
    "view": "global",
    "selector": ".nav-btn[data-view=\"skins\"]",
    "container": true
  },
  "skins-panel": {
    "name": "Skins · panel",
    "view": "skins",
    "selector": "#view-skins > .panel",
    "container": true
  },
  "nav-info": {
    "name": "Navegación · Información",
    "view": "global",
    "selector": ".nav-btn[data-view=\"info\"]",
    "container": true
  },
  "info-panel": {
    "name": "Información · panel",
    "view": "info",
    "selector": "#view-info > .panel",
    "container": true
  },
  "nav-credits": {
    "name": "Navegación · Créditos",
    "view": "global",
    "selector": ".nav-btn[data-view=\"credits\"]",
    "container": true
  },
  "credits-panel": {
    "name": "Créditos · panel",
    "view": "credits",
    "selector": "#view-credits > .panel",
    "container": true
  },
  "nav-account": {
    "name": "Navegación · Cuentas",
    "view": "global",
    "selector": ".nav-btn[data-view=\"account\"]",
    "container": true
  },
  "account-panel": {
    "name": "Cuentas · panel",
    "view": "account",
    "selector": "#view-account > .panel",
    "container": true
  },
  "nav-settings": {
    "name": "Navegación · Ajustes",
    "view": "global",
    "selector": ".nav-btn[data-view=\"settings\"]",
    "container": true
  },
  "settings-panel": {
    "name": "Ajustes · panel",
    "view": "settings",
    "selector": "#view-settings > .panel",
    "container": true
  },
  "home-hero": {
    "name": "Panel principal",
    "view": "home",
    "selector": "#hero",
    "container": true
  },
  "home-profile": {
    "name": "Perfil del jugador",
    "view": "home",
    "selector": ".profile",
    "container": true
  },
  "home-selector": {
    "name": "Selector de instancias",
    "view": "home",
    "selector": "#selector",
    "container": true
  },
  "projects-grid": {
    "name": "Cuadrícula de instancias",
    "view": "projects",
    "selector": "#project-grid",
    "container": true
  },
  "skins-preview": {
    "name": "Vista del personaje",
    "view": "skins",
    "selector": "#view-skins .preview",
    "container": true
  },
  "skins-controls": {
    "name": "Controles de skins",
    "view": "skins",
    "selector": "#view-skins .skin-controls",
    "container": true
  },
  "ui-go-skins": {
    "name": "Inicio · CAMBIAR SKIN",
    "view": "home",
    "selector": "#go-skins",
    "text": true
  },
  "ui-home-001": {
    "name": "Inicio · Discord",
    "view": "home",
    "selector": "#view-home > div:nth-of-type(3) > div:nth-of-type(1) > div:nth-of-type(2) > strong:nth-of-type(1)",
    "text": true
  },
  "ui-home-002": {
    "name": "Inicio · UNIRME",
    "view": "home",
    "selector": "#view-home > div:nth-of-type(3) > div:nth-of-type(1) > a:nth-of-type(1)",
    "text": true
  },
  "ui-skins-003": {
    "name": "Skins · Mi skin",
    "view": "skins",
    "selector": "#view-skins > div:nth-of-type(1) > h2:nth-of-type(1)",
    "text": true
  },
  "ui-skins-004": {
    "name": "Skins · Puedes subir una skin PNG de Minecraft (64×64 o 64×32).",
    "view": "skins",
    "selector": "#view-skins > div:nth-of-type(1) > p:nth-of-type(1)",
    "text": true
  },
  "ui-skins-005": {
    "name": "Skins · SUBIR SKIN",
    "view": "skins",
    "selector": "#view-skins > div:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(2) > label:nth-of-type(1)",
    "text": true
  },
  "ui-skins-006": {
    "name": "Skins · Classic",
    "view": "skins",
    "selector": "#view-skins > div:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(2) > div:nth-of-type(1) > button:nth-of-type(1)",
    "text": true
  },
  "ui-skins-007": {
    "name": "Skins · Slim",
    "view": "skins",
    "selector": "#view-skins > div:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(2) > div:nth-of-type(1) > button:nth-of-type(2)",
    "text": true
  },
  "ui-skin-reset": {
    "name": "Skins · QUITAR SKIN",
    "view": "skins",
    "selector": "#skin-reset",
    "text": true
  },
  "ui-skins-008": {
    "name": "Skins · Tu skin se aplica dentro del juego al pulsar PLAY.",
    "view": "skins",
    "selector": "#view-skins > div:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(2) > p:nth-of-type(2)",
    "text": true
  },
  "ui-info-009": {
    "name": "Información · Información",
    "view": "info",
    "selector": "#view-info > div:nth-of-type(1) > h2:nth-of-type(1)",
    "text": true
  },
  "ui-info-010": {
    "name": "Información · Todo sobre Kovium Studios y nuestros proyectos",
    "view": "info",
    "selector": "#view-info > div:nth-of-type(1) > p:nth-of-type(1)",
    "text": true
  },
  "ui-info-011": {
    "name": "Información · Únete a nuestro Discord",
    "view": "info",
    "selector": "#view-info > div:nth-of-type(1) > div:nth-of-type(2) > div:nth-of-type(2) > h3:nth-of-type(1)",
    "text": true
  },
  "ui-info-012": {
    "name": "Información · Anuncios de eventos, soporte, sorteos y la comunidad de Kovi",
    "view": "info",
    "selector": "#view-info > div:nth-of-type(1) > div:nth-of-type(2) > div:nth-of-type(2) > p:nth-of-type(1)",
    "text": true
  },
  "ui-info-013": {
    "name": "Información · UNIRME AL DISCORD",
    "view": "info",
    "selector": "#view-info > div:nth-of-type(1) > div:nth-of-type(2) > a:nth-of-type(1)",
    "text": true
  },
  "ui-credits-014": {
    "name": "Créditos · Imagen",
    "view": "credits",
    "selector": "#view-credits > div:nth-of-type(1) > img:nth-of-type(1)",
    "image": true
  },
  "ui-credits-015": {
    "name": "Créditos · KOVIUM STUDIOS",
    "view": "credits",
    "selector": "#view-credits > div:nth-of-type(1) > h2:nth-of-type(1)",
    "text": true
  },
  "ui-credits-016": {
    "name": "Créditos · Créditos oficiales",
    "view": "credits",
    "selector": "#view-credits > div:nth-of-type(1) > p:nth-of-type(1)",
    "text": true
  },
  "ui-credits-017": {
    "name": "Créditos · Minecraft es una marca registrada de Mojang Studios y Micros",
    "view": "credits",
    "selector": "#view-credits > div:nth-of-type(1) > p:nth-of-type(2)",
    "text": true
  },
  "ui-account-018": {
    "name": "Cuentas · Mi cuenta",
    "view": "account",
    "selector": "#view-account > div:nth-of-type(1) > h2:nth-of-type(1)",
    "text": true
  },
  "ui-account-019": {
    "name": "Cuentas · Elige tu nombre de jugador para entrar al launcher.",
    "view": "account",
    "selector": "#view-account > div:nth-of-type(1) > p:nth-of-type(1)",
    "text": true
  },
  "ui-account-020": {
    "name": "Cuentas · Minecraft No Premium",
    "view": "account",
    "selector": "#acc-out > div:nth-of-type(1) > h3:nth-of-type(1)",
    "text": true
  },
  "ui-account-021": {
    "name": "Cuentas · Introduce tu nombre de jugador (3 a 16 caracteres: letras, n",
    "view": "account",
    "selector": "#acc-out > div:nth-of-type(1) > p:nth-of-type(1)",
    "text": true
  },
  "ui-offline-login": {
    "name": "Cuentas · CONECTAR",
    "view": "account",
    "selector": "#offline-login",
    "text": true
  },
  "ui-account-022": {
    "name": "Cuentas · SESIÓN ACTIVA",
    "view": "account",
    "selector": "#acc-in > div:nth-of-type(1) > div:nth-of-type(2) > p:nth-of-type(1)",
    "text": true
  },
  "ui-ms-logout": {
    "name": "Cuentas · CERRAR SESIÓN",
    "view": "account",
    "selector": "#ms-logout",
    "text": true
  },
  "ui-settings-023": {
    "name": "Ajustes · Ajustes",
    "view": "settings",
    "selector": "#view-settings > div:nth-of-type(1) > h2:nth-of-type(1)",
    "text": true
  },
  "ui-settings-024": {
    "name": "Ajustes · Memoria por instancia, actualizaciones y archivos.",
    "view": "settings",
    "selector": "#view-settings > div:nth-of-type(1) > p:nth-of-type(1)",
    "text": true
  },
  "ui-settings-025": {
    "name": "Ajustes · Instancia seleccionada",
    "view": "settings",
    "selector": "#view-settings > div:nth-of-type(1) > div:nth-of-type(1) > label:nth-of-type(1)",
    "text": true
  },
  "ui-settings-026": {
    "name": "Ajustes · RAM de esta instancia",
    "view": "settings",
    "selector": "#view-settings > div:nth-of-type(1) > div:nth-of-type(2) > div:nth-of-type(1) > h3:nth-of-type(1)",
    "text": true
  },
  "ui-settings-027": {
    "name": "Ajustes · Cuánta memoria puede usar Minecraft. Más no siempre es mejor",
    "view": "settings",
    "selector": "#view-settings > div:nth-of-type(1) > div:nth-of-type(2) > p:nth-of-type(1)",
    "text": true
  },
  "ui-settings-028": {
    "name": "Ajustes · Actualizaciones",
    "view": "settings",
    "selector": "#view-settings > div:nth-of-type(1) > div:nth-of-type(3) > div:nth-of-type(1) > h3:nth-of-type(1)",
    "text": true
  },
  "ui-update-check": {
    "name": "Ajustes · BUSCAR ACTUALIZACIONES",
    "view": "settings",
    "selector": "#update-check",
    "text": true
  },
  "ui-update-install": {
    "name": "Ajustes · DESCARGAR NUEVA VERSIÓN",
    "view": "settings",
    "selector": "#update-install",
    "text": true
  },
  "ui-settings-029": {
    "name": "Ajustes · Archivos del juego",
    "view": "settings",
    "selector": "#view-settings > div:nth-of-type(1) > div:nth-of-type(4) > div:nth-of-type(1) > h3:nth-of-type(1)",
    "text": true
  },
  "ui-settings-030": {
    "name": "Ajustes · Si un proyecto falla o se corrompió, repáralo y se volverá a",
    "view": "settings",
    "selector": "#view-settings > div:nth-of-type(1) > div:nth-of-type(4) > p:nth-of-type(1)",
    "text": true
  },
  "ui-open-folder": {
    "name": "Ajustes · ABRIR CARPETA DEL JUEGO",
    "view": "settings",
    "selector": "#open-folder",
    "text": true
  },
  "ui-open-log": {
    "name": "Ajustes · ABRIR REGISTRO DE ERRORES",
    "view": "settings",
    "selector": "#open-log",
    "text": true
  },
  "ui-copy-error": {
    "name": "Ajustes · COPIAR DIAGNÓSTICO",
    "view": "settings",
    "selector": "#copy-error",
    "text": true
  },
  "ui-repair-pack": {
    "name": "Ajustes · REPARAR PROYECTO ACTUAL",
    "view": "settings",
    "selector": "#repair-pack",
    "text": true
  },
  "ui-settings-031": {
    "name": "Ajustes · Copias de seguridad",
    "view": "settings",
    "selector": "#view-settings > div:nth-of-type(1) > div:nth-of-type(5) > div:nth-of-type(1) > h3:nth-of-type(1)",
    "text": true
  },
  "ui-settings-032": {
    "name": "Ajustes · Se crea una copia antes de cambiar el pack. Puedes crear otr",
    "view": "settings",
    "selector": "#view-settings > div:nth-of-type(1) > div:nth-of-type(5) > p:nth-of-type(1)",
    "text": true
  },
  "ui-backup-create": {
    "name": "Ajustes · CREAR COPIA",
    "view": "settings",
    "selector": "#backup-create",
    "text": true
  },
  "ui-backup-refresh": {
    "name": "Ajustes · VER COPIAS",
    "view": "settings",
    "selector": "#backup-refresh",
    "text": true
  },
  "account-microsoft-card": {
    "name": "Tarjeta · microsoft",
    "view": "account",
    "selector": ".identity-card[data-provider=\"microsoft\"]",
    "container": true
  },
  "account-microsoft-title": {
    "name": "Título · microsoft",
    "view": "account",
    "selector": ".identity-card[data-provider=\"microsoft\"] h4",
    "text": true
  },
  "account-microsoft-description": {
    "name": "Descripción · microsoft",
    "view": "account",
    "selector": ".identity-card[data-provider=\"microsoft\"] h4 + p",
    "text": true
  },
  "account-discord-card": {
    "name": "Tarjeta · discord",
    "view": "account",
    "selector": ".identity-card[data-provider=\"discord\"]",
    "container": true
  },
  "account-discord-title": {
    "name": "Título · discord",
    "view": "account",
    "selector": ".identity-card[data-provider=\"discord\"] h4",
    "text": true
  },
  "account-discord-description": {
    "name": "Descripción · discord",
    "view": "account",
    "selector": ".identity-card[data-provider=\"discord\"] h4 + p",
    "text": true
  },
  "account-connections-title": {
    "name": "Título de conexiones",
    "view": "account",
    "selector": ".identity-connections > h3",
    "text": true
  },
  "credits-content": {
    "name": "Nombres y equipos de créditos",
    "view": "credits",
    "selector": "#credit-sections",
    "text": true,
    "multiline": true
  },
  "credits-rights": {
    "name": "Texto de derechos",
    "view": "credits",
    "selector": "#rights",
    "text": true,
    "multiline": true
  },
  "settings-card-1": {
    "name": "Tarjeta de ajustes 1",
    "view": "settings",
    "selector": "#view-settings .settings-card:nth-of-type(1)",
    "container": true
  },
  "settings-card-2": {
    "name": "Tarjeta de ajustes 2",
    "view": "settings",
    "selector": "#view-settings .settings-card:nth-of-type(2)",
    "container": true
  },
  "settings-card-3": {
    "name": "Tarjeta de ajustes 3",
    "view": "settings",
    "selector": "#view-settings .settings-card:nth-of-type(3)",
    "container": true
  },
  "settings-card-4": {
    "name": "Tarjeta de ajustes 4",
    "view": "settings",
    "selector": "#view-settings .settings-card:nth-of-type(4)",
    "container": true
  },
  "settings-card-5": {
    "name": "Tarjeta de ajustes 5",
    "view": "settings",
    "selector": "#view-settings .settings-card:nth-of-type(5)",
    "container": true
  }
});
 const color=v=>typeof v==='string'&&/^#(?:[a-f0-9]{3}|[a-f0-9]{6}|[a-f0-9]{8})$/i.test(v);
 function image(v){if(typeof v!=='string'||v.length>4000)return false;if(/^[A-Za-z0-9 _().-]+\.(png|jpe?g|webp)$/i.test(v))return true;try{const u=new URL(v);return u.protocol==='https:'&&!u.username&&!u.password;}catch{return false;}}
 function object(v){return v&&typeof v==='object'&&!Array.isArray(v);}
 function sanitize(value){
  if(!object(value)||value.elements!==undefined&&!object(value.elements)||value.theme!==undefined&&!object(value.theme))throw Error('El diseño del launcher no es válido.');
  if(Object.keys(value).some(k=>!['elements','theme'].includes(k)))throw Error('Propiedad de diseño no permitida.');
  const elements={};for(const [id,e]of Object.entries(value.elements||{})){
   if(!Object.hasOwn(definitions,id)||!object(e))throw Error('Elemento del launcher no permitido.');const spec=definitions[id],out={};
   for(const [key,v]of Object.entries(e)){
    if(key==='text'){if(!spec.text||typeof v!=='string'||v.length>4000)throw Error('Texto del launcher no válido.');out.text=v;}
    else if(key==='src'){if(!spec.image||!image(v))throw Error('Imagen del launcher no válida.');out.src=v;}
    else if(['color','backgroundColor'].includes(key)){if(!color(v))throw Error('Color del launcher no válido.');out[key]=v;}
    else if(['x','y','width','height','fontSize','borderRadius'].includes(key)){const range=key==='x'||key==='y'?[-3000,3000]:key==='fontSize'?[8,160]:key==='borderRadius'?[0,200]:[8,3000];if(typeof v!=='number'||!Number.isFinite(v)||v<range[0]||v>range[1])throw Error('Tamaño o posición del launcher no válido.');out[key]=v;}
    else throw Error('Propiedad de elemento no permitida.');
   }elements[id]=out;
  }
  const theme={};for(const [key,v]of Object.entries(value.theme||{})){if(!['accent','surface','background','text','muted'].includes(key)||!color(v))throw Error('Tema del launcher no válido.');theme[key]=v;}
  return {elements,theme};
 }
 const records=new WeakMap(),themes=new WeakMap();
 const styleKeys=['transform','width','height','fontSize','color','backgroundColor','borderRadius','objectFit','maxWidth','backgroundImage','backgroundSize','backgroundPosition','whiteSpace'];
 function remember(el){let record=records.get(el);if(!record){record={styles:Object.fromEntries(styleKeys.map(k=>[k,el.style[k]])),text:el.textContent,children:[...el.childNodes].map(n=>n.cloneNode(true)),src:el.getAttribute('src'),applied:false};records.set(el,record);}return record;}
 function restore(el,record){for(const [k,v]of Object.entries(record.styles))el.style[k]=v;if(record.changedText)el.replaceChildren(...record.children.map(n=>n.cloneNode(true)));if(record.changedSrc){if(record.src===null)el.removeAttribute('src');else el.setAttribute('src',record.src);}record.applied=false;record.changedText=false;record.changedSrc=false;}
 function annotate(doc){for(const [id,spec]of Object.entries(definitions))for(const el of doc.querySelectorAll(spec.selector))el.dataset.koviumGlobal=id;}
 function apply(doc,value={}){
  const clean=sanitize(value);const root=doc.documentElement;
  if(!themes.has(root))themes.set(root,Object.fromEntries(['--red','--red-hover','--card','--bg','--text','--muted'].map(k=>[k,root.style.getPropertyValue(k)])));
  for(const [k,v]of Object.entries(themes.get(root)))if(v)root.style.setProperty(k,v);else root.style.removeProperty(k);
  for(const [key,variable]of Object.entries({accent:'--red',surface:'--card',background:'--bg',text:'--text',muted:'--muted'}))if(clean.theme[key])root.style.setProperty(variable,clean.theme[key]);
  if(clean.theme.accent)root.style.setProperty('--red-hover',clean.theme.accent);
  for(const [id,spec]of Object.entries(definitions))for(const el of doc.querySelectorAll(spec.selector)){
   const prior=records.get(el),e=clean.elements[id];if(prior?.applied)restore(el,prior);if(!e)continue;const record=remember(el);
   // Capture live base captions before first customization; dynamic account status is excluded from the registry.
   if(!record.changedText){record.text=el.textContent;record.children=[...el.childNodes].map(n=>n.cloneNode(true));}
   if(e.text!==undefined){el.textContent=e.text;record.changedText=true;if(spec.multiline)el.style.whiteSpace='pre-line';}
   if(e.src!==undefined){if(spec.background){el.style.backgroundImage='url('+JSON.stringify(e.src)+')';el.style.backgroundSize='cover';el.style.backgroundPosition='center';}else{el.setAttribute('src',e.src);record.changedSrc=true;el.style.objectFit='contain';el.style.maxWidth='none';}}
   if(e.x!==undefined||e.y!==undefined)el.style.transform='translate('+(e.x||0)+'px,'+(e.y||0)+'px)';
   for(const key of ['width','height','fontSize','borderRadius'])if(e[key]!==undefined)el.style[key]=e[key]+'px';
   for(const key of ['color','backgroundColor'])if(e[key]!==undefined)el.style[key]=e[key];record.applied=true;
  }
  annotate(doc);return clean;
 }
 return Object.freeze({definitions,sanitize,apply,annotate,reset:doc=>apply(doc,{})});
});
