const fs=require('fs'),path=require('path'),assert=require('node:assert/strict'),{JSDOM,VirtualConsole}=require('jsdom');
const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
const dom=new JSDOM(fs.readFileSync(path.join(__dirname,'../dist/index.html'),'utf8'),{url:'https://qa.local/spatial-update.html',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){w.HTMLCanvasElement.prototype.getContext=()=>null;w.HTMLElement.prototype.getBoundingClientRect=()=>({left:0,top:0,width:1000,height:700});w.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','')};w.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open')};w.URL.createObjectURL=()=> 'blob:test';w.URL.revokeObjectURL=()=>{};w.HTMLAnchorElement.prototype.click=()=>{}}});
const w=dom.window,d=w.document,A=w.SpatialEditor,M=w.StudioModel,R=w.StudioRender,S=w.StudioSnapping,c=d.querySelector('#canvas');
const near=(a,b,msg)=>assert(Math.abs(a-b)<1e-5,`${msg||''}: ${a} != ${b}`);
function add(doc,type,pos,props={}){const o=Object.assign(M.createObject(doc,type,pos),props);doc.objects.push(o);return o}
function blank(){A.createDocument('space');A.document.objects=[];A.setTool('select');d.querySelector('#snap').checked=false;return A.document}
function pointer(type,p,props={}){const a=A.camera;c.dispatchEvent(new w.MouseEvent(type,{bubbles:true,button:0,clientX:(p[0]-a.x)/a.w*1000,clientY:(p[1]-a.y)/a.h*700,...props}))}
function drag(a,b,props={}){pointer('pointerdown',a,props);pointer('pointermove',b,props);pointer('pointerup',b,props)}
function tap(a){pointer('pointerdown',a);pointer('pointerup',a)}
function refresh(){A.setTool(A.tool)}
function pick(q){return R.pickAll(q,A.scene,A.document,A.view)[0]?.id}
function solve(doc,src,total,mode='plan'){const view={mode,side:'front',scope:'all'},cache=S.prepare(doc,[src.id],M.viewBasis(doc,view),view,false);return S.solve(cache,total,1)}
try{
 for(const type of ['plane','wall']){blank();A.setTool(type);drag([100,100],[300,200]);const id=A.document.objects.at(-1).id;tap([1100,750]);assert.equal(A.tool,'select');assert.equal(A.selection.id,id);A.setTool(type);tap([150,150]);assert.equal(A.tool,'select');assert.equal(A.selection.id,id)}
 let doc=blank(),p=add(doc,'plane',[100,100,0],{points:[[0,0],[300,0],[300,300],[0,300]]}),p2=add(doc,'plane',[500,100,0],{points:[[0,0],[300,0],[300,300],[0,300]]});
 refresh();assert(!d.querySelector('[data-tool="hole"]').disabled);A.select(p.id,false,true);A.setTool('hole');assert(d.querySelector(`[data-selection-outline="${p.id}"]`));
 drag([150,150],[200,200]);let h=A.document.objects.at(-1);assert.equal(h.type,'hole');assert.equal(h.host,p.id);assert.equal(A.selection.id,h.id);assert.equal(A.tool,'hole');assert.equal(pick([175,175]),h.id);
 drag([550,150],[600,200]);h=A.document.objects.at(-1);assert.equal(h.host,p2.id);assert.equal(A.selection.id,h.id);tap([1100,750]);assert.equal(A.tool,'select');assert.equal(A.selection.id,h.id);
 A.select(p2.id);assert(!d.querySelector(`[data-selection-outline="${h.id}"]`),'dependent hole has no selection outline');
 A.setTool('hole');tap([120,120]);assert.equal(A.tool,'select');assert.equal(A.selection.id,p.id);
 A.setTool('hole');const count=A.document.objects.length;drag([390,390],[450,450]);assert.equal(A.document.objects.length,count,'out-of-host hole rejected');
 const saved=M.validate(JSON.parse(JSON.stringify(A.project)));saved.documents=saved.documents.filter(d=>d.id===doc.id);A.loadProject(saved);assert.equal(A.document.objects.filter(o=>o.type==='hole').length,2);A.command('undo');
 doc=blank();p=add(doc,'plane',[0,0,0],{points:[[0,0],[600,0],[600,600],[0,600]]});p2=add(doc,'plane',[100,100,0],{points:[[0,0],[100,0],[100,100],[0,100]]});refresh();assert.equal(pick([150,150]),p2.id);assert.equal(pick([50,50]),p.id);
 A.select(p.id,false,true);A.command('front');assert.equal(pick([150,150]),p.id,'opaque top plane blocks smaller one');A.command('back');assert.equal(pick([150,150]),p2.id);A.command('undo');assert.equal(pick([150,150]),p.id);A.command('redo');assert.equal(pick([150,150]),p2.id);
 p=A.document.objects.find(o=>o.id===p.id);p.position[2]=20;refresh();assert.equal(pick([150,150]),p.id,'actual raised geometry wins over layer order');
 // Creation snaps its initial cursor and the growing edge, even when the
 // dragged corner is beyond the other component's short edge.
 doc=blank();p=add(doc,'plane',[100,100,0],{points:[[0,0],[200,0],[200,200],[0,200]]});refresh();A.setTool('plane');drag([295,200],[500,400]);let created=A.document.objects.at(-1);near(M.origin(doc,created)[0]+Math.min(...created.points.map(p=>p[0])),300,'creation cursor snaps before drag');
 doc=blank();p=add(doc,'plane',[600,250,0],{points:[[0,0],[100,0],[100,100],[0,100]]});refresh();A.setTool('plane');drag([400,200],[595,500]);created=A.document.objects.at(-1);near(M.origin(doc,created)[0]+Math.max(...created.points.map(p=>p[0])),600,'growing edge snaps to short target');A.command('undo');A.setTool('plane');drag([400,200],[595,500],{ctrlKey:true});created=A.document.objects.at(-1);near(M.origin(A.document,created)[0]+Math.max(...created.points.map(p=>p[0])),595,'Ctrl bypasses creation snap');
 // Either direction can join the same connection edges.
 doc=blank();p=add(doc,'plane',[100,0,0],{points:[[0,0],[100,0],[100,100],[0,100]]});let s=add(doc,'stairs',[0,0,0],{flights:[{id:M.uid(),points:[[-20,-100],[20,-100],[20,0],[-20,0]],start:0,end:160,steps:12}]});near(solve(doc,s,[75,40,0]).delta[0],80);near(solve(doc,p,[-75,-40,0]).delta[0],-80);
 doc=blank();const wall=add(doc,'wall',[100,0,0],{thickness:20});s=add(doc,'stairs',[0,0,0],{flights:[{id:M.uid(),points:[[-20,-100],[20,-100],[20,0],[-20,0]],start:0,end:160,steps:12}]});assert(solve(doc,s,[-15,15,0]).guides.length,'stairs to wall');assert(solve(doc,wall,[15,-15,0]).guides.length,'wall to stairs');
 doc=blank();const ladder=add(doc,'ladder',[0,0,0]),spiral=add(doc,'spiral',[0,0,0]);near(ladder.end,160);near(spiral.end,160);const route=add(doc,'route',[0,0,0]);near(route.width,5);near(route.outlineWidth,.5);assert.equal(route.outlineMode,'auto');refresh();A.select(route.id,false,true);assert(d.querySelector('[data-route-selection="outline"]'));
 route.width=3;route.outlineWidth=0;delete route.outlineMode;const loaded=M.validate(JSON.parse(JSON.stringify(A.project)));const old=loaded.documents.at(-1).objects.find(o=>o.id===route.id);near(old.width,3);near(old.outlineWidth,0);assert.equal(old.outlineMode,'manual');
 doc=blank();p=add(doc,'plane',[100,100,0]);A.select(p.id,false,true);d.querySelector('[data-view="solid"]').click();A.select(p.id,false,true);const q=[A.camera.x+A.camera.w*.99,A.camera.y+A.camera.h*.01];drag(q,[q[0]-50,q[1]+30]);assert.equal(A.selection.id,p.id,'orbit drag preserves selection');tap(q);assert.equal(A.selection.ids.length,0,'solid blank click deselects');
 assert.deepEqual(errors,[]);console.log('PASS spatial update: creation exit/selection; cross-host holes, invalid holes and save; dependent outlines; visible layer picking, depth, reorder/undo; bidirectional snaps; defaults and legacy routes; route selection ring; solid click versus orbit.');
}finally{w.close()}
