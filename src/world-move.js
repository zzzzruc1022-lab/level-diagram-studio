// Orthographic world-axis constraints; only the selected axes may change.
const worldAxes=[[1,0,0],[0,1,0],[0,0,1]],worldNames=['X','Y','Z'],worldColors=['#c53b35','#258342','#2566c5'];
function worldProjection(basis){return worldAxes.map(a=>[M.dot(a,basis.r),M.dot(a,basis.down)])}
function worldConstraint(axes,delta,basis){
 const p=worldProjection(basis),out=[0,0,0];
 if(axes.length===1){const i=axes[0],v=p[i],length=M.dot(v,v);if(length<.035)return null;out[i]=M.dot(delta,v)/length}
 else{const [i,j]=axes,a=p[i],b=p[j],det=a[0]*b[1]-a[1]*b[0];if(Math.abs(det)<.12)return null;out[i]=(delta[0]*b[1]-delta[1]*b[0])/det;out[j]=(a[0]*delta[1]-a[1]*delta[0])/det}
 return out;
}
function worldMovable(){
 const a=selected();return doc()?.type==='space'&&view.mode==='solid'&&a.length>0&&!locked()&&a.every(o=>o.type!=='hole'||selection.includes(o.host));
}
function usesWorldGizmo(){return worldMovable()&&selected().some(o=>!['hole','text','route'].includes(o.type))}
function worldGizmoInfo(){
 if(!usesWorldGizmo()||!['select','move'].includes(tool))return null;
 let anchor;
 if(drag?.kind==='world-move')anchor=M.add(drag.gizmoAnchor,drag.applied||[0,0,0]);
 else{
  const roots=selected().filter(o=>!['hole','text','route'].includes(o.type)),points=roots.flatMap(o=>o.type==='marker'?[M.add(M.origin(doc(),o),M.add(M.mul(scene.basis.r,-o.r*Math.SQRT1_2),M.mul(scene.basis.down,o.r*Math.SQRT1_2)))]:M.geometry(doc(),o).flatMap(f=>f.points));
  if(!points.length)return null;const candidates=points.map(p=>({world:p,screen:M.project(p,scene.basis)})),b=bounds2(candidates.map(p=>p.screen)),corner=[b.min[0],b.max[1]];
  anchor=candidates.reduce((best,p)=>Math.hypot(...M.sub(p.screen,corner))<Math.hypot(...M.sub(best.screen,corner))?p:best).world;
 }
 return {anchor,p:M.project(anchor,scene.basis),vectors:worldProjection(scene.basis)};
}
function worldGizmoMarkup(){
 const info=worldGizmoInfo();if(!info)return '';const k=pixel(),{p,vectors}=info,at=(axis,n)=>M.add(p,M.mul(vectors[axis],n*k));
 const active=drag?.kind==='world-move'?drag.axes.join(''):null,attrs=(axes,available)=>available?`data-world-handle="${axes.join('')}" role="button" aria-label="沿 ${axes.map(i=>worldNames[i]).join('')} ${axes.length===1?'轴':'平面'}移动" style="cursor:${drag?'grabbing':'grab'};--gizmo-color:${axes.length===1?worldColors[axes[0]]:worldColors[[0,1,2].find(i=>!axes.includes(i))]}" class="${active===axes.join('')?'active':''}"`:`opacity=".25" pointer-events="none" style="--gizmo-color:${axes.length===1?worldColors[axes[0]]:worldColors[[0,1,2].find(i=>!axes.includes(i))]}"`;
 let s='<g class="world-gizmo" data-world-gizmo="true">';
 for(const axes of [[0,1],[0,2],[1,2]]){
  const [i,j]=axes,poly=[[15,15],[31,15],[31,31],[15,31]].map(([a,b])=>M.add(at(i,a),M.mul(vectors[j],b*k))),available=!!worldConstraint(axes,[0,0],scene.basis);
  s+=`<g ${attrs(axes,available)}><title>拖动可沿 ${axes.map(i=>worldNames[i]).join('')} 平面移动</title><path class="gizmo-plane" d="${R.path(poly,true)}" stroke-width="${k*1.3}"/></g>`;
 }
 for(let i=0;i<3;i++){
  const a=at(i,7),b=at(i,88),v=M.unit([...vectors[i],0]),normal=[-v[1],v[0]],tip=[b,M.add(M.sub(b,M.mul(v.slice(0,2),11*k)),M.mul(normal,5*k)),M.sub(M.sub(b,M.mul(v.slice(0,2),11*k)),M.mul(normal,5*k))],available=!!worldConstraint([i],[0,0],scene.basis),label=M.add(b,M.mul(v.slice(0,2),12*k));
  s+=`<g ${attrs([i],available)}><title>拖动沿 ${worldNames[i]} 轴移动；Alt 拖动复制</title><path d="${R.path([a,b])}" stroke="white" stroke-width="${k*5}" pointer-events="none"/><path class="gizmo-axis" d="${R.path([a,b])}" stroke-width="${k*2.7}"/><path class="gizmo-tip" d="${R.path(tip,true)}" stroke="white" stroke-width="${k}"/><path d="${R.path([a,b])}" stroke="transparent" stroke-width="${k*13}"/><text x="${label[0]}" y="${label[1]+k*4}" font-size="${k*12}" text-anchor="middle" fill="${worldColors[i]}" stroke="white" stroke-width="${k*3}" paint-order="stroke" pointer-events="none">${worldNames[i]}</text></g>`;
 }
 return s+`<circle cx="${p[0]}" cy="${p[1]}" r="${k*3}" fill="white" stroke="#44536a" stroke-width="${k}" pointer-events="none"/></g>`;
}
function beginWorldMove(e,q){
 const target=e.target.closest('[data-world-handle]'),info=worldGizmoInfo();if(!target||!info)return false;const axes=target.dataset.worldHandle.split('').map(Number);
 if(!worldConstraint(axes,[0,0],scene.basis))return false;
 drag={kind:'world-move',before:snapshot(),start:q,last:q,axes,basis:M.clone(scene.basis),gizmoAnchor:[...info.anchor],ids:[...selection],sourceIds:[...selection],primary,copy:!!e.altKey,copied:false,changed:false,floor:floorSelection,sourceFloor:floorSelection};
 canvas.style.cursor='grabbing';capture(e);drawHandles();return true;
}
function moveInWorld(q,e){
 const desired=worldConstraint(drag.axes,M.sub(q,drag.start),drag.basis);if(!desired)return;
 if($('#snap').checked&&!e.ctrlKey&&!e.metaKey)for(const i of drag.axes)desired[i]=Math.round(desired[i]/10)*10;
 if(!drag.changed&&Math.hypot(...M.sub(q,drag.start))<pixel()*3||!drag.changed&&Math.hypot(...desired)<1e-7)return;
 if(drag.copy&&!drag.copied){drag.ids=M.duplicate(doc(),drag.ids);drag.copied=true;selection=[...drag.ids];primary=selection.find(id=>doc().objects.find(o=>o.id===id)?.type===doc().objects.find(o=>o.id===drag.primary)?.type)||selection[0];floorSelection=null;drag.floor=null}
 M.move(doc(),drag.ids,M.sub(desired,drag.applied||[0,0,0]),drag.floor);drag.applied=desired;drag.last=q;drag.changed=true;
 status(`${drag.copy?'复制并移动':'移动'} ${drag.axes.map(i=>worldNames[i]).join('')} · ${drag.axes.map(i=>desired[i].toFixed(1)).join(' / ')}`);drawCanvas();
}
