'use strict';
const {app,BrowserWindow,Menu,session,dialog}=require('electron');
const path=require('node:path');
const {pathToFileURL}=require('node:url');

app.setName('Level Diagram Studio');
// An isolated profile is useful for reproducible release smoke tests.
const profile=process.argv.find(v=>v.startsWith('--studio-profile='));
if(profile)app.setPath('userData',path.resolve(profile.slice('--studio-profile='.length)));
if(!app.requestSingleInstanceLock()){app.quit();}else{
 let window;
 app.on('second-instance',()=>{if(window){if(window.isMinimized())window.restore();window.focus()}});
 app.whenReady().then(()=>{
  const home=pathToFileURL(path.join(__dirname,'index.html')).href;
  // Offline app: imported projects never gain access to Node, OS APIs or the network.
  session.defaultSession.setPermissionRequestHandler((_contents,_permission,callback)=>callback(false));
  session.defaultSession.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*','ws://*/*','wss://*/*']},(_details,callback)=>callback({cancel:true}));
  session.defaultSession.on('will-download',(_event,item)=>item.setSaveDialogOptions({title:'保存工程或图稿',defaultPath:path.join(app.getPath('documents'),path.basename(item.getFilename()))}));
  window=new BrowserWindow({width:1440,height:960,minWidth:960,minHeight:680,show:false,backgroundColor:'#f8f9fb',
   title:'关卡简图工坊 1.0',icon:path.join(__dirname,'icon.ico'),
   webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,spellcheck:false}});
  window.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  window.webContents.on('will-navigate',(event,url)=>{if(url!==home)event.preventDefault()});
  window.webContents.on('will-attach-webview',event=>event.preventDefault());
  window.webContents.on('did-fail-load',(_e,code,description)=>{if(code!==-3)dialog.showErrorBox('页面未能载入',description)});
  Menu.setApplicationMenu(Menu.buildFromTemplate([{label:'帮助',submenu:[
   {label:'图文使用说明',accelerator:'F1',click:()=>window.webContents.executeJavaScript('SpatialEditor.command("help")').catch(()=>{})},
   {label:'关于关卡简图工坊',click:()=>dialog.showMessageBox(window,{type:'info',title:'关卡简图工坊',message:'关卡简图工坊 1.0',detail:'Level Diagram Studio\n离线关卡简图与曲线绘制工具。\n请使用“下载工程”保存可编辑 JSON。'})}
  ]}]));
  window.once('ready-to-show',()=>window.show());
  // Commit inline text and flush the app debounce before disposing the renderer.
  let closing=false;
  window.on('close',event=>{
   if(closing)return;event.preventDefault();closing=true;
   window.webContents.executeJavaScript('SpatialEditor.finishEditing();SpatialEditor.command("save")')
    .catch(()=>{}).finally(()=>window.destroy());
  });
  window.loadURL(home);
 });
 app.on('window-all-closed',()=>app.quit());
}
