// Editor-only interaction state: never serialized into project geometry.
let pickPreview=null,pickKeyboard=false,overlapPointer=null,viewportSize=null;
function overlapHits(q){return R.pickAll(q,scene,doc(),view,{through:true}).filter(h=>h.id&&doc().objects.some(o=>o.id===h.id&&o.visible!==false))}
function pickMenuItem(o){return `<button data-pick="${R.esc(o.id)}" role="menuitem" class="pick-item" title="${R.esc(o.name)}"><span>${R.esc(o.name)}</span><small>${R.esc(floor(o.floor)?.name||'')}${o.locked?' · 已锁定':''}${selection.includes(o.id)?' · 已选中':''}</small></button>`}
function wallOverlapEntry(hits,inLayers){
 const walls=hits.map(h=>doc().objects.find(o=>o.id===h.id)).filter(o=>o?.type==='wall'),wall=walls.find(o=>o.id===primary)||walls[0];if(inLayers||!wall)return '';
 const seen=new Set(hits.map(h=>h.id)),matches=R.wallOverlap(scene,doc(),wall.id).filter(o=>!seen.has(o.id));
 return matches.length?`<hr><div class="pick-heading" data-wall-overlap-list="${R.esc(wall.id)}">与“${R.esc(wall.name)}”重叠的其他组件 · ${matches.length} 个</div>`+matches.map(pickMenuItem).join(''):'';
}
function pointerHit(q,e){
 const selectedHole=obj();if(tool==='move'&&selectedHole?.type==='hole'&&!e.ctrlKey&&!e.metaKey&&M.inside(q,scene.outlines.get(primary)?.poly||[]))return {id:primary};const hits=R.pickAll(q,scene,doc(),view);
 if(tool==='move'&&!e.ctrlKey&&!e.metaKey&&selection.length){const all=overlapHits(q),chosen=all.find(h=>h.id===primary)||all.find(h=>selection.includes(h.id));if(chosen)return chosen}
 return hits[0];
}
function interactionHint(){
 const bar=$('#interaction-hint');bar.hidden=!doc();if(!doc())return;
 const names={select:'选择',move:'移动组件',size:'大小',rotate:'旋转',vertex:'顶点',plane:'绘制平面',wall:'绘制墙壁',hole:'绘制空洞',stairs:'放置楼梯',ladder:'放置爬梯',spiral:'放置旋转楼梯',route:'绘制路线',text:'放置文字',marker:'放置标记',pan:'平移视图'};
 const creating=creationTools.includes(tool),tips=tool==='route'?'逐点点击 · Enter 完成 · Backspace 撤回一点':creating?'连续创建 · Esc / 右键退出':tool==='move'?'拖动所选组件 · Alt 拖动复制 · Q 切换选择':tool==='select'?'先选中，再拖动 · 右键选择重叠组件 · Alt 单击轮选':tool==='pan'?'拖动画布 · Esc 返回选择':'Esc 返回选择';
 $('#interaction-mode').textContent=names[tool]||'选择';$('#interaction-tip').textContent=tips;bar.title=tips;
 const exit=$('#interaction-exit');exit.hidden=tool==='select';exit.textContent=creating?'退出创建':'返回选择';
}
function exitInteraction(){
 overlapPointer=null;
 if(editing){finishEditing(true);canvasFocus();return}
 if(drag){endDrag(true);canvasFocus();status('已取消本次操作');return}
 if(exitCreation()){canvasFocus();return}
 if(view.mode==='solid'&&obj()?.type==='route'&&Number.isInteger(vertexIndex)){vertexIndex=null;render();canvasFocus();status('已返回整条路线移动');return}
 if(tool!=='select'){tool='select';vertexIndex=null;placementGhost=null;render();canvasFocus();status('已返回选择 · Esc 取消选择');return}
 clear();curveSelected=false;curveText=null;render();canvasFocus();status('已取消选择');
}
function menuKeys(e){
 const menu=document.querySelector('.popover:not([hidden])');if(!menu)return false;
 if(e.key==='Escape'){e.preventDefault();closeMenus();canvasFocus();return true}
 if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){
  e.preventDefault();const buttons=[...menu.querySelectorAll('button:not(:disabled)')],i=buttons.indexOf(document.activeElement),n=buttons.length;
  if(n)buttons[e.key==='Home'?0:e.key==='End'?n-1:e.key==='ArrowDown'?(i+1+n)%n:(i-1+n)%n].focus();return true;
 }
 if(e.key==='Tab'){e.preventDefault();closeMenus();canvasFocus();return true}
 return true; // Native Enter/Space still activate the focused button; canvas shortcuts wait.
}
function previewPick(id){if(pickPreview===id)return;pickPreview=id;drawHandles()}
function pickPreviewMarkup(){const o=doc()?.objects.find(o=>o.id===pickPreview);return o?`<g data-pick-preview="${o.id}" pointer-events="none">${selectionMarkup(o,true)}</g>`:''}
$('#context-menu').addEventListener('pointermove',e=>{pickKeyboard=false;previewPick(e.target.closest('[data-pick]')?.dataset.pick||null)});
$('#context-menu').addEventListener('focusin',e=>{pickKeyboard=true;previewPick(e.target.closest('[data-pick]')?.dataset.pick||null)});
$('#context-menu').addEventListener('pointerleave',()=>{if(!pickKeyboard)previewPick(null)});
$('#interaction-exit').addEventListener('click',()=>exitInteraction());
canvas.addEventListener('pointerdown',e=>{
 overlapPointer=null;
 if(e.button!==0||!e.altKey||e.ctrlKey||e.metaKey||e.shiftKey||!doc()||!['select','move'].includes(tool)||space||e.target.closest('[data-world-handle],[data-vertex],[data-midpoint],[data-ring],[data-size-edge],[data-size-corner]'))return;
 const hits=overlapHits(point(e));if(!hits.length)return;
 overlapPointer={ids:hits.map(h=>h.id),primary,start:[e.clientX,e.clientY],moved:false};canvas.setPointerCapture?.(e.pointerId);
},true);
canvas.addEventListener('pointermove',e=>{if(overlapPointer&&Math.hypot(e.clientX-overlapPointer.start[0],e.clientY-overlapPointer.start[1])>5)overlapPointer.moved=true},true);
canvas.addEventListener('pointerup',e=>{
 const a=overlapPointer;overlapPointer=null;if(!a||a.moved)return;
 e.preventDefault();e.stopImmediatePropagation();endDrag(true);const i=a.ids.indexOf(a.primary),id=a.ids[(i+1)%a.ids.length];choose(id,false,true);status('已选择 '+obj().name+' · Alt 单击继续轮选 · W 移动所选');
},true);
canvas.addEventListener('pointercancel',()=>{overlapPointer=null},true);
function rememberViewport(){
 const r=stage.getBoundingClientRect();if(r.width<=0||r.height<=0)return;
 // A toolbar/hint reflow can arrive one frame after pointerdown. Keep the
 // gesture's reference frame until endDrag redraws, rather than cancelling it.
 if(drag)return;
 if(viewportSize&&(r.width!==viewportSize.width||r.height!==viewportSize.height)){
  const cx=camera.x+camera.w/2,cy=camera.y+camera.h/2,px=camera.w/viewportSize.width;camera={x:cx-r.width*px/2,y:cy-r.height*px/2,w:r.width*px,h:r.height*px};
 }
 viewportSize={width:r.width,height:r.height};
}
function resizeViewport(){
 if(!doc()||drag)return;
 drawCanvas();if(editing)positionInlineEditor();
}
const interactionRender=render;render=function(keep=false){interactionHint();interactionRender(keep);interactionHint()};
