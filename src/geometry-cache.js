(()=>{
'use strict';const M=window.StudioModel,geometry=M.geometry,boundary=M.boundaryEdges,cache=new Map(),facesCache=new WeakMap();
// Visual edits and camera changes keep geometry; every physical field participates
// in the signature. Bound retention rather than accumulating document history.
const visual=new Set(['name','fill','stroke','strokeWidth','color','opacity','locked','group','visible','autoCount','stepSpacing','rungSpacing']);
let preview=null;
const physical=o=>Object.fromEntries(Object.entries(o).filter(([k])=>!visual.has(k)));
M.geometry=(d,o)=>{const frozen=preview?.get(o.id);if(frozen&&M.holes(d,o).length)return frozen.map(f=>({...f,owner:o,points:f.points.map(p=>M.world(d,o,p)),holes:f.holes.map(r=>r.map(p=>M.world(d,o,p)))}));const key=d.id+':'+o.id,signature=JSON.stringify([physical(o),M.floor(d,o)?.height||0,M.holes(d,o).map(physical)]);let entry=cache.get(key);if(!entry||entry.signature!==signature){entry={signature,faces:geometry(d,o),edges:null};cache.set(key,entry);if(cache.size>512)cache.delete(cache.keys().next().value)}const faces=entry.faces.map(f=>({...f,owner:o}));facesCache.set(faces,entry);return faces};
M.beginGeometryPreview=(d,ids)=>{preview=null;const frozen=new Map();for(const o of d.objects){if(o.type!=='wall'||!M.usesEdgeGeometry(d,o)||!ids.some(id=>id===o.id||d.objects.find(x=>x.id===id)?.host===o.id))continue;const hs=M.holes(d,o),mixed=hs.some(h=>h.cut&&Math.abs(h.cut.n[2])<.9);if(!(hs.length>=6||(o.wallPath||o.wallFootprint)&&mixed||hs.length>=2&&hs.some(h=>h.shape==='ellipse')))continue;frozen.set(o.id,M.geometry(d,o).map(f=>({...f,points:f.points.map(p=>M.local(d,o,p)),holes:f.holes.map(r=>r.map(p=>M.local(d,o,p)))})))}preview=frozen.size?frozen:null;return !!preview};
// Hard constraints must see current geometry even during a frozen visual preview.
M.geometryForBoundary=(d,o)=>{const saved=preview;try{preview=null;return M.geometry(d,o)}finally{preview=saved}};
M.endGeometryPreview=()=>{preview=null};
M.boundaryEdges=faces=>{const entry=facesCache.get(faces);if(!entry)return boundary(faces);return entry.edges??(entry.edges=boundary(faces))};
})();
