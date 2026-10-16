// Tool keys belong to the canvas; composition and typing belong to editors.
let composingElement=null,imeHintAt=-Infinity;
function textInput(target){return target instanceof Element&&!!target.closest('input,textarea,select,[contenteditable="true"],[role="textbox"]')}
function composingKey(e){return e.isComposing||e.keyCode===229||e.key==='Process'||composingElement&&textInput(e.target)}
document.addEventListener('compositionstart',e=>{if(textInput(e.target))composingElement=e.target},true);
document.addEventListener('compositionend',()=>{composingElement=null},true);
document.addEventListener('focusout',e=>{if(composingElement===e.target)composingElement=null},true);
function toolKey(e){
 const keys={s:'size',q:'select',w:'move',e:'rotate',v:'vertex',p:'plane',o:'hole',r:'route',t:'text',m:'marker',h:'pan'};
 const physical=/^Key([A-Z])$/.exec(e.code||'');return keys[physical?physical[1].toLowerCase():e.key?.toLowerCase()];
}
function unavailableTool(t){if(!doc())return '请先新建图稿';if(['move','size','rotate','vertex','hole'].includes(t)&&!selection.length)return '请先选择可编辑组件';if(locked())return '请先解除组件锁定';if(t==='size'&&obj()?.type==='text')return '双击文字或在属性中调整字号';if(t==='vertex'&&obj()?.type==='route')return '直接拖动路线节点调整';if(view.mode==='solid')return obj()?.type==='hole'?'请切换平面图或立面图编辑空洞':'请切换平面图或立面图使用此工具';return '当前组件或视图不支持此工具'}
function imeHint(){if(Date.now()-imeHintAt<6000)return;imeHintAt=Date.now();status('快捷键未识别，请切换英文输入法后重试，或点击左侧工具')}
function canvasFocus(){if(!editing&&!rowRename&&!document.querySelector('dialog[open]'))canvas.focus({preventScroll:true})}
// Do not destroy an editor while its candidate text is being committed on blur.
document.addEventListener('pointerdown',e=>{if(composingElement&&editing&&!e.target.closest('#inline-edit-shell')){e.stopImmediatePropagation();const editor=$('#inline-editor');editor.blur();queueMicrotask(()=>{composingElement=null;finishEditing();canvasFocus()})}},true);
