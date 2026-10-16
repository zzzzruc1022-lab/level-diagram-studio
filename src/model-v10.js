(()=>{
 'use strict';const M=window.StudioModel,validate=M.validate;
 M.validate=input=>{
  const p=M.clone(input),legacy=p.version<7;if(p.version===7)p.version=6;
  if(legacy)for(const d of p.documents||[]){const c=d.curve;if(c?.xAxis?.mode==='stages')for(const e of c.events)e.x=(Math.max(0,c.stages.findIndex(s=>s.id===e.stage))+e.fraction)/c.stages.length}
  const project=validate(p);
  for(const d of project.documents){const c=d.curve;if(!c)continue;
   if(c.xAxis.mode==='numeric'){c.stages=c.xAxis.ticks.map((t,i)=>({id:t.id,label:t.label+(c.xAxis.unit?' '+c.xAxis.unit:''),color:c.stages[i%c.stages.length].color}));c.xAxis.mode='stages';c.xAxis.unit=''}
   for(const e of c.events){if(e.labelOffset!==undefined&&(!Array.isArray(e.labelOffset)||e.labelOffset.length!==2||!e.labelOffset.every(n=>Number.isFinite(n)&&Math.abs(n)<1e6)))throw Error('事件文字位置无效');const j=Math.min(c.stages.length-1,Math.floor(e.x*c.stages.length));e.stage=c.stages[j].id;e.fraction=e.x*c.stages.length-j}
   M.redistributeTicks(c.yAxis);
  }
  project.version=7;return project;
 };
})();
