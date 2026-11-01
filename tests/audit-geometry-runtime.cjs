// Load the production module order without changing dist during parallel audits.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
module.exports=function sourceHtml(){
 const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8'),build=read('tools/build.mjs');
 const names=key=>vm.runInNewContext(build.match(new RegExp('const '+key+'=(\\[[^;]+\\]);'))[1]);
 const js=names('modules').map(name=>read(`src/${name}.js`).replace('/*TEXT_EDITING*/',()=>read('src/text-editing.js')).replace('/*INTERACTIONS*/',()=>names('interactions').map(n=>read(`src/${n}.js`)).join('\n'))).join('\n');
 const help=read('dist/index.html').match(/<div class="help-layout">[\s\S]*?<\/dialog>/)[0].replace(/<\/dialog>$/,'');
 return read('src/editor.html').replace('<!--UPDATE_NOTICE-->',()=>read('dist/index.html').match(/<dialog id="update-notice"[\s\S]*?<\/dialog>/)[0]).replace('<!--HELP_CONTENT-->',()=>help).replace('/*EDITOR_CSS*/',()=>read('src/editor.css')).replace('/*EDITOR_JS*/',()=>js).replace('SEED_JSON',()=>read('data/initial-project.json').replaceAll('</','<\\/'));
};
