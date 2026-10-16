// Static outlines are cached once per drag. Only small screen-space corrections
// are computed while moving; no mesh, step, boolean or constraint solver is used.
const MoveSnapping=(()=>{
 const cross=(a,b)=>a[0]*b[1]-a[1]*b[0],len=v=>Math.hypot(...v),mid=(a,b)=>M.mul(M.add(a,b),.5);
 function features(d,o){
  const edges=[],world=p=>M.world(d,o,p),edge=(a,b,kind='boundary')=>edges.push({a:world(a),b:world(b),kind,owner:o});
  const ring=(ps,kind)=>ps.forEach((p,i)=>edge(p,ps[(i+1)%ps.length],kind));
  if(o.type==='plane')ring(M.contour(o).map(p=>[...p,0]));
  if(o.type==='wall'){const ps=M.wallFootprint(o),[lo,hi]=M.wallLevels(o);ring(ps.map(p=>[...p,lo]));ring(ps.map(p=>[...p,hi]));ps.forEach(p=>edge([...p,lo],[...p,hi]))}
  if(o.type==='stairs'){const f=o.flights[0];edge([...f.points[0],f.start],[...f.points[1],f.start],'end');edge([...f.points[3],f.end],[...f.points[2],f.end],'end')}
  if(o.type==='spiral')for(const [a,z] of [[o.angle*Math.PI/180,o.start+(o.end-o.start)/o.steps],[(o.angle+o.direction*360*o.turns)*Math.PI/180,o.end]])edge([o.inner*Math.cos(a),o.inner*Math.sin(a),z],[o.outer*Math.cos(a),o.outer*Math.sin(a),z],'end');
  if(o.type==='ladder'){const w=(o.span+Math.min(o.span/3,o.railWidth||6))/2,t=(o.thickness||6)/2;
   for(const y of [-t,t]){edge([-w,y,o.start],[w,y,o.start],'end');edge([-w,y,o.end],[w,y,o.end],'end');edge([-w,y,o.start],[-w,y,o.end]);edge([w,y,o.start],[w,y,o.end])}
   for(const x of [-w,w])for(const z of [o.start,o.end])edge([x,-t,z],[x,t,z]);
  }
  return edges;
 }
 function prepare(d,ids,basis,view,ghost){
  const excluded=new Set(ids),sources=d.objects.filter(o=>excluded.has(o.id)&&['plane','wall','stairs','ladder','spiral'].includes(o.type)).flatMap(o=>{const fs=features(d,o),zs=fs.flatMap(e=>[e.a[2],e.b[2]]),height=[Math.min(...zs),Math.max(...zs)],ds=fs.flatMap(e=>[M.dot(e.a,basis.n),M.dot(e.b,basis.n)]),depth=[Math.min(...ds),Math.max(...ds)];return fs.map(e=>({...e,height,depth}))}),targets=[];
  const range=ps=>[Math.min(...ps.map(p=>M.dot(p,basis.n))),Math.max(...ps.map(p=>M.dot(p,basis.n)))];
  const add=(e,id,depth)=>{const a=M.project(e.a,basis),b=M.project(e.b,basis);targets.push({...e,id,a2:a,b2:b,depth:depth||range([e.a,e.b]),box:[Math.min(a[0],b[0]),Math.min(a[1],b[1]),Math.max(a[0],b[0]),Math.max(a[1],b[1])]})};
  for(const o of d.objects){
   if(excluded.has(o.id)||o.visible===false||M.floor(d,o)?.visible===false||!['plane','wall','stairs','ladder','spiral'].includes(o.type))continue;
   if(view.mode==='plan'&&!ghost&&o.floor!==d.activeFloor)continue;
   if(view.mode==='elevation'&&(view.scope==='floor'&&o.floor!==d.activeFloor||view.scope==='selection'&&!view.focusIds?.includes(o.id)))continue;
   const fs=features(d,o),depth=range(fs.flatMap(e=>[e.a,e.b])),zs=fs.flatMap(e=>[e.a[2],e.b[2]]),height=[Math.min(...zs),Math.max(...zs)];fs.forEach((e,i)=>add({...e,height},o.id+':'+i,o.type==='wall'?depth:null));
   if(o.type==='plane'){
    for(const h of M.holes(d,o)){if(h.visible===false)continue;const ps=M.contour(h).map(p=>M.world(d,o,h.cut?M.holePoint(h,p):M.facePoint(o,p)));ps.forEach((p,i)=>add({a:p,b:ps[(i+1)%ps.length],owner:o,kind:'hole'},h.id+':'+i))}
    // In elevation a floor's top is a height reference across its material span.
    if(view.mode==='elevation'&&Math.abs(M.normal(o)[2])>.9999){const ps=fs.map(e=>e.a),xs=ps.map(p=>M.project(p,basis)[0]),y=M.project(ps[0],basis)[1];add({a:M.unproject([Math.min(...xs),y],basis,ps[0]),b:M.unproject([Math.max(...xs),y],basis,ps[0]),owner:o,kind:'surface'},o.id+':surface',depth)}
   }
  }
  return {sources,targets,basis,mode:view.mode,activeFloor:d.activeFloor,held:null};
 }
 function compatible(s,t,c){
  const a=s.owner,b=t.owner;if(a.type==='cursor')return true;
  if(['stairs','spiral'].includes(a.type))return ['plane','wall'].includes(b.type);
  if(['stairs','spiral'].includes(b.type))return ['plane','wall'].includes(a.type)&&t.kind==='end';
  const ladder=a.type==='ladder'?a:b.type==='ladder'?b:null,other=ladder===a?b:a,feature=ladder===a?s:t;
  if(ladder){const vertical=Math.abs(M.mat(ladder.orientation,[0,0,1])[2])>.9999;if(other.type==='wall')return vertical&&Math.abs(M.normal(other)[2])<.0001;return other.type==='plane'&&(feature.kind==='end'||Math.abs(M.mat(ladder.orientation,[0,1,0])[2])>.9999)}
  return ['plane','wall'].includes(a.type)&&['plane','wall'].includes(b.type)&&(c.mode!=='plan'||b.floor===c.activeFloor)&&t.kind!=='hole';
 }
 function solve(c,total,units,paused=false){
  if(paused){c.held=null;return {delta:total,guides:[]}}
  let best=null;const pad=9*units,b=c.basis;
  for(let si=0;si<c.sources.length;si++){
   const s=c.sources[si],wa=M.add(s.a,total),wb=M.add(s.b,total),a=M.project(wa,b),z=M.project(wb,b),v=M.sub(z,a),length=len(v),depth=[Math.min(M.dot(wa,b.n),M.dot(wb,b.n)),Math.max(M.dot(wa,b.n),M.dot(wb,b.n))];
   for(const t of c.targets){
    if(!compatible(s,t,c))continue;
    if(Math.max(a[0],z[0])+pad<t.box[0]||Math.min(a[0],z[0])-pad>t.box[2]||Math.max(a[1],z[1])+pad<t.box[1]||Math.min(a[1],z[1])-pad>t.box[3])continue;
    const sourceDepth=s.owner.type==='plane'&&s.depth?s.depth.map(v=>v+M.dot(total,b.n)):depth;if(c.mode==='elevation'&&(sourceDepth[1]<t.depth[0]-.001||sourceDepth[0]>t.depth[1]+.001))continue;
    if(s.owner.type==='ladder'&&t.owner.type==='wall'||s.owner.type==='wall'&&t.owner.type==='ladder'){
     if(s.height[1]+total[2]<t.height[0]||s.height[0]+total[2]>t.height[1])continue;
    }
    const id=si+'|'+t.id,tolerance=(c.held===id?9:6)*units,q=t.a2,r=t.b2,u=M.sub(r,q),targetLength=len(u);let correction=null,score=Infinity,axes=[true,true],quality=1;
    if(length>1e-6&&targetLength>1e-6&&Math.abs(cross(v,u))/(length*targetLength)<1e-5){
     const axis=M.mul(u,1/targetLength),n=[-axis[1],axis[0]],as=[M.dot(a,axis),M.dot(z,axis)].sort((x,y)=>x-y),bs=[M.dot(q,axis),M.dot(r,axis)].sort((x,y)=>x-y),overlap=Math.min(as[1],bs[1])-Math.max(as[0],bs[0]),distance=M.dot(M.sub(q,a),n);
     if(overlap>1e-6&&Math.abs(distance)<=tolerance){correction=M.mul(n,distance);score=Math.abs(distance);quality=0;axes=n.map(v=>Math.abs(v)>1e-8);
      let along=Infinity;for(const p of [a,z,mid(a,z)])for(const h of [q,r,mid(q,r)]){const d=M.dot(M.sub(h,p),axis);if(Math.abs(d)<Math.abs(along))along=d}if(Math.abs(along)<=6*units){correction=M.add(correction,M.mul(axis,along));axes=[true,true]}
     }
    }else if(length<1e-6&&targetLength>1e-6){const f=Math.max(0,Math.min(1,M.dot(M.sub(a,q),u)/(targetLength*targetLength)));correction=M.sub(M.add(q,M.mul(u,f)),a);score=len(correction)}
    if(!correction&&s.kind==='end'&&targetLength>1e-6)for(const p of [a,z,mid(a,z)]){const f=M.dot(M.sub(p,q),u)/(targetLength*targetLength);if(f<0||f>1)continue;const delta=M.sub(M.add(q,M.mul(u,f)),p),distance=len(delta);if(distance<score){score=distance;correction=delta;axes=u.map((_,i)=>Math.abs(u[1-i])>1e-8)}}
    if(!correction&&t.kind==='end'&&length>1e-6)for(const p of [q,r,mid(q,r)]){const f=M.dot(M.sub(p,a),v)/(length*length);if(f<0||f>1)continue;const delta=M.sub(p,M.add(a,M.mul(v,f))),distance=len(delta);if(distance<score){score=distance;correction=delta;axes=v.map((_,i)=>Math.abs(v[1-i])>1e-8)}}
    // Endpoint joining also handles edges that do not overlap or are not parallel.
    if(!correction)for(const p of [a,z])for(const h of [q,r]){const delta=M.sub(h,p),distance=len(delta);if(distance<score){score=distance;correction=delta}}
    if(correction&&score<=tolerance&&len(correction)<=tolerance*Math.SQRT2){const rank=score+quality*.01+(t.kind==='surface'?.001:0);if(!best||rank<best.rank-1e-6||Math.abs(rank-best.rank)<1e-6&&c.held===id)best={id,rank,correction,axes,t,a:M.add(a,correction),z:M.add(z,correction),heightOnly:t.kind==='surface',projected:c.mode==='plan'&&Math.abs(wa[2]-t.a[2])>.01}}
   }
  }
  if(!best){c.held=null;return {delta:total,guides:[]}}c.held=best.id;
  const v=best.correction,delta=M.add(total,M.add(M.mul(b.r,v[0]),M.mul(b.down,v[1])));
  return {delta,guides:[best],axes:best.axes};
 }
 return {features,prepare,solve};
})();
window.StudioSnapping=MoveSnapping;
let moveSnapGuides=[];
function moveWithSnapping(q,e){
 const raw=M.sub(M.unproject(q,scene.basis,drag.anchor),M.unproject(drag.start,scene.basis,drag.anchor));
 if(!drag.snapCache&&!drag.floor&&doc().type==='space'&&view.mode!=='solid')drag.snapCache=MoveSnapping.prepare(doc(),drag.ids,scene.basis,view,$('#ghost').checked);
 const paused=e.ctrlKey||e.metaKey||!$('#move-snap').checked,result=drag.snapCache?MoveSnapping.solve(drag.snapCache,raw,pixel(),paused):{delta:raw,guides:[]};let desired=result.delta;
 // Object corrections win on their matched axes; the grid handles the rest.
 if($('#snap').checked&&!e.ctrlKey&&!e.metaKey){const grid=snap(raw);desired=result.guides.length?M.add(raw,M.add(M.mul(scene.basis.r,result.axes?.[0]?M.dot(M.sub(desired,raw),scene.basis.r):M.dot(M.sub(grid,raw),scene.basis.r)),M.mul(scene.basis.down,result.axes?.[1]?M.dot(M.sub(desired,raw),scene.basis.down):M.dot(M.sub(grid,raw),scene.basis.down)))):grid}
 M.move(doc(),drag.ids,M.sub(desired,drag.applied||[0,0,0]),drag.floor);drag.applied=desired;moveSnapGuides=result.guides;
 if(moveSnapGuides.length)status(moveSnapGuides[0].projected?'平面位置已对齐 · 高度保持不变':'已吸附连接边 · 拖动中按 Ctrl 暂停');
}
function moveSnapMarkup(){const cursor=['plane','wall'].includes(tool)&&!drag?moveSnapGuides[0]?.a:null;const color=doc()?.background==='#101214'?'#ffc58a':'#ac4c0d';return moveSnapGuides.map(g=>`<g data-move-snap-guide="true" pointer-events="none"><path d="${R.path([g.t.a2,g.t.b2])}" fill="none" stroke="${color}" stroke-width="${pixel()*3}"/><path d="${R.path([g.a,g.z])}" fill="none" stroke="${color}" stroke-width="${pixel()*1.5}" stroke-dasharray="${pixel()*4} ${pixel()*3}"/></g>`).join('')+(cursor?'<circle data-creation-snap-point="true" cx="'+cursor[0]+'" cy="'+cursor[1]+'" r="'+pixel()*3+'" fill="'+color+'" stroke="'+doc().background+'" stroke-width="'+pixel()+'" pointer-events="none"/>':'')}

// Creation uses the same cached targets and pixel thresholds as movement.
function creationSnap(q,e,reset=false){
 const d=doc();if(reset)creationSnapCache=null;
 if(!creationSnapCache||creationSnapCache.document!==d){creationSnapCache=MoveSnapping.prepare(d,[],scene.basis,view,$('#ghost').checked);creationSnapCache.document=d}
 const world=M.unproject(q,scene.basis,[0,0,floor(d.activeFloor)?.height||0],[0,0,1]),c=creationSnapCache;
 const source=(a,b)=>({a,b,kind:'point',owner:{type:'cursor'},height:[world[2],world[2]]});c.sources=[source(world,world)];if(drag?.kind==='create-rect'){const at=p=>M.unproject(p,scene.basis,[0,0,world[2]],[0,0,1]);c.sources.push(source(at([drag.start[0],q[1]]),world),source(at([q[0],drag.start[1]]),world))}
 const paused=e.ctrlKey||e.metaKey||!$('#move-snap').checked,result=MoveSnapping.solve(c,[0,0,0],pixel(),paused),grid=e.ctrlKey||e.metaKey?world:snap(world),point=[...grid];
 if(result.guides.length)for(let i=0;i<2;i++)if(result.axes?.[i])point[i]=world[i]+result.delta[i];
 moveSnapGuides=result.guides;return M.project(point,scene.basis);
}

// The ghost and the committed placement use the same lightweight edge solve.
let placementSnapCache=null;
function snapPlacement(d,o,e={}){
 if(!['stairs','ladder','spiral'].includes(o.type)||view.mode==='solid')return;
 const original=doc(),ghost=$('#ghost').checked;
 if(!placementSnapCache||placementSnapCache.document!==original||placementSnapCache.count!==original.objects.length||placementSnapCache.ghost!==ghost){placementSnapCache=MoveSnapping.prepare(original,[],scene.basis,view,ghost);Object.assign(placementSnapCache,{document:original,count:original.objects.length,ghost})}
 const c=placementSnapCache,edges=MoveSnapping.features(d,o),zs=edges.flatMap(f=>[f.a[2],f.b[2]]),height=[Math.min(...zs),Math.max(...zs)],raw=M.origin(d,o);
 c.sources=edges.map(f=>({...f,height}));
 const paused=e.ctrlKey||e.metaKey||!$('#move-snap').checked,result=MoveSnapping.solve(c,[0,0,0],pixel(),paused),grid=e.ctrlKey||e.metaKey?raw:snap(raw);let desired=grid;
 if(result.guides.length){desired=M.add(raw,result.delta);const diff=M.sub(grid,raw);for(let i=0;i<2;i++)if(!result.axes?.[i]){const axis=i?scene.basis.down:scene.basis.r;desired=M.add(desired,M.mul(axis,M.dot(diff,axis)))}}
 o.position=M.sub(desired,[0,0,M.floor(d,o)?.height||0]);moveSnapGuides=result.guides;
}
