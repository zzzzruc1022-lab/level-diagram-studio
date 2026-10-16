(()=>{
'use strict';const M=window.StudioModel,geometry=M.geometry,boundary=M.boundaryEdges,cache=new Map(),facesCache=new WeakMap();
// Visual edits and camera changes keep geometry; every physical field participates
// in the signature. Bound retention rather than accumulating document history.
const visual=new Set(['name','fill','stroke','strokeWidth','color','opacity','locked','group','visible','autoCount','stepSpacing','rungSpacing']);
const physical=o=>Object.fromEntries(Object.entries(o).filter(([k])=>!visual.has(k)));
M.geometry=(d,o)=>{const key=d.id+':'+o.id,signature=JSON.stringify([physical(o),M.floor(d,o)?.height||0,M.holes(d,o).map(physical)]);let entry=cache.get(key);if(!entry||entry.signature!==signature){entry={signature,faces:geometry(d,o),edges:null};cache.set(key,entry);if(cache.size>512)cache.delete(cache.keys().next().value)}const faces=entry.faces.map(f=>({...f,owner:o}));facesCache.set(faces,entry);return faces};
M.boundaryEdges=faces=>{const entry=facesCache.get(faces);if(!entry)return boundary(faces);return entry.edges??(entry.edges=boundary(faces))};
})();
