const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const offline=read('dist/index.html'),web=read('dist/web/index.html'),report=JSON.parse(read('dist/build-report.json'));
assert(report.webHTML<report.html*.2,'web must not embed tutorial media');
assert(report.webGzip<report.offlineGzip*.1,'cold transfer regression');
assert(!web.includes('data:image/gif;base64,'));assert(!offline.includes("img-src &#39;self&#39;"));
let reconstructed=web.replace("img-src &#39;self&#39; data: blob:;",'img-src data: blob:;').replaceAll(' loading="lazy"','');
assert.equal(report.webHelpAssets.length,14);
for(const name of report.webHelpAssets){
 const match=name.match(/^assets\/help\/([a-z]+)\.([a-f0-9]{12})\.(gif|png)$/);assert(match);
 const [,id,hash,ext]=match,data=fs.readFileSync(path.join(root,'dist/web',name));
 assert.deepEqual(data,fs.readFileSync(path.join(root,`src/help/${id}.${ext}`)),'tutorial bytes preserved');
 assert.equal(hash,crypto.createHash('sha256').update(data).digest('hex').slice(0,12));
 reconstructed=reconstructed.replaceAll(name,`data:image/${ext};base64,${data.toString('base64')}`);
}
assert.equal(reconstructed,offline,'online/offline have identical editor code, styles, content, seed and announcement');
assert(read('.github/workflows/pages.yml').includes('cp -R dist/web/. .build/site/'));
console.log('PASS web delivery: smaller cold payload, 14 original hashed media, identical editor and strict offline CSP.');
