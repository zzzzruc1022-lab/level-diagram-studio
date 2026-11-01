(()=>{
'use strict';const M=window.StudioModel,R=window.StudioRender,I=window.StudioImages,scene=R.scene,extent=R.extent,contentExtent=R.contentExtent;
function one(b,s,embedded=false){if(!b||!b.visible||s?.basemapVisible!==true)return '';if(s.imageCropPreview===(b.id||b.assetId))b={...b,crop:undefined};const url=I.href(b.assetId,embedded);if(!url)return '';const [u,v,w,h]=b.crop||[0,0,1,1],clip=`image-clip-${b.id||b.assetId}`;return `<g transform="rotate(${b.rotation} ${b.x+b.width/2} ${b.y+b.height/2})"><defs><clipPath id="${clip}"><rect x="${b.x+u*b.width}" y="${b.y+v*b.height}" width="${w*b.width}" height="${h*b.height}"/></clipPath></defs><image clip-path="url(#${clip})" data-basemap="true" x="${b.x}" y="${b.y}" width="${b.width}" height="${b.height}" opacity="${b.opacity}" href="${R.esc(url)}" preserveAspectRatio="none" pointer-events="none"/></g>`}
function markup(d,s,embedded=false){return M.images(d).map(b=>one(b,s,embedded)).join('')}
function combined(s,fn){const a=fn(s),b=s.basemapExtent;if(!b)return a;if(!a)return {...b};const x=Math.min(a.x,b.x),y=Math.min(a.y,b.y);return {x,y,w:Math.max(a.x+a.w,b.x+b.w)-x,h:Math.max(a.y+a.h,b.y+b.h)-y}}
R.scene=(d,v,options={})=>{const s=scene(d,v,options);s.basemapVisible=d.type==='space'&&v.mode==='plan'&&M.images(d).some(b=>b.visible)&&options.basemap!==false;s.basemapExtent=s.basemapVisible?M.basemapBounds(d):null;return s};
R.extent=s=>combined(s,extent);R.contentExtent=s=>combined(s,contentExtent);R.basemapMarkup=markup;
})();
