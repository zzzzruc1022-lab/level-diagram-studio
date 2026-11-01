(()=>{
'use strict';const R=window.StudioRender,M=window.StudioModel,oldScene=R.scene;
function sample(points,kind){if(points.length<3)return points;const out=[];if(kind==='monotone'){const slopes=points.slice(1).map((p,i)=>(p[1]-points[i][1])/(p[0]-points[i][0]||1e-6)),m=points.map((_,i)=>i===0?slopes[0]:i===points.length-1?slopes.at(-1):slopes[i-1]*slopes[i]<=0?0:2/(1/slopes[i-1]+1/slopes[i]));for(let i=0;i<points.length-1;i++){const p=points[i],q=points[i+1],dx=(q[0]-p[0])/3;segment(p,[p[0]+dx,p[1]+m[i]*dx],[q[0]-dx,q[1]-m[i+1]*dx],q,out)}}else{const a=[points[0],...points,points.at(-1)];for(let i=1;i<a.length-2;i++){const [v,w,x,y]=a.slice(i-1,i+3);segment(w,[w[0]+(x[0]-v[0])/8,w[1]+(x[1]-v[1])/8],[x[0]-(y[0]-w[0])/8,x[1]-(y[1]-w[1])/8],x,out)}}return out}
function segment(a,b,c,d,out){for(let j=0;j<=24;j++){const t=j/24,u=1-t;out.push([0,1].map(i=>u*u*u*a[i]+3*u*u*t*b[i]+3*u*t*t*c[i]+t*t*t*d[i]))}}
function distance(p,line){let min=Infinity;for(let i=0;i<line.length-1;i++){const a=line[i],b=line[i+1],dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy||1)));min=Math.min(min,Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy))}return min}
function grid(d,view,basis,camera,viewportWidth=1200){
 const r=camera||{x:0,y:0,w:d.width,h:d.height},step=M.gridInterval?M.gridInterval(d,r):40*Math.max(1,2**Math.ceil(Math.log2(r.w/2400))),line=(a,b,opacity=.28)=>`<path d="${R.path([a,b])}" stroke="#98a6b6" stroke-width="${r.w/1200*.6}" opacity="${opacity}"/>`;
 let s='<g data-viewport-grid="true" pointer-events="none">';
 if(view.mode!=='solid'){
 const fixed=d.gridDisplay!=='adaptive',base=M.scaleConfig?M.scaleConfig(d).gridStep:40,px=(camera?.w||d.width)/Math.max(1,viewportWidth);
 for(const gap of fixed?[base,base*10]:[step]){const opacity=Math.max(0,Math.min(1,(gap/px-4)/10));if(!opacity||r.w/gap+r.h/gap>1500)continue;for(let x=Math.floor(r.x/gap)*gap;x<r.x+r.w+gap;x+=gap)if(!fixed||gap!==base||Math.round(x/base)%10)s+=`<g opacity="${opacity}">${line([x,r.y],[x,r.y+r.h],fixed&&gap!==base?.42:.28)}</g>`;for(let y=Math.floor(r.y/gap)*gap;y<r.y+r.h+gap;y+=gap)if(!fixed||gap!==base||Math.round(y/base)%10)s+=`<g opacity="${opacity}">${line([r.x,y],[r.x+r.w,y],fixed&&gap!==base?.42:.28)}</g>`}return s+'</g>'}

 // Work in the projected viewport: inverse ground projection diverges at 0 degrees.
 // Each line family has at most 101 lines, regardless of pitch, zoom or aspect.
 const t=Math.min(1,Math.abs(basis.n[2])/Math.sin(Math.PI/60)),fade=t*t*(3-2*t);
 s=`<g data-viewport-grid="true" pointer-events="none" opacity="${fade}">`;if(!fade)return s+'</g>';
 const base=M.project([0,0,0],basis),axes=[[basis.r[0],basis.down[0]],[basis.r[1],basis.down[1]]],corners=[[r.x,r.y],[r.x+r.w,r.y],[r.x+r.w,r.y+r.h],[r.x,r.y+r.h]],span=Math.hypot(r.w,r.h),center=[r.x+r.w/2,r.y+r.h/2],minGap=span/100;
 for(let i=0;i<2;i++){const direction=axes[1-i],length=Math.hypot(...direction);if(length<1e-10)continue;const u=M.mul(direction,1/length);let n=[-u[1],u[0]],gap=M.dot(n,axes[i])*step;if(Math.abs(gap)<1e-10)continue;if(gap<0){gap=-gap;n=M.mul(n,-1)}gap*=2**Math.max(0,Math.ceil(Math.log2(minGap/gap)));const phase=M.dot(n,base),values=corners.map(p=>M.dot(n,p)),lo=Math.ceil((Math.min(...values)-phase)/gap),hi=Math.floor((Math.max(...values)-phase)/gap);
  for(let j=lo;j<=hi;j++){const q=M.add(center,M.mul(n,phase+j*gap-M.dot(n,center))),delta=M.mul(u,span);s+=line(M.sub(q,delta),M.add(q,delta))}
 }
 return s+'</g>'
}
R.scene=(d,view,options={})=>{const show=d.gridVisible;let s;d.gridVisible=false;try{s=oldScene(d,view,options)}finally{d.gridVisible=show}s.outlines=new Map();s.tolerance=options.tolerance||10;if(show&&d.type==='space')s.grid=grid(d,view,s.basis,options.camera,options.viewport?.width||d.width);s.grid??='';
 for(const o of d.objects){if(!o.visible||M.floor(d,o)?.visible===false)continue;const ghost=view.mode==='plan'&&o.floor&&o.floor!==d.activeFloor;if(ghost&&!options.ghost)continue;
  if(['plane','wall','stairs','ladder','spiral'].includes(o.type)){let p=M.geometry(d,o).flatMap(f=>f.points).map(p=>M.project(p,s.basis)),outline=M.hull(p);if(o.type==='plane'&&Math.abs(M.dot(M.normal(o),s.basis.n))>.999)outline=o.points.map(p=>M.project(M.world(d,o,[...p,0]),s.basis));s.outlines.set(o.id,{poly:outline});if(!ghost&&o.type==='ladder')s.hits.push({id:o.id,poly:outline,depth:0,body:true})}
  if(o.type==='hole'){const p=M.controls(d,o,view.mode).map(c=>M.project(c.point,s.basis));s.outlines.set(o.id,{poly:p});if(o.cut&&!ghost)s.holeHits.push({id:o.id,host:o.host,poly:p})}
  if(o.type==='text'&&s.textBoxes.has(o.id))s.outlines.set(o.id,{poly:s.textBoxes.get(o.id).corners});
  if(o.type==='marker')s.outlines.set(o.id,{circle:{p:M.project(M.origin(d,o),s.basis),r:o.r}});
  if(o.type==='route'){const p=o.points.map(p=>M.project(M.world(d,o,p),s.basis)),sampled=o.curve==='smooth'?sample(p,'smooth'):p;s.outlines.set(o.id,{line:sampled,control:p,arrow:o.arrow,heads:R.routeShape(d,o,s.basis).heads});for(const h of s.hits.filter(h=>h.id===o.id&&h.line))h.line=sampled}
 }
 if(d.curve){const events=[...d.curve.events].sort((a,b)=>R.eventX(d,a)-R.eventX(d,b)),p=events.map(e=>R.eventPoint(d,e));s.curveLine=sample(p,'monotone');s.curveEvents=events}
 return s};
const oldPick=R.pickAll;R.pickAll=(q,s,d,view,options={})=>{const out=oldPick(q,{...s,hits:s.hits.filter(h=>!h.line&&!h.body)},d,view,options),lines=s.hits.filter(h=>h.line&&distance(q,h.line)<s.tolerance),bodies=s.hits.filter(h=>h.body&&M.inside(q,h.poly)),curve=s.curveLine&&distance(q,s.curveLine)<s.tolerance?[{curve:true}]:[];return [...out.filter(h=>h.event||h.edit||h.id&&d.objects.find(o=>o.id===h.id)?.type==='text'),...lines,...curve,...bodies,...out.filter(h=>!h.event&&!h.edit&&(!h.id||d.objects.find(o=>o.id===h.id)?.type!=='text'))].filter((h,i,a)=>a.findIndex(v=>v.id===h.id&&v.event===h.event&&v.edit===h.edit&&v.curve===h.curve)===i)};
// Selection-only geometry: never added to the rendered or exported scene.
const bandScene=R.scene;
R.scene=(d,view,options={})=>{const s=bandScene(d,view,options);if(view.mode==='elevation'){
 const depths=new Map();for(const f of s.faces)if(!f.ghost&&f.owner.type==='stairs')for(const p of f.points)depths.set(f.owner.id,Math.max(depths.get(f.owner.id)??-Infinity,M.dot(p,s.basis.n)));
 s.stairPickBands=[...depths].map(([id,depth])=>({id,depth,poly:s.outlines.get(id)?.poly||[]})).filter(b=>b.poly.length>=3);
 }return s};
function wallOverlap(s,d,wallId){
 const area=p=>Math.abs(p.reduce((v,a,i)=>{const b=p[(i+1)%p.length];return v+a[0]*b[1]-a[1]*b[0]},0))/2;
 const bounds=p=>({x:Math.min(...p.map(v=>v[0])),y:Math.min(...p.map(v=>v[1])),r:Math.max(...p.map(v=>v[0])),b:Math.max(...p.map(v=>v[1]))});
 const meets=(a,b)=>a.x<b.r&&a.r>b.x&&a.y<b.b&&a.b>b.y,regions=new Map();
 const add=(id,poly,holes=[])=>{if(poly.length<3||area(poly)<1e-7)return;if(!regions.has(id))regions.set(id,[]);regions.get(id).push({poly:[poly,...holes.filter(h=>h.length>=3)],box:bounds(poly)})};
 for(const f of s.faces)if(!f.ghost)add(f.owner.id,f.poly,f.cutouts||[]);
 const walls=regions.get(wallId);if(!walls?.length)return [];
 for(const h of s.hits){if(!h.id||regions.has(h.id))continue;if(h.poly)add(h.id,h.poly);else if(h.line){const t=s.tolerance*.3;for(let i=1;i<h.line.length;i++){const a=h.line[i-1],b=h.line[i],len=Math.hypot(...M.sub(b,a));if(!len)continue;const n=[-(b[1]-a[1])*t/len,(b[0]-a[0])*t/len];add(h.id,[M.add(a,n),M.add(b,n),M.sub(b,n),M.sub(a,n)])}}}
 const wallBox=bounds(walls.flatMap(w=>w.poly[0])),result=[];
 // Broad-phase bounds first; exact projected intersection only until the first match.
 for(const o of d.objects){const parts=regions.get(o.id);if(o.id===wallId||o.visible===false||M.floor(d,o)?.visible===false||!parts)continue;
  if(parts.some(p=>meets(p.box,wallBox)&&walls.some(w=>meets(p.box,w.box)&&window.polygonClipping.intersection(p.poly,w.poly).some(poly=>area(poly[0])-poly.slice(1).reduce((v,h)=>v+area(h),0)>1e-7))))result.push(o);
 }return result.reverse();
}
Object.assign(R,{sample,distance,viewportGrid:grid,wallOverlap});
})();
