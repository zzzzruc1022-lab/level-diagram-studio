function toolTeaching(t){
 const solid=view.mode==='solid';
 return {select:solid?'点击选中组件':'点击选中，拖框多选',move:solid&&usesWorldGizmo()?'拖动坐标轴或平面手柄':'选中后拖动组件',size:'拖边拉伸，拖角等比缩放',rotate:'拖动圆环调整方向',vertex:'拖动角点，调整图形轮廓',plane:'拖拽创建平面',wall:'拖拽创建墙壁',hole:view.mode==='elevation'?'在墙壁上拖拽打洞':'在平面上拖拽打洞',stairs:'点击放置楼梯',ladder:'点击放置爬梯',spiral:'点击放置旋转楼梯',marker:'点击放置标记',route:'依次点击连线，Enter结束',text:'点击添加，双击修改',pan:'按住左键拖动画面'}[t];
}
// GIFs are decoded only on demand, and replaced with their still when stopped.
const helpDialog=$('#help-dialog');
const helpContent=$('#help-content'),helpSections=[...helpDialog.querySelectorAll('[data-help-section]')];
function selectHelpChapter(id){helpDialog.querySelectorAll('[data-help-chapter]').forEach(button=>button.setAttribute('aria-current',String(button.dataset.helpChapter===id)));$('#help-chapter').value=id}
function goHelpChapter(id){const section=helpSections.find(s=>s.dataset.helpSection===id);if(section){helpContent.scrollTop=section.offsetTop-helpContent.offsetTop;selectHelpChapter(id)}}
function stopHelpDemos(){helpDialog.querySelectorAll('[data-help-demo]').forEach(button=>{button.querySelector('img').src=button.dataset.poster;button.setAttribute('aria-pressed','false');button.querySelector('.help-demo-action').textContent='点击播放演示'})}
helpDialog.addEventListener('click',e=>{const chapter=e.target.closest('[data-help-chapter]');if(chapter){goHelpChapter(chapter.dataset.helpChapter);return}const button=e.target.closest('[data-help-demo]');if(!button)return;const play=button.getAttribute('aria-pressed')!=='true';stopHelpDemos();if(play){button.querySelector('img').src=button.dataset.gif;button.setAttribute('aria-pressed','true');button.querySelector('.help-demo-action').textContent='点击停止演示'}});
$('#help-chapter').addEventListener('change',e=>goHelpChapter(e.target.value));
helpContent.addEventListener('scroll',()=>{const section=helpSections.filter(s=>s.offsetTop-helpContent.offsetTop<=helpContent.scrollTop+40).at(-1)||helpSections[0];selectHelpChapter(section.dataset.helpSection);const playing=helpDialog.querySelector('[data-help-demo][aria-pressed="true"]');if(playing){const a=playing.getBoundingClientRect(),b=helpContent.getBoundingClientRect();if(a.bottom<b.top||a.top>b.bottom)stopHelpDemos()}});
helpDialog.addEventListener('close',stopHelpDemos);
document.addEventListener('keydown',e=>{if(e.key==='F1'){e.preventDefault();if(!document.querySelector('dialog[open]'))command('help')}});
