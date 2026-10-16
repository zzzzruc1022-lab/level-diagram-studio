let eventOrderDrag=null;
const orderedEvents=()=>[...doc().curve.events].sort((a,b)=>a.x-b.x);
function eventRows(){return '<div class="section-heading"><h3>事件节点</h3></div><div class="curve-event-list">'+orderedEvents().map((e,i)=>`<div class="event-row ${eventId===e.id||curveText==='event:'+e.id?'active':''}" data-event-row="${e.id}"><button class="event-grip" data-event-grip="${e.id}" title="拖动名称排序" aria-label="拖动事件名称排序"><svg viewBox="0 0 16 24" width="12" height="18" aria-hidden="true" fill="currentColor">${[5,12,19].flatMap(y=>[4,12].map(x=>`<circle cx="${x}" cy="${y}" r="1.7"/>`)).join('')}</svg></button><input data-event-name="${e.id}" aria-label="事件${i+1}名称" placeholder="未命名节点" value="${R.esc(e.label)}"><button class="danger event-delete" data-delete-event="${e.id}" title="删除事件及节点" aria-label="删除事件${i+1}">×</button></div>`).join('')+'</div><button data-action="add-event" class="event-add">＋ 事件</button>'}
function selectEventLabel(id,forms=true){clear();curveText='event:'+id;panel='properties';if(forms)render();else{drawHandles();document.querySelectorAll('[data-event-row]').forEach(row=>row.classList.toggle('active',row.dataset.eventRow===id));$('#selection-info').textContent='所选事件文字'}}
function deleteCurveEvent(id){mutate(()=>{doc().curve.events=doc().curve.events.filter(e=>e.id!==id);if(eventId===id)eventId=null;if(curveText==='event:'+id)curveText=null},'已删除事件及节点 · Ctrl+Z 撤销')}
document.addEventListener('focusin',e=>{if(e.target.dataset.eventName)selectEventLabel(e.target.dataset.eventName,false)});
document.addEventListener('input',e=>{const id=e.target.dataset.eventName;if(!id)return;const event=doc()?.curve?.events.find(e=>e.id===id);if(!event)return;const previous=formInput;formInput='event-name:'+current+':'+id;try{mutate(()=>event.label=e.target.value)}finally{formInput=previous}});
document.addEventListener('click',e=>{const button=e.target.closest('[data-delete-event]');if(button){e.preventDefault();deleteCurveEvent(button.dataset.deleteEvent)}});

// Reordering is a DOM-only preview. Names are committed once on pointer release.
document.addEventListener('pointerdown',e=>{
 const grip=e.target.closest('[data-event-grip]');if(!grip||e.button!==0)return;e.preventDefault();e.stopPropagation();finishEditing();
 const row=document.querySelector(`[data-event-row="${grip.dataset.eventGrip}"]`),handle=row?.querySelector('.event-grip');if(!row)return;
 eventOrderDrag={id:grip.dataset.eventGrip,doc:current,pointer:e.pointerId,start:[e.clientX,e.clientY],last:[e.clientX,e.clientY],row,handle,index:null,moved:false};handle.setPointerCapture?.(e.pointerId);
},true);
function updateEventOrder(e){
 const a=eventOrderDrag;if(!a)return;a.last=[e.clientX,e.clientY];if(!a.moved&&Math.hypot(e.clientX-a.start[0],e.clientY-a.start[1])<4)return;
 if(!a.moved){a.moved=true;a.row.classList.add('event-row-dragging');a.ghost=a.row.cloneNode(true);a.ghost.className='event-row event-drag-ghost';a.ghost.setAttribute('aria-hidden','true');a.ghost.removeAttribute('data-event-row');for(const el of a.ghost.querySelectorAll('input,button')){el.disabled=true;for(const key of [...el.attributes].map(v=>v.name))if(key.startsWith('data-'))el.removeAttribute(key)}a.ghost.style.width=a.row.getBoundingClientRect().width+'px';a.line=document.createElement('div');a.line.className='event-insertion-line';a.line.hidden=true;document.body.append(a.ghost,a.line);document.body.classList.add('event-ordering')}
 a.ghost.style.left=Math.max(4,Math.min(e.clientX+12,innerWidth-a.ghost.offsetWidth-4))+'px';a.ghost.style.top=Math.max(4,Math.min(e.clientY+12,innerHeight-a.ghost.offsetHeight-4))+'px';
 const list=a.row.parentElement,r=list.getBoundingClientRect();a.index=null;a.line.hidden=true;
 if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top-8||e.clientY>r.bottom+8)return;
 if(e.clientY<r.top+18)list.scrollTop-=10;else if(e.clientY>r.bottom-18)list.scrollTop+=10;
 const rows=[...list.querySelectorAll('[data-event-row]')].filter(row=>row!==a.row);let index=rows.findIndex(row=>{const b=row.getBoundingClientRect();return e.clientY<b.top+b.height/2});if(index<0)index=rows.length;a.index=index;
 const prev=rows[index-1]?.getBoundingClientRect(),next=rows[index]?.getBoundingClientRect(),y=prev&&next?(prev.bottom+next.top)/2:next?next.top-3:prev?prev.bottom+3:r.top;
 a.line.style.left=r.left+'px';a.line.style.top=Math.max(r.top,Math.min(r.bottom,y))+'px';a.line.style.width=r.width+'px';a.line.hidden=false;
}
function finishEventOrder(cancel=false){
 const a=eventOrderDrag;if(!a)return;eventOrderDrag=null;a.row.classList.remove('event-row-dragging');a.ghost?.remove();a.line?.remove();document.body.classList.remove('event-ordering');if(a.handle.hasPointerCapture?.(a.pointer))a.handle.releasePointerCapture(a.pointer);
 if(cancel||!a.moved||a.index===null||a.doc!==current)return;
 const events=orderedEvents(),from=events.findIndex(e=>e.id===a.id);if(from<0||from===a.index)return;const labels=events.map(e=>e.label),[label]=labels.splice(from,1);labels.splice(a.index,0,label);
 clear();curveText='event:'+events[a.index].id;mutate(()=>events.forEach((event,i)=>event.label=labels[i]),'已按插入顺序调整名称 · 节点和曲线保持原位');
}
document.addEventListener('pointermove',e=>{if(eventOrderDrag)updateEventOrder(e)},true);
document.addEventListener('pointerup',()=>finishEventOrder(),true);
document.addEventListener('pointercancel',()=>finishEventOrder(true),true);
window.addEventListener('blur',()=>finishEventOrder(true));
document.addEventListener('keydown',e=>{if(eventOrderDrag&&(e.key==='Escape'||(e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z')){e.preventDefault();e.stopImmediatePropagation();finishEventOrder(true)}},true);

function beginEventLabelPointer(e,q,code){
 if(lastTextClick?.id===code&&Date.now()-lastTextClick.time<450){lastTextClick=null;beginEditing(null,code);e.preventDefault();return}
 lastTextClick={id:code,time:Date.now()};const id=code.slice(6),event=doc().curve.events.find(e=>e.id===id);selectEventLabel(id);drag={kind:'event-text',id,before:snapshot(),start:q,last:q,offset:[...R.eventLabelOffset(event)],changed:false};canvas.style.cursor='move';capture(e);
}
function moveEventLabel(q){
 const delta=M.sub(q,drag.start);if(!drag.changed&&Math.hypot(...delta)<pixel()*4)return;
 const event=doc().curve.events.find(e=>e.id===drag.id);event.labelOffset=M.add(drag.offset,delta);drag.changed=true;drag.last=q;lastTextClick=null;drawCanvas();
}
function eventSelectionMarkup(){
 const id=eventId||(curveText?.startsWith('event:')?curveText.slice(6):null),event=doc()?.curve?.events.find(e=>e.id===id);if(!event)return '';
 const px=pixel(),color=R.contrast(doc().background),halo=color==='#000000'?'#ffffff':'#000000';let out='';
 if(eventId){const p=R.eventPoint(doc(),event);out+=`<circle data-event-node-selection="${id}" cx="${p[0]}" cy="${p[1]}" r="${px*10}" fill="none" stroke="#3977df" stroke-width="${px*2}" pointer-events="none"/>`}
 const text=scene.texts.find(t=>t.edit==='event:'+id);if(text){const box=text.layout.box,points=[[box.x-px*3,box.y-px*3],[box.x+box.w+px*3,box.y-px*3],[box.x+box.w+px*3,box.y+box.h+px*3],[box.x-px*3,box.y+box.h+px*3]],path=R.path(points,true);out+=`<g data-event-label-selection="${id}" pointer-events="none"><path d="${path}" fill="none" stroke="${halo}" stroke-width="${px*5}"/><path d="${path}" fill="none" stroke="${color}" stroke-width="${px*2}" stroke-dasharray="${px*6} ${px*4}"/></g>`}return out;
}
