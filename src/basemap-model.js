// Image bytes live outside mutable documents and undo snapshots.
(()=>{
'use strict';const M=window.StudioModel,validate=M.validate,assets=new Map(),persisted=new Set();let database;
const MAX_BYTES=28*1024*1024,MAX_PROJECT_BYTES=64*1024*1024;
function references(p){return [...new Set((p.documents||[]).flatMap(d=>[d.basemap,...(d.images||[])].filter(Boolean)).map(b=>b.assetId))]}
function checkAsset(id,a){
 if(!/^img-[\w-]{1,100}$/.test(id)||!a||typeof a.data!=='string'||a.data.length>MAX_BYTES||!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(a.data)||!Number.isInteger(a.width)||!Number.isInteger(a.height)||a.width<1||a.height<1||a.width>8192||a.height>8192||a.width*a.height>32*1024*1024)throw Error('底图数据无效或超过图片大小限制');
 const mime=a.data.slice(5,a.data.indexOf(';')),head=atob(a.data.slice(a.data.indexOf(',')+1).slice(0,24));
 if(mime==='image/png'&&!head.startsWith('\x89PNG\r\n\x1a\n')||mime==='image/jpeg'&&!head.startsWith('\xff\xd8\xff')||mime==='image/webp'&&!(head.startsWith('RIFF')&&head.slice(8,12)==='WEBP'))throw Error('图片格式与内容不一致');
 return {id,data:a.data,width:a.width,height:a.height,mime};
}
function remember(a){const previous=assets.get(a.id);if(previous&&(previous.data!==a.data||previous.width!==a.width||previous.height!==a.height))throw Error('工程图片标识重复或尺寸与内容不一致，请重新导出完整工程');if(!previous)assets.set(a.id,a);return assets.get(a.id)}
function openDatabase(){
 if(database)return database;
 database=new Promise((resolve,reject)=>{
  if(!window.indexedDB){reject(Error('当前浏览器不能暂存图片，请使用本地网页版或允许浏览器存储后重试'));return}
  const request=indexedDB.open('level-diagram-studio-images',1);
  request.onupgradeneeded=()=>request.result.createObjectStore('images',{keyPath:'id'});
  request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(Error('图片存储不可用，请检查浏览器存储权限'));request.onblocked=()=>reject(Error('图片存储被其他页面占用，请关闭旧页面后重试'));
 }).catch(e=>{database=null;throw e});return database;
}
async function decoded(a){
 if(a.checked)return;if(a.decoding)return a.decoding;
 a.decoding=new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>{if(img.naturalWidth!==a.width||img.naturalHeight!==a.height){reject(Error('底图尺寸与图片内容不一致'));return}a.checked=true;resolve()};img.onerror=()=>reject(Error('底图无法解码，请重新选择有效的 JPG、PNG 或 WebP 图片'));img.src=a.data});
 try{await a.decoding}finally{delete a.decoding}
}
async function storeAsset(a){
 if(persisted.has(a.id))return;if(a.storing)return a.storing;
 a.storing=(async()=>{await decoded(a);const db=await openDatabase();await new Promise((resolve,reject)=>{const tx=db.transaction('images','readwrite');tx.objectStore('images').put({id:a.id,data:a.data,width:a.width,height:a.height});tx.oncomplete=resolve;tx.onerror=()=>reject(Error('图片暂存失败，可能是浏览器存储空间不足；请缩小图片后重试'));tx.onabort=()=>reject(Error('图片暂存未完成，请重试'))});persisted.add(a.id)})();
 try{await a.storing}finally{delete a.storing}
}
async function loadAsset(id){
 if(assets.has(id))return assets.get(id);const db=await openDatabase(),a=await new Promise((resolve,reject)=>{const r=db.transaction('images').objectStore('images').get(id);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(Error('无法读取已暂存的底图'))});
 if(!a)throw Error('图片暂存缺失，请重新打开包含图片的完整工程文件');const result=remember(checkAsset(id,a));persisted.add(id);await decoded(result);return result;
}
async function add(data,width,height){const a=remember(checkAsset('img-'+M.uid(),{data,width,height}));try{await storeAsset(a);return a.id}catch(e){assets.delete(a.id);throw e}}
function href(id,embedded=false){const a=assets.get(id);if(!a)return '';if(embedded||!URL.createObjectURL)return a.data;if(!a.url){const raw=atob(a.data.slice(a.data.indexOf(',')+1)),bytes=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);a.url=URL.createObjectURL(new Blob([bytes],{type:a.mime}))}return a.url}
function pack(p){const result=M.clone(p),ids=references(p);if(!ids.length)return result;const table={};let bytes=0;for(const id of ids){const a=assets.get(id);if(!a)throw Error('底图尚未恢复，请等待后再下载工程');bytes+=a.data.length;table[id]={data:a.data,width:a.width,height:a.height}}if(bytes>MAX_PROJECT_BYTES)throw Error('工程图片总量过大，请缩小图片或拆分图稿后保存');result.version=10;result.assets=table;return result}
async function ensureProject(p){const results=await Promise.allSettled(references(p).map(async id=>storeAsset(await loadAsset(id))));const failure=results.find(r=>r.status==='rejected');if(failure)throw failure.reason}
async function restoreProject(p){await Promise.all(references(p).map(loadAsset))}
async function unpack(input){
 if(references(input).length&&!input.assets)throw Error('工程缺少图片内容，请使用“下载工程”生成的完整 JSON 文件');
 const added=Object.keys(input.assets||{}).filter(id=>!assets.has(id));try{const p=M.validate(input);await ensureProject(p);return p}catch(e){
  // A rejected import must not poison a later corrected import with the same ID.
  for(const id of added){const a=assets.get(id);if(a?.url)URL.revokeObjectURL(a.url);assets.delete(id);persisted.delete(id)}throw e;
 }
}
function corners(d){const b=d?.basemap;if(!b)return [];const angle=b.rotation*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle),cx=b.x+b.width/2,cy=b.y+b.height/2;const [u,v,w,h]=b.crop||[0,0,1,1];return [[u-.5,v-.5],[u+w-.5,v-.5],[u+w-.5,v+h-.5],[u-.5,v+h-.5]].map(([x,y])=>[x*b.width,y*b.height]).map(([x,y])=>[cx+x*c-y*s,cy+x*s+y*c])}
function bounds(d){const ps=corners(d);if(!ps.length)return null;const xs=ps.map(p=>p[0]),ys=ps.map(p=>p[1]);return {x:Math.min(...xs),y:Math.min(...ys),w:Math.max(...xs)-Math.min(...xs),h:Math.max(...ys)-Math.min(...ys)}}
M.validate=input=>{
 const clean={...input};delete clean.assets;if(clean.version===9||clean.version===10)clean.version=8;
 const p=validate(clean);for(const d of p.documents)for(const b of [d.basemap,...(d.images||[])]){if(b===undefined)continue;
  if(d.type!=='space'||!b||typeof b!=='object'||Array.isArray(b)||!/^img-[\w-]{1,100}$/.test(b.assetId)||!['x','y','width','height','rotation','opacity'].every(k=>Number.isFinite(b[k]))||Math.abs(b.x)>1e6||Math.abs(b.y)>1e6||b.width<.01||b.height<.01||b.width>1e6||b.height>1e6||Math.abs(b.rotation)>360000||b.opacity<0||b.opacity>1||typeof b.visible!=='boolean')throw Error('底图位置、尺寸或显示设置无效');
 }
 for(const d of p.documents){if(d.images!==undefined&&(!Array.isArray(d.images)||d.images.length>29))throw Error('每张图稿最多30张图片');for(const b of [d.basemap,...(d.images||[])].filter(Boolean)){if(b.id!==undefined&&!/^[\w-]{1,100}$/.test(b.id)||b.name!==undefined&&(typeof b.name!=='string'||b.name.length>300))throw Error('图片标识或名称无效');if(b.crop&&(!Array.isArray(b.crop)||b.crop.length!==4||!b.crop.every(Number.isFinite)||b.crop[0]<0||b.crop[1]<0||b.crop[2]<=0||b.crop[3]<=0||b.crop[0]+b.crop[2]>1.000001||b.crop[1]+b.crop[3]>1.000001))throw Error('图片裁切范围无效')}}
 if(input?.assets!==undefined){if(!input.assets||typeof input.assets!=='object'||Array.isArray(input.assets)||Object.keys(input.assets).length>30)throw Error('工程图片列表无效');const incoming=Object.entries(input.assets).map(([id,a])=>checkAsset(id,a));if(incoming.reduce((n,a)=>n+a.data.length,0)>MAX_PROJECT_BYTES)throw Error('工程图片总量超过限制');for(const id of references(p))if(!Object.hasOwn(input.assets,id))throw Error('工程缺少底图图片内容');for(const a of incoming){const old=assets.get(a.id);if(old&&old.data!==a.data)throw Error('工程图片标识重复')}incoming.forEach(remember)}
 if(references(p).reduce((n,id)=>n+(assets.get(id)?.data.length||0),0)>MAX_PROJECT_BYTES)throw Error('工程图片总量超过限制，请缩小图片后重试');
 if(references(p).length)p.version=(p.documents.some(d=>d.images?.length||d.basemap?.crop))?10:9;return p;
};
function images(d){return [d?.basemap,...(d?.images||[])].filter(Boolean)}
function allBounds(d,visible=true){const a=images(d).filter(b=>!visible||b.visible).map(b=>bounds({basemap:b}));if(!a.length)return null;const x=Math.min(...a.map(b=>b.x)),y=Math.min(...a.map(b=>b.y));return {x,y,w:Math.max(...a.map(b=>b.x+b.w))-x,h:Math.max(...a.map(b=>b.y+b.h))-y}}
Object.assign(M,{images,basemapBounds:allBounds,imageBounds:b=>bounds({basemap:b}),basemapCorners:corners});
window.StudioImages={add,get:id=>assets.get(id),href,pack,unpack,ensureProject,restoreProject,references,isReady:p=>references(p).every(id=>persisted.has(id)&&assets.has(id))};
})();
