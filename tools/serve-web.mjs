// Local-only preview of the online build; does not use the user's browser profile.
import {createServer} from 'node:http';
import {readFileSync,statSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,relative,extname} from 'node:path';
import {gzipSync} from 'node:zlib';
const root=fileURLToPath(new URL('../dist/web/',import.meta.url)),port=Number(process.argv[2]||10436);
createServer((req,res)=>{try{
 const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=resolve(root,'.'+(pathname.endsWith('/')?pathname+'index.html':pathname));
 if(relative(root,file).startsWith('..')||!statSync(file).isFile())throw Error('Not found');
 const ext=extname(file),body=readFileSync(file);res.setHeader('Content-Type',{'.html':'text/html; charset=utf-8','.gif':'image/gif','.png':'image/png','.txt':'text/plain; charset=utf-8'}[ext]||'application/octet-stream');
 res.setHeader('Cache-Control',pathname.includes('/assets/')?'public, max-age=31536000, immutable':'no-cache');
 if(/\bgzip\b/.test(req.headers['accept-encoding']||'')){res.setHeader('Content-Encoding','gzip');res.setHeader('Vary','Accept-Encoding');res.end(gzipSync(body))}else res.end(body);
 }catch{res.writeHead(404);res.end('Not found')}}).listen(port,'127.0.0.1',()=>console.log(`Local web preview: http://127.0.0.1:${port}/`));
