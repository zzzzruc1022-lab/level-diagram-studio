(()=>{
'use strict';const M=window.StudioModel,createObject=M.createObject,createDocument=M.createDocument,validate=M.validate;
// A small fixed palette keeps the result predictable and allocation bounded.
const palette=['#dce8df','#eedbdf','#f0d2bc','#e6daed','#c5dfd6','#e4cbc4','#d4bfce','#e1e6c5','#bcd4d2','#ccc8dd','#c9dac9','#efd0d8'];
const rgb=c=>[1,3,5].map(i=>parseInt(c.slice(i,i+2),16)),near=(a,b)=>Math.hypot(...M.sub(rgb(a),rgb(b)))<12;
const border=c=>'#'+rgb(c).map(n=>Math.round(n*.62).toString(16).padStart(2,'0')).join('');
function state(d){d.planeColors??={used:[],last:null};for(const o of d.objects.filter(o=>o.type==='plane')){const c=o.fill.toLowerCase();if(palette.includes(c)&&!d.planeColors.used.includes(c))d.planeColors.used.push(c)}return d.planeColors}
function next(d){const s=state(d),planes=d.objects.filter(o=>o.type==='plane'),reserved=['#000000','#ffffff','#dce6f2','#e8dfce',...d.objects.filter(o=>['wall','stairs','ladder','spiral'].includes(o.type)).map(o=>o.fill)],available=palette.filter(c=>!reserved.some(r=>near(c,r)));
 if(!available.length)throw Error('平面色板均被其他组件使用，请先调整其中一种组件颜色');
 const fresh=available.find(c=>!s.used.includes(c)&&!planes.some(o=>near(c,o.fill))),c=fresh||available.filter(c=>c!==s.last||available.length===1).map(c=>({c,count:planes.filter(o=>near(c,o.fill)).length})).sort((a,b)=>a.count-b.count)[0].c;
 if(!s.used.includes(c))s.used.push(c);s.last=c;return c}
M.createObject=(d,type,pos)=>{const o=createObject(d,type,pos);if(type==='plane'){o.fill=next(d);o.stroke=border(o.fill)}if(['stairs','ladder','spiral'].includes(type)){o.fill='#e8dfce';o.stroke='#9f8a68'}return o};
M.createDocument=(...args)=>{const d=createDocument(...args);if(d.type==='space'){state(d);d.planeColors.last=d.objects.findLast(o=>o.type==='plane')?.fill||null}return d};
M.validate=input=>{const p=validate(input);for(const d of p.documents){const s=d.planeColors;if(s&&(!Array.isArray(s.used)||s.used.length>palette.length||new Set(s.used).size!==s.used.length||s.used.some(c=>!palette.includes(c))||s.last!==null&&!palette.includes(s.last)))throw Error('平面配色记录不正确')}return p};
M.planePalette=palette;
})();
