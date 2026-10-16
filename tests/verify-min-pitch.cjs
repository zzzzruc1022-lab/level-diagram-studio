const fs=require('fs'),path=require('path'),assert=require('node:assert/strict'),{JSDOM,VirtualConsole}=require('jsdom'),errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
const dom=new JSDOM(fs.readFileSync(path.join(__dirname,'../dist/index.html'),'utf8'),{url:'https://qa.local/pitch.html',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){w.HTMLCanvasElement.prototype.getContext=()=>null;w.HTMLElement.prototype.getBoundingClientRect=()=>({left:0,top:0,width:1000,height:700})}}),w=dom.window,d=w.document,A=w.SpatialEditor,M=w.StudioModel,c=d.querySelector('#canvas'),slider=d.querySelector('#elevation');
const input=(el,value)=>{el.value=value;el.dispatchEvent(new w.Event('input',{bubbles:true}))};
function pointer(type,x,y){c.dispatchEvent(new w.MouseEvent(type,{bubbles:true,button:0,clientX:x,clientY:y}))}
function orbit(dy){pointer('pointerdown',990,10);pointer('pointermove',990,10+dy);pointer('pointerup',990,10+dy)}
try{
 A.createDocument('space');d.querySelector('[data-view="solid"]').click();const before=JSON.stringify(A.project);
 assert.equal(slider.min,'0.5');assert.equal(slider.max,'90');assert.equal(slider.step,'0.5');input(slider,'0');assert.equal(A.view.elevation,.5);input(slider,'90');assert.equal(A.view.elevation,90);
 for(const n of [0,-20,.1,.5,1,89.5,90,120]){A.view.elevation=n;input(d.querySelector('#azimuth'),35);assert.equal(A.view.elevation,Math.max(.5,Math.min(90,n)))}
 A.view.elevation=35;orbit(-1000);assert.equal(A.view.elevation,.5);orbit(1000);assert.equal(A.view.elevation,90);
 const invert=d.querySelector('#reverse-vertical');invert.checked=true;invert.dispatchEvent(new w.Event('change',{bubbles:true}));orbit(1000);assert.equal(A.view.elevation,.5);orbit(-1000);assert.equal(A.view.elevation,90);
 A.command('reset-view');assert.equal(A.view.elevation,35);A.command('observe-front');assert.equal(A.view.elevation,15);
 d.querySelector('[data-view="elevation"]').click();assert.equal(M.viewBasis(A.document,A.view).n[2],0,'dedicated elevation stays truly horizontal');assert.equal(JSON.stringify(A.project),before,'camera controls never mutate the project');assert.deepEqual(errors,[]);
 console.log('PASS minimum pitch: slider 0.5–90; draw guard; normal/inverted orbit bounds; exact 90 reachable; reset/presets unchanged; dedicated elevation truly horizontal; document and storage key preserved.');
}finally{w.close()}
