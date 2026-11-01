// Non-destructive edge cuts. Legacy documents keep their original geometry path.
(()=>{
'use strict';
const M=window.StudioModel,P=window.polygonClipping,geometry=M.geometry,validGeometry=M.validGeometry,validHole=M.validHole,validate=M.validate,footprint=M.footprint,EPS=1e-7;
const area=r=>r.reduce((s,a,i)=>{const b=r[(i+1)%r.length];return s+a[0]*b[1]-b[0]*a[1]},0)/2;
const open=r=>r.length>1&&Math.hypot(...M.sub(r[0],r.at(-1)))<EPS?r.slice(0,-1):r;
const ccw=r=>area(r)<0?[...r].reverse():r;
const frameXY={origin:[0,0,0],r:[1,0,0],d:[0,1,0],n:[0,0,1]},frameXZ={origin:[0,0,0],r:[1,0,0],d:[0,0,1],n:[0,-1,0]};
const at=(f,p,z=0)=>M.add(f.origin,M.add(M.mul(f.r,p[0]),M.add(M.mul(f.d,p[1]),M.mul(f.n,z))));
function newFeature(o){return !!(o.edgeCut||o.footprintCurves||o.equalArc||o.arcEdit)}
M.footprint=o=>{
 if(o.footprintCurves)return M.contour({points:o.wallFootprint,curves:o.footprintCurves,arcEdit:true});
 if(!o.equalArc)return o.wallPath||o.wallFootprint?footprint(o):M.wallFootprint(o);
 const [a,b]=o.wallPath.points,arc=M.arc(a,b,o.wallPath.curves[0]),half=o.thickness/2;
 if(!arc.angle){const v=M.unit([...M.sub(b,a),0]),n=[-v[1]*half,v[0]*half];return [M.add(a,n),M.add(b,n),M.sub(b,n),M.sub(a,n)]}
 if(arc.radius<=half+EPS)return [];
 const steps=Math.min(128,Math.max(8,Math.ceil(Math.abs(arc.angle)/(Math.PI/48)))),side=offset=>Array.from({length:steps+1},(_,i)=>{const p=arc.point(i/steps),v=M.sub(p,arc.center);return M.add(arc.center,M.mul(v,(arc.radius+offset)/arc.radius))});
 return [...side(half),...side(-half).reverse()];
};
function hostSolid(o){
 if(o.type==='plane')return {ring:ccw(M.contour(o)),f:frameXY,lo:-o.thickness,hi:0};
 if(o.wallFootprint||o.wallPath){const [lo,hi]=M.wallLevels(o);return {ring:ccw(M.footprint(o)),f:frameXY,lo,hi}}
 return {ring:ccw(M.contour(o)),f:frameXZ,lo:-o.thickness/2,hi:o.thickness/2};
}
function cutters(d,o,solid){const vertices=solid.ring.flatMap(p=>[at(solid.f,p,solid.lo),at(solid.f,p,solid.hi)]);return M.holes(d,o).map(h=>{const f=h.cut||(o.type==='plane'?frameXY:frameXZ),depth=vertices.map(p=>M.frameCoordinates(f,p)[2]);return {h,ring:ccw(M.contour(h)),f,lo:Math.min(...depth)-1,hi:Math.max(...depth)+1}})}
function face(points,owner,side=1,holes=[]){return {points,holes,owner,side,merged:true,edgeSolid:true}}
function extrude(polygons,s,o){const out=[],orient=M.dot(M.cross(s.f.r,s.f.d),s.f.n)>0?1:-1;
 for(const polygon of polygons){const rings=polygon.map(open);if(!rings[0]?.length)continue;
  for(const [z,sign,shade] of [[s.hi,orient,1],[s.lo,-orient,.8]]){const rr=rings.map(r=>r.map(p=>at(s.f,p,z)));if(sign<0)rr.forEach(r=>r.reverse());out.push(face(rr[0],o,shade,rr.slice(1)))}
  for(const ring of rings)for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length],points=[at(s.f,a,s.lo),at(s.f,b,s.lo),at(s.f,b,s.hi),at(s.f,a,s.hi)];if(orient<0)points.reverse();out.push(face(points,o,.76))}
 }return out;
}
function parts(s){return (M.convex(s.ring)?[s.ring]:M.triangles(s.ring)).map(r=>M.prism(r,s.f,s.lo,s.hi))}
function merge(polys,o){const groups=new Map();for(const p of polys){if(!M.nonzero(p))continue;const n=M.faceNormal(p),w=M.dot(n,p[0]),key=[...n,w].map(v=>Math.round(v*1e6)).join(',');let g=groups.get(key);if(!g){const r=M.unit(M.sub(p[1],p[0])),d=M.cross(n,r);g={f:{origin:p[0],r,d,n},rings:[]};groups.set(key,g)}const ring=open(p.map(p=>M.frameCoordinates(g.f,p).slice(0,2).map(v=>Math.round(v*1e6)/1e6))).filter((v,i,a)=>!i||Math.hypot(...M.sub(v,a[i-1]))>EPS);if(ring.length>=3&&Math.abs(area(ring))>EPS)g.rings.push([ring])}
 const out=[];for(const g of groups.values()){if(!g.rings.length)continue;// Coplanar union is cosmetic; preserve the clipped faces if numeric stitching fails.
 let result;try{result=P.union(...g.rings)}catch{result=g.rings}for(const polygon of result){const rings=polygon.map(r=>open(r).map(p=>at(g.f,p)));out.push(face(rings[0],o,.85,rings.slice(1)))}}return out;
}
function localGeometry(d,o){const s=hostSolid(o);if(s.ring.length<3)return [];const cuts=cutters(d,o,s);
 // Parallel cuts are a single 2-D Boolean, including overlapping cuts and islands.
 if(cuts.every(c=>Math.abs(M.dot(M.unit(c.f.n),s.f.n))>1-1e-7&&Math.abs(M.dot(c.f.r,s.f.n))<EPS&&Math.abs(M.dot(c.f.d,s.f.n))<EPS)){
  const rings=cuts.map(c=>[c.ring.map(p=>M.frameCoordinates(s.f,at(c.f,p)).slice(0,2))]);
  return extrude(rings.length?P.difference([s.ring],...rings):[[s.ring]],s,o);
 }
 const hostParts=parts(s),cs=cuts.map(c=>({...c,parts:parts(c)})),out=[];
 for(const f of extrude([[s.ring]],s,o)){
  // Only caps may be concave. Triangulate them before convex clipping.
  const faces=f.points.length>4||!M.convex(f.points.map(p=>M.frameCoordinates(s.f,p).slice(0,2)))&&Math.abs(M.dot(M.faceNormal(f.points),s.f.n))>.99
   ?M.triangles(f.points.map(p=>M.frameCoordinates(s.f,p).slice(0,2))).map(r=>{const z=M.frameCoordinates(s.f,f.points[0])[2],p=r.map(v=>at(s.f,v,z));if(M.dot(M.faceNormal(p),M.faceNormal(f.points))<0)p.reverse();return p}):[f.points];
  let remaining=faces;for(const c of cs)for(const part of c.parts)remaining=remaining.flatMap(p=>M.subtract(p,part.planes));out.push(...remaining);
 }
 for(const c of cs)for(const f of extrude([[c.ring]],c,o)){
  if(Math.abs(M.dot(M.faceNormal(f.points),M.unit(c.f.n)))>.99)continue;
  for(const part of hostParts){let p=f.points;for(const bound of part.planes)p=M.clip(p,bound);let remaining=M.nonzero(p)?[p]:[];for(const other of cs)if(other!==c)for(const piece of other.parts)remaining=remaining.flatMap(p=>M.subtract(p,piece.planes));for(const p of remaining)out.push([...p].reverse())}
 }
 return merge(out,o);
}
const uses=(d,o)=>['plane','wall'].includes(o.type)&&(newFeature(o)||M.holes(d,o).some(h=>h.edgeCut));
M.geometry=(d,o)=>uses(d,o)?localGeometry(d,o).map(f=>({...f,points:f.points.map(p=>M.world(d,o,p)),holes:f.holes.map(r=>r.map(p=>M.world(d,o,p)))})):geometry(d,o);
function holeValid(d,h){const host=d.objects.find(o=>o.id===h.host);return !!host&&['plane','wall'].includes(host.type)&&host.floor===h.floor&&M.simple(M.contour(h))&&(!h.cut||['origin','r','d','n'].every(k=>Array.isArray(h.cut[k])&&h.cut[k].length===3&&h.cut[k].every(Number.isFinite))&&Math.abs(M.dot(h.cut.r,M.cross(h.cut.d,h.cut.n)))>EPS)}
M.validHole=(d,h)=>h.edgeCut?holeValid(d,h):validHole(d,h);
for(const name of ['move','rotate']){const original=M[name];M[name]=(d,ids,...args)=>{for(const h of d.objects)if(h.type==='hole'&&ids.includes(h.id)&&!ids.includes(h.host))h.edgeCut=true;return original(d,ids,...args)}}
M.validGeometry=d=>{try{
 const hosts=d.objects.filter(o=>uses(d,o)),ids=new Set(hosts.map(o=>o.id));
 if(!validGeometry({...d,objects:d.objects.filter(o=>!ids.has(o.id)&&!ids.has(o.host))}))return false;
 for(const o of hosts){const s=hostSolid(o);if(!M.simple(s.ring)||s.hi-s.lo<1||!M.holes(d,o).every(h=>holeValid(d,h)))return false;const faces=M.geometry(d,o);if(!faces.length)return false;const volume=faces.reduce((sum,f)=>sum+[f.points,...f.holes].reduce((sum,r)=>sum+r.slice(1,-1).reduce((v,p,i)=>v+M.dot(r[0],M.cross(p,r[i+2]))/6,0),0),0);if(Math.abs(volume)<1e-5)return false}
 return true;
 }catch{return false}};
M.validate=input=>{const p=M.clone(input);if(p.version===8)p.version=7;
 const num=n=>Number.isFinite(n)&&Math.abs(n)<1e6;
 for(const d of p.documents||[])for(const o of d.objects||[]){
  if(o.arcEdit!==undefined&&(o.arcEdit!==true||!['plane','hole','wall'].includes(o.type)))throw Error('圆弧编辑数据无效');
  if(o.edgeCut!==undefined&&(o.type!=='hole'||o.edgeCut!==true))throw Error('跨边空洞数据无效');
  if(o.footprintCurves!==undefined&&(o.type!=='wall'||!o.wallFootprint||!Array.isArray(o.footprintCurves)||o.footprintCurves.length!==o.wallFootprint.length||o.footprintCurves.some(n=>!num(n)||Math.abs(n)>1)))throw Error('墙体圆弧参数无效');
  if(o.equalArc!==undefined&&(o.type!=='wall'||o.equalArc!==true||!o.wallPath||o.wallPath.points.length!==2||o.wallPath.curves?.length!==1||Math.abs(o.wallPath.curves[0])>1))throw Error('等厚弯墙参数无效');
 }
 const v=validate(p);if(v.documents.some(d=>d.objects.some(newFeature)))v.version=8;return v;
};
M.edgeCutIntersects=(d,h)=>{const o=d.objects.find(o=>o.id===h.host);if(!o)return false;const s=hostSolid(o),c=cutters({...d,objects:[o,h]},o,s)[0];if(!c)return false;const projected=extrude([[s.ring]],s,o).map(f=>f.points.map(p=>M.frameCoordinates(c.f,p).slice(0,2))).filter(M.simple);return projected.length>0&&P.intersection(P.union(...projected.map(r=>[r])),[c.ring]).length>0};
M.straightenWall=(d,o)=>{
 if(!o.equalArc||!o.wallPath)throw Error('请选择等厚弯墙');
 const [a,b]=o.wallPath.points,v=M.sub(b,a),length=Math.hypot(...v);if(length<1)throw Error('两个端点距离太近，不能转直墙');
 const u=[v[0]/length,v[1]/length,0],n=[-u[1],u[0],0],offset=[...a,0],toNew=p=>{const q=M.sub(p,offset);return [M.dot(q,u),M.dot(q,n),q[2]]},direction=p=>[M.dot(p,u),M.dot(p,n),p[2]];
 for(const h of d.objects.filter(h=>h.host===o.id)){const f=h.cut||frameXZ;h.edgeCut=true;h.cut={origin:toNew(f.origin),r:direction(f.r),d:direction(f.d),n:direction(f.n)}}
 const height=o.wallPath.height;o.position=M.add(o.position,M.mat(o.orientation,offset));o.orientation=M.product(o.orientation,[u[0],n[0],0,u[1],n[1],0,0,0,1]);o.points=[[0,0],[length,0],[length,height],[0,height]];
 delete o.equalArc;delete o.wallPath;delete o.wallFootprint;delete o.footprintCurves;delete o.curves;delete o.shape;
};
Object.assign(M,{edgeGeometry:localGeometry,usesEdgeGeometry:uses,hasEdgeFeature:newFeature});
})();
