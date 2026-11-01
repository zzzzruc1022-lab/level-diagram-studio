const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright-core');
const root=path.resolve(__dirname,'..'),out=path.join(root,'qa/full-review-2026-10-31/interaction');
const url=process.env.AUDIT_URL||'http://127.0.0.1:10435/';
const results={startedAt:new Date().toISOString(),url,headless:true,distSHA256:crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'dist/index.html'))).digest('hex'),runs:[]};
const write=()=>fs.writeFileSync(path.join(out,'headless-results.json'),JSON.stringify(results,null,2));
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  for(const name of ['browser-interaction.js','browser-interaction-extra.js']){
   const context=await browser.newContext({acceptDownloads:true,viewport:{width:1440,height:1000}}),page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(12000);
   const run={script:name,checks:[],errors,files:[],failure:null};results.runs.push(run);
   try{
    await page.goto(url);await page.waitForFunction(()=>window.SpatialEditor);
    const source=fs.readFileSync(path.join(__dirname,name),'utf8').replace("const out='qa/interaction-audit-2026-10-30/'","const out="+JSON.stringify(out.replace(/\\/g,'/')+'/'));
    assert(!source.includes('qa/interaction-audit-2026-10-30/'),'all output remains in current audit directory');
    Object.assign(run,await eval('('+source+')')(page));
    assert(!run.failure,run.failure);assert.deepEqual(errors,[]);assert.deepEqual(run.errors,[]);
    if(name==='browser-interaction.js'){
     const saved=JSON.parse(fs.readFileSync(path.join(out,'interaction-saved.json'),'utf8')),chooser=page.waitForEvent('filechooser');
     await page.locator('[data-action="import"]').click();await(await chooser).setFiles(path.join(out,'interaction-saved.json'));
     assert.deepEqual(await page.evaluate(()=>SpatialEditor.project),saved);run.checks.push('downloaded JSON imports through the actual file chooser without changes');
     await page.waitForTimeout(600);await page.close();const reopened=await context.newPage();await reopened.goto(url);await reopened.waitForFunction(()=>window.SpatialEditor);
     assert.deepEqual(await reopened.evaluate(()=>SpatialEditor.project),saved);run.checks.push('closing and reopening the page restores the saved interaction project');
     const svgPage=await context.newPage();await svgPage.goto(pathToFileURL(path.join(out,'interaction-elevation.svg')).href);assert.equal(await svgPage.locator('svg').count(),1);
     assert.equal(await svgPage.locator('[data-pick-preview],[data-world-handle]').count(),0);await svgPage.screenshot({path:path.join(out,'interaction-elevation-rendered.png')});
     run.checks.push('downloaded SVG opens in the browser with no selection preview or world handle');await svgPage.close();
     const png=fs.readFileSync(path.join(out,'interaction-elevation.png'));assert.equal(png.subarray(1,4).toString(),'PNG');run.pngSize=[png.readUInt32BE(16),png.readUInt32BE(20)];assert(run.pngSize.every(v=>v>0));
     run.checks.push('downloaded PNG has a valid PNG signature and positive image dimensions');
    }else await page.screenshot({path:path.join(out,'interaction-extra-final.png')});
   }catch(e){run.failure=e.stack;try{if(!page.isClosed())await page.screenshot({path:path.join(out,name.replace('.js','')+'-failure.png')})}catch{}process.exitCode=1}
   finally{await context.close();write()}
  }
 }finally{await browser.close();results.finishedAt=new Date().toISOString();results.totalChecks=results.runs.reduce((n,r)=>n+r.checks.length,0);write();console.log(JSON.stringify({totalChecks:results.totalChecks,runs:results.runs.map(({script,checks,failure,pngSize})=>({script,checks:checks.length,failure,pngSize})),report:path.join(out,'headless-results.json')},null,2))}
})().catch(e=>{console.error(e);process.exitCode=1});
