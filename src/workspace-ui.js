// Panel sizes and disclosure are personal workspace state, not project geometry.
const workspaceKey='level-diagram-studio:panels:v1';
const workspaceDefaults=()=>({floating:{leftOpen:true,rightOpen:false,tab:'properties'},rail:{left:224,right:268},ribbon:{left:224,right:268}});
let workspacePrefs=workspaceDefaults(),workspaceReady=false,workspaceFrame=0,workspaceResize=null,workspaceNoticeTimer=0,workspaceLastInspector=null,workspaceLastPrimary=null;
try{const p=JSON.parse(localStorage.getItem(workspaceKey));if(p){for(const k of ['leftOpen','rightOpen'])if(typeof p.floating?.[k]==='boolean')workspacePrefs.floating[k]=p.floating[k];if(['properties','document'].includes(p.floating?.tab))workspacePrefs.floating.tab=p.floating.tab;for(const mode of ['rail','ribbon'])for(const [side,min,max]of [['left',160,400],['right',180,480]])if(Number.isFinite(p[mode]?.[side]))workspacePrefs[mode][side]=clamp(p[mode][side],min,max)}}catch{}
function saveWorkspacePreferences(){try{localStorage.setItem(workspaceKey,JSON.stringify(workspacePrefs))}catch{}}
function openWorkspacePanel(name='properties'){
 if(!['properties','document'].includes(name))return;panel=name;
 if(workspaceReady){workspacePrefs.floating.rightOpen=true;workspacePrefs.floating.tab=name;saveWorkspacePreferences()}
 render();
}
function workspaceStatus(message,urgent=false){
 if(!workspaceReady||!message||!urgent&&!/(失败|无法|不能|无效|不可用|不支持|越界|超出|已恢复|未能|请先|请选择|请输入|请切换|至少|最多|尚未生成|没有可|不能为空|必须|过短)/.test(message))return;
 const notice=$('#workspace-notice');$('#workspace-notice-text').textContent=message;notice.hidden=false;clearTimeout(workspaceNoticeTimer);workspaceNoticeTimer=setTimeout(()=>notice.hidden=true,8500);
}
function workspaceWidths(mode,values=workspacePrefs[mode]){
 const work=$('.workspace'),rail=mode==='rail'?($('#tool-host').getBoundingClientRect().width||82):0,available=Math.max(340,(work.clientWidth||innerWidth)-rail-320);
 let left=clamp(values.left,160,400),right=clamp(values.right,180,480);right=Math.max(180,Math.min(right,available-left));left=Math.max(160,Math.min(left,available-right));return {left,right,available};
}
function measureWorkspace(){
 workspaceFrame=0;if(!workspaceReady)return;const work=$('.workspace'),bar=$('#interaction-hint'),h=bar.hidden?0:bar.getBoundingClientRect().height;
 document.body.style.setProperty('--workspace-status-height',h+'px');
 const mode=appearance.layout;
 if(mode==='floating'){work.style.removeProperty('--left-panel-width');work.style.removeProperty('--right-panel-width')}
 else{const w=workspaceWidths(mode);work.style.setProperty('--left-panel-width',w.left+'px');work.style.setProperty('--right-panel-width',w.right+'px')}
 const rect=work.getBoundingClientRect(),left=$('.workspace > .left').getBoundingClientRect(),right=$('.workspace > .right').getBoundingClientRect();
 for(const [side,r]of [['left',left],['right',right]]){const handle=$(`[data-panel-resize="${side}"]`);handle.hidden=mode==='floating';handle.style.left=(side==='left'?r.right-rect.left-4:r.left-rect.left-4)+'px';handle.setAttribute('aria-valuenow',String(Math.round(r.width)));handle.setAttribute('aria-valuemax',String(Math.floor(Math.min(side==='left'?400:480,workspaceWidths(mode==='floating'?'rail':mode).available-(side==='left'?right.width:left.width)))))}
 scheduleAppearanceMeasure();
}
function scheduleWorkspaceMeasure(){if(!workspaceFrame)workspaceFrame=requestAnimationFrame(measureWorkspace)}
function arrangeWorkspaceProperties(){
 const container=$('#properties'),o=obj(),first=container.firstElementChild;if(!o||!first||first===workspaceLastInspector)return;
 for(const i of container.querySelectorAll('[data-scope="prop"][data-key="px"],[data-scope="prop"][data-key="py"]'))i.closest('.property,.field')?.remove();
 const actions=container.querySelector(':scope > .button-row');
 if(doc()?.type==='space'&&M.metric(doc())&&actions?.nextElementSibling){const dimensions=document.createElement('section');dimensions.className='workspace-dimensions';let next=actions.nextElementSibling;while(next){const node=next;next=next.nextElementSibling;if(node.tagName==='HR')node.remove();else dimensions.append(node)}if(dimensions.childElementCount)container.append(dimensions)}
 const rank=node=>{
  if(node.classList.contains('badge'))return -2;
  if(o.type==='route'){
   if(node.classList.contains('route-occlusion-panel'))return 1;
   if(node.classList.contains('route-node-panel'))return 7;
   if(node.classList.contains('button-row'))return 20;
   if(node.classList.contains('workspace-dimensions'))return 12;
   const routeKey=node.querySelector('[data-key]')?.dataset.key,order={name:0,style:2,curve:3,color:4,width:5,opacity:6,arrow:8,outlineMode:9,outlineColor:9.1,outlineWidth:9.2,pz:10,floor:11};
   if(routeKey in order)return order[routeKey];return 13;
  }
  if(node.classList.contains('edge-editing-panel'))return tool==='vertex'?-1:3.6;
  if(node.classList.contains('workspace-dimensions'))return 3;
  if(node.classList.contains('button-row'))return 12;
  if(node.tagName==='BUTTON')return node.dataset.action==='host'?1:10;
  const key=node.querySelector('[data-key]')?.dataset.key;
  if(key==='name')return 0;
  if(key==='text')return .5;
  if(['text','marker'].includes(o.type)&&['size','r'].includes(key))return 1;
  if(['fill','stroke','width','opacity','colorMode','color'].includes(key))return 2;
  if(o.type==='route'&&['style','curve','arrow','outlineMode','outlineColor','outlineWidth'].includes(key))return 2.2;
  if(['thickness','wallHeight','start','end','span','inner','outer','riseSpacing'].includes(key))return 3.5;
  if(['floor','pz'].includes(key))return 6;
  if(node.classList.contains('group-note')&&o.type==='hole')return .7;
  return 5;
 };
 [...container.children].map((node,index)=>({node,index,rank:rank(node)})).sort((a,b)=>a.rank-b.rank||a.index-b.index).forEach(({node})=>container.append(node));workspaceLastInspector=container.firstElementChild;
}
function refreshWorkspaceUI(){
 if(!workspaceReady)return;const f=workspacePrefs.floating,floating=appearance.layout==='floating';
 document.body.dataset.leftPanelOpen=String(f.leftOpen);document.body.dataset.rightPanelOpen=String(f.rightOpen);
 const left=$('#workspace-left-toggle'),collapse=$('#workspace-right-collapse');left.setAttribute('aria-expanded',String(f.leftOpen));left.title=f.leftOpen?'收起图稿、楼层和组件':'展开图稿、楼层和组件';collapse.hidden=!floating||!f.rightOpen;
 for(const b of document.querySelectorAll('.panel-tabs [data-panel]')){b.setAttribute('aria-expanded',String(!floating||f.rightOpen));b.setAttribute('aria-controls',b.dataset.panel==='properties'?'properties':'document-properties')}
 if(f.tab!==panel){f.tab=panel;saveWorkspacePreferences()}
 if(primary!==workspaceLastPrimary){workspaceLastPrimary=primary;if(panel==='properties')$('.workspace > .right').scrollTop=0}
 arrangeWorkspaceProperties();scheduleWorkspaceMeasure();
}
function initWorkspaceUI(){
 if(workspaceReady)return;document.body.classList.add('workspace-ui');const left=$('.workspace > .left'),right=$('.workspace > .right');
 const leftContent=document.createElement('div');leftContent.id='workspace-left-content';while(left.firstChild)leftContent.append(left.firstChild);left.append(leftContent);
 const toggle=document.createElement('button');toggle.id='workspace-left-toggle';toggle.type='button';toggle.setAttribute('aria-controls',leftContent.id);toggle.innerHTML='<span>图稿、楼层和组件</span><svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="m4 10 4-4 4 4"/></svg>';left.prepend(toggle);
 const rightHeading=document.createElement('div');rightHeading.className='workspace-panel-heading';rightHeading.append(right.querySelector('.panel-tabs'));const collapse=document.createElement('button');collapse.id='workspace-right-collapse';collapse.type='button';collapse.title='收起右侧面板';collapse.setAttribute('aria-label',collapse.title);collapse.innerHTML='<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="m4 10 4-4 4 4"/></svg>';rightHeading.append(collapse);right.prepend(rightHeading);
 for(const el of left.querySelectorAll('.shortcut-note,.mini-help'))el.remove();
 const bar=$('#interaction-hint'),fixed=document.createElement('span');fixed.id='workspace-fixed-hints';fixed.textContent='Alt＋左键拖动复制 · Ctrl 点击多选 · 中键／空格平移 · Ctrl＋Z 撤销';bar.append(fixed);document.body.append(bar);stage.append($('.canvas-bottom .zoom'));
 for(const side of ['left','right']){const handle=document.createElement('div');handle.dataset.panelResize=side;handle.tabIndex=0;handle.setAttribute('role','separator');handle.setAttribute('aria-orientation','vertical');handle.setAttribute('aria-label',side==='left'?'调整图稿、楼层和组件面板宽度':'调整属性和图稿设置面板宽度');handle.setAttribute('aria-valuemin',side==='left'?'160':'180');handle.title='拖动调整宽度 · 双击恢复默认';$('.workspace').append(handle)}
 const notice=document.createElement('div');notice.id='workspace-notice';notice.hidden=true;notice.setAttribute('role','status');notice.innerHTML='<span id="workspace-notice-text"></span><button type="button" id="workspace-notice-close" aria-label="关闭提示"><svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="m4 4 8 8M12 4l-8 8"/></svg></button>';document.body.append(notice);
 panel=workspacePrefs.floating.tab;
 document.addEventListener('click',e=>{
  const b=e.target.closest?.('button');if(!b)return;
  if(b.id==='workspace-left-toggle'){e.stopImmediatePropagation();workspacePrefs.floating.leftOpen=!workspacePrefs.floating.leftOpen;left.scrollTop=0;saveWorkspacePreferences();refreshWorkspaceUI();return}
  if(b.id==='workspace-right-collapse'){e.stopImmediatePropagation();workspacePrefs.floating.rightOpen=false;right.scrollTop=0;saveWorkspacePreferences();refreshWorkspaceUI();return}
  if(b.closest('.workspace-panel-heading')&&b.dataset.panel){e.stopImmediatePropagation();openWorkspacePanel(b.dataset.panel);return}
  if(b.id==='workspace-notice-close'){e.stopImmediatePropagation();notice.hidden=true}
 },true);
 const commitResize=cancel=>{if(!workspaceResize)return;const old=workspaceResize;workspaceResize=null;document.body.classList.remove('workspace-resizing');if(cancel)workspacePrefs[old.mode]=old.before;else saveWorkspacePreferences();measureWorkspace();};
 document.addEventListener('pointerdown',e=>{const handle=e.target.closest('[data-panel-resize]');if(!handle||e.button!==0||appearance.layout==='floating')return;e.preventDefault();e.stopImmediatePropagation();const mode=appearance.layout,w=workspaceWidths(mode);workspaceResize={pointerId:e.pointerId,side:handle.dataset.panelResize,mode,x:e.clientX,before:{...workspacePrefs[mode]},start:w};document.body.classList.add('workspace-resizing');handle.setPointerCapture?.(e.pointerId)},true);
 document.addEventListener('pointermove',e=>{const s=workspaceResize;if(!s||e.pointerId!==s.pointerId)return;e.preventDefault();const delta=(e.clientX-s.x)*(s.side==='left'?1:-1),min=s.side==='left'?160:180,max=Math.min(s.side==='left'?400:480,s.start.available-s.start[s.side==='left'?'right':'left']);workspacePrefs[s.mode]={left:s.start.left,right:s.start.right,[s.side]:clamp(s.start[s.side]+delta,min,max)};measureWorkspace()},true);
 document.addEventListener('pointerup',e=>{if(workspaceResize&&e.pointerId===workspaceResize.pointerId){e.preventDefault();commitResize(false)}},true);
 document.addEventListener('pointercancel',()=>commitResize(true),true);
 document.addEventListener('dblclick',e=>{const handle=e.target.closest('[data-panel-resize]');if(!handle||appearance.layout==='floating')return;e.preventDefault();workspacePrefs[appearance.layout][handle.dataset.panelResize]=workspaceDefaults()[appearance.layout][handle.dataset.panelResize];saveWorkspacePreferences();measureWorkspace()},true);
 document.addEventListener('keydown',e=>{
  if(workspaceResize&&e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();commitResize(true);return}
  const handle=e.target.closest?.('[data-panel-resize]');if(handle){e.stopImmediatePropagation();const mode=appearance.layout;if(mode==='floating')return;const side=handle.dataset.panelResize,w=workspaceWidths(mode);if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const min=side==='left'?160:180,max=Math.min(side==='left'?400:480,w.available-w[side==='left'?'right':'left']),delta=(e.key==='ArrowLeft'?-1:1)*(side==='left'?1:-1)*(e.shiftKey?32:8);workspacePrefs[mode][side]=e.key==='Home'?min:e.key==='End'?max:clamp(w[side]+delta,min,max);saveWorkspacePreferences();measureWorkspace()}return}
  if(e.target.closest?.('#workspace-left-toggle,#workspace-right-collapse,.workspace-panel-heading [data-panel],#workspace-notice-close')&&[' ','Enter'].includes(e.key))e.stopImmediatePropagation();
 },true);
 window.addEventListener('blur',()=>commitResize(false));window.addEventListener('resize',scheduleWorkspaceMeasure);
 workspaceReady=true;refreshWorkspaceUI();measureWorkspace();workspaceStatus($('#status').textContent);
 if(typeof ResizeObserver!=='undefined'){const observer=new ResizeObserver(scheduleWorkspaceMeasure);observer.observe($('.workspace'));observer.observe(bar)}
}
const workspaceInspector=inspector;inspector=function(){workspaceInspector();if(workspaceReady)arrangeWorkspaceProperties()};
const workspaceRender=render;render=function(keep=false){workspaceRender(keep);refreshWorkspaceUI()};
const workspaceAppearance=refreshAppearance;refreshAppearance=function(){workspaceAppearance();refreshWorkspaceUI()};
const workspaceHint=interactionHint;interactionHint=function(){workspaceHint();if(!workspaceReady||!doc())return;if(tool==='select')$('#interaction-tip').textContent='右键选择重叠组件 · Alt 单击轮选';else if(tool==='move')$('#interaction-tip').textContent='拖动所选组件 · Q 切换选择'};
