const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{JSDOM,VirtualConsole}=require('jsdom');
const html=fs.readFileSync(path.join(__dirname,'../dist/index.html'),'utf8'),KEY='level-diagram-studio:appearance:v1';
const errors=[],plain=x=>JSON.parse(JSON.stringify(x));
function open(preference){const vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));return new JSDOM(html,{url:'https://qa.local/appearance.html',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){w.localStorage.setItem('level-diagram-studio:notice:1.1.0','seen');w.HTMLCanvasElement.prototype.getContext=()=>null;w.HTMLElement.prototype.getBoundingClientRect=()=>({left:0,top:0,width:1000,height:700});w.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','')};w.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open')};if(preference!==undefined)w.localStorage.setItem(KEY,preference)}})}
const dom=open(),w=dom.window,D=w.document,A=w.SpatialEditor,M=w.StudioModel;
const click=s=>{const e=D.querySelector(s);assert(e,`missing ${s}`);assert(!e.disabled,`disabled ${s}`);e.click();return e},key=k=>D.activeElement.dispatchEvent(new w.KeyboardEvent('keydown',{key:k,bubbles:true}));
const visibleTools=()=>[...D.querySelectorAll('[data-tool]')].filter(e=>!e.hidden).map(e=>e.dataset.tool);
const expected={plan:['select','move','size','rotate','vertex','plane','wall','hole','stairs','ladder','spiral','route','text','marker','pan'],elevation:['select','move','size','rotate','vertex','hole','stairs','ladder','spiral','marker','pan'],solid:['select','move','rotate','route','text','pan'],curve:['select','move','rotate','route','text','marker','pan']};
try{
 assert(A,`editor initialization failed: ${errors.join('; ')}`);
 assert.equal(D.body.dataset.layout,'floating');assert.equal(D.body.dataset.theme,'blue');
 A.createDocument('space','布局回归');const d=A.document;d.objects=[];const wall=M.createObject(d,'wall',[300,300,0]);d.objects.push(wall);A.select(wall.id);A.setTool('select');
 const initial=JSON.stringify(A.project),camera=plain(A.camera),selection=plain(A.selection),undo=A.undoCount;
 for(const layout of ['floating','rail','ribbon'])for(const theme of ['blue','sage','graphite']){
  click('#appearance-button');click(`[data-layout-choice="${layout}"]`);if(D.querySelector('#appearance-popover').hidden)click('#appearance-button');click(`[data-theme-choice="${theme}"]`);
  assert.equal(D.body.dataset.layout,layout);assert.equal(D.body.dataset.theme,theme);assert.deepEqual(JSON.parse(w.localStorage.getItem(KEY)),{layout,theme});
  assert.equal(JSON.stringify(A.project),initial,'appearance must not alter project');assert.deepEqual(plain(A.selection),selection);assert.deepEqual(plain(A.camera),camera);assert.equal(A.undoCount,undo,'appearance must not consume project undo');
  key('Escape');assert(D.querySelector('#appearance-popover').hidden);assert.equal(A.selection.id,wall.id,'Escape closes appearance only');
 }
 click('#appearance-button');const before=JSON.stringify(d.objects);key('Delete');key('p');assert.equal(JSON.stringify(d.objects),before);assert.equal(A.tool,'select');key('Escape');
 for(const mode of ['plan','elevation','solid']){click(`[data-view="${mode}"]`);assert.deepEqual(visibleTools(),expected[mode],`tool membership ${mode}`)}
 click('[data-view="plan"]');A.select(wall.id);A.setTool('select');const hole=D.querySelector('[data-tool="hole"]');assert(!hole.hidden);assert(hole.disabled,'wall holes need elevation');assert.match(hole.title,/立面/);D.querySelector('#canvas').focus();key('Escape');assert(!hole.disabled,'unselected user may enter hole mode');
 A.setTool('route');A.drawing.points.push([10,10,0],[20,20,0]);click('#appearance-button');for(const b of D.querySelectorAll('[data-layout-choice]'))assert(b.disabled,'unfinished drawing blocks layout switching');const themeButton=[...D.querySelectorAll('[data-theme-choice]')].find(b=>b.dataset.theme!==D.body.dataset.theme);assert(!themeButton.disabled);themeButton.click();assert.equal(A.drawing.points.length,2);key('Escape');assert.equal(A.drawing.points.length,2,'menu Escape preserves draft');key('Escape');
 A.createDocument('curve','曲线布局回归');assert.deepEqual(visibleTools(),expected.curve);const settings=JSON.parse(w.localStorage.getItem(KEY));A.loadProject(JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/scale-legacy-project.json'),'utf8')));assert.equal(D.body.dataset.layout,settings.layout);assert.equal(D.body.dataset.theme,settings.theme);
 click('#appearance-button');click('#appearance-reset');assert.equal(D.body.dataset.layout,'floating');assert.equal(D.body.dataset.theme,'blue');
 for(const value of ['invalid json',JSON.stringify({layout:'unknown',theme:'invalid'}),JSON.stringify(null)]){const other=open(value);try{assert.equal(other.window.document.body.dataset.layout,'floating');assert.equal(other.window.document.body.dataset.theme,'blue')}finally{other.window.close()}}
 const remembered=open(JSON.stringify({layout:'rail',theme:'sage'}));try{assert.equal(remembered.window.document.body.dataset.layout,'rail');assert.equal(remembered.window.document.body.dataset.theme,'sage')}finally{remembered.window.close()}
 assert.deepEqual(errors,[]);console.log('PASS appearance: nine combinations; independent stored preferences; geometry, camera, selection and undo preserved; tool membership and disabled reasons; menu shortcut isolation; unfinished drawing guard; old project import; remembered and corrupt preference fallback.');
}finally{dom.window.close()}
