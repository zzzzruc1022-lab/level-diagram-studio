async(page)=>{
 await page.goto('http://127.0.0.1:8777/使用说明.html');
 const checks=[];
 for(const width of [1440,900]){
  await page.setViewportSize({width,height:1000});
  const result=await page.evaluate(async()=>{
   const imgs=[...document.images];await Promise.all(imgs.map(im=>{im.loading='eager';return im.decode()}));
   return {overflow:document.documentElement.scrollWidth>innerWidth,images:imgs.length,anchors:[...document.querySelectorAll('nav a')].every(a=>document.querySelectorAll(a.hash).length===1)};
  });
  if(result.overflow||!result.anchors||result.images<7)throw Error(JSON.stringify(result));checks.push({width,...result});
 }
 await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:'docs/使用说明_阅读预览.png'});
 return checks;
}
