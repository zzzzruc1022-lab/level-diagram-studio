// Optional map furniture shares the map's projection and physical scale.
(()=>{
'use strict';const M=window.StudioModel,R=window.StudioRender,validate=M.validate;
function config(d){return {rulerEnabled:M.metric(d),rulerPlacement:'map',northEnabled:false,northPlacement:'map',northAngle:0,...d.mapInfo}}
const mode=(view,scene)=>view?.mode||scene?.scaleView||'plan';
function eligible(d,view,scene){const c=config(d),v=mode(view,scene),space=d.type==='space';return {c,ruler:space&&M.metric(d)&&v!=='solid'&&c.rulerEnabled,north:space&&v==='plan'&&c.northEnabled}}
function projectedNorth(d,scene){const a=config(d).northAngle*Math.PI/180,v=[Math.sin(a),-Math.cos(a),0],basis=scene.basis;return Math.atan2(M.dot(v,basis.r),-M.dot(v,basis.down))*180/Math.PI}
function arrow(d,scene,x,y,k,color,halo){const angle=projectedNorth(d,scene);return `<g data-north-arrow="true" data-north-angle="${angle}" pointer-events="none" transform="translate(${x} ${y}) scale(${k})"><g transform="rotate(${angle})" stroke-linecap="round" stroke-linejoin="round"><path d="M 0 19 V -14" fill="none" stroke="${halo}" stroke-width="5"/><path d="M 0 19 V -14" fill="none" stroke="${color}" stroke-width="2.5"/><path d="M 0 -24 L 8 -5 L 0 -9 L -8 -5 Z" fill="${color}" stroke="${halo}" stroke-width="1.5"/></g><text x="0" y="42" text-anchor="middle" font-size="13" fill="${color}" stroke="${halo}" stroke-width="3" paint-order="stroke">规划北 N</text></g>`}
function mapNorth(d,scene,r,width,height,view){const e=eligible(d,view,scene);if(!e.north||e.c.northPlacement!=='map'||width<160||height<100)return '';const k=r.w/width,color=R.contrast(d.background),halo=color==='#000000'?'#ffffff':'#000000';return arrow(d,scene,r.x+r.w-58*k,r.y+44*k,k,color,halo)}
function mapInfoFooter(d,scene,r,width,view){const e=eligible(d,view,scene),ruler=e.ruler&&e.c.rulerPlacement==='footer',north=e.north&&e.c.northPlacement==='footer';if(!ruler&&!north)return {height:0,markup:''};const height=110,k=r.w/width,t=R.legendTheme(d);let markup=`<g data-map-info-footer="true"><rect data-legend-background="true" width="${width}" height="${height}" fill="${t.background}"/>`;
 if(north)markup+=arrow(d,scene,58,42,1,t.color,t.halo);
 // The inner ruler is in map units. This uniform transform restores page pixels,
 // so moving the ruler to the footer does not change the represented distance.
 if(ruler)markup+=`<g transform="scale(${1/k})">${R.scaleBar({...d,background:t.background},{x:0,y:0,w:r.w,h:height*k},width,height)}</g>`;
 return {height,markup:markup+'</g>'}
}
function hasExportFooter(d,view){const e=eligible(d,view);return M.legendConfig(d).enabled||e.ruler&&e.c.rulerPlacement==='footer'||e.north&&e.c.northPlacement==='footer'}
function exportFooter(d,scene,r,width,view){const legend=R.legendLayout(d,scene,r,width),info=mapInfoFooter(d,scene,r,width,view);if(!info.height)return legend;return {height:legend.height+info.height,rows:legend.rows,markup:legend.markup+`<g transform="translate(0 ${legend.height})">${info.markup}</g>`}}
M.validate=input=>{const p=validate(input);for(const d of p.documents){const c=d.mapInfo;if(c===undefined)continue;if(!c||Array.isArray(c)||typeof c!=='object'||typeof c.rulerEnabled!=='boolean'||typeof c.northEnabled!=='boolean'||!['map','footer'].includes(c.rulerPlacement)||!['map','footer'].includes(c.northPlacement)||!Number.isFinite(c.northAngle)||c.northAngle<0||c.northAngle>360)throw Error('地图信息设置无效')}return p};
Object.assign(M,{mapInfo:config});Object.assign(R,{mapInfoFooter,mapNorth,hasExportFooter,exportFooter});
})();
