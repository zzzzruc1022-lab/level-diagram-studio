(()=>{
'use strict';const R=window.StudioRender,M=window.StudioModel,oldScene=R.scene;
function sample(points,kind){if(points.length<3)return points;const out=[];if(kind==='monotone'){const slopes=points.slice(1).map((p,i)=>(p[1]-points[i][1])/(p[0]-points[i][0]||1e-6)),m=points.map((_,i)=>i===0?slopes[0]:i===points.length-1?slopes.at(-1):slopes[i-1]*slopes[i]<=0?0:2/(1/slopes[i-1]+1/slopes[i]));for(let i=0;i<points.length-1;i++){const p=points[i],q=points[i+1],dx=(q[0]-p[0])/3;segment(p,[p[0]+dx,p[1]+m[i]*dx],[q[0]-dx,q[1]-m[i+1]*dx],q,out)}}else{const a=[points[0],...points,points.at(-1)];for(let i=1;i<a.length-2;i++){const [v,w,x,y]=a.slice(i-1,i+3);segment(w,[w[0]+(x[0]-v[0])/8,w[1]+(x[1]-v[1])/8],[x[0]-(y[0]-w[0])/8,x[1]-(y[1]-w[1])/8],x,out)}}return out}
function segment(a,b,c,d,out){for(let j=0;j<=24;j++){const t=j/24,u=1-t;out.push([0,1].map(i=>u*u*u*a[i]+3*u*u*t*b[i]+3*u*t*t*c[i]+t*t*t*d[i]))}}
function distance(p,line){let min=Infinity;for(let i=0;i<line.length-1;i++){const a=line[i],b=line[i+1],dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy||1)));min=Math.min(min,Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy))}return min}
function grid(d,view,basis,camera){
 const r=camera||{x:0,y:0,w:d.width,h:d.height},step=40*Math.max(1,2**Math.ceil(Math.log2(r.w/2400))),line=(a,b)=>`<path d="${R.path([a,b])}" stroke="#98a6b6" stroke-width="${r.w/1200*.6}" opacity=".28"/>`;
 let s='<g data-viewport-grid="true" pointer-events="none">';
 if(view.mode!=='solid'){for(let x=Math.floor(r.x/step)*step;x<r.x+r.w+step;x+=step)s+=line([x,r.y],[x,r.y+r.h]);for(let y=Math.floor(r.y/step)*step;y<r.y+r.h+step;y+=step)s+=line([r.x,y],[r.x+r.w,y]);return s+'</g>'}
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
R.scene=(d,view,options={})=>{const show=d.gridVisible;let s;d.gridVisible=false;try{s=oldScene(d,view,options)}finally{d.gridVisible=show}s.outlines=new Map();s.tolerance=options.tolerance||10;if(show&&d.type==='space')s.geom=grid(d,view,s.basis,options.camera)+s.geom;
 for(const o of d.objects){if(!o.visible||M.floor(d,o)?.visible===false)continue;const ghost=view.mode==='plan'&&o.floor&&o.floor!==d.activeFloor;if(ghost&&!options.ghost)continue;
  if(['plane','wall','stairs','ladder','spiral'].includes(o.type)){let p=M.geometry(d,o).flatMap(f=>f.points).map(p=>M.project(p,s.basis)),outline=M.hull(p);if(o.type==='plane'&&Math.abs(M.dot(M.normal(o),s.basis.n))>.999)outline=o.points.map(p=>M.project(M.world(d,o,[...p,0]),s.basis));s.outlines.set(o.id,{poly:outline});if(!ghost&&o.type==='ladder')s.hits.push({id:o.id,poly:outline,depth:0,body:true})}
  if(o.type==='hole'){const p=M.controls(d,o,view.mode).map(c=>M.project(c.point,s.basis));s.outlines.set(o.id,{poly:p});if(o.cut&&!ghost)s.holeHits.push({id:o.id,host:o.host,poly:p})}
  if(o.type==='text'&&s.textBoxes.has(o.id))s.outlines.set(o.id,{poly:s.textBoxes.get(o.id).corners});
  if(o.type==='marker')s.outlines.set(o.id,{circle:{p:M.project(M.origin(d,o),s.basis),r:o.r}});
  if(o.type==='route'){const p=o.points.map(p=>M.project(M.world(d,o,p),s.basis)),sampled=o.curve==='smooth'?sample(p,'smooth'):p;s.outlines.set(o.id,{line:sampled,control:p,arrow:o.arrow,heads:R.routeShape(d,o,s.basis).heads});for(const h of s.hits.filter(h=>h.id===o.id&&h.line))h.line=sampled}
 }
 if(d.curve){const events=[...d.curve.events].sort((a,b)=>R.eventX(d,a)-R.eventX(d,b)),p=events.map(e=>R.eventPoint(d,e));s.curveLine=sample(p,'monotone');s.curveEvents=events}
 return s};
const oldPick=R.pickAll;R.pickAll=(q,s,d,view)=>{const out=oldPick(q,{...s,hits:s.hits.filter(h=>!h.line&&!h.body)},d,view),lines=s.hits.filter(h=>h.line&&distance(q,h.line)<s.tolerance),bodies=s.hits.filter(h=>h.body&&M.inside(q,h.poly)),curve=s.curveLine&&distance(q,s.curveLine)<s.tolerance?[{curve:true}]:[];return [...out.filter(h=>h.event||h.edit||h.id&&d.objects.find(o=>o.id===h.id)?.type==='text'),...lines,...curve,...bodies,...out.filter(h=>!h.event&&!h.edit&&(!h.id||d.objects.find(o=>o.id===h.id)?.type!=='text'))].filter((h,i,a)=>a.findIndex(v=>v.id===h.id&&v.event===h.event&&v.edit===h.edit&&v.curve===h.curve)===i)};
Object.assign(R,{sample,distance,viewportGrid:grid});
})();
