// Bound temporary raster allocation even for extreme SVG/preview aspect ratios.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{JSDOM}=require('jsdom');
const dom=new JSDOM('<!doctype html>',{runScripts:'outside-only'}),w=dom.window;
w.StudioModel={};w.eval(fs.readFileSync(path.join(__dirname,'../src/render.js'),'utf8'));
const canvases=[];
w.document.createElement=()=>{const c={width:0,height:0,toDataURL:()=> 'data:image/png;base64,AA==',getContext:()=>({drawImage(){},getImageData:()=>({data:new Uint8ClampedArray(4)}),putImageData(){}})};canvases.push(c);return c};
w.URL.createObjectURL=()=> 'blob:test';w.URL.revokeObjectURL=()=>{};
w.Image=class{set src(_){queueMicrotask(()=>this.onload())}};
(async()=>{
 const d={background:'#ffffff'},s={masks:'<text>对比色</text>',geom:''};
 for(const [width,height]of [[1200,800],[1,100000],[100000,1],[100,10000000]]){
  await w.StudioRender.atlas(d,s,{x:0,y:0,w:width,h:height},3000);
  const c=canvases.at(-1);assert(c.width>=1&&c.height>=1);assert(c.width<=4096&&c.height<=4096);assert(c.width*c.height<=16777216);
  if(width===1200){assert.equal(c.width,3000);assert.equal(c.height,2000)}
 }
 const count=canvases.length;assert.equal(await w.StudioRender.atlas(d,{masks:'',geom:''},{w:1,h:1}),null);assert.equal(canvases.length,count);
 dom.window.close();console.log('PASS release: extreme preview/SVG aspect ratios use bounded raster memory; normal aspect preserved; no contrast raster without masks.');
})().catch(e=>{console.error(e);dom.window.close();process.exitCode=1});
