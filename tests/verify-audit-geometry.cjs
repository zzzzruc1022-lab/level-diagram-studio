const assert=require('node:assert/strict'),{JSDOM,VirtualConsole}=require('jsdom'),html=require('./audit-geometry-runtime.cjs')();
const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
const dom=new JSDOM(html,{url:'https://qa.local/geometry',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){w.localStorage.setItem('level-diagram-studio:notice:1.1.0','seen');w.HTMLCanvasElement.prototype.getContext=()=>null;w.HTMLElement.prototype.getBoundingClientRect=()=>({left:0,top:0,width:1000,height:700});w.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','')};w.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open')};w.URL.createObjectURL=()=> 'blob:test';w.URL.revokeObjectURL=()=>{};w.HTMLAnchorElement.prototype.click=()=>{}}});
const w=dom.window,M=w.StudioModel,A=w.SpatialEditor,plain=v=>JSON.parse(JSON.stringify(v)),same=(a,b,msg)=>assert.deepEqual(plain(a),plain(b),msg),close=(a,b,msg)=>a.forEach((p,i)=>p.forEach((v,j)=>assert(Math.abs(v-b[i][j])<1e-8,msg)));
const load=d=>A.loadProject({format:'level-spatial-editor',version:8,documents:[d],activeDocument:d.id});
const worldCuts=()=>{const d=A.document;return d.objects.filter(o=>o.type==='hole').map(h=>h.points.map(p=>M.world(d,d.objects.find(o=>o.id===h.host),M.holePoint(h,p))))};
try{
 for(const bottom of [40,-25])for(const legacy of [false,true]){
  const d=M.createDocument('space','隐藏洞坐标回归');d.objects=[];d.floors[0].height=160;
  const wall=M.createObject(d,'wall',[300,300,20]);wall.points=[[-100,bottom],[100,bottom],[100,bottom+180],[-100,bottom+180]];wall.orientation=M.axisRotation([0,0,1],.4);d.objects.push(wall);
  for(const visible of [false,true]){const h=M.createObject(d,'hole');Object.assign(h,{host:wall.id,floor:wall.floor,visible,edgeCut:true,points:[[-30,bottom+40],[30,bottom+40],[30,bottom+100],[-30,bottom+100]]});if(!legacy)h.cut={origin:[0,0,0],r:[1,0,0],d:[0,0,1],n:[0,-1,0]};d.objects.push(h)}
  load(d);const before=worldCuts(),saved=plain(A.document.objects);A.select(wall.id,false,true);w.document.querySelector('#equal-wall').click();
  assert(A.document.objects[0].equalArc);worldCuts().forEach((p,i)=>close(p,before[i],'wall conversion preserves visible and hidden cutters in world coordinates'));
  assert.equal(A.document.objects[1].visible,false);assert(A.document.objects[1].cut,'hidden legacy cutter receives explicit frame');assert(M.validGeometry(A.document));
  A.command('undo');same(A.document.objects,saved,'conversion undo restores exact old objects');A.command('redo');worldCuts().forEach((p,i)=>close(p,before[i],'conversion redo preserves cutter coordinates'));
  const reopened=M.validate(plain(A.project));same(reopened,A.project,'converted hidden cut data saves and reopens without changes');
 }
 // Copying a host must offset it once and preserve the attached hole coordinates.
 const d=M.createDocument('space','空洞剪贴板回归');d.objects=[];const p=M.createObject(d,'plane',[300,300,0]);p.points=[[-150,-150],[150,-150],[150,150],[-150,150]];const h=M.createObject(d,'hole');Object.assign(h,{host:p.id,floor:p.floor,edgeCut:true,points:[[-30,-20],[30,-20],[30,20],[-30,20]]});d.objects.push(p,h);load(d);const before=plain(A.document.objects);
 A.select(p.id,false,true);A.command('copy');A.command('paste');let pasted=A.document.objects.slice(2);assert.equal(pasted.length,2);same(pasted[0].position,[325,325,0]);assert.equal(pasted[1].host,pasted[0].id);same(pasted[1].points,h.points,'hole follows copied host without double offset');A.command('undo');same(A.document.objects,before,'host and hole clipboard undo restores exactly');
 A.select(h.id,false,true);A.command('copy');A.command('paste');pasted=A.document.objects.at(-1);same(pasted.points,h.points.map(p=>[p[0]+25,p[1]+25]),'standalone hole uses the same clipboard offset as other objects');A.command('undo');same(A.document.objects,before,'standalone hole clipboard undo restores exactly');
 assert.deepEqual(errors,[]);console.log('PASS audit geometry: visible/hidden and legacy cutters retain world coordinates through wall conversion at positive/negative local heights, rotated hosts, raised floor; undo/redo/reopen; standalone and compound hole clipboard offsets and undo.');
}finally{dom.window.close()}
