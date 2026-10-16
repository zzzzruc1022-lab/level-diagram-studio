import {packager} from '@electron/packager';
import {cpSync,mkdirSync,readFileSync,writeFileSync,readdirSync,unlinkSync,rmSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(fileURLToPath(new URL('../',import.meta.url)));
const staging=path.join(root,'.build','app');
if(!staging.startsWith(root+path.sep)||path.relative(root,staging)!==path.join('.build','app'))throw Error('Unexpected staging path');
rmSync(staging,{recursive:true,force:true});
mkdirSync(staging,{recursive:true});
cpSync(path.join(root,'desktop'),staging,{recursive:true});
for(const name of ['LICENSE','THIRD_PARTY_NOTICES.md'])cpSync(path.join(root,name),path.join(staging,name));
cpSync(path.join(root,'third_party'),path.join(staging,'third_party'),{recursive:true});
// The browser keeps its historical path key; desktop autosave survives moving the app folder.
writeFileSync(path.join(staging,'index.html'),readFileSync(path.join(root,'dist','index.html'),'utf8')
 .replace('<html lang="zh-CN">','<html lang="zh-CN" data-storage-key="level-diagram-studio-desktop-v1">'));
const version=JSON.parse(readFileSync(path.join(root,'node_modules/electron/package.json'),'utf8')).version;
const results=await packager({dir:staging,name:'关卡简图工坊',platform:'win32',arch:'x64',
 out:path.join(root,'.build','desktop'),overwrite:true,asar:true,prune:false,
 electronVersion:version,electronZipDir:process.env.ELECTRON_ZIP_DIR||undefined,icon:path.join(root,'desktop','icon.ico'),
 appVersion:'1.0.0',buildVersion:'1.0.0',
 win32metadata:{ProductName:'关卡简图工坊',FileDescription:'Level Diagram Studio',CompanyName:'Level Diagram Studio'}});
console.log(results.join('\n'));
const manualFiles=['使用说明.html','使用说明.md','空间图_平面.png','空间图_立面.png','空间图_立体.png','曲线图_总览.png','曲线图_事件.png','导出图稿_预览.png','事件名称排序_拖动中.png'];
for(const folder of results){mkdirSync(path.join(folder,'说明文档'),{recursive:true});for(const name of manualFiles)cpSync(path.join(root,'docs',name),path.join(folder,'说明文档',name))}
// Ship only the interface languages used by this Chinese application and its fallback.
for(const folder of results)for(const locale of readdirSync(path.join(folder,'locales')))
 if(!['zh-CN.pak','en-US.pak'].includes(locale))unlinkSync(path.join(folder,'locales',locale));
