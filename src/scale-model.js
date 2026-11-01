// Optional measurement metadata. Geometry always stays in the original units.
(()=>{
'use strict';const M=window.StudioModel,validate=M.validate;
const defaults={enabled:false,metersPerUnit:.02,gridStep:40,snapStep:10,followGrid:false};
function scaleConfig(d){return {...defaults,...d?.scaleSettings}}
function metric(d){return d?.type==='space'&&scaleConfig(d).enabled}
function lengthText(d,value,cm=false){return metric(d)?`${+(value*scaleConfig(d).metersPerUnit*(cm?100:1)).toFixed(5)} ${cm?'cm':'m'}`:`${+value.toFixed(5)} ${d.unit||'单位'}`}
function gridInterval(d,r){const base=scaleConfig(d).gridStep;return base*Math.max(1,2**Math.ceil(Math.log2(Math.max(r.w/60,r.h/100)/base)))}
function snapInterval(d){const c=scaleConfig(d);return c.followGrid?c.gridStep:c.snapStep}
function boundary(d){return d?.type==='space'&&d.mapBoundary?.enabled?d.mapBoundary:null}
function cubicExtrema(a,b,c,d){const A=-a+3*b-3*c+d,B=2*(a-2*b+c),C=b-a,roots=[];if(Math.abs(A)<1e-12){if(Math.abs(B)>1e-12)roots.push(-C/B)}else{const disc=B*B-4*A*C;if(disc>=0){roots.push((-B+Math.sqrt(disc))/(2*A),(-B-Math.sqrt(disc))/(2*A))}}return roots.filter(t=>t>0&&t<1).map(t=>a*(1-t)**3+3*b*(1-t)**2*t+3*c*(1-t)*t*t+d*t**3)}
function objectBounds(d,o){
 if(['text','marker','hole'].includes(o.type))return null;
 let points;if(o.type==='route'){
  points=o.points.map(p=>M.world(d,o,p));
  if(o.curve==='smooth'&&points.length>2){const padded=[points[0],...points,points.at(-1)],extra=[];
   for(let i=1;i<padded.length-2;i++){const [v,a,b,z]=padded.slice(i-1,i+3),c=a.map((n,j)=>n+(b[j]-v[j])/8),e=b.map((n,j)=>n-(z[j]-a[j])/8);for(let j=0;j<2;j++)for(const n of cubicExtrema(a[j],c[j],e[j],b[j])){const p=[...a];p[j]=n;extra.push(p)}}points.push(...extra)
  }
 }else {points=(M.geometryForBoundary||M.geometry)(d,o).flatMap(f=>f.points);
  if(!M.holes(d,o).length&&['plane','wall'].includes(o.type)){const fp=o.wallFootprint||o.wallPath,shape=fp?footprintContour(o):o,levels=fp?M.wallLevels(o):o.type==='plane'?[-o.thickness,0]:[-o.thickness/2,o.thickness/2];for(const z of levels)points.push(...contourExtrema(shape,p=>M.world(d,o,fp||o.type==='plane'?[...p,z]:[p[0],z,p[1]])))}
 }
 if(!points.length)return null;return {x:Math.min(...points.map(p=>p[0])),y:Math.min(...points.map(p=>p[1])),right:Math.max(...points.map(p=>p[0])),bottom:Math.max(...points.map(p=>p[1]))}
}
function outside(d,o){const b=boundary(d),r=b&&objectBounds(d,o);return !!r&&(r.x< -1e-7||r.y< -1e-7||r.right>b.width+1e-7||r.bottom>b.height+1e-7)}
function boundaryViolations(d){return boundary(d)?d.objects.filter(o=>outside(d,o)):[]}
function checkBoundary(d,before,ids=null){
 if(boundary(d)?.mode!=='hard')return;
 const old=new Map((before?.objects||[]).map(o=>[o.id,o])),now=new Map(d.objects.map(o=>[o.id,o])),affected=new Set(),all=JSON.stringify(d.mapBoundary)!==JSON.stringify(before?.mapBoundary);
 // A cutter changes its host even when the host's own fields have not changed.
 for(const id of new Set([...old.keys(),...now.keys()])){const a=old.get(id),b=now.get(id);if(JSON.stringify(a)!==JSON.stringify(b)){affected.add(id);if(a?.host)affected.add(a.host);if(b?.host)affected.add(b.host)}}
 for(const o of d.objects){if(!all&&!affected.has(o.id)&&M.floor(d,o)?.height===before?.floors?.find(f=>f.id===o.floor)?.height)continue;if(outside(d,o))throw Error('组件超出地图边界，本次修改已恢复；可在顶部地图边界设置中改为仅提醒。')}
}
// Exact circular extrema for dimension readouts; no denser render mesh needed.
function contourExtrema(o,transform=p=>p){
 const points=o.points||[],out=points.map(transform),tau=Math.PI*2;
 const addArc=(a,b,bulge)=>{const c=M.arc(a,b,bulge);if(!c.angle)return;const center=transform(c.center),u=M.sub(transform(M.add(c.center,[1,0])),center),v=M.sub(transform(M.add(c.center,[0,1])),center),start=Math.atan2(a[1]-c.center[1],a[0]-c.center[0]);for(let axis=0;axis<center.length;axis++)for(const angle of [Math.atan2(v[axis],u[axis]),Math.atan2(v[axis],u[axis])+Math.PI]){const delta=((c.angle>0?angle-start:start-angle)%tau+tau)%tau;if(delta<=Math.abs(c.angle)+1e-10)out.push(transform(c.point(delta/Math.abs(c.angle))))}};
 if(o.shape==='ellipse'){
  const [a,b,c,d]=points;if(!a||!d)return out;
  // Affine ellipses have analytic extrema; deformed legacy quadrilaterals retain their sampled shape.
  if(Math.hypot(...M.sub(M.add(a,c),M.add(b,d)))>1e-7)return M.contour(o).map(transform);
  const center=M.mul(M.add(a,c),.5),u=M.mul(M.sub(b,a),.5),v=M.mul(M.sub(d,a),.5),tc=transform(center),tu=M.sub(transform(M.add(center,u)),tc),tv=M.sub(transform(M.add(center,v)),tc);
  const result=[];for(let axis=0;axis<tc.length;axis++)for(const t of [Math.atan2(tv[axis],tu[axis]),Math.atan2(tv[axis],tu[axis])+Math.PI])result.push(transform(M.add(center,M.add(M.mul(u,Math.cos(t)),M.mul(v,Math.sin(t))))));return result
 }
 for(let i=0;i<points.length;i++)addArc(points[i],points[(i+1)%points.length],o.curves?.[i]||0);return out
}
function footprintContour(o){
 if(o.equalArc&&o.wallPath?.points.length===2){const [a,b]=o.wallPath.points,bulge=o.wallPath.curves?.[0]||0,c=M.arc(a,b,bulge);if(c.radius){const at=(p,offset)=>M.add(c.center,M.mul(M.sub(p,c.center),(c.radius+offset)/c.radius)),t=o.thickness/2;return {points:[at(a,t),at(b,t),at(b,-t),at(a,-t)],curves:[bulge,0,-bulge,0]}}}
 return o.wallFootprint?{points:o.wallFootprint,curves:o.footprintCurves}:{points:M.footprint(o)}
}
function outlineMeasurements(d,o){
 let contour,vertical=false;
 if(o.wallPath||o.wallFootprint){contour=footprintContour(o)}
 else if(o.points){contour=o;vertical=o.type==='wall'}else return null;
 let points=contourExtrema(contour);
 if(o.type!=='hole'&&M.holes(d,o).length)points=M.geometry(d,o).flatMap(f=>f.points.map(p=>{const q=M.local(d,o,p);return vertical?[q[0],q[2]]:q.slice(0,2)}));
 if(!points.length)return null;return {width:Math.max(...points.map(p=>p[0]))-Math.min(...points.map(p=>p[0])),depth:Math.max(...points.map(p=>p[1]))-Math.min(...points.map(p=>p[1]))}
}
function pathLength(points,curves=[],closed=false){return points.slice(0,closed?points.length:-1).reduce((sum,a,i)=>{const b=points[(i+1)%points.length],arc=M.arc(a,b,curves[i]||0);return sum+(arc.radius?Math.abs(arc.angle)*arc.radius:Math.hypot(...M.sub(b,a)))},0)}

M.validate=input=>{const p=validate(input);for(const d of p.documents){const c=d.scaleSettings,b=d.mapBoundary,num=(v,min,max)=>Number.isFinite(v)&&v>=min&&v<=max;
 if(c!==undefined&&(d.type!=='space'||!c||Array.isArray(c)||typeof c.enabled!=='boolean'||!num(c.metersPerUnit,.000001,100)||!num(c.gridStep,.01,500000)||!num(c.snapStep,.01,500000)||typeof c.followGrid!=='boolean'))throw Error('比例尺设置无效');
 if(b!==undefined&&(d.type!=='space'||!b||Array.isArray(b)||typeof b.enabled!=='boolean'||!num(b.width,1,500000)||!num(b.height,1,500000)||!['warn','hard'].includes(b.mode)))throw Error('地图边界设置无效');
 if(b?.enabled&&b.mode==='hard'&&boundaryViolations(d).length)b.mode='warn';
 }return p};
Object.assign(M,{scaleConfig,metric,lengthText,gridInterval,snapInterval,boundary,objectBounds,boundaryViolations,checkBoundary,contourExtrema,outlineMeasurements,pathLength});
})();
