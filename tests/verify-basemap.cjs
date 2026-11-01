const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{JSDOM,VirtualConsole}=require('jsdom');
const root=path.resolve(__dirname,'..'),errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
const dom=new JSDOM(fs.readFileSync(path.join(root,'dist/index.html'),'utf8'),{url:'https://qa.local/basemap.html',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){w.localStorage.setItem('level-diagram-studio:notice:1.1.0','seen');w.HTMLCanvasElement.prototype.getContext=()=>null;w.HTMLElement.prototype.getBoundingClientRect=()=>({left:0,top:0,right:1000,bottom:700,width:1000,height:700});w.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','')};w.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open')}}});
try{
 const w=dom.window,M=w.StudioModel,R=w.StudioRender,I=w.StudioImages,A=w.SpatialEditor;assert(A,errors.join('\n'));
 const old=JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/scale-legacy-project.json'),'utf8')),legacy=M.validate(old),geometry=JSON.stringify(legacy.documents.map(d=>({objects:d.objects,floors:d.floors})));
 const p=M.clone(legacy),d=p.documents[0],id='img-test-1',data='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a1ioAAAAASUVORK5CYII=';
 p.version=9;d.basemap={assetId:id,x:100,y:200,width:800,height:400,rotation:0,opacity:.6,visible:true};p.assets={[id]:{data,width:1,height:1}};
 const runtime=M.validate(p);assert.equal(runtime.version,9);assert(!runtime.assets,'runtime state must exclude image bytes');assert(JSON.stringify(runtime).length<JSON.stringify(p).length);assert.equal(JSON.stringify(runtime.documents.map(d=>({objects:d.objects,floors:d.floors}))),geometry);
 const duplicate=M.clone(runtime.documents[0]);duplicate.id='duplicate-doc';runtime.documents.push(duplicate);const packed=I.pack(runtime);assert.equal(Object.keys(packed.assets).length,1,'copied documents share one image');assert.equal(packed.assets[id].data,data);assert.equal(M.validate(packed).documents.length,legacy.documents.length+1);
 const imageDoc=runtime.documents[0];imageDoc.objects=[];const view={mode:'plan',side:'front',azimuth:35,elevation:35},s=R.scene(imageDoc,view,{selection:[],ghost:false});const extent=R.contentExtent(s);assert.deepEqual(JSON.parse(JSON.stringify(extent)),{x:100,y:200,w:800,h:400});assert.equal(s.hits.length,0,'image is not pickable geometry');assert.equal(M.legendCandidates(imageDoc).length,0,'image is not a legend candidate');
 const svg=R.svg(imageDoc,s,extent,null);assert(svg.includes('data-basemap="true"'));assert.equal(svg.split(data).length-1,1,'SVG embeds image once');assert(!svg.includes('blob:'));
 for(const mode of ['elevation','solid']){const scene=R.scene(imageDoc,{...view,mode},{selection:[]});assert(!R.svg(imageDoc,scene,{x:0,y:0,w:1200,h:800}).includes('data-basemap="true"'))}
 imageDoc.basemap.rotation=90;const b=M.basemapBounds(imageDoc);assert(Math.abs(b.w-400)<1e-7&&Math.abs(b.h-800)<1e-7);imageDoc.basemap.visible=false;assert(!R.svg(imageDoc,R.scene(imageDoc,view,{}),{x:0,y:0,w:1200,h:800}).includes('data-basemap="true"'));
 const bad=M.clone(p);bad.documents[0].basemap.width=-1;assert.throws(()=>M.validate(bad),/底图/);bad.documents[0].basemap.width=800;bad.assets[id].data='data:image/svg+xml;base64,PHN2Zz4=';assert.throws(()=>M.validate(bad),/底图/);

 // Multiple pictures and non-destructive crop retain the original transform and shared bytes.
 const many=M.clone(runtime);many.documents=[many.documents[0]];const md=many.documents[0];md.basemap.visible=true;md.basemap.rotation=0;md.basemap.id='first';md.images=[{...M.clone(md.basemap),id:'second',x:1000,crop:[.25,.25,.5,.5]}];
 const transform=JSON.stringify([md.images[0].x,md.images[0].y,md.images[0].width,md.images[0].height]);
 assert.deepEqual(JSON.parse(JSON.stringify(M.imageBounds(md.images[0]))),{x:1200,y:300,w:400,h:200});
 const multiPacked=I.pack(many);assert.equal(multiPacked.version,10);assert.equal(Object.keys(multiPacked.assets).length,1);assert.equal(M.validate(multiPacked).documents[0].images.length,1);
 const multiSvg=R.svg(md,R.scene(md,view,{}),{x:0,y:0,w:2000,h:1000});assert.equal((multiSvg.match(/data-basemap="true"/g)||[]).length,2);assert(multiSvg.includes('clipPath'));assert(!multiSvg.includes('blob:'));
 assert.equal(JSON.stringify([md.images[0].x,md.images[0].y,md.images[0].width,md.images[0].height]),transform);
 md.basemap.visible=false;assert.deepEqual(JSON.parse(JSON.stringify(M.basemapBounds(md))),{x:1200,y:300,w:400,h:200});assert(M.basemapBounds(md,false).w>400);
 for(const crop of [[0,0,0,1],[.8,0,.5,1],[0,-1,1,1],[0,0,NaN,1]]){const invalid=M.clone(multiPacked);invalid.documents[0].images[0].crop=crop;assert.throws(()=>M.validate(invalid),/裁切/)}
 // Fixed grid never shifts its world-coordinate lattice as the viewport changes.
 md.gridDisplay='fixed';const originalSnap=M.snapInterval(md),gaps=[];for(const width of [1200,1800,2400,4800,9600]){const g=R.viewportGrid(md,view,M.viewBasis(md,view),{x:0,y:0,w:width,h:width*.7},1200);const vals=[...g.matchAll(/d="M ([^ ]+) ([^ ]+) L ([^ ]+) ([^"]+)"/g)];for(const a of vals){const coordinate=+a[1]===+a[3]?+a[1]:+a[2];assert(Math.abs(coordinate/M.scaleConfig(md).gridStep-Math.round(coordinate/M.scaleConfig(md).gridStep))<1e-6)}gaps.push(vals.length)}assert.equal(M.snapInterval(md),originalSnap);assert(gaps.every(n=>n<1500));
 console.log('PASS multi-image: v10 portable data; shared assets; cropped bounds; hidden-first image; embedded clips; invalid crop rejection; fixed grid lattice and independent snap.');
 assert.deepEqual(errors,[]);console.log('PASS basemap: legacy geometry; version9/runtime asset separation; shared embedded assets; plan-only rendering; image-only extent; no picking/legend; standalone SVG embed; rotated bounds; invalid image validation.');
}finally{dom.window.close()}
