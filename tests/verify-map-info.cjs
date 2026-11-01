const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),vm=require('node:vm');
const root=path.join(__dirname,'..'),context=vm.createContext({console});context.window=context;
for(const name of ['model','geometry','model-features','curved-geometry','creation-colors','model-v10','scale-model','vendor/polygon-clipping','edge-geometry','geometry-cache','render','render-features','view-features','advanced-render','edge-render','scale-render','legend'])vm.runInContext(fs.readFileSync(path.join(root,'src',name+'.js'),'utf8'),context);
const M=context.StudioModel,R=context.StudioRender,plain=value=>JSON.parse(JSON.stringify(value)),near=(a,b,message)=>assert(Math.abs(a-b)<1e-8,`${message}: ${a} != ${b}`),count=(s,token)=>(s.match(new RegExp(token,'g'))||[]).length;
const legacy=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/scale-legacy-project.json'),'utf8')),beforeModule=plain(M.validate(legacy));
vm.runInContext(fs.readFileSync(path.join(root,'src/map-info.js'),'utf8'),context);
assert.deepEqual(plain(M.validate(legacy)),beforeModule,'optional map-info module leaves legacy validation unchanged');
const geometry=p=>plain(p.documents.map(d=>({objects:d.objects,floors:d.floors,unit:d.unit})));
assert.deepEqual(geometry(M.validate(legacy)),geometry(legacy),'legacy coordinates, sizes, floors and stairs unchanged');
const d=M.createDocument('space','地图信息回归'),r={x:300,y:150,w:25600,h:17066.666666666668},width=1200,height=800,plan={mode:'plan',side:'front'},initial=JSON.stringify(d);
assert.deepEqual(plain(M.mapInfo(d)),{rulerEnabled:false,rulerPlacement:'map',northEnabled:false,northPlacement:'map',northAngle:0});
assert.equal(JSON.stringify(d),initial,'reading defaults does not attach metadata');
assert.equal(R.hasExportFooter(d,plan),false);assert.equal(R.exportFooter(d,R.scene(d,plan,{}),r,width,plan).height,0);
d.scaleSettings={enabled:true,metersPerUnit:.02,gridStep:40,snapStep:10,followGrid:false};
assert.equal(M.mapInfo(d).rulerEnabled,true,'legacy metric documents keep their existing ruler default');assert.equal(d.mapInfo,undefined);
d.mapInfo={...M.mapInfo(d),northEnabled:true,rulerPlacement:'footer',northPlacement:'footer'};
const project=()=>({format:'level-spatial-editor',version:7,activeDocument:d.id,documents:[d]});
assert.deepEqual(plain(M.validate(project()).documents[0].mapInfo),plain(d.mapInfo),'five settings survive JSON validation');
const valid=M.clone(d.mapInfo);
for(const [key,values] of Object.entries({rulerEnabled:[null,1,'true'],northEnabled:[null,0,'false'],rulerPlacement:['bottom',false,null],northPlacement:['right',true,null],northAngle:[-1,361,NaN,Infinity,'90',null]}))for(const value of values){d.mapInfo={...valid,[key]:value};assert.throws(()=>M.validate(project()),/地图信息/,`${key} rejects ${value}`)}
for(const key of Object.keys(valid)){d.mapInfo={...valid};delete d.mapInfo[key];assert.throws(()=>M.validate(project()),/地图信息/,`required field ${key}`)}
for(const value of [null,[],true,'map']){d.mapInfo=value;assert.throws(()=>M.validate(project()),/地图信息/)}
for(const angle of [0,360]){d.mapInfo={...valid,northAngle:angle};assert.equal(M.validate(project()).documents[0].mapInfo.northAngle,angle)}
d.mapInfo={...valid,northEnabled:false};
let scene=R.scene(d,plan,{}),footer=R.exportFooter(d,scene,r,width,plan);
assert.equal(footer.height,110);assert.equal(count(footer.markup,'data-scale-bar="true"'),1,'ruler can appear alone without legend');assert.equal(count(footer.markup,'data-north-arrow="true"'),0);assert.equal(footer.rows.length,0);
const distance=+footer.markup.match(/data-distance-m="([^"]+)"/)[1],worldLength=+footer.markup.match(/data-bar-length="([^"]+)"/)[1],scale=+footer.markup.match(/<g transform="scale\(([^)]+)\)">/)[1],line=footer.markup.match(/d="M ([\d.e+-]+) ([\d.e+-]+) V ([\d.e+-]+) H ([\d.e+-]+)/);
assert(line,'ruler has a measurable horizontal segment');const pixelLength=(Number(line[4])-Number(line[1]))*scale;
near(distance/worldLength,.02,'ruler world-unit calibration');near(scale,width/r.w,'footer uses identical map-to-page scale');near(pixelLength*r.w/width*.02,distance,'physical distance computed from actual transformed ruler endpoints');
const mapScale=R.scaleBar(d,r,width,height);near(+mapScale.match(/data-distance-m="([^"]+)"/)[1],distance,'map and footer choose the same represented distance');
d.mapInfo={...valid,northPlacement:'map'};
const angleOf=markup=>+markup.match(/data-north-angle="([^"]+)"/)[1];
near(angleOf(R.mapNorth(d,scene,r,width,height,plan)),0,'default planning north points up');
d.mapInfo.northAngle=90;near(angleOf(R.mapNorth(d,scene,r,width,height,plan)),90,'90 degrees clockwise points right');
const reflectedX={...scene,basis:{...scene.basis,r:[-1,0,0]}},reflectedY={...scene,basis:{...scene.basis,down:[0,-1,0]}};
near(angleOf(R.mapNorth(d,reflectedX,r,width,height,plan)),-90,'north follows horizontal reflected basis');d.mapInfo.northAngle=0;near(angleOf(R.mapNorth(d,reflectedY,r,width,height,plan)),180,'north follows vertical reflected basis');
// All placement/visibility/view/metric combinations must output each element at most once.
for(const metric of [false,true])for(const mode of ['plan','elevation','solid'])for(const rulerPlacement of ['map','footer'])for(const northPlacement of ['map','footer'])for(const rulerEnabled of [false,true])for(const northEnabled of [false,true]){
 d.scaleSettings.enabled=metric;d.mapInfo={rulerEnabled,rulerPlacement,northEnabled,northPlacement,northAngle:0};const view={mode,side:'front',azimuth:35,elevation:35},s=R.scene(d,view,{ruler:rulerEnabled&&rulerPlacement==='map',viewport:{width,height}}),f=R.exportFooter(d,s,r,width,view),map=R.svg(d,s,r,null)+R.mapNorth(d,s,r,width,height,view),expectedRuler=metric&&mode!=='solid'&&rulerEnabled,expectedNorth=mode==='plan'&&northEnabled;
 assert.equal(count(map+f.markup,'data-scale-bar="true"'),Number(expectedRuler),`ruler ${metric}/${mode}/${rulerPlacement}/${rulerEnabled}`);
 assert.equal(count(map+f.markup,'data-north-arrow="true"'),Number(expectedNorth),`north ${mode}/${northPlacement}/${northEnabled}`);
 assert.equal(count(f.markup,'data-scale-bar="true"'),Number(expectedRuler&&rulerPlacement==='footer'));
 assert.equal(count(f.markup,'data-north-arrow="true"'),Number(expectedNorth&&northPlacement==='footer'));
 assert.equal(R.hasExportFooter(d,view),expectedRuler&&rulerPlacement==='footer'||expectedNorth&&northPlacement==='footer');
}
d.scaleSettings.enabled=true;d.mapInfo={...valid};d.legend={enabled:true,title:'既有图例',scope:'all',excluded:[],entries:[{id:'legend-note',title:'已有名称',description:'保留手动说明',enabled:true,sources:[],symbols:[]}]};scene=R.scene(d,plan,{});
const originalLegend=R.legendLayout(d,scene,r,width),combined=R.exportFooter(d,scene,r,width,plan),snapshot=JSON.stringify(d);
assert.equal(combined.height,originalLegend.height+110);assert(combined.markup.startsWith(originalLegend.markup),'existing legend markup stays intact');assert.deepEqual(plain(combined.rows),plain(originalLegend.rows));
const originalMap=R.svg(d,scene,r,null),composite=R.legendAppend(originalMap,combined,width,height);
assert(composite.includes(originalMap),'footer composition preserves the complete original map SVG');assert(composite.startsWith(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height+combined.height}"`),'page width stays fixed while only height grows');assert.equal(JSON.stringify(d),snapshot,'rendering and composition never mutate document');
d.mapInfo.northEnabled=false;d.mapInfo.rulerEnabled=false;assert.deepEqual(plain(R.exportFooter(d,scene,r,width,plan)),plain(originalLegend),'no enabled furniture returns identical legacy legend');
const curve=M.createDocument('curve','曲线图');curve.mapInfo={...valid};assert.equal(R.mapNorth(curve,scene,r,width,height,plan),'');assert.equal(R.mapInfoFooter(curve,scene,r,width,plan).height,0,'curve axes are not geographic map furniture');
console.log('PASS map info: five-field validation; legacy/default/no-mutation compatibility; independent single ruler with transformed physical scale; north 0/90/reflected basis; all view/placement/visibility/metric combinations; existing legend and map dimensions preserved.');
