import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {minify} from 'terser';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
const root=new URL('../',import.meta.url);
const read=p=>readFileSync(new URL(p,root),'utf8');
const modules=['model','geometry','model-features','curved-geometry','creation-colors','model-v10','scale-model','vendor/polygon-clipping','edge-geometry','geometry-cache','render','render-features','view-features','advanced-render','edge-render','scale-render','legend','map-info','basemap-model','basemap-render','route-occlusion','app'];
const interactions=['interactions','ui-features','advanced-interactions','export-preview','curve-panel','keyboard','move-snapping','transform-snapping','world-move','usage-help','event-editing','scale-ui','interaction-ux','edge-editing','legend-ui','map-info-ui','appearance','workspace-ui','basemap-ui','image-components','route-occlusion-ui','update-notice'];
const source=modules.map(name=>read(`src/${name}.js`)
  .replace('/*TEXT_EDITING*/',()=>read('src/text-editing.js'))
  .replace('/*INTERACTIONS*/',()=>interactions.map(name=>read(`src/${name}.js`)).join('\n'))).join('\n');
// Only distribution code is compacted. Public API properties are preserved.
const result=await minify(source,{compress:{passes:1},mangle:true,format:{comments:false,inline_script:true}});
const css=['editor','appearance','export-layout','workspace-ui','scale-toolbar','basemap'].map(name=>read(`src/${name}.css`)).join('\n').replace(/\/\*[\s\S]*?\*\//g,'').trim();
const helpAsset=(id,kind)=>{const file=new URL('src/help/'+id.toLowerCase()+'.'+(kind==='GIF'?'gif':'png'),root);return 'data:image/'+(kind==='GIF'?'gif':'png')+';base64,'+readFileSync(file).toString('base64')};
const help=JSON.parse(read('src/help/content.json')),esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const helpSections=help.sections.map(s=>{
 const demo=s.demo?(()=>{const id=s.demo.toUpperCase(),png=readFileSync(new URL('src/help/'+s.demo+'.png',root)),width=png.readUInt32BE(16),height=png.readUInt32BE(20);return `<figure class="help-demo"><button type="button" data-help-demo="${id}" data-gif="HELP_${id}_GIF" data-poster="HELP_${id}_POSTER" aria-pressed="false" aria-label="播放或停止：${esc(s.caption)}"><img src="HELP_${id}_POSTER" alt="${esc(s.caption)}" width="${width}" height="${height}" decoding="async"><span class="help-demo-action">点击播放演示</span></button><figcaption>${esc(s.caption)}</figcaption></figure>`})():'';
 return `<section id="help-${s.id}" data-help-section="${s.id}"><h3>${esc(s.title)}</h3><dl>${s.steps.map(([label,text])=>`<dt>${esc(label)}</dt><dd>${esc(text)}</dd>`).join('')}</dl>${demo}</section>`;
}).join('');
const helpMarkup=`<div class="help-layout"><nav class="help-directory" aria-label="使用说明目录"><strong>操作目录</strong>${help.sections.map((s,i)=>`<button type="button" data-help-chapter="${s.id}" aria-controls="help-${s.id}" aria-current="${i===0}">${esc(s.title)}</button>`).join('')}</nav><label class="help-mobile-directory">查看章节<select id="help-chapter">${help.sections.map(s=>`<option value="${s.id}">${esc(s.title)}</option>`).join('')}</select></label><div id="help-content" tabindex="0" aria-label="使用说明正文"><p class="help-intro">${esc(help.intro)}</p>${helpSections}<section class="help-shortcuts"><h3>常用快捷键</h3><dl>${help.shortcuts.map(([label,key])=>`<dt>${esc(label)}</dt><dd>${esc(key)}</dd>`).join('')}</dl><p>${esc(help.shortcutNote)}</p></section></div></div>`;
const release=JSON.parse(read('src/release-notes.json'));
const updateNotice=`<dialog id="update-notice" aria-labelledby="update-title"><div class="update-heading"><h2 id="update-title">关卡简图工坊 1.1 更新</h2><button type="button" id="update-close" aria-label="关闭更新公告" autofocus>×</button></div><div class="update-body"><ol>${release.items.map(t=>`<li>${esc(t)}</li>`).join('')}</ol><p><a href="${release.download}" target="_blank" rel="noopener noreferrer">GitHub 下载 Windows 版和离线网页版</a></p><p>演示视频：<a href="${release.video}" target="_blank" rel="noopener noreferrer">在 B 站观看九项更新演示</a></p></div><div class="update-footer"><button type="button" id="update-continue" class="primary">开始使用</button></div></dialog>`;
const notices='polygon-clipping — pinned commit 82b0ac2c35304bfea9cac24eabcbda32a808ee55\nhttps://github.com/mfogel/polygon-clipping\nBundled and minified for this offline editor; source vendor file unchanged.\n\n'+read('src/vendor/polygon-clipping.LICENSE.md')+'\n\n'+(read('src/vendor/polygon-clipping.js').match(/\/\*[\s\S]*?\*\//g)||[]).join('\n')+'\n\n'+read('src/vendor/Apache-2.0.txt');
const template=read('src/editor.html').replace('</head>',()=>'<script type="text/plain" id="third-party-notices">'+notices.replaceAll('</','<\\/')+'</script></head>').replace('<!--UPDATE_NOTICE-->',()=>updateNotice).replace('<!--HELP_CONTENT-->',()=>helpMarkup).replace('/*EDITOR_CSS*/',()=>css).replace('/*EDITOR_JS*/',()=>result.code)
  .replace('SEED_JSON',()=>read('data/initial-project.json').replaceAll('</','<\\/'));
const html=template.replace(/HELP_([A-Z]+)_(GIF|POSTER)/g,(_,id,kind)=>helpAsset(id,kind));
mkdirSync(new URL('dist/',root),{recursive:true});
writeFileSync(new URL('dist/index.html',root),html);
writeFileSync(new URL('dist/THIRD-PARTY-NOTICES.txt',root),notices);
// Online delivery keeps the same editor; teaching media is fetched only when used.
// Offline HTML and desktop continue to embed every asset and need no connection.
mkdirSync(new URL('dist/web/assets/help/',root),{recursive:true});
const webAssets=new Map();
const web=template.replace('img-src data: blob:;',"img-src &#39;self&#39; data: blob:;")
 .replace(/HELP_([A-Z]+)_(GIF|POSTER)/g,(_,id,kind)=>{
  const key=id+kind;if(webAssets.has(key))return webAssets.get(key);
  const ext=kind==='GIF'?'gif':'png',data=readFileSync(new URL(`src/help/${id.toLowerCase()}.${ext}`,root));
  const name=`assets/help/${id.toLowerCase()}.${createHash('sha256').update(data).digest('hex').slice(0,12)}.${ext}`;
  writeFileSync(new URL('dist/web/'+name,root),data);webAssets.set(key,name);return name;
 }).replaceAll('decoding="async"','decoding="async" loading="lazy"');
writeFileSync(new URL('dist/web/index.html',root),web);
writeFileSync(new URL('dist/web/THIRD-PARTY-NOTICES.txt',root),notices);
writeFileSync(new URL('dist/build-report.json',root),JSON.stringify({sourceJS:Buffer.byteLength(source),publishedJS:Buffer.byteLength(result.code),html:Buffer.byteLength(html),webHTML:Buffer.byteLength(web),offlineGzip:gzipSync(html).length,webGzip:gzipSync(web).length,webHelpAssets:[...webAssets.values()]},null,2));
console.log(`Built Level Diagram Studio 1.1: offline ${Buffer.byteLength(html)} bytes; web ${Buffer.byteLength(web)} bytes`);
