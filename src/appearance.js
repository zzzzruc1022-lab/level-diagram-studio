// Personal UI preferences stay outside project data and undo history.
const appearanceKey='level-diagram-studio:appearance:v1';
const appearanceDefaults={layout:'floating',theme:'blue'};
const appearanceLayouts=[['floating','悬浮面板'],['rail','独立工具列'],['ribbon','顶部工具带']];
const appearanceThemes=[['blue','浅灰蓝'],['sage','暖灰松石'],['graphite','石墨琥珀']];
const viewTools={
 plan:['select','move','size','rotate','vertex','plane','wall','hole','stairs','ladder','spiral','route','text','marker','pan'],
 elevation:['select','move','size','rotate','vertex','hole','stairs','ladder','spiral','marker','pan'],
 solid:['select','move','rotate','route','text','pan'],
 curve:['select','move','rotate','route','text','marker','pan']
};
let appearance={...appearanceDefaults},appearanceReady=false,appearanceFrame=0,appearanceStorage=true;
try{const saved=JSON.parse(localStorage.getItem(appearanceKey));if(appearanceLayouts.some(([id])=>id===saved?.layout))appearance.layout=saved.layout;if(appearanceThemes.some(([id])=>id===saved?.theme))appearance.theme=saved.theme}catch{}
function appearanceBusy(){return !!(drag||editing||rowRename||drawing?.points?.length)}
function closeAppearance(focus=false){const pop=$('#appearance-popover');if(!pop)return;pop.hidden=true;$('#appearance-button').setAttribute('aria-expanded','false');if(focus)$('#appearance-button').focus({preventScroll:true})}
function closeViewPreferences(focus=false){const pop=$('#view-preferences-popover');if(!pop)return;pop.hidden=true;$('#view-preferences-button').setAttribute('aria-expanded','false');if(focus)$('#view-preferences-button').focus({preventScroll:true})}
function positionAppearance(){
 const pop=$('#appearance-popover');if(!pop||pop.hidden)return;const r=$('#appearance-button').getBoundingClientRect();
 pop.style.left=Math.max(12,Math.min(r.right-pop.offsetWidth,innerWidth-pop.offsetWidth-12))+'px';pop.style.top=(r.bottom+8)+'px';
}
function positionViewPreferences(){
 const pop=$('#view-preferences-popover');if(!pop||pop.hidden)return;const r=$('#view-preferences-button').getBoundingClientRect();
 pop.style.left=Math.max(12,Math.min(r.right-pop.offsetWidth,innerWidth-pop.offsetWidth-12))+'px';pop.style.top=Math.max(12,r.top-pop.offsetHeight-8)+'px';
}
function measureAppearance(){
 appearanceFrame=0;if(!appearanceReady)return;const work=$('.workspace'),r=stage.getBoundingClientRect(),w=work.getBoundingClientRect(),host=$('#tool-host');
 for(const [name,value]of [['--stage-top',Math.max(0,r.top-w.top)+'px'],['--stage-bottom',Math.max(0,w.bottom-r.bottom)+'px'],['--tool-host-height',host.getBoundingClientRect().height+'px']])if(work.style.getPropertyValue(name)!==value)work.style.setProperty(name,value);
 positionAppearance();positionViewPreferences();
 if(doc()&&viewportSize&&(r.width!==viewportSize.width||r.height!==viewportSize.height))resizeViewport();
}
function scheduleAppearanceMeasure(){if(!appearanceFrame)appearanceFrame=requestAnimationFrame(measureAppearance)}
function persistAppearance(){try{localStorage.setItem(appearanceKey,JSON.stringify(appearance));appearanceStorage=true}catch{appearanceStorage=false}}
function refreshAppearance(){
 if(!appearanceReady)return;const mode=doc()?.type==='curve'?'curve':view.mode;
 document.body.dataset.viewMode=mode;
 for(const b of document.querySelectorAll('#tool-host [data-tool]')){b.hidden=!viewTools[mode].includes(b.dataset.tool);b.setAttribute('aria-pressed',String(tool===b.dataset.tool));const shortcut=b.querySelector('kbd')?.textContent;if(shortcut){b.setAttribute('aria-keyshortcuts',shortcut);if(!b.disabled)b.title=toolTeaching(b.dataset.tool)+' · '+shortcut}}
 for(const b of document.querySelectorAll('[data-layout-choice]')){b.setAttribute('aria-pressed',String(appearance.layout===b.dataset.layoutChoice));b.disabled=appearanceBusy();b.title=b.disabled?'先完成或取消当前绘制、拖动或文字编辑':''}
 for(const b of document.querySelectorAll('[data-theme-choice]'))b.setAttribute('aria-pressed',String(appearance.theme===b.dataset.themeChoice));
 $('#appearance-reset').disabled=appearanceBusy();
 $('#appearance-note').textContent=appearanceBusy()?'先完成或取消当前绘制、拖动或文字编辑，再切换布局。':appearanceStorage?'自动记住此浏览器中的设置；不影响工程和导出图稿。':'当前浏览器无法保存外观设置，本次打开期间仍可使用。';
 if(mode!=='solid')closeViewPreferences();scheduleAppearanceMeasure();
}
function applyAppearance(){
 document.body.dataset.layout=appearance.layout;document.body.dataset.theme=appearance.theme;
 const host=$('#tool-host'),controls=$('#view-controls');
 if(appearance.layout==='floating'){if(host.parentElement!==stage)stage.append(host);if(controls.parentElement!==host)host.append(controls)}
 else{if(controls.parentElement!==stage)stage.append(controls);const parent=appearance.layout==='rail'?$('.workspace'):document.body;if(host.parentElement!==parent){if(appearance.layout==='rail')parent.prepend(host);else parent.insertBefore(host,$('.workspace'))}}
 closeViewPreferences();refreshAppearance();measureAppearance();
}
function initAppearance(){
 const grid=$('.tool-grid'),heading=grid.previousElementSibling;
 if(heading?.querySelector('h2')?.textContent==='绘图工具')heading.remove();
 const host=document.createElement('div');host.id='tool-host';host.append(grid);stage.append(host);
 const drawings={floating:'<rect x="7" y="10" width="15" height="32" rx="3"/><rect x="58" y="10" width="15" height="32" rx="3"/><rect x="28" y="39" width="24" height="8" rx="4"/>',rail:'<path d="M16 4v48M32 4v48M61 4v48"/><path d="M7 14h3m-3 9h3m-3 9h3m-3 9h3"/>',ribbon:'<path d="M3 16h74M22 16v36M59 16v36"/><path d="M10 10h6m5 0h6m5 0h6m5 0h6m5 0h6"/>'};
 const pop=document.createElement('section');pop.id='appearance-popover';pop.hidden=true;pop.setAttribute('role','dialog');pop.setAttribute('aria-label','外观设置');
 pop.innerHTML='<div class="appearance-heading"><strong>外观</strong><span>按你的习惯布置工作台</span></div><section class="appearance-section"><h3>工作区布局</h3><div class="appearance-options">'+appearanceLayouts.map(([id,name])=>`<button type="button" data-layout-choice="${id}"><svg class="layout-preview" viewBox="0 0 80 56" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="2" y="3" width="76" height="50" rx="4"/>${drawings[id]}</svg><span>${name}</span></button>`).join('')+'</div></section><section class="appearance-section"><h3>界面配色</h3><div class="appearance-options">'+appearanceThemes.map(([id,name])=>`<button type="button" data-theme-choice="${id}"><span class="theme-preview" aria-hidden="true"><i></i><i></i><i></i></span><span>${name}</span></button>`).join('')+'</div></section><div class="appearance-footer"><small id="appearance-note"></small><button id="appearance-reset" type="button">恢复默认</button></div>';
 document.body.append(pop);
 const viewPop=document.createElement('section');viewPop.id='view-preferences-popover';viewPop.hidden=true;viewPop.setAttribute('role','dialog');viewPop.setAttribute('aria-label','视角设置');
 for(const id of ['reverse-horizontal','reverse-vertical'])viewPop.append($('#'+id).closest('label'));
 const vb=document.createElement('button');vb.type='button';vb.id='view-preferences-button';vb.textContent='视角设置';vb.setAttribute('aria-expanded','false');vb.setAttribute('aria-controls',viewPop.id);$('#view-controls').append(vb);document.body.append(viewPop);
 const icons={select:'<path d="m5 3 13 10-7 1-3 7Z"/>',move:'<path d="M12 3v18M3 12h18m-12-6 3-3 3 3m-6 12 3 3 3-3M6 9l-3 3 3 3m12-6 3 3-3 3"/>',size:'<path d="m5 19 14-14M5 13v6h6M13 5h6v6"/>',rotate:'<path d="M5 9a8 8 0 1 1 0 7M5 4v5h5"/>',vertex:'<path d="m5 5 14 2-3 12-11-3Z"/><path d="M3 3h4v4H3Zm14 2h4v4h-4Zm-3 12h4v4h-4ZM3 14h4v4H3Z"/>',plane:'<path d="m8 5 13 3-6 12-13-3Z"/>',wall:'<path d="m3 8 15-4 3 2v12l-15 4-3-2Zm0 0 3 2 15-4M6 10v12"/>',hole:'<circle cx="12" cy="12" r="8" stroke-dasharray="3 3"/>',stairs:'<path d="M3 20v-5h6v-5h6V5h6M3 20h18V5"/>',ladder:'<path d="M6 3v18M18 3v18M6 6h12M6 10h12M6 14h12M6 18h12"/>',spiral:'<path d="M12 12h8a8 8 0 1 0-8 8v-8M12 4v8M6.3 6.3 12 12M4 12h8m-5.7 5.7L12 12m5.7-5.7L12 12"/>',route:'<path d="M3 20v-6h8V5h9m-4-4 4 4-4 4"/>',text:'<path d="M4 7V4h16v3M12 4v16m-4 0h8"/>',marker:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2.5"/>',pan:'<path d="M8 11V5a2 2 0 0 1 4 0v6-8a2 2 0 0 1 4 0v8-6a2 2 0 0 1 4 0v9c0 5-3 7-7 7-3 0-4-1-6-4l-3-5c-1-2 1-3 2-2l2 2"/>'};
 for(const [name,shape]of Object.entries(icons))$(`[data-tool="${name}"] > span`).innerHTML=`<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${shape}</svg>`;
 document.addEventListener('click',e=>{
  const b=e.target.closest('button');
  if(b?.id==='appearance-button'){e.stopImmediatePropagation();const open=pop.hidden;closeMenus();closeViewPreferences();pop.hidden=!open;b.setAttribute('aria-expanded',String(open));refreshAppearance();positionAppearance();if(open)pop.querySelector('[data-layout-choice][aria-pressed="true"]:not(:disabled),[data-theme-choice][aria-pressed="true"]').focus({preventScroll:true});return}
  if(b?.id==='view-preferences-button'){e.stopImmediatePropagation();closeAppearance();viewPop.hidden=!viewPop.hidden;b.setAttribute('aria-expanded',String(!viewPop.hidden));positionViewPreferences();return}
  if(pop.contains(e.target)){e.stopImmediatePropagation();if(!b||b.disabled)return;if(b.dataset.layoutChoice&&!appearanceBusy())appearance.layout=b.dataset.layoutChoice;else if(b.dataset.themeChoice)appearance.theme=b.dataset.themeChoice;else if(b.id==='appearance-reset'&&!appearanceBusy())appearance={...appearanceDefaults};else return;persistAppearance();applyAppearance();return}
  if(!e.target.closest('#view-preferences-popover'))closeViewPreferences();closeAppearance();
 },true);
 document.addEventListener('keydown',e=>{
  if(e.target.closest('#appearance-button,#view-preferences-button')&&[' ','Enter'].includes(e.key)){e.stopImmediatePropagation();return}
  const open=!pop.hidden?pop:!viewPop.hidden?viewPop:null;if(!open)return;
  if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();open===pop?closeAppearance(true):closeViewPreferences(true);return}
  if(open.contains(e.target)){e.stopImmediatePropagation();if(e.key==='Tab'){const controls=[...open.querySelectorAll('button:not(:disabled),input:not(:disabled)')];const i=controls.indexOf(document.activeElement);if(e.shiftKey&&i===0||!e.shiftKey&&i===controls.length-1){e.preventDefault();(e.shiftKey?controls.at(-1):controls[0]).focus()}}}
 },true);
 appearanceReady=true;applyAppearance();
 if(typeof ResizeObserver!=='undefined'){const observer=new ResizeObserver(scheduleAppearanceMeasure);observer.observe(stage);observer.observe($('.workspace'));observer.observe(host)}
 window.addEventListener('resize',scheduleAppearanceMeasure);
}
