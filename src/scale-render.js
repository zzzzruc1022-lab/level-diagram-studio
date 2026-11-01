// The ruler is an overlay, excluded from content bounds and hit testing.
(()=>{
'use strict';const R=window.StudioRender,M=window.StudioModel,scene=R.scene,markup=R.markup;
function scaleBar(d,r,width,height,bottom=24){
 if(!M.metric(d)||width<160||height<100)return '';const factor=M.scaleConfig(d).metersPerUnit,units=r.w/width,target=Math.min(145,width*.3)*units*factor,power=10**Math.floor(Math.log10(target)),distance=[1,2,4,5,8,10].map(v=>v*power).reduce((a,b)=>Math.abs(b-target)<Math.abs(a-target)?b:a),pixels=distance/(units*factor),pad=20,x=r.x+r.w-(pad+pixels)*units,y=r.y+r.h-bottom*r.h/height,k=r.h/height,font=12*k,ticks=7*k,color=R.contrast(d.background),halo=color==='#000000'?'#ffffff':'#000000',small=distance<1,mult=small?100:1,suffix=small?'cm':'m',labels=[0,distance/2,distance];
 const path=`M ${x} ${y-ticks} V ${y} H ${x+pixels*units} V ${y-ticks} M ${x+pixels*units/2} ${y} V ${y-ticks}`;
 return `<g data-scale-bar="true" data-distance-m="${distance}" data-bar-length="${pixels*units}" pointer-events="none" fill="${color}" stroke-linecap="round"><path d="${path}" fill="none" stroke="${halo}" stroke-width="${4*k}"/><path d="${path}" fill="none" stroke="${color}" stroke-width="${1.5*k}"/>${labels.map((v,i)=>`<text x="${x+pixels*units*i/2}" y="${y-ticks-5*k}" text-anchor="${i===0?'start':i===2?'end':'middle'}" font-size="${font}" stroke="${halo}" stroke-width="${3*k}" paint-order="stroke">${+(v*mult).toPrecision(6)}${i===2?' '+suffix:''}</text>`).join('')}</g>`
}
function projectedBoundary(d,basis){const b=M.boundary(d);if(!b)return null;const p=[[0,0,0],[b.width,0,0],[b.width,b.height,0],[0,b.height,0]].map(p=>M.project(p,basis));return {points:p,x:Math.min(...p.map(p=>p[0])),y:Math.min(...p.map(p=>p[1])),w:Math.max(...p.map(p=>p[0]))-Math.min(...p.map(p=>p[0])),h:Math.max(...p.map(p=>p[1]))-Math.min(...p.map(p=>p[1]))}}
R.scene=(d,view,options={})=>{const s=scene(d,view,options),b=projectedBoundary(d,s.basis);s.scaleView=view.mode;s.scaleViewport=options.viewport||{width:d.width,height:d.height};s.scaleRuler=options.ruler!==false;s.scaleBottom=options.rulerBottom||24;
 if(b){const r=options.camera||{x:0,y:0,w:d.width,h:d.height},k=r.w/(options.viewport?.width||d.width),color=options.invalidBoundary?'#c44242':R.contrast(d.background),p=R.path(b.points,true);let background='';if(view.mode==='plan'&&!options.exporting)background=`<path data-boundary-shade="true" d="M ${r.x} ${r.y} H ${r.x+r.w} V ${r.y+r.h} H ${r.x} Z ${p}" fill="${color}" opacity=".055" fill-rule="evenodd" pointer-events="none"/>`;
  s.geom+=background+`<g data-map-boundary="true" pointer-events="none"><path d="${p}" fill="none" stroke="${color}" stroke-width="${1.4*k}" stroke-dasharray="${6*k} ${4*k}"/><text x="${b.points[0][0]+8*k}" y="${b.points[0][1]+18*k}" font-size="${12*k}" fill="${color}" stroke="${d.background}" stroke-width="${3*k}" paint-order="stroke">${R.esc(M.lengthText(d,d.mapBoundary.width))} × ${R.esc(M.lengthText(d,d.mapBoundary.height))}</text></g>`
 }return s};
R.markup=(d,s,r,a=null)=>markup(d,s,r,a)+(s.scaleView!=='solid'&&s.scaleRuler?scaleBar(d,r,s.scaleViewport?.width||d.width,s.scaleViewport?.height||d.height,s.scaleBottom):'');
// R.svg closes over its original markup function, so append the same overlay explicitly.
const svg=R.svg;R.svg=(d,s,r,a=null,metadata=true)=>svg(d,s,r,a,metadata).replace('</svg>',(s.scaleView!=='solid'&&s.scaleRuler?scaleBar(d,r,s.scaleViewport?.width||d.width,s.scaleViewport?.height||d.height):'')+'</svg>');
Object.assign(R,{scaleBar,projectedBoundary});
})();
