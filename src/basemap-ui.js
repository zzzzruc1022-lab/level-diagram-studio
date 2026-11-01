// Image transforms reuse the toolbar and keep raster data out of geometry.
let basemapUIReady=false,basemapMode=null,basemapDrag=null,basemapLoading=false,basemapFrame=0,basemapPointer=null;
let imageSelected=null,imageLastView='plan';
function activeImage(){return M.images(doc()).find(b=>(b.id||b.assetId)===imageSelected)}
const basemapDetails=new Map();
function basemapInteractionActive(){return !!basemapMode}
function basemapPoint(b,x,y){const a=b.rotation*Math.PI/180,c=Math.cos(a),s=Math.sin(a),cx=b.x+b.width/2,cy=b.y+b.height/2;return [cx+x*c-y*s,cy+x*s+y*c]}
function basemapCorners(b){return M.basemapCorners({basemap:b})}
function basemapInside(b,q){return M.inside(q,basemapCorners(b))}
function basemapCanStart(){if(drag||editing||rowRename||drawing?.points?.length){status('请先完成或取消当前绘制、拖动或文字编辑。');return false}return !!activeImage()&&view.mode==='plan'}
function basemapChanged(fn,message){return mutate(fn,message)}
function basemapShowSettings(){if(typeof openWorkspacePanel==='function')openWorkspacePanel('properties');else{panel='properties';render()}$('#basemap-settings')?.scrollIntoView({block:'nearest'})}
function basemapStart(kind){if(!basemapCanStart())return;finishEditing();tool='select';drawing=null;placementGhost=null;basemapMode={docId:current,kind,points:[]};basemapShowSettings();render();status(kind==='calibrate'?'在底图上点击已知距离的两个端点；不需要校准时按 Esc 返回。':'调整底图：拖动移动，拖角等比缩放，拖圆点旋转；Esc 返回绘图。')}
function cancelBasemapInteraction(){
 if(basemapFrame)cancelAnimationFrame(basemapFrame);basemapFrame=0;basemapPointer=null;
 if(basemapDrag){const target=project.documents.find(d=>d.id===basemapDrag.docId);if(target){const b=M.images(target).find(b=>(b.id||b.assetId)===imageSelected);if(b)Object.assign(b,M.clone(basemapDrag.original))};if(canvas.hasPointerCapture?.(basemapDrag.pointerId))canvas.releasePointerCapture(basemapDrag.pointerId)}
 basemapDrag=null;basemapMode=null;imageSelected=null;canvas.classList.remove('basemap-adjusting');if(basemapUIReady){render();canvasFocus()}
}
function finishBasemapGesture(cancel=false){
 if(!basemapDrag)return;const a=basemapDrag;basemapDrag=null;if(basemapFrame)cancelAnimationFrame(basemapFrame);basemapFrame=0;basemapPointer=null;
 if(doc()?.id===a.docId){if(cancel)Object.assign(activeImage(),M.clone(a.original));else{try{M.validate(project);if(a.changed)history(a.before)}catch(e){Object.assign(activeImage(),M.clone(a.original));status(e.message)}}}
 if(canvas.hasPointerCapture?.(a.pointerId))canvas.releasePointerCapture(a.pointerId);render();
}
function drawBasemapHandles(){
 let layer=$('#basemap-handles');if(!layer){layer=document.createElementNS('http://www.w3.org/2000/svg','g');layer.id='basemap-handles';canvas.append(layer)}
 layer.replaceChildren();const b=activeImage();if(!basemapMode||basemapMode.docId!==current||view.mode!=='plan'||!b||!b.visible)return;
 const k=pixel(),points=basemapCorners(b),path=R.path(points,true);let markup=`<path d="${path}" fill="${basemapMode.kind==='adjust'?'transparent':'none'}" stroke="white" stroke-width="${4*k}" pointer-events="${basemapMode.kind==='adjust'?'all':'none'}"/><path d="${path}" fill="none" stroke="var(--ui-accent)" stroke-width="${1.5*k}" stroke-dasharray="${6*k} ${4*k}" pointer-events="none"/>`;
 if(basemapMode.kind==='adjust'){
  if(tool==='size')points.forEach((p,i)=>markup+=`<rect data-basemap-handle="size" data-basemap-corner="${i}" x="${p[0]-6*k}" y="${p[1]-6*k}" width="${12*k}" height="${12*k}" rx="${2*k}" fill="white" stroke="var(--ui-accent)" stroke-width="${2*k}" style="cursor:${i%2?'nesw':'nwse'}-resize"/>`);
  const top=M.mul(M.add(points[0],points[1]),.5),angle=b.rotation*Math.PI/180,rotate=M.add(top,[Math.sin(angle)*30*k,-Math.cos(angle)*30*k]);if(tool==='rotate')markup+=`<path d="M ${top} L ${rotate}" stroke="var(--ui-accent)" stroke-width="${1.5*k}" pointer-events="none"/><circle data-basemap-handle="rotate" cx="${rotate[0]}" cy="${rotate[1]}" r="${7*k}" fill="white" stroke="var(--ui-accent)" stroke-width="${2*k}" style="cursor:grab"/>`;
 }else{const p=basemapMode.points;if(p.length>1)markup+=`<path d="${R.path(p)}" fill="none" stroke="white" stroke-width="${5*k}"/><path d="${R.path(p)}" fill="none" stroke="var(--ui-accent)" stroke-width="${2*k}"/>`;p.forEach((q,i)=>markup+=`<circle cx="${q[0]}" cy="${q[1]}" r="${6*k}" fill="var(--ui-accent)" stroke="white" stroke-width="${2*k}"/><text x="${q[0]+10*k}" y="${q[1]-10*k}" font-size="${14*k}" fill="var(--ui-accent)" stroke="white" stroke-width="${3*k}" paint-order="stroke" pointer-events="none">${i+1}</text>`)}
 layer.innerHTML=markup;canvas.style.cursor=basemapMode.kind==='calibrate'?'crosshair':basemapDrag?'grabbing':'move';
}
function basemapPanel(){
 const d=doc();if(d?.type!=='space')return '';const b=activeImage(),a=b&&window.StudioImages.get(b.assetId),active=basemapMode?.docId===current,unit=M.metric(d)?'m':R.esc(d.unit||'单位'),factor=M.metric(d)?M.scaleConfig(d).metersPerUnit:1;
 return `<section id="basemap-settings" aria-labelledby="basemap-title"><h2 id="basemap-title">图片底图</h2>${b?`<label class="field">名称<input data-image-name maxlength="300" value="${R.esc(b.name||'图片')}"></label><p class="basemap-summary">${a?`${a.width} × ${a.height} 像素`:'图片正在载入'} · 仅平面图显示</p><label class="check"><input data-basemap-field="visible" type="checkbox" ${b.visible?'checked':''}>显示底图</label><label class="field">不透明度 / %<input data-basemap-field="opacity" type="number" min="5" max="100" step="5" value="${Math.round(b.opacity*100)}"></label><div class="basemap-buttons"><button type="button" data-image-crop>裁切图片</button><button type="button" data-image-reset-crop>恢复完整图片</button><button type="button" data-basemap-action="remove" class="danger">移除底图</button></div><details id="basemap-size-details"><summary>可选：手动设置尺寸</summary><div class="basemap-size-fields"><label class="field">宽度 / ${unit}<input data-basemap-field="width" type="number" step="any" min="${.01*factor}" value="${+(b.width*(b.crop?.[2]||1)*factor).toFixed(6)}"></label><label class="field">高度 / ${unit}<input data-basemap-field="height" type="number" step="any" min="${.01*factor}" value="${+(b.height*(b.crop?.[3]||1)*factor).toFixed(6)}"></label></div><small>修改宽或高时保持图片比例，裁切后按可见区域计算。未按实际距离校准时，米数仅按当前工程比例换算。</small><label class="field">旋转 / °<input data-basemap-field="rotation" type="number" step="1" value="${+b.rotation.toFixed(3)}"></label><button type="button" data-basemap-action="fit">重新适应画布大小</button></details><details id="basemap-distance-details" ${active&&basemapMode.kind==='calibrate'?'open':''}><summary>可选：按已知距离校准</summary><small>不知道实际距离也可以直接标注。校准只调整底图，建议先校准再标注。</small><button type="button" data-basemap-action="calibrate" ${!b.visible||view.mode!=='plan'?'disabled':''}>在底图上点两个端点</button>${active&&basemapMode.kind==='calibrate'?`<p class="basemap-calibration-count">已选 ${basemapMode.points.length} / 2 个端点</p><label class="field">两点之间的实际距离 / m<input id="basemap-known-distance" type="number" min="0.000001" step="any" placeholder="例如 40" ${basemapMode.points.length<2?'disabled':''}></label>${!M.metric(d)?'<label class="check"><input id="basemap-enable-metric" type="checkbox">同时启用比例尺</label>':''}<button type="button" data-basemap-action="apply-calibration" ${basemapMode.points.length<2?'disabled':''}>应用校准</button><small id="basemap-calibration-error" role="status"></small>`:''}</details>${view.mode!=='plan'?'<p class="basemap-view-note">底图在立面和立体图隐藏；切回平面图即可调整。</p>':''}`:`<p class="basemap-summary">导入平面图，在图上添加路线、文字和组件。</p><button type="button" data-basemap-action="import" ${basemapLoading?'disabled':''}>${basemapLoading?'正在导入…':'导入图片底图'}</button><small>支持 JPG、PNG、WebP。导入后直接使用，不必填写实际尺寸。</small>`}</section>`;
}
const basemapDocumentInspector=documentInspector;
documentInspector=function(){
 const prior=$('#basemap-settings');if(prior){basemapDetails.set(prior.dataset.document,[...prior.querySelectorAll('details[open]')].map(e=>e.id));if(basemapMode?.kind==='calibrate'&&prior.dataset.document===basemapMode.docId){basemapMode.distance=$('#basemap-known-distance')?.value||'';basemapMode.enableMetric=$('#basemap-enable-metric')?.checked||false}}
 basemapDocumentInspector();if(!basemapUIReady)return;if(activeImage())$('#properties').innerHTML=basemapPanel();const next=$('#basemap-settings');if(!next)return;next.dataset.document=current;for(const id of basemapDetails.get(current)||[])next.querySelector('#'+id)?.setAttribute('open','');if(basemapMode?.kind==='calibrate'&&$('#basemap-known-distance')){$('#basemap-known-distance').value=basemapMode.distance||'';const enable=$('#basemap-enable-metric');if(enable)enable.checked=!!basemapMode.enableMetric}
};
const basemapRender=render;
render=function(keep=false){
 if(basemapMode&&(basemapMode.docId!==current||view.mode!=='plan'||!activeImage())){if(basemapDrag){const target=project.documents.find(d=>d.id===basemapDrag.docId);if(target){const b=M.images(target).find(b=>(b.id||b.assetId)===imageSelected);if(b)Object.assign(b,M.clone(basemapDrag.original))};if(canvas.hasPointerCapture?.(basemapDrag.pointerId))canvas.releasePointerCapture(basemapDrag.pointerId)}basemapMode=null;basemapDrag=null}
 basemapRender(keep);if(basemapUIReady)refreshBasemapUI();
};
function refreshBasemapUI(){
 const importButton=$('#import-basemap');if(importButton){importButton.hidden=doc()?.type==='curve'||view.mode!=='plan';importButton.disabled=!doc()||basemapLoading||!!drag||!!drawing?.points?.length}
 const hint=$('#basemap-mode-hint');hint.hidden=!basemapMode;
 if(basemapMode){hint.querySelector('span').textContent=basemapMode.kind==='adjust'?'调整底图 · 拖动移动 · 拖角等比缩放 · 拖圆点旋转':'校准底图 · 点击两个端点后，在右侧填写实际距离';canvas.classList.add('basemap-adjusting')}else canvas.classList.remove('basemap-adjusting');drawBasemapHandles();
}
function basemapFitRect(d,w,h){const area=M.boundary(d)||{width:d.width,height:d.height},factor=Math.min(area.width/w,area.height/h)*.96;return {x:(area.width-w*factor)/2,y:(area.height-h*factor)/2,width:w*factor,height:h*factor}}
function basemapKnownDistance(){
 const input=$('#basemap-known-distance'),note=$('#basemap-calibration-error'),value=Number(input?.value),d=doc(),b=activeImage(),p=basemapMode?.points;
 if(!b||!p||p.length!==2)return;const length=Math.hypot(p[1][0]-p[0][0],p[1][1]-p[0][1]),ratio=value/(length*M.scaleConfig(d).metersPerUnit);
 if(!input.value||!Number.isFinite(ratio)||ratio<=0||Math.max(b.width,b.height)*ratio>500000||Math.min(b.width,b.height)*ratio<.01){note.textContent='请输入有效的正距离，校准后的底图尺寸须在可用范围内。';input.setAttribute('aria-invalid','true');return}
 const enabled=$('#basemap-enable-metric')?.checked,anchor=p[0],cx=b.x+b.width/2,cy=b.y+b.height/2;
 const ok=basemapChanged(()=>{b.width*=ratio;b.height*=ratio;b.x=anchor[0]+(cx-anchor[0])*ratio-b.width/2;b.y=anchor[1]+(cy-anchor[1])*ratio-b.height/2;if(enabled)d.scaleSettings={...M.scaleConfig(d),enabled:true}},'底图距离已校准；其他组件与工程标定保持不变。');
 if(ok){basemapMode=null;render();basemapShowSettings()}
}
function basemapImageChoice(width,height){
 const dialog=$('#basemap-resolution-dialog'),factor=Math.min(1,4096/Math.max(width,height));dialog.querySelector('p').textContent=`图片为 ${width} × ${height} 像素。推荐使用 ${Math.round(width*factor)} × ${Math.round(height*factor)} 的副本，减小工程体积；原图片文件不变。`;
 return new Promise(resolve=>{let done=false;const finish=value=>{if(done)return;done=true;dialog.close();dialog.removeEventListener('click',click);dialog.removeEventListener('cancel',cancel);dialog.removeEventListener('close',closed);resolve(value)},click=e=>{const b=e.target.closest('[data-image-resolution]');if(b)finish(b.dataset.imageResolution)},cancel=e=>{e.preventDefault();finish('cancel')},closed=()=>finish('cancel');dialog.addEventListener('click',click);dialog.addEventListener('cancel',cancel);dialog.addEventListener('close',closed);dialog.showModal()});
}
async function basemapReadFile(file){
 if(file.size>20*1024*1024)throw Error('图片超过20 MB，请先缩小后再导入。');const bytes=new Uint8Array(await file.arrayBuffer());
 const mime=bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71?'image/png':bytes[0]===255&&bytes[1]===216&&bytes[2]===255?'image/jpeg':String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP'?'image/webp':null;
 if(!mime)throw Error('请选择 JPG、PNG 或 WebP 静态图片。');
 let data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).replace(/^data:[^;]*;/,'data:'+mime+';'));reader.onerror=()=>reject(Error('图片读取失败，请重新选择。'));reader.readAsDataURL(file)});
 const image=await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(Error('图片无法解码，请确认文件未损坏。'));img.src=data});let width=image.naturalWidth,height=image.naturalHeight;
 if(!width||!height||Math.max(width,height)>8192||width*height>32e6)throw Error('图片尺寸过大，请先缩小到最长边8192像素以内、总像素3200万以内。');
 if(Math.max(width,height)>4096||width*height>16e6){const choice=await basemapImageChoice(width,height);if(choice==='cancel')return null;if(choice==='smaller'){const factor=Math.min(1,4096/Math.max(width,height)),c=document.createElement('canvas');c.width=Math.round(width*factor);c.height=Math.round(height*factor);const ctx=c.getContext('2d');if(!ctx)throw Error('当前浏览器无法缩小图片。');ctx.drawImage(image,0,0,c.width,c.height);data=c.toDataURL(mime==='image/jpeg'?'image/jpeg':'image/png',.92);width=c.width;height=c.height}}
 return {data,width,height};
}
async function importBasemap(file){
 if(!file||basemapLoading)return;if(drag||basemapDrag||editing||drawing?.points?.length){status('请先完成或取消当前编辑，再导入底图。');return}if(doc()?.type==='curve'){status('图片底图用于空间图的平面视图，请先切换或新建空间图。');return}
 const targetId=current,sourceProject=project;basemapLoading=true;refreshBasemapUI();
 try{const read=await basemapReadFile(file);if(!read)return;if(project!==sourceProject||current!==targetId)throw Error('图稿已切换，本次图片导入已取消。');const assetId=await window.StudioImages.add(read.data,read.width,read.height);if(project!==sourceProject||current!==targetId)throw Error('图稿已切换，本次图片导入已取消。');
  if(!doc())createDocument('space','图片标注');const d=doc(),old=d.basemap,next={id:M.uid(),name:file.name,assetId,...basemapFitRect(d,read.width,read.height),rotation:0,opacity:1,visible:true};
  const ok=basemapChanged(()=>{if(M.images(d).length>=30)throw Error('每张图稿最多30张图片');if(!d.basemap)d.basemap=next;else(d.images??=[]).push(next)},'图片底图已导入，可直接标注；实际尺寸和距离校准均为可选。');if(ok){view.mode='plan';selectImage(next.id);if(!old)fit();}
 }catch(e){status('底图导入失败：'+e.message)}finally{basemapLoading=false;refreshBasemapUI()}
}
function basemapVisibleCenter(b){const ps=basemapCorners(b);return M.mul(M.add(ps[0],ps[2]),.5)}
function rotateBasemap(b,angle){const center=basemapVisibleCenter(b),[u,v,w,h]=b.crop||[0,0,1,1],x=(u+w/2-.5)*b.width,y=(v+h/2-.5)*b.height,a=angle*Math.PI/180;b.rotation=(angle%360+360)%360;b.x=center[0]-x*Math.cos(a)+y*Math.sin(a)-b.width/2;b.y=center[1]-x*Math.sin(a)-y*Math.cos(a)-b.height/2}
function updateBasemapPointer(e){
 const a=basemapDrag,b=activeImage();if(!a||!b||current!==a.docId)return;const q=point(e),old=a.original,cx=old.x+old.width/2,cy=old.y+old.height/2;
 if(!a.changed&&Math.hypot(...M.sub(q,a.start))<pixel()*3)return;a.changed=true;
 if(a.kind==='move'){b.x=old.x+q[0]-a.start[0];b.y=old.y+q[1]-a.start[1]}
 else if(a.kind==='rotate'){let angle=(Math.atan2(q[1]-basemapVisibleCenter(old)[1],q[0]-basemapVisibleCenter(old)[0])-a.startAngle)*180/Math.PI+old.rotation;if(e.shiftKey)angle=Math.round(angle/15)*15;Object.assign(b,M.clone(old));rotateBasemap(b,angle)}
 else{const v=M.sub(a.corner,a.anchor),ratio=clamp(M.dot(M.sub(q,a.anchor),v)/M.dot(v,v),Math.max(.01/old.width,.01/old.height),Math.min(500000/old.width,500000/old.height));b.width=old.width*ratio;b.height=old.height*ratio;b.x=a.anchor[0]+(cx-a.anchor[0])*ratio-b.width/2;b.y=a.anchor[1]+(cy-a.anchor[1])*ratio-b.height/2}
 drawCanvas();
}
function initBasemapUI(){
 const button=document.createElement('button');button.id='import-basemap';button.type='button';button.dataset.basemapAction='import';button.textContent='导入底图';button.title='插入图片';button.innerHTML='<span><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="m3 17 6-6 5 5 3-3 4 4"/><circle cx="16" cy="8" r="2"/></svg></span><span class="tool-label">插入</span>';$('#tool-host .tool-grid').append(button);
 const input=document.createElement('input');input.type='file';input.id='basemap-file-input';input.accept='.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp';input.hidden=true;input.addEventListener('change',()=>importBasemap(input.files[0]));document.body.append(input);
 const hint=document.createElement('div');hint.id='basemap-mode-hint';hint.hidden=true;hint.innerHTML='<span></span><button type="button" data-basemap-action="finish">返回绘图</button>';stage.append(hint);
 const dialog=document.createElement('dialog');dialog.id='basemap-resolution-dialog';dialog.setAttribute('aria-labelledby','basemap-resolution-title');dialog.innerHTML='<h2 id="basemap-resolution-title">选择图片清晰度</h2><p></p><div class="basemap-buttons"><button type="button" data-image-resolution="smaller" class="primary">推荐缩小副本</button><button type="button" data-image-resolution="original">保留原图</button><button type="button" data-image-resolution="cancel">取消</button></div>';document.body.append(dialog);
 document.addEventListener('click',e=>{
  const action=e.target.closest('[data-basemap-action]')?.dataset.basemapAction;
  if(!action)return;e.preventDefault();e.stopImmediatePropagation();
  if(action==='import'){input.value='';input.click();return}if(action==='finish'){cancelBasemapInteraction();return}const b=activeImage();if(!b)return;
  if(action==='adjust'||action==='calibrate'){basemapStart(action);return}if(action==='apply-calibration'){basemapKnownDistance();return}
  if(action==='remove'){const id=imageSelected;basemapMode=null;basemapChanged(()=>{const d=doc();if((d.basemap?.id||d.basemap?.assetId)===id){d.basemap=d.images?.shift();if(!d.basemap)delete d.basemap}else d.images=d.images.filter(b=>(b.id||b.assetId)!==id);imageSelected=null},'已移除底图；组件和标注保留，可撤销。');return}
  if(action==='fit'){const a=window.StudioImages.get(b.assetId);if(a)basemapChanged(()=>Object.assign(b,basemapFitRect(doc(),a.width,a.height),{rotation:0}),'底图已重新适应画布；组件位置保持不变。');return}
 },true);
 document.addEventListener('change',e=>{const input=e.target,key=input.dataset.basemapField;if(!key)return;e.stopImmediatePropagation();const b=activeImage();if(!b)return;
  if(key==='visible'){basemapChanged(()=>{b.visible=input.checked});return}const value=Number(input.value);if(!input.value||!Number.isFinite(value)){status('请输入有效数字。');render();return}
  if(key==='opacity'){basemapChanged(()=>{b.opacity=clamp(value/100,.05,1)});return}if(key==='rotation'){basemapChanged(()=>rotateBasemap(b,value));return}
  const factor=M.metric(doc())?M.scaleConfig(doc()).metersPerUnit:1,size=value/factor,ratio=size/(b[key]*(b.crop?.[key==='width'?2:3]||1)),center=basemapVisibleCenter(b); if(size<=0||Math.max(b.width,b.height)*ratio>500000||Math.min(b.width,b.height)*ratio<.01){status('底图尺寸超出可用范围，已恢复原值。');render();return}basemapChanged(()=>{b.width*=ratio;b.height*=ratio;const next=basemapVisibleCenter(b);b.x+=center[0]-next[0];b.y+=center[1]-next[1]});
 },true);
 document.addEventListener('pointerdown',e=>{
  if(!basemapMode||!canvas.contains(e.target)||e.button!==0||space)return;if(basemapMode.kind==='adjust'&&tool==='select'&&!e.target.closest('[data-basemap-handle]')){imageSelected=null;basemapMode=null;render();return}e.preventDefault();e.stopImmediatePropagation();const b=activeImage();if(!b)return;const q=point(e),handle=e.target.closest('[data-basemap-handle]');
  if(basemapMode.kind==='calibrate'){if(!basemapInside(b,q)){status('请在底图内选择已知距离的端点。');return}if(basemapMode.points.length===2)basemapMode.points=[];if(basemapMode.points.length&&Math.hypot(...M.sub(q,basemapMode.points[0]))<pixel()*3)return;basemapMode.points.push(q);render();if(basemapMode.points.length===2){basemapShowSettings();$('#basemap-known-distance')?.focus({preventScroll:true})}return}
  if(!handle&&!basemapInside(b,q))return;if(!handle&&tool!=='move')return;const points=basemapCorners(b),kind=handle?.dataset.basemapHandle||'move',corner=Number(handle?.dataset.basemapCorner||0);basemapDrag={docId:current,kind,original:M.clone(b),before:snapshot(),start:q,pointerId:e.pointerId,corner:points[corner],anchor:points[(corner+2)%4],startAngle:Math.atan2(q[1]-basemapVisibleCenter(b)[1],q[0]-basemapVisibleCenter(b)[0])};canvas.setPointerCapture?.(e.pointerId);drawBasemapHandles();
 },true);
 document.addEventListener('pointermove',e=>{if(!basemapDrag)return;e.preventDefault();e.stopImmediatePropagation();basemapPointer=e;if(!basemapFrame)basemapFrame=requestAnimationFrame(()=>{basemapFrame=0;const last=basemapPointer;basemapPointer=null;if(last)updateBasemapPointer(last)})},true);
 document.addEventListener('pointerup',e=>{if(!basemapDrag)return;e.preventDefault();e.stopImmediatePropagation();if(basemapPointer)updateBasemapPointer(e);finishBasemapGesture()},true);
 document.addEventListener('pointercancel',()=>finishBasemapGesture(true),true);
 document.addEventListener('contextmenu',e=>{if(basemapMode&&canvas.contains(e.target)){e.preventDefault();e.stopImmediatePropagation();cancelBasemapInteraction()}},true);
 document.addEventListener('keydown',e=>{
  if(!dialog.open&&basemapMode&&e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();if(basemapDrag)finishBasemapGesture(true);else cancelBasemapInteraction();return}
  if(e.target.closest('#basemap-settings,#basemap-resolution-dialog,#basemap-mode-hint')){if(e.key==='Enter'&&e.target.id==='basemap-known-distance'){e.preventDefault();basemapKnownDistance()}if(e.key!=='Escape')e.stopImmediatePropagation()}
  else if(basemapMode&&!e.target.closest('input,textarea,select,[contenteditable="true"]')&&!document.querySelector('dialog[open]')){const mod=e.ctrlKey||e.metaKey,k=e.key.toLowerCase();if(mod&&['z','y','s'].includes(k)){cancelBasemapInteraction();return}if(!mod&&!e.altKey&&toolKey(e)){cancelBasemapInteraction();return}if(e.code==='Space'||e.key==='Tab'||['Shift','Control','Alt','Meta'].includes(e.key))return;e.preventDefault();e.stopImmediatePropagation();if(['Delete','Backspace'].includes(e.key))status('调整底图时不会删除组件。可在右侧移除底图，或按 Esc 返回绘图。')}
 },true);
 stage.addEventListener('dragover',e=>{if(e.dataTransfer?.types.includes('Files')){e.preventDefault();e.dataTransfer.dropEffect='copy';stage.classList.add('basemap-drop-target')}});
 stage.addEventListener('dragleave',e=>{if(!stage.contains(e.relatedTarget))stage.classList.remove('basemap-drop-target')});
 stage.addEventListener('drop',e=>{if(!e.dataTransfer?.files.length)return;e.preventDefault();e.stopPropagation();stage.classList.remove('basemap-drop-target');if(e.dataTransfer.files.length!==1){status('请一次拖入一张图片，可多次插入。');return}importBasemap(e.dataTransfer.files[0])});
 window.addEventListener('blur',()=>finishBasemapGesture(true));basemapUIReady=true;refreshBasemapUI();
}
