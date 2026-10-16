const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict'),context={window:{}};
for(const n of ['model','geometry','model-features','curved-geometry','creation-colors','geometry-cache','render','render-features'])vm.runInNewContext(fs.readFileSync(new URL('../src/'+n+'.js','file:///'+__filename.replaceAll('\\','/')),'utf8'),context);
const M=context.window.StudioModel,R=context.window.StudioRender,d=M.createDocument('space'),before=JSON.stringify(d),camera={x:0,y:0,w:1200,h:800},count=s=>(s.match(/<path/g)||[]).length;
let max=0;
for(const azimuth of [0,1,35,89.999,90,135,180,270,359])for(const elevation of [0,.000001,.001,.01,.1,.3,1,2,3,5,35,89.999,90])for(const r of [camera,{x:45000,y:-73000,w:20000,h:300},{x:-300,y:900,w:80,h:2000}]){
 const v={mode:'solid',azimuth,elevation},b=M.viewBasis(d,v),g=R.viewportGrid(d,v,b,r),n=count(g);max=Math.max(max,n);assert(n<=202,`${azimuth}/${elevation}: ${n} lines`);assert(!/NaN|Infinity/.test(g));const alpha=Number(g.match(/none" opacity="([^"]+)/)[1]);assert(alpha>=0&&alpha<=1);if(!elevation){assert.equal(n,0);assert.equal(alpha,0);assert.equal(b.n[2],0)}else if(elevation>=3)assert.equal(alpha,1);
}
let last=-1;for(let i=0;i<=300;i++){const v={mode:'solid',azimuth:35,elevation:i/100},g=R.viewportGrid(d,v,M.viewBasis(d,v),camera),alpha=Number(g.match(/none" opacity="([^"]+)/)[1]);assert(alpha>=last);if(last>=0)assert(alpha-last<.006);last=alpha}
// Grid still belongs to the same world-coordinate lattice at normal pitches.
for(const elevation of [3,5,35,90]){const v={mode:'solid',azimuth:35,elevation},b=M.viewBasis(d,v),g=R.viewportGrid(d,v,b,camera);for(const m of g.matchAll(/d="M ([^ ]+) ([^ ]+) L ([^ ]+) ([^"]+)"/g)){const a=M.unproject([+m[1],+m[2]],b,[0,0,0],[0,0,1]),z=M.unproject([+m[3],+m[4]],b,[0,0,0],[0,0,1]),axis=Math.abs(a[0]-z[0])<1e-5?0:1;assert(Math.abs(a[axis]-z[axis])<1e-5);assert(Math.abs(a[axis]/40-Math.round(a[axis]/40))<1e-5)}}
const unproject=M.unproject;M.unproject=()=>{throw Error('Ground grid must not invert the horizon')};const v={mode:'solid',azimuth:35,elevation:.000001};R.viewportGrid(d,v,M.viewBasis(d,v),camera);M.unproject=unproject;
assert.equal(JSON.stringify(d),before);for(const mode of ['plan','elevation']){const v={mode};assert.equal(count(R.viewportGrid(d,v,M.viewBasis(d,v),camera)),52)}
console.log(`PASS horizon grid: 351 camera/angle cases; at most ${max} lines; finite coordinates; smooth 0–3 degree opacity; true 0 and 90 preserved; world lattice retained; no inverse ground projection or document mutation; 2D grid unchanged.`);
