// Small, sequential real-browser audit; fixtures seed geometry, all tested commands use actual UI.
const fs=require('node:fs'),path=require('node:path'),{chromium}=require('playwright-core');
const root=path.resolve(__dirname,'..'),out=path.join(root,'qa/full-review-2026-10-31/geometry'),source=process.argv.includes('--source'),suffix=source?'-source':'';
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'}),page=await browser.newPage({viewport:{width:1440,height:1000}});
 const report={kind:'Headless Chrome, seeded geometry fixture plus real UI clicks and keyboard events',build:source?'Current source assembled in memory; dist unchanged':'Current local distribution',checks:[],errors:[]};
 page.on('pageerror',e=>report.errors.push(e.message));
 const capture=async()=>page.evaluate(()=>({objects:SpatialEditor.document.objects,status:document.querySelector('#status').textContent,valid:StudioModel.validGeometry(SpatialEditor.document)}));
 const check=(value,name,detail)=>report.checks.push({name,pass:!!value,...(detail?{detail}:{})});
 try {
  if(source)await page.route('http://127.0.0.1:10435/',route=>route.fulfill({contentType:'text/html',body:require('./audit-geometry-runtime.cjs')()}));
  await page.goto('http://127.0.0.1:10435/');
  const ids=await page.evaluate(()=>{const A=SpatialEditor,M=StudioModel,d=M.createDocument('space','单孔粘贴复核');d.objects=[];const p=M.createObject(d,'plane',[400,300,0]);p.name='测试平台';p.points=[[-150,-150],[150,-150],[150,150],[-150,150]];const h=M.createObject(d,'hole');Object.assign(h,{name:'测试空洞',host:p.id,floor:p.floor,edgeCut:true,points:[[-30,-20],[30,-20],[30,20],[-30,20]]});d.objects.push(p,h);A.loadProject({format:'level-spatial-editor',version:8,documents:[d],activeDocument:d.id});A.command('fit');return {plane:p.id,hole:h.id}});
  const baseline=await capture();
  await page.locator(`[data-layer="${ids.hole}"]`).click();
  await page.keyboard.press('Control+c');await page.keyboard.press('Control+v');
  const independent=await capture();
  const independentDelta=independent.objects.at(-1).points[0].map((x,i)=>x-baseline.objects[1].points[0][i]);
  check(independent.objects.length===3,'standalone hole Ctrl+C/V inserts one new hole');
  check(independentDelta.every(v=>v===25),'standalone hole Ctrl+C/V offsets by 25/25',independentDelta);
  await page.screenshot({path:path.join(out,'standalone-hole-paste'+suffix+'.png')});
  await page.keyboard.press('Control+z');const undone=await capture();
  check(JSON.stringify(undone.objects)===JSON.stringify(baseline.objects),'standalone hole paste undo restores exact geometry');
  await page.locator(`[data-layer="${ids.plane}"]`).click();
  await page.keyboard.press('Control+c');await page.keyboard.press('Control+v');
  const compound=await capture(),newPlane=compound.objects.find(o=>o.type==='plane'&&o.id!==ids.plane),newHole=compound.objects.find(o=>o.type==='hole'&&o.id!==ids.hole);
  check(compound.objects.length===4&&newHole.host===newPlane.id,'host clipboard includes and rebinds attached hole');
  check(newPlane.position.every((v,i)=>v-baseline.objects[0].position[i]===[25,25,0][i])&&JSON.stringify(newHole.points)===JSON.stringify(baseline.objects[1].points),'host and hole move together once without double offset');
  await page.keyboard.press('Control+z');check(JSON.stringify((await capture()).objects)===JSON.stringify(baseline.objects),'host plus hole paste undo restores exact geometry');
  report.clipboard={baseline,independent,independentDelta,compound};
  const wallId=await page.evaluate(()=>{const A=SpatialEditor,M=StudioModel,d=M.createDocument('space','隐藏空洞转墙复核');d.objects=[];const o=M.createObject(d,'wall',[400,300,0]);o.name='高底边墙';o.points=[[-100,40],[100,40],[100,200],[-100,200]];const h=M.createObject(d,'hole');Object.assign(h,{name:'隐藏检修孔',host:o.id,floor:o.floor,edgeCut:true,visible:false,points:[[-30,80],[30,80],[30,140],[-30,140]],cut:{origin:[0,0,0],r:[1,0,0],d:[0,0,1],n:[0,-1,0]}});d.objects.push(o,h);A.loadProject({format:'level-spatial-editor',version:8,documents:[d],activeDocument:d.id});A.command('fit');return o.id});
  const worldCut=()=>page.evaluate(()=>{const A=SpatialEditor,M=StudioModel,h=A.document.objects.find(o=>o.type==='hole'),o=A.document.objects.find(o=>o.id===h.host);return h.points.map(p=>M.world(A.document,o,M.holePoint(h,p)))});
  const before=await worldCut();await page.locator(`[data-layer="${wallId}"]`).click();await page.locator('#equal-wall').click();const after=await worldCut();
  report.hiddenCut={before,after,delta:after[0].map((v,i)=>v-before[0][i]),state:await capture()};
  check(JSON.stringify(before)===JSON.stringify(after),'hidden hole world geometry survives conversion to equal thickness wall',report.hiddenCut.delta);
  const holeId=await page.evaluate(()=>SpatialEditor.document.objects.find(o=>o.type==='hole').id);
  await page.locator(`[data-visible="${holeId}"]`).click();await page.locator('[data-view="elevation"]').click();
  check(JSON.stringify(before)===JSON.stringify(await worldCut()),'showing hidden hole after conversion preserves its original placement');
  await page.screenshot({path:path.join(out,'hidden-hole-shown'+suffix+'.png')});
  await page.keyboard.press('Control+z');await page.keyboard.press('Control+z');check(JSON.stringify(before)===JSON.stringify(await worldCut()),'wall conversion undo restores hidden hole coordinates');
  await page.locator('[data-view="plan"]').click();
  await page.locator(`[data-visible="${holeId}"]`).click();await page.locator(`[data-layer="${wallId}"]`).click();await page.locator('#equal-wall').click();
  check(JSON.stringify(before)===JSON.stringify(await worldCut()),'visible hole retains coordinates through same conversion');
  await page.locator('[data-view="elevation"]').click();await page.screenshot({path:path.join(out,'visible-hole-conversion'+suffix+'.png')});
 } catch(e){report.fatal={message:e.message,stack:e.stack};}
 finally {await browser.close();fs.writeFileSync(path.join(out,'headless-results'+suffix+'.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({checks:report.checks.map(c=>({name:c.name,pass:c.pass,detail:c.detail})),errors:report.errors,fatal:report.fatal}));}
})();
