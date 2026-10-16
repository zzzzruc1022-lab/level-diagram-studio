// Real packaged EXE, isolated Chromium profile, real DOM/input/download paths.
const {_electron}=require('playwright-core');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
let exe=process.env.STUDIO_EXE;
if(!exe)throw Error('Set STUDIO_EXE to the extracted release EXE');
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'level-diagram-test-'));
const results={profile,exe,checks:[],errors:[]};
let app;
const start=async()=>{
 const a=await _electron.launch({executablePath:exe,args:['--studio-profile='+profile],timeout:60000});
 const p=await a.firstWindow();p.on('pageerror',e=>results.errors.push(e.message));
 await p.waitForFunction(()=>!!window.SpatialEditor);return {a,p};
};
(async()=>{
 let {a,p}=await start();app=a;
 assert.equal(await p.title(),'关卡简图工坊 v1.0');
 assert.equal(await p.evaluate(()=>typeof require),'undefined');
 assert(await p.evaluate(()=>window.SpatialEditor.project.documents.length===0));results.checks.push('real EXE starts offline, empty seed, Node unavailable');
 const preferences=await a.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];return w.webContents.getLastWebPreferences()});
 assert(preferences.sandbox&&preferences.contextIsolation&&!preferences.nodeIntegration);results.checks.push('sandbox and context isolation enabled');
 await a.evaluate(({Menu})=>Menu.getApplicationMenu().items[0].submenu.items[0].click());
 await p.locator('#help-dialog').waitFor({state:'visible'});assert.equal(await p.locator('[data-help-demo]').count(),7);await p.locator('[data-action="close-help"]').click();results.checks.push('F1 menu opens complete embedded help with seven demos');
 await p.locator('[data-template="space"]').first().click();
 await p.locator('#canvas').focus();await p.keyboard.press('p');assert.equal(await p.evaluate(()=>SpatialEditor.tool),'plane');
 const b=await p.locator('#stage').boundingBox();await p.mouse.move(b.x+b.width*.3,b.y+b.height*.35);await p.mouse.down();await p.mouse.move(b.x+b.width*.5,b.y+b.height*.6,{steps:8});await p.mouse.up();
 assert(await p.evaluate(()=>SpatialEditor.document.objects.filter(o=>o.type==='plane').length>=2));results.checks.push('physical tool key and real rectangle drag');
 await p.keyboard.press('Control+z');assert.equal(await p.evaluate(()=>SpatialEditor.document.objects.filter(o=>o.type==='plane').length),1);await p.keyboard.press('Control+Shift+z');results.checks.push('undo and redo');
 const sample=path.resolve(__dirname,'../data/qa-project.json');
 await p.evaluate(()=>SpatialEditor.command('import'));await p.locator('#file-input').setInputFiles(sample);
 await p.waitForFunction(()=>SpatialEditor.project.documents.length===2);
 await p.locator('[data-view="solid"]').click();await p.screenshot({path:path.resolve(__dirname,'../docs/桌面版_运行.png')});
 await p.locator('[data-view="plan"]').click();
 // Set a destination on the native DownloadItem in this test process only.
 const prepare=async file=>a.evaluate(({session},file)=>{global.studioDownload=null;session.defaultSession.once('will-download',(_event,item)=>{item.setSavePath(file);item.once('done',(_e,state)=>{global.studioDownload=state})})},file);
 const saved=async()=>{for(let i=0;i<100;i++){const state=await a.evaluate(()=>global.studioDownload);if(state){assert.equal(state,'completed');return}await new Promise(r=>setTimeout(r,100))}throw Error('Native download did not complete')};
 const downloaded=path.join(profile,'工程.json');
 await prepare(downloaded);await p.locator('[data-action="project"]').click();await saved();assert.equal(JSON.parse(fs.readFileSync(downloaded,'utf8')).version,7);results.checks.push('native JSON import and real file download');
 await p.evaluate(()=>SpatialEditor.command('png'));await p.locator('#export-download').waitFor({state:'visible'});await p.waitForFunction(()=>!document.querySelector('#export-download').disabled);
 const png=path.join(profile,'图稿.png');await prepare(png);await p.locator('#export-download').click();await saved();assert.equal(fs.readFileSync(png).subarray(0,8).toString('hex'),'89504e470d0a1a0a');results.checks.push('PNG preview and real PNG export');
 await p.locator('[data-action="export-close"]').first().click();
 await p.evaluate(()=>{SpatialEditor.document.name='重开恢复验证';SpatialEditor.command('save')});
 await a.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].close());await a.process().exitCode;
 // Await process disposal before reusing the isolated profile.
 await new Promise(resolve=>{if(a.process().exitCode!==null)resolve();else a.process().once('exit',resolve)});
 if(process.env.STUDIO_EXE_SECOND)exe=process.env.STUDIO_EXE_SECOND;
 ({a,p}=await start());app=a;assert.equal(await p.evaluate(()=>SpatialEditor.document.name),'重开恢复验证');results.checks.push('close and relaunch restores isolated autosave'+(process.env.STUDIO_EXE_SECOND?' after moving app folder':''));
 assert.equal(results.errors.length,0);
 await a.close();app=null;
 fs.writeFileSync(path.resolve(process.env.STUDIO_DESKTOP_REPORT||path.join(__dirname,'../docs/desktop-test-results.json')),JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
})().catch(async e=>{console.error(e);if(app)await app.close().catch(()=>{});process.exitCode=1});
