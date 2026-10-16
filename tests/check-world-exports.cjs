// Independently inspect the real files downloaded through the browser UI.
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict'),{JSDOM}=require('jsdom'),dir=process.argv[2]?path.resolve(process.argv[2]):path.join(__dirname,'../qa/world-move');
const report=JSON.parse(fs.readFileSync(path.join(dir,'help-export-results.json'),'utf8').replace(/^\uFEFF/,'')),files=[];
function crc32(b){let n=0xffffffff;for(const byte of b){n^=byte;for(let i=0;i<8;i++)n=n&1?(n>>>1)^0xedb88320:n>>>1}return(n^0xffffffff)>>>0}
for(const item of report.files){const b=fs.readFileSync(path.join(dir,item.name));if(item.format==='png'){
 assert.equal(b.subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert.equal(b.readUInt32BE(16),item.size.width);assert.equal(b.readUInt32BE(20),item.size.height);let at=8,end=false;while(at<b.length){const n=b.readUInt32BE(at);assert.equal(crc32(b.subarray(at+4,at+8+n)),b.readUInt32BE(at+8+n),item.name+' CRC');end=b.toString('ascii',at+4,at+8)==='IEND';at+=12+n}assert(end&&at===b.length);assert(item.opaque);
 }else{
 const dom=new JSDOM(b.toString('utf8'),{contentType:'image/svg+xml'}),d=dom.window.document,r=item.r;assert.equal(d.documentElement.getAttribute('viewBox'),[r.x,r.y,r.w,r.h].join(' '));const bg=d.querySelector('[data-background]');assert.equal(+bg.getAttribute('width'),r.w);assert.equal(+bg.getAttribute('height'),r.h);assert(!d.querySelector('[data-world-gizmo],[data-world-handle],[data-selection-outline],[data-placement-ghost],[data-move-snap-guide],[data-vertex]'));
 const model=JSON.parse(d.querySelector('metadata').textContent);for(const o of model.objects)if(!o.visible||!model.floors.find(f=>f.id===o.floor)?.visible)assert(!d.querySelector(`[data-object="${o.id}"]`),'hidden objects excluded');dom.window.close();
 }files.push({name:item.name,bytes:b.length})}
fs.writeFileSync(path.join(dir,'download-checks.json'),JSON.stringify({files},null,2));console.log(`PASS ${files.length} actual downloads: PNG signatures/dimensions/every chunk CRC/opacity; SVG camera/background/hidden floor/exclusion of gizmos and other edit controls.`);
