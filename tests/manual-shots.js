async(page)=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setViewportSize({width:1600,height:1000});
 await page.reload();await page.evaluate(()=>SpatialEditor.loadProject(JSON.parse(document.querySelector('#editor-seed').textContent)));
 await page.screenshot({path:'docs/空间图_平面.png'});
 await page.locator('[data-view="elevation"]').click();
 await page.screenshot({path:'docs/空间图_立面.png'});
 await page.locator('[data-view="solid"]').click();
 await page.screenshot({path:'docs/空间图_立体.png'});
 await page.locator('#document-select').selectOption(await page.evaluate(()=>SpatialEditor.project.documents.find(d=>d.type==='curve').id));
 await page.screenshot({path:'docs/曲线图_总览.png'});
 await page.locator('[data-curve-section="title"] summary').click();await page.locator('[data-curve-section="curve"] summary').click();
 await page.screenshot({path:'docs/曲线图_事件.png'});
 await page.evaluate(()=>SpatialEditor.command('svg'));await page.locator('#export-preview-svg').waitFor({state:'visible'});
 await page.screenshot({path:'docs/导出图稿_预览.png'});
 if(errors.length)throw Error(errors.join('\n'));
 return {screenshots:6,errors};
}
