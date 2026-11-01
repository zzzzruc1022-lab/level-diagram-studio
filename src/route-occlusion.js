// Vector masks use the existing, already-cut faces. No second 3D engine or pixel readback.
(()=>{
'use strict';const M=window.StudioModel,R=window.StudioRender,faceCache=new WeakMap(),routeCache=new WeakMap(),validate=M.validate;
M.validate=input=>{const p=validate(input);for(const d of p.documents)for(const o of d.objects||[])if(o.type==='route'){
 if(o.occlusion!==undefined&&!['always','spatial'].includes(o.occlusion))throw Error('路线遮挡方式无效');
 for(const key of ['occludePlan','hiddenDashed'])if(o[key]!==undefined&&typeof o[key]!=='boolean')throw Error('路线遮挡设置无效');
}return p};
const enabled=(o,v)=>o.occlusion==='spatial'&&(v.mode!=='plan'||o.occludePlan===true);
const box=ps=>({x:Math.min(...ps.map(p=>p[0])),y:Math.min(...ps.map(p=>p[1])),right:Math.max(...ps.map(p=>p[0])),bottom:Math.max(...ps.map(p=>p[1]))});
function clip(poly,fn){const out=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],da=fn(a),db=fn(b);if(da>=0)out.push(a);if((da>=0)!==(db>=0)){const t=da/(da-db);out.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t])}}return out}
function prepare(d,faces,basis){
 const relevant=faces.filter(f=>!f.ghost&&f.opacity>0&&['plane','wall','stairs','ladder','spiral'].includes(f.owner.type));
 const key=JSON.stringify([basis,relevant.map(f=>[f.points,f.holes,f.opacity])]),old=faceCache.get(d);if(old?.key===key)return old.value;
 const value=[];for(const f of relevant){const ps=f.poly,z=f.points.map(p=>M.dot(p,basis.n));if(!ps||ps.length<3)continue;let coeff;
  for(let i=1;i<ps.length-1;i++){const a=M.sub(ps[i],ps[0]),b=M.sub(ps[i+1],ps[0]),det=a[0]*b[1]-a[1]*b[0];if(Math.abs(det)<1e-8)continue;const u=z[i]-z[0],v=z[i+1]-z[0],x=(u*b[1]-a[1]*v)/det,y=(a[0]*v-u*b[0])/det;coeff=[x,y,z[0]-x*ps[0][0]-y*ps[0][1]];break}
  if(coeff)value.push({poly:ps,holes:f.cutouts||[],bounds:box(ps),coeff,opacity:Math.min(1,f.opacity)});
 }faceCache.set(d,{key,value});return value;
}
function worldSamples(d,o){const p=o.points.map(p=>M.world(d,o,p));if(o.curve!=='smooth'||p.length<3)return p;const out=[p[0]],a=[p[0],...p,p.at(-1)],steps=Math.min(24,Math.max(2,Math.floor(4096/(p.length-1))));
 for(let i=1;i<a.length-2;i++){const [v,w,x,y]=a.slice(i-1,i+3),b=M.add(w,M.mul(M.sub(x,v),1/8)),c=M.sub(x,M.mul(M.sub(y,w),1/8));for(let j=1;j<=steps;j++){const t=j/steps,u=1-t;out.push([0,1,2].map(k=>u*u*u*w[k]+3*u*u*t*b[k]+3*u*t*t*c[k]+t*t*t*x[k]))}}return out;
}
function render(d,o,basis,faces,opacity,margin=24){
 const key=JSON.stringify([o,M.origin(d,o),basis,opacity,margin]),old=routeCache.get(o);if(old?.key===key&&old.faces===faces)return old.value;
 const world=worldSamples(d,o),points=world.map(p=>M.project(p,basis)),depths=world.map(p=>M.dot(p,basis.n)),pieces=[];let offset=0,defs='',outlines='',fills='',ghost='',autoOuter='',autoInner='';
 function piece(ps,da,db,head=false){const bounds=box(ps),a=ps[0],b=ps.at(-1),v=M.sub(b,a),len2=M.dot(v,v),length=Math.sqrt(len2),depth=q=>head||len2<1e-12?da:da+(db-da)*M.dot(M.sub(q,a),v)/len2;
  const masks=[];for(const f of faces){const fb=f.bounds;if(fb.right<bounds.x-margin||fb.x>bounds.right+margin||fb.bottom<bounds.y-margin||fb.y>bounds.bottom+margin)continue;const fn=q=>f.coeff[0]*q[0]+f.coeff[1]*q[1]+f.coeff[2]-depth(q)-1e-5,poly=clip(f.poly,fn);if(poly.length<3)continue;const holes=f.holes.map(h=>clip(h,fn)).filter(h=>h.length>=3);masks.push({poly,holes,opacity:f.opacity,path:R.path(poly,true)+' '+holes.map(h=>R.path(h,true)).join(' ')})}
  const id='route-depth-'+o.id+'-'+pieces.length,rect=`x="${bounds.x-margin}" y="${bounds.y-margin}" width="${bounds.right-bounds.x+2*margin}" height="${bounds.bottom-bounds.y+2*margin}"`,mask=(suffix,inverse)=>`<mask id="${id+suffix}" maskUnits="userSpaceOnUse" ${rect} style="mask-type:luminance"><rect ${rect} fill="${inverse?'black':'white'}"/>${masks.map(f=>`<path d="${f.path}" fill="${inverse?'white':'black'}" fill-rule="evenodd" opacity="${f.opacity}"/>`).join('')}</mask>`;
  if(masks.length)defs+=mask('',false)+mask('-hidden',true);const wrap=(s,hidden=false)=>masks.length?`<g mask="url(#${id+(hidden?'-hidden':'')})">${s}</g>`:hidden?'':s;
  const path=R.path(ps,head),dash=o.style==='dashed'?'12 8':o.style==='dotted'?'1 7':'',attrs=`stroke-linejoin="round" stroke-linecap="round"${dash&&!head?` stroke-dasharray="${dash}" stroke-dashoffset="${-offset}"`:''}`;
  const shape=(color,width,fill=head?color:'none')=>`<path d="${path}" fill="${fill}" stroke="${color}" stroke-width="${width}" ${attrs}/>`;
  if(o.hiddenDashed)ghost+=wrap(`<path data-route-hidden="true" d="${path}" fill="${head?o.color:'none'}" stroke="${o.color}" stroke-width="${head?0:o.width}" stroke-dasharray="5 7" stroke-dashoffset="${-offset}" opacity=".22"/>`,true);
  if(o.outlineWidth&&o.outlineMode!=='auto')outlines+=wrap(shape(o.outlineColor,head?o.outlineWidth*2:o.width+o.outlineWidth*2));
  fills+=wrap(shape(o.color,head?0:o.width));
  if(o.outlineWidth&&o.outlineMode==='auto'){autoOuter+=wrap(shape('white',head?o.outlineWidth*2:o.width+o.outlineWidth*2));autoInner+=wrap(shape('black',head?0:o.width))}
  pieces.push({points:ps,head,mask:masks.length?id:null,masks,offset});if(!head)offset+=length;
 }
 for(let i=0;i<points.length-1;i++)if(Math.hypot(...M.sub(points[i+1],points[i]))>1e-8)piece([points[i],points[i+1]],depths[i],depths[i+1]);
 const heads=R.routeShape(d,o,basis).heads;let index=0;if(['end','both'].includes(o.arrow))piece(heads[index++],depths.at(-1),depths.at(-1),true);if(['start','both'].includes(o.arrow))piece(heads[index],depths[0],depths[0],true);
 const value={html:`<g data-object="${o.id}" data-route-spatial="true" opacity="${opacity}"><defs>${defs}</defs>${ghost}${outlines}${fills}</g>`,autoMask:autoOuter?`<g opacity="${opacity}">${autoOuter}${autoInner}</g>`:'',pieces};routeCache.set(o,{key,faces,value});return value;
}
function visibleAt(q,result,tolerance){return result.pieces.some(p=>{if(p.head){if(!M.inside(q,p.points))return false}else if(R.distance(q,p.points)>tolerance)return false;return !p.masks.some(f=>f.opacity>.98&&M.inside(q,f.poly)&&!f.holes.some(h=>M.inside(q,h)))})}
const pick=R.pickAll;R.pickAll=(q,s,d,v,options={})=>pick(q,s,d,v,options).filter(h=>options.through||!s.routeOcclusion?.has(h.id)||visibleAt(q,s.routeOcclusion.get(h.id),s.tolerance||8));
Object.assign(R,{routeOcclusionEnabled:enabled,prepareRouteOcclusion:prepare,occludedRoute:render,routeVisibleAt:visibleAt});
})();
