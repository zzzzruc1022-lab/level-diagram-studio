function inlineFontTarget(edit){
 if(!edit.code)return {target:edit.target,key:'size'};
 const c=doc().curve,group=curveFontCode(edit.code);
 if(group)return edit.target.fontSize!==undefined?{target:edit.target,key:'fontSize'}:{target:c.fonts,key:group};
 if(edit.code==='curve:title')return {target:c,key:'titleSize'};
 if(edit.code==='curve:subtitle')return {target:c,key:'subtitleSize'};
 return {target:edit.target,key:'titleSize'};
}
function positionInlineEditor(){
 if(!editing)return;const e=$('#inline-editor'),shell=$('#inline-edit-shell'),font=inlineFontTarget(editing),size=font.target[font.key],text=editing.code?scene.texts.find(t=>t.edit===editing.code):null,o=editing.id?doc().objects.find(o=>o.id===editing.id):null;
 const l=text?.layout||(o&&R.textLayout(o,M.project(M.origin(doc(),o),scene.basis)));if(!l)return;
 const scale=stage.getBoundingClientRect().width/camera.w;shell.style.left=(l.box.x-camera.x)*scale+'px';shell.style.top=(l.box.y-camera.y)*scale+'px';shell.style.transform=`rotate(${o?.textAngle||0}deg)`;e.style.width=Math.max(40,Math.ceil(l.w*scale)+8)+'px';e.style.fontSize=size*scale+'px';
 if(document.activeElement!==$('#inline-font-size'))$('#inline-font-size').value=size;
}
function beginEditing(o,code=null){
 finishEditing();lastTextClick=null;let target,key;
 if(code){const t=editTarget(code);if(!t?.target||!scene.texts.some(t=>t.edit===code))return;({target,key}=t);curveText=code;eventId=null}
 else{if(!o||o.locked)return;choose(o.id,false,true);target=o;key='text'}
 editing={before:snapshot(),id:o?.id,code,target,key,range:null};const e=$('#inline-editor');$('#inline-edit-shell').hidden=false;e.hidden=false;e.textContent=target[key];positionInlineEditor();e.focus();const range=document.createRange();range.selectNodeContents(e);const sel=window.getSelection();sel.removeAllRanges();sel.addRange(range);status('直接输入文字 · 右侧调整字号 · 点击外部完成 · Esc 取消');
}
function finishEditing(cancel=false){
 if(!editing)return;const edit=editing;editing=null;$('#inline-edit-shell').hidden=true;$('#inline-editor').hidden=true;
 if(cancel){project=JSON.parse(edit.before);prune();status('已取消文字与字号编辑')}
 else{edit.target[edit.key]=$('#inline-editor').innerText?.replaceAll('\r','')??$('#inline-editor').textContent;if(edit.code?.startsWith('tick:'))edit.target.customLabel=true;history(edit.before)}render();
}
function inlineKeys(e){e.stopPropagation();if(composingKey(e))return;if(e.key==='Escape'){e.preventDefault();finishEditing(true)}else if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();finishEditing()}}
$('#inline-editor').addEventListener('input',()=>{if(!editing)return;editing.target[editing.key]=$('#inline-editor').innerText??$('#inline-editor').textContent;const field=$(editing.code?.startsWith('event:')?'[data-event-name="'+editing.code.slice(6)+'"]':editing.code==='curve:title'?'#curve-title':editing.code==='curve:subtitle'?'#curve-subtitle':editing.code==='axis:x'?'#xAxis-title':editing.code==='axis:y'?'#yAxis-title':editing.code?'#curveText-value':'textarea[data-scope="prop"][data-key="text"]');if(field)field.value=editing.target[editing.key];drawCanvas();positionInlineEditor()});
$('#inline-editor').addEventListener('keydown',inlineKeys);
$('#inline-font-size').addEventListener('pointerdown',()=>{if(!editing)return;const s=window.getSelection();if(s.rangeCount&&$('#inline-editor').contains(s.anchorNode))editing.range=s.getRangeAt(0).cloneRange()});
function changeInlineSize(commit=false){
 if(!editing)return;const input=$('#inline-font-size'),value=Number(input.value),f=inlineFontTarget(editing);if(input.value.trim()!==''&&Number.isFinite(value)){f.target[f.key]=clamp(Math.round(value),8,200);drawCanvas();positionInlineEditor();inspector()}if(commit)input.value=f.target[f.key];
}
$('#inline-font-size').addEventListener('input',()=>changeInlineSize());
$('#inline-font-size').addEventListener('change',()=>changeInlineSize(true));
$('#inline-font-size').addEventListener('keydown',e=>{inlineKeys(e);if(!composingKey(e)&&e.key==='Enter'&&!e.ctrlKey&&!e.metaKey&&editing){e.preventDefault();changeInlineSize(true);$('#inline-editor').focus();const s=window.getSelection();if(editing.range){s.removeAllRanges();s.addRange(editing.range)}}});
