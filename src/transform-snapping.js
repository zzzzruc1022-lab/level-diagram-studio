// Rotation and size stay on their original one-dimensional gesture. Targets
// are shared with move snapping; analytic contacts never translate the object.
const TransformSnapping=(()=>{
 const cross=(a,b)=>a[0]*b[1]-a[1]*b[0],dot=M.dot,sub=M.sub,add=M.add,mul=M.mul,len=v=>Math.hypot(...v),mix=(a,b,f)=>add(a,mul(sub(b,a),f));
 const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
 function pairs(c,sources,pad,visit){
  if(!sources.length)return;const ps=sources.flatMap(s=>[s.a2,s.b2]),box=[Math.min(...ps.map(p=>p[0]))-pad,Math.min(...ps.map(p=>p[1]))-pad,Math.max(...ps.map(p=>p[0]))+pad,Math.max(...ps.map(p=>p[1]))+pad],targets=c.targets.filter(t=>t.box[0]<=box[2]&&t.box[2]>=box[0]&&t.box[1]<=box[3]&&t.box[3]>=box[1]);
  sources.forEach((s,i)=>{for(const t of targets){if(Math.max(s.a2[0],s.b2[0])+pad<t.box[0]||Math.min(s.a2[0],s.b2[0])-pad>t.box[2]||Math.max(s.a2[1],s.b2[1])+pad<t.box[1]||Math.min(s.a2[1],s.b2[1])-pad>t.box[3]||!MoveSnapping.eligible(s,t,c))continue;const u=sub(t.b2,t.a2),length=len(u);if(length<1e-7)continue;visit(s,t,i,u,length)}});
 }
 function samples(s,t){const v=sub(s.b2,s.a2),vv=dot(v,v),fs=[0,.5,1];if(vv>1e-12)for(const p of [t.a2,t.b2,mix(t.a2,t.b2,.5)]){const f=dot(sub(p,s.a2),v)/vv;if(f>0&&f<1)fs.push(f)}return fs}
 function onSegment(p,t,eps=1e-6){const v=sub(t.b2,t.a2),vv=dot(v,v),f=dot(sub(p,t.a2),v)/vv;return f>=-eps&&f<=1+eps}
 function parallel(a,b,t,tolerance){const v=sub(t.b2,t.a2),l=len(v),axis=mul(v,1/l),n=[-axis[1],axis[0]],sa=[dot(a,axis),dot(b,axis)].sort((x,y)=>x-y),ta=[dot(t.a2,axis),dot(t.b2,axis)].sort((x,y)=>x-y),gap=Math.abs(dot(sub(a,t.a2),n));return Math.min(sa[1],ta[1])-Math.max(sa[0],ta[0])>1e-6&&gap<=tolerance?gap:null}
 function rotation(c,sources,center,units,raw=0){
  let best=null;const motion=sources.map((s,i)=>[s.a2,s.b2].map((p,k)=>{const m=c.motion?.[i]?.[k],o=m?.o||center,u=sub(p,o),v=m?add(mul(m.a,-Math.sin(raw)),mul(m.b,Math.cos(raw))):[-u[1],u[0]],trace=dot(u,u)+dot(v,v),det=cross(u,v)**2,radius=Math.sqrt((trace+Math.sqrt(Math.max(0,trace*trace-4*det)))/2);return {o,u,v,radius}})),radius=Math.max(1,...motion.flatMap(m=>m.map(p=>p.radius))),at=(i,k,a)=>{const m=motion[i][k];return add(m.o,add(mul(m.u,Math.cos(a)),mul(m.v,Math.sin(a))))};
  const roots=(a,b,z)=>{const r=Math.hypot(a,b);if(r<1e-7||Math.abs(z)>r+1e-7)return [];const phase=Math.atan2(b,a),alpha=Math.acos(Math.max(-1,Math.min(1,z/r)));return [wrap(phase+alpha),wrap(phase-alpha)]};
  const offer=(value,i,t,kind,f,gap=0)=>{const id=i+'|'+t.id+'|'+kind,tolerance=(c.held===id?9:6)*units,move=2*radius*Math.abs(Math.sin(value/2));if(move>tolerance||!Number.isFinite(value))return;const rank=move+(kind==='parallel'?.02+gap*.05:0);if(!best||rank<best.rank-1e-7||Math.abs(rank-best.rank)<1e-7&&c.held===id)best={value,id,rank,i,t,kind,f,tolerance}};
  pairs(c,sources,9*units,(s,t,i,u,length)=>{
   const [a,b]=motion[i],n=[-u[1]/length,u[0]/length],du=sub(b.u,a.u),dv=sub(b.v,a.v),offset=sub(b.o,a.o);
   for(const angle of roots(cross(du,u),cross(dv,u),-cross(offset,u))){const gap=parallel(at(i,0,angle),at(i,1,angle),t,(c.held===i+'|'+t.id+'|parallel'?9:6)*units);if(gap!==null)offer(angle,i,t,'parallel',null,gap)}
   for(const k of [0,1]){const m=motion[i][k];for(const angle of roots(dot(m.u,n),dot(m.v,n),dot(sub(t.a2,m.o),n)))if(onSegment(at(i,k,angle),t))offer(angle,i,t,'contact',k)}
   // Reverse corner/edge contact is also analytic for rigid and projected
   // planar rotation. Degenerate stair-end projections use the forward test.
   const k0=cross(a.u,du),k1=cross(a.v,dv),mixed=cross(a.u,dv)+cross(a.v,du),scale=Math.max(1,Math.abs(k0),Math.abs(k1));
   if(len(offset)<1e-6&&Math.abs(k0-k1)<scale*1e-6&&Math.abs(mixed)<scale*1e-6)for(const p of [t.a2,t.b2]){const w=sub(p,a.o);for(const angle of roots(cross(w,du),cross(w,dv),k0)){const x=at(i,0,angle),y=at(i,1,angle),edge=sub(y,x);if(dot(edge,edge)>1e-12&&onSegment(p,{a2:x,b2:y}))offer(angle,i,t,'contact',dot(sub(p,x),edge)/dot(edge,edge))}}
  });
  c.held=best?.id||null;return best;
 }
 function resize(c,before,sources,parameter,units){
  if(Math.abs(parameter)<1e-7||before.length!==sources.length){c.held=null;return null}let best=null;
  const velocity=sources.map((s,i)=>[mul(sub(s.a2,before[i].a2),1/parameter),mul(sub(s.b2,before[i].b2),1/parameter)]),speed=Math.max(1e-7,...velocity.flatMap(a=>a.map(len)));
  pairs(c,sources,9*units,(s,t,i,u,length)=>{const n=[-u[1]/length,u[0]/length];for(const f of samples(s,t)){const p=mix(s.a2,s.b2,f),v=mix(velocity[i][0],velocity[i][1],f),normal=dot(v,n);if(Math.abs(normal)<1e-7)continue;const value=dot(sub(t.a2,p),n)/normal,id=i+'|'+t.id+'|contact',tolerance=(c.held===id?9:6)*units,rank=Math.abs(value)*speed;if(rank>tolerance||!onSegment(add(p,mul(v,value)),t))continue;if(!best||rank<best.rank-1e-7||Math.abs(rank-best.rank)<1e-7&&c.held===id)best={value,id,rank,i,t,kind:'contact',f,tolerance}}});
  c.held=best?.id||null;return best;
 }
 function guide(result,sources,units){
  const s=sources[result.i];if(!s)return null;const t=result.t,v=sub(t.b2,t.a2),length=len(v);if(length<1e-7)return null;
  if(result.kind==='parallel'){const edge=sub(s.b2,s.a2),edgeLength=len(edge);if(edgeLength<1e-7||Math.abs(cross(v,edge))/(length*edgeLength)>1e-5||parallel(s.a2,s.b2,t,result.tolerance)===null)return null}
  else{const p=mix(s.a2,s.b2,result.f),distance=Math.abs(cross(sub(p,t.a2),v))/length;if(distance>units*.15||!onSegment(p,t))return null}
  return {t,a:s.a2,z:s.b2,projected:false};
 }
 return {rotation,resize,guide};
})();
window.StudioTransformSnapping=TransformSnapping;

function transformFeatures(d,ids){
 const set=new Set(ids),basis=scene.basis;return d.objects.filter(o=>set.has(o.id)&&(o.type!=='hole'||!set.has(o.host))).flatMap(o=>{
  let edges=MoveSnapping.features(d,o);
  if(o.type==='text'){const anchor=M.origin(d,o),ps=R.textLayout(o,M.project(anchor,basis)).corners.map(p=>M.unproject(p,basis,anchor));edges=ps.map((p,i)=>({a:p,b:ps[(i+1)%ps.length],kind:'boundary',owner:o}))}
  if(!edges.length)return [];const ps=edges.flatMap(e=>[e.a,e.b]),height=[Math.min(...ps.map(p=>p[2])),Math.max(...ps.map(p=>p[2]))],depth=[Math.min(...ps.map(p=>M.dot(p,basis.n))),Math.max(...ps.map(p=>M.dot(p,basis.n)))];
  return edges.map(e=>({...e,height,depth,a2:M.project(e.a,basis),b2:M.project(e.b,basis)}));
 });
}
function transformCache(){
 if(!drag.transformCache){const original=JSON.parse(drag.before).documents.find(d=>d.id===current),ids=drag.kind==='size'?[drag.id]:drag.selection,c=MoveSnapping.prepare(original,selection,scene.basis,view,$('#ghost').checked);c.transform=true;c.original=transformFeatures(original,ids);drag.transformCache=c}
 return drag.transformCache;
}
function applyRotation(angle){
 project=JSON.parse(drag.before);selection=[...drag.selection];primary=drag.primary;
 if(selected().every(o=>o.type==='text')){const c=Math.cos(angle),s=Math.sin(angle);drag.textCenters.forEach(record=>{const o=doc().objects.find(o=>o.id===record.id),a=M.project(record.anchor,scene.basis),x=record.center[0]-drag.ring.p[0],y=record.center[1]-drag.ring.p[1],q=[drag.ring.p[0]+x*c-y*s-(record.center[0]-a[0]),drag.ring.p[1]+x*s+y*c-(record.center[1]-a[1])];o.position=M.sub(M.unproject(q,scene.basis,record.anchor),[0,0,floor(o.floor)?.height||0]);o.textAngle+=angle*180/Math.PI})}
 else M.rotate(doc(),selection,view.mode==='plan'?[0,0,1]:scene.basis.n,angle,drag.ring.center);
}
function rotateWithSnapping(e){
 const raw=drag.rawAngle,angle=snappedAngle(raw,e);moveSnapGuides=[];
 if(e.ctrlKey||e.metaKey||e.shiftKey||!$('#move-snap').checked||doc().type!=='space'){if(drag.transformCache)drag.transformCache.held=null;applyRotation(angle);return angle}
 const c=transformCache();if(!c.motion){const frames=[0,Math.PI/2,Math.PI].map(angle=>{applyRotation(angle);return transformFeatures(doc(),drag.selection)});c.motion=frames[0].map((s,i)=>['a2','b2'].map(k=>{const o=M.mul(M.add(s[k],frames[2][i][k]),.5);return {o,a:M.sub(s[k],o),b:M.sub(frames[1][i][k],o)}}))}
 applyRotation(raw);const sources=transformFeatures(doc(),drag.selection),hit=TransformSnapping.rotation(c,sources,drag.ring.p,pixel(),raw);
 if(hit&&(angle===raw||Math.abs(hit.value)<Math.abs(angle-raw))){const next=raw+hit.value;applyRotation(next);const guide=TransformSnapping.guide(hit,transformFeatures(doc(),drag.selection),pixel());if(guide&&valid()){moveSnapGuides=[guide];return next}}
 c.held=null;if(angle!==raw||hit)applyRotation(angle);return angle;
}
function sizeSnapParameter(q){
 const info=drag.info,p=info.screen,j=drag.index;
 if(info.kind==='spiral'){const c=M.project(info.center,scene.basis),v=M.sub(q,c),length=Math.hypot(...v);return {axis:M.mul(v,1/(length||1)),value:length-(drag.radius==='inner'?info.inner:info.outer)}}
 let vector;
 if(drag.corner){const center=info.world.reduce((a,b)=>M.add(a,M.mul(b,1/info.world.length)),[0,0,0]),regular=info.kind!=='polygon'||info.points.length===4&&info.points.every((a,i)=>{const b=info.points[(i+1)%4],c=info.points[(i+2)%4];return Math.abs((b[0]-a[0])*(c[0]-b[0])+(b[1]-a[1])*(c[1]-b[1]))<1e-4}),anchor=regular?info.world[(j+2)%4]:center;vector=M.sub(drag.start,M.project(anchor,scene.basis))}
 else if(p.length===2)vector=M.sub(p[1],p[0]);else{const v=M.sub(p[(j+1)%p.length],p[j]);vector=[-v[1],v[0]]}
 const length=Math.hypot(...vector),axis=M.mul(vector,1/(length||1));return {axis,value:M.dot(M.sub(q,drag.start),axis)};
}
function sizeWithSnapping(q,e){
 moveSnapGuides=[];const active=!e.ctrlKey&&!e.metaKey&&$('#move-snap').checked&&doc().type==='space',c=active?transformCache():drag.transformCache;editSize(q);if(!active){if(c)c.held=null;return}
 const parameter=sizeSnapParameter(q),sources=transformFeatures(doc(),[drag.id]),hit=TransformSnapping.resize(c,c.original,sources,parameter.value,pixel());if(!hit)return;
 const next=M.add(q,M.mul(parameter.axis,hit.value));editSize(next);const guide=TransformSnapping.guide(hit,transformFeatures(doc(),[drag.id]),pixel());if(guide&&valid()){moveSnapGuides=[guide];status('已吸附组件边 · Ctrl 暂停')}else{c.held=null;editSize(q)}
}
