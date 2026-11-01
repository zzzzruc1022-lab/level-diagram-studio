// Edge controls share the existing vertex tool and undo transaction.
let queuedPointer=null,pointerFrame=0;
function flushPointer(){if(pointerFrame)cancelAnimationFrame(pointerFrame);pointerFrame=0;const e=queuedPointer;queuedPointer=null;if(e)pointerMove(e)}
let edgeMode='straight',edgeSelection=null,edgeFrame=0,edgePending=null;
function holeTarget(id){const o=doc().objects.find(o=>o.id===id);return o&&holeHost(o)}
function holeHost(o=obj()){const h=o?.type==='hole'?doc().objects.find(x=>x.id===o.host):o;return h&&!h.locked&&h.visible!==false&&h.floor===doc().activeFloor&&(view.mode==='plan'&&h.type==='plane'||view.mode==='elevation'&&h.type==='wall')?h:null}
function edgeInfo(o=obj()){
 if(!o||!['plane','wall','hole'].includes(o.type)||o.shape==='ellipse'||view.mode==='solid')return null;
 if(o.type==='wall'&&view.mode==='plan'){
  const center=!!o.equalArc,points=center?o.wallPath.points:M.wallFootprint(o),curves=center?o.wallPath.curves:o.footprintCurves||[],z=M.wallLevels(o)[1];
  return {o,points,curves,center,footprint:!center,world:p=>M.world(doc(),o,[...p,z]),local:p=>M.local(doc(),o,p).slice(0,2),normal:M.mat(o.orientation,[0,0,1])};
 }
 if(o.wallPath)return null;const f=objectPlane(o);return {o,points:o.points,curves:o.curves||[],world:f.world,local:f.local,normal:f.normal};
}
function ensureEdge(info){const o=info.o;if(info.center)return o.wallPath;
 if(info.footprint){o.wallFootprint??=M.clone(info.points);o.footprintCurves??=o.wallFootprint.map(()=>0);for(const h of M.holes(doc(),o))h.cut??={origin:[0,0,0],r:[1,0,0],d:[0,0,1],n:[0,-1,0]};return {points:o.wallFootprint,curves:o.footprintCurves}}
 o.arcEdit=true;if(o.type==='hole')o.edgeCut=true;o.curves??=o.points.map(()=>0);return o;
}
function edgeHandles(){if(tool!=='vertex'||!enabled('vertex'))return '';const f=edgeInfo();if(!f||!f.footprint&&!f.center)return '';let s='';for(let i=0;i<(f.center?1:f.points.length);i++){const p=M.project(f.world(M.arc(f.points[i],f.points[(i+1)%f.points.length],f.curves[i]||0).point(.5)),scene.basis),r=pixel()*4;s+=`<circle data-edge-mid="${i}" cx="${p[0]}" cy="${p[1]}" r="${pixel()*11}" fill="transparent"/><circle data-edge-mid="${i}" cx="${p[0]}" cy="${p[1]}" r="${r}" fill="white" stroke="#3977df" stroke-width="${pixel()*1.4}"/>`}return s}
function beginEdgeEdit(e,q){const mid=e.target.closest('[data-edge-mid],[data-midpoint]');if(!mid||tool!=='vertex'||locked())return false;const f=edgeInfo();if(!f)return false;const i=Number(mid.dataset.edgeMid??mid.dataset.midpoint);edgeSelection={id:primary,index:i};
 if(edgeMode==='straight'&&!f.center){if(!f.footprint)return false;const before=snapshot(),target=ensureEdge(f),proxy={points:target.points,curves:target.curves},index=M.insertContourVertex(proxy,i);obj().wallFootprint=proxy.points;obj().footprintCurves=proxy.curves;M.syncWallProfile(obj());const p=M.controls(doc(),obj(),view.mode).find(c=>c.index===index).point;vertexIndex=index;drag={kind:'vertex',before,index,start:q,last:q,anchor:p,changed:true,objectId:primary};capture(e);drawCanvas();return true}
 drag={kind:'arc-edge',before:snapshot(),objectId:primary,index:i,start:q,last:q,anchor:f.world(M.arc(f.points[i],f.points[(i+1)%f.points.length],f.curves[i]||0).point(.5)),changed:false};capture(e);inspector();status('拖动虚点调整圆弧 · 两端保持不动 · Esc 取消本次拖动');return true;
}
function moveArcEdge(q){edgePending=q;if(!edgeFrame)edgeFrame=requestAnimationFrame(()=>{edgeFrame=0;flushArcEdge()})}
function flushArcEdge(){if(!edgePending||drag?.kind!=='arc-edge'){edgePending=null;return}const q=edgePending;edgePending=null;const f=edgeInfo(),a=f.points[drag.index],b=f.points[(drag.index+1)%f.points.length],v=M.sub(b,a),length=Math.hypot(...v);if(length<1e-6)return;const p=f.local(M.unproject(q,scene.basis,drag.anchor,f.normal)),s=M.dot(M.sub(p,M.mul(M.add(a,b),.5)),[-v[1]/length,v[0]/length]),bulge=Math.abs(s)<pixel()*2?0:clamp(2*s/length,-1,1),target=ensureEdge(f),old=target.curves[drag.index];target.curves[drag.index]=bulge;
 const ring=f.footprint||f.center?M.footprint(f.o):M.contour(f.o);if(!M.simple(ring)){target.curves[drag.index]=old;status('圆弧不能自交或使墙内侧折叠，已保留上一个有效形状');return}
 drag.changed=true;drag.last=q;drawCanvas();status('圆弧弓高 '+M.lengthText(doc(),bulge*length/2)+' · Esc 取消');
}
const edgeEndDrag=endDrag;endDrag=function(cancel=false){if(!cancel)flushPointer();else{queuedPointer=null;if(pointerFrame)cancelAnimationFrame(pointerFrame);pointerFrame=0}if(!cancel)flushArcEdge();else edgePending=null;if(edgeFrame){cancelAnimationFrame(edgeFrame);edgeFrame=0}M.endGeometryPreview();edgeEndDrag(cancel)};
function deleteFootprintVertex(){const o=obj();if(o.equalArc){status('等厚弯墙保留两个端点');return}mutate(()=>{const f=ensureEdge(edgeInfo()),proxy={points:f.points,curves:f.curves};if(proxy.points.length<=3)throw Error('轮廓至少需要三个角点');M.removeContourVertex(proxy,vertexIndex);o.wallFootprint=proxy.points;o.footprintCurves=proxy.curves;M.syncWallProfile(o);vertexIndex=null;edgeSelection=null})}
function makeEqualWall(){const o=obj();if(!o||o.type!=='wall'||locked()||view.mode!=='plan')return;mutate(()=>{if(o.equalArc)return;const p=M.footprint(o),b=bounds2(p),z=M.wallLevels(o),cy=(b.min[1]+b.max[1])/2,holes=doc().objects.filter(h=>h.type==='hole'&&h.host===o.id);
  for(const h of holes)h.cut??={origin:[0,0,0],r:[1,0,0],d:[0,0,1],n:[0,-1,0]};
  o.wallPath={points:[[b.min[0],cy],[b.max[0],cy]],curves:[0],height:z[1]-z[0]};o.equalArc=true;o.position=M.add(o.position,M.mat(o.orientation,[0,0,z[0]]));for(const h of holes)h.cut.origin[2]-=z[0];delete o.wallFootprint;delete o.footprintCurves;delete o.curves;o.points=[[b.min[0],0],[b.max[0],0],[b.max[0],z[1]-z[0]],[b.min[0],z[1]-z[0]]];edgeMode='arc';edgeSelection={id:o.id,index:0};tool='vertex';
 },'已转为等厚墙 · 拖动中心虚点弯曲 · Ctrl+Z 可撤销')}
function makeStraightWall(){const o=obj();if(!o?.equalArc||locked())return;mutate(()=>{M.straightenWall(doc(),o);edgeSelection=null;vertexIndex=null;tool='select'},'已转为普通直墙，端点、墙高和墙厚保留 · Ctrl+Z 可撤销')}
const edgeInspector=inspector;inspector=function(){edgeInspector();const o=obj();if(!o)return;const disabled=locked()?'disabled':'',f=edgeInfo();let html='';
 if(tool==='hole')html+=`<p class="group-note">当前切割宿主：${R.esc(holeHost()?.name||'平面图选平面，立面图选墙壁')}<br>可从边缘外起笔；Esc／右键退出。</p>`;
 if(o.type==='hole'&&o.edgeCut)html+=`<p class="group-note">${M.edgeCutIntersects(doc(),o)?'与宿主相交':'未相交 · 可移回宿主'} · 可跨边、重叠切割<br>${o.cut&&Math.abs(o.cut.n[2])>.9?'沿高度贯穿':'沿创建时的方向贯穿'}；删除空洞可恢复宿主。</p>`;
 if(f&&tool==='vertex'){
  if(!f.center)html+=`<div class="property"><label for="edge-mode">边线编辑</label><select id="edge-mode" ${disabled}><option value="straight" ${edgeMode==='straight'?'selected':''}>添加角点</option><option value="arc" ${edgeMode==='arc'?'selected':''}>调整圆弧</option></select></div>`;
  if(f.center)html+='<p class="group-note">等厚弯墙：虚点始终调整弯曲。两端固定，墙厚保持一致。</p>';else html+='<p class="group-note">圆弧模式：向内拖为内凹，向外拖为外凸。只调整当前边；转角处不自动圆滑。</p>';
  if(edgeSelection?.id===o.id&&f.points[edgeSelection.index]){const i=edgeSelection.index,a=f.points[i],b=f.points[(i+1)%f.points.length],bulge=f.curves[i]||0,length=Math.hypot(...M.sub(b,a)),c=M.arc(a,b,bulge),factor=M.metric(doc())?M.scaleConfig(doc()).metersPerUnit:1;
   html+=`<div class="property"><label for="edge-bulge">弓高 / ${M.metric(doc())?'m':R.esc(doc().unit||'单位')}</label><input id="edge-bulge" type="number" step="any" value="${+(bulge*length/2*factor).toFixed(5)}" ${disabled}></div><small>${c.radius?'弧长':'边长'}：${M.lengthText(doc(),c.radius?Math.abs(c.angle)*c.radius:length)} · 半径：${c.radius?M.lengthText(doc(),c.radius):'直线'}</small><button id="edge-straight" ${disabled}>当前边恢复直线</button>`;
  }
 }
 if(o.equalArc)html+=`<button id="straight-wall" ${disabled}>转为普通直墙</button><small>连接当前两个端点；保留墙高、墙厚与空洞位置。可撤销。</small>`;
 if(o.type==='wall'&&view.mode==='plan'&&!o.equalArc)html+=`<button id="equal-wall" ${disabled}>${o.wallFootprint||o.wallPath?'替换现有轮廓，转为等厚墙':'转为等厚弯墙'}</button><small>轮廓编辑可改变墙厚；等厚弯墙按中心线弯曲。转换可撤销。</small>`;
 $('#properties').insertAdjacentHTML('afterbegin','<div class="edge-editing-panel">'+html+'</div>');
 $('#edge-mode')?.addEventListener('change',e=>{edgeMode=e.target.value;drawCanvas();canvasFocus()});
 const changeBulge=value=>{const f=edgeInfo(),i=edgeSelection.index,length=Math.hypot(...M.sub(f.points[(i+1)%f.points.length],f.points[i]));mutate(()=>{const b=value*2/length;if(!Number.isFinite(b)||Math.abs(b)>1)throw Error('弓高绝对值不能超过边长的一半');ensureEdge(f).curves[i]=b},'已调整当前圆弧')};
 $('#edge-bulge')?.addEventListener('change',e=>changeBulge(Number(e.target.value)/(M.metric(doc())?M.scaleConfig(doc()).metersPerUnit:1)));
 $('#edge-straight')?.addEventListener('click',()=>changeBulge(0));$('#equal-wall')?.addEventListener('click',makeEqualWall);$('#straight-wall')?.addEventListener('click',makeStraightWall);
};

const edgeDraw=drawCanvas;drawCanvas=function(){edgeDraw();if(drag?.deferred)status('复杂切割：拖动时显示编辑轮廓，松手后计算完整结果')};

function makeEdgeHole(d,host,p,shape){const b=bounds2(p),o=M.createObject(d,'hole');o.edgeCut=true;o.host=host.id;o.floor=host.floor;if(host.type==='wall'&&view.mode!=='elevation')throw Error('请切换到立面图给墙壁开洞');if(host.type==='wall'){const center=[(b.min[0]+b.max[0])/2,(b.min[1]+b.max[1])/2],world=M.unproject(center,scene.basis,M.origin(d,host)),inverse=M.transpose(host.orientation);o.cut={origin:M.local(d,host,world),r:M.mat(inverse,scene.basis.r),d:M.mat(inverse,scene.basis.down),n:M.mat(inverse,scene.basis.n)};o.points=p.map(q=>M.sub(q,center))}else o.points=p.map(q=>{const world=M.unproject(q,scene.basis,M.world(d,host,[0,0,0]),M.normal(host));return M.local(d,host,world).slice(0,2)});if(shape==='ellipse')o.shape='ellipse';return o}
function cutPreview(){if(drag?.type!=='hole')return;drag.cutInvalid=!drag.host;if(!drag.host)return;const host=doc().objects.find(o=>o.id===drag.host),d=M.clone({...doc(),objects:doc().objects.filter(o=>o.id===host.id||o.host===host.id)});if(host.type==='wall'&&(d.objects.length>4||drag.shape==='ellipse'&&(host.wallPath||host.wallFootprint||d.objects.length>1))){status('复杂切割：松手后检查完整结果');return}try{d.objects.push(makeEdgeHole(d,d.objects.find(o=>o.id===host.id),drag.points,drag.shape));drag.cutInvalid=!M.validGeometry(d)}catch{drag.cutInvalid=true}if(drag.cutInvalid)status('红色范围不可用：不能完全切空宿主；松手将恢复')}
