(()=>{
'use strict';const M=window.StudioModel,R=window.StudioRender,scene=R.scene,P=window.polygonClipping;
R.scene=(d,view,options={})=>{const s=scene(d,view,options),cache=new Map();
 for(const h of d.objects.filter(o=>o.type==='hole'&&o.edgeCut)){
  const entries=s.holeHits.filter(x=>x.id===h.id);s.holeHits=s.holeHits.filter(x=>x.id!==h.id);if(!entries.length)continue;
  const host=d.objects.find(o=>o.id===h.host);if(!host||host.visible===false)continue;
  let outline=cache.get(host.id);if(!outline){const uncut={...d,objects:d.objects.filter(o=>o.host!==host.id)},polys=M.edgeGeometry(uncut,host).map(f=>f.points.map(p=>M.project(M.world(d,host,p),s.basis))).filter(p=>M.simple(p));outline=polys.length?P.union(...polys.map(p=>[p])):[];cache.set(host.id,outline)}
  const ring=M.contour(h).map(p=>M.project(M.world(d,host,h.cut?M.holePoint(h,p):M.facePoint(host,p)),s.basis));
  if(outline.length&&M.simple(ring))for(const p of P.intersection(outline,[ring]))s.holeHits.push({...entries[0],poly:p[0].slice(0,-1)});
 }return s;
};
})();
