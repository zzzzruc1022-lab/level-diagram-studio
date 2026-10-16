import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {minify} from 'terser';
const root=new URL('../',import.meta.url);
const read=p=>readFileSync(new URL(p,root),'utf8');
const modules=['model','geometry','model-features','curved-geometry','creation-colors','model-v10','geometry-cache','render','render-features','view-features','advanced-render','app'];
const interactions=['interactions','ui-features','advanced-interactions','export-preview','curve-panel','keyboard','move-snapping','transform-snapping','world-move','usage-help','event-editing'];
const source=modules.map(name=>read(`src/${name}.js`)
  .replace('/*TEXT_EDITING*/',()=>read('src/text-editing.js'))
  .replace('/*INTERACTIONS*/',()=>interactions.map(name=>read(`src/${name}.js`)).join('\n'))).join('\n');
// Only distribution code is compacted. Public API properties are preserved.
const result=await minify(source,{compress:{passes:1},mangle:true,format:{comments:false,inline_script:true}});
const css=read('src/editor.css').replace(/\/\*[\s\S]*?\*\//g,'').trim();
const helpAsset=(id,kind)=>{const file=new URL('src/help/'+id.toLowerCase()+'.'+(kind==='GIF'?'gif':'png'),root);return 'data:image/'+(kind==='GIF'?'gif':'png')+';base64,'+readFileSync(file).toString('base64')};
const help=JSON.parse(read('src/help/content.json')),esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const helpSections=help.sections.map(s=>{
 const demo=s.demo?(()=>{const id=s.demo.toUpperCase(),png=readFileSync(new URL('src/help/'+s.demo+'.png',root)),width=png.readUInt32BE(16),height=png.readUInt32BE(20);return `<figure class="help-demo"><button type="button" data-help-demo="${id}" data-gif="HELP_${id}_GIF" data-poster="HELP_${id}_POSTER" aria-pressed="false" aria-label="播放或停止：${esc(s.caption)}"><img src="HELP_${id}_POSTER" alt="${esc(s.caption)}" width="${width}" height="${height}" decoding="async"><span class="help-demo-action">点击播放演示</span></button><figcaption>${esc(s.caption)}</figcaption></figure>`})():'';
 return `<section id="help-${s.id}" data-help-section="${s.id}"><h3>${esc(s.title)}</h3><dl>${s.steps.map(([label,text])=>`<dt>${esc(label)}</dt><dd>${esc(text)}</dd>`).join('')}</dl>${demo}</section>`;
}).join('');
const helpMarkup=`<div class="help-layout"><nav class="help-directory" aria-label="使用说明目录"><strong>操作目录</strong>${help.sections.map((s,i)=>`<button type="button" data-help-chapter="${s.id}" aria-controls="help-${s.id}" aria-current="${i===0}">${esc(s.title)}</button>`).join('')}</nav><label class="help-mobile-directory">查看章节<select id="help-chapter">${help.sections.map(s=>`<option value="${s.id}">${esc(s.title)}</option>`).join('')}</select></label><div id="help-content" tabindex="0" aria-label="使用说明正文"><p class="help-intro">${esc(help.intro)}</p>${helpSections}<section class="help-shortcuts"><h3>常用快捷键</h3><dl>${help.shortcuts.map(([label,key])=>`<dt>${esc(label)}</dt><dd>${esc(key)}</dd>`).join('')}</dl><p>${esc(help.shortcutNote)}</p></section></div></div>`;
const html=read('src/editor.html').replace('<!--HELP_CONTENT-->',()=>helpMarkup).replace(/HELP_([A-Z]+)_(GIF|POSTER)/g,(_,id,kind)=>helpAsset(id,kind)).replace('/*EDITOR_CSS*/',()=>css).replace('/*EDITOR_JS*/',()=>result.code)
  .replace('SEED_JSON',()=>read('data/initial-project.json').replaceAll('</','<\\/'));
mkdirSync(new URL('dist/',root),{recursive:true});
writeFileSync(new URL('dist/index.html',root),html);
writeFileSync(new URL('dist/build-report.json',root),JSON.stringify({sourceJS:Buffer.byteLength(source),publishedJS:Buffer.byteLength(result.code),html:Buffer.byteLength(html)},null,2));
console.log('Built Level Diagram Studio 1.0: '+Buffer.byteLength(html)+' bytes');
