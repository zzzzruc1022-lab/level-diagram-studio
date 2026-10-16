async page=>{
 const results=[];
 for(const [version,path]of [['before','qa/world-move/baseline.html'],['after','dist/index.html']]){
  const tab=await page.context().newPage();await tab.setViewportSize({width:1440,height:1000});await tab.goto('http://127.0.0.1:4178/work/spatial-map-editor-v10/'+path);
  await tab.evaluate(()=>{const A=SpatialEditor,M=StudioModel;A.createDocument('space','性能采样');const d=A.document;d.objects=[];d.heightReferences=false;for(let i=0;i<80;i++){const o=M.createObject(d,'plane',[220+(i%10)*75,140+Math.floor(i/10)*65,(i%3)*20]);o.points=[[-30,-22],[30,-22],[30,22],[-30,22]];d.objects.push(o)}document.querySelector('[data-view="solid"]').click();A.select(d.objects[0].id,false,true);A.command('fit')});
  for(const selection of ['single','floor']){
   const result=await tab.evaluate(selection=>{const A=SpatialEditor,id=A.document.objects[0].id,refresh=()=>selection==='single'?A.select(id,false,true):document.querySelector(`[data-floor="${A.document.activeFloor}"]`).click();if(selection==='floor')document.querySelector('[data-tool="select"]').click();const times=[];for(let i=0;i<30;i++){if(selection==='floor')document.querySelector('[data-tool="select"]').click();const start=performance.now();refresh();if(i>=8)times.push(performance.now()-start)}times.sort((a,b)=>a-b);return {components:A.document.objects.length,selection,median_ms:times[Math.floor(times.length/2)],p95_ms:times[Math.floor(times.length*.95)]}},selection);results.push({version,...result});
  }
  await tab.close();
 }
 await page.evaluate(results=>window.__worldPerformance=results,results);return results;
}
