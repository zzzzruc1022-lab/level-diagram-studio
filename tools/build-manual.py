"""Generate both manuals from the approved in-app content, including offline GIFs."""
from pathlib import Path
import base64, html, json
root=Path(__file__).resolve().parents[1]
content=json.loads((root/'src/help/content.json').read_text(encoding='utf-8'))
e=html.escape
md=['# 关卡简图工坊 · 使用说明','',content['intro'],''];sections=[]
for s in content['sections']:
 md+=['## '+s['title'],''];steps=[]
 for label,text in s['steps']:
  md+=['**'+label+'**：'+text,''];steps.append('<dt>'+e(label)+'</dt><dd>'+e(text)+'</dd>')
 demo=''
 if s.get('demo'):
  name=s['demo']
  def asset(ext):return 'data:image/'+ext+';base64,'+base64.b64encode((root/'src/help'/(name+'.'+ext)).read_bytes()).decode('ascii')
  md+=['!['+s['caption']+'](../src/help/'+name+'.gif)','']
  demo='<figure><button class="demo" aria-pressed="false" aria-label="播放或停止：'+e(s['caption'])+'" data-gif="'+asset('gif')+'" data-poster="'+asset('png')+'"><img src="'+asset('png')+'" alt="'+e(s['caption'])+'" decoding="async"><span>点击播放演示</span></button><figcaption>'+e(s['caption'])+'</figcaption></figure>'
 sections.append('<section id="'+s['id']+'"><h2>'+e(s['title'])+'</h2><dl>'+''.join(steps)+'</dl>'+demo+'</section>')
md+=['## 常用快捷键',''];shortcuts=[]
for label,key in content['shortcuts']:
 md+=['- '+label+'：'+key];shortcuts.append('<dt>'+e(label)+'</dt><dd>'+e(key)+'</dd>')
md+=['',content['shortcutNote'],'']
(root/'docs/使用说明.md').write_text('\n'.join(md),encoding='utf-8')
style='''*{box-sizing:border-box}html{scroll-padding-top:90px}body{margin:0;background:#f6f8fb;color:#263247;font:16px/1.85 "Segoe UI","Microsoft YaHei",sans-serif}header{position:sticky;top:0;z-index:1;padding:16px 28px;background:#fff;border-bottom:1px solid #dce3ed}h1{font-size:24px;line-height:1.5;margin:0}nav{position:fixed;top:80px;bottom:0;width:240px;padding:24px;overflow:auto}nav a{display:block;padding:8px 0;font-size:14px}a{color:#245dbb;text-decoration:underline;text-underline-offset:3px}main{margin-left:240px;max-width:1300px;padding:24px 40px 80px}h2{font-size:22px;line-height:1.5;margin:42px 0 16px}p,dd{max-width:72ch}dt{font-weight:600;margin-top:14px}dd{margin:2px 0 14px}figure{margin:24px 0 36px}.demo{position:relative;display:block;width:100%;padding:0;background:#fff;border:1px solid #dce3ed;border-radius:8px;overflow:hidden;cursor:pointer;color:#263247}.demo:hover{border-color:#3977df}.demo img{display:block;width:100%;height:auto}.demo span{position:absolute;right:10px;bottom:10px;padding:5px 12px;border:1px solid #dce3ed;border-radius:5px;background:#fff;font:14px/1.5 "Microsoft YaHei",sans-serif}figcaption{font-size:14px;color:#506079;margin-top:8px}:focus-visible{outline:2px solid #3977df;outline-offset:3px}::selection{background:#dce9ff;color:#10223e}@media(max-width:900px){header{padding:16px 20px}nav{position:static;width:auto;padding:16px 20px;border-bottom:1px solid #dce3ed}nav a{display:inline-block;margin-right:16px}main{margin:0;padding:20px}h1{font-size:21px}}@media print{header{position:static}nav,.demo span{display:none}main{margin:0;padding:0}figure{break-inside:avoid}body{background:white}}'''
script='''const buttons=[...document.querySelectorAll('.demo')];function stop(){for(const b of buttons){b.querySelector('img').src=b.dataset.poster;b.setAttribute('aria-pressed','false');b.querySelector('span').textContent='点击播放演示'}}for(const b of buttons)b.addEventListener('click',()=>{const play=b.getAttribute('aria-pressed')!=='true';stop();if(play){b.querySelector('img').src=b.dataset.gif;b.setAttribute('aria-pressed','true');b.querySelector('span').textContent='点击停止演示'}});document.addEventListener('visibilitychange',()=>{if(document.hidden)stop()});addEventListener('scroll',()=>{const b=buttons.find(b=>b.getAttribute('aria-pressed')==='true');if(b){const r=b.getBoundingClientRect();if(r.bottom<80||r.top>innerHeight)stop()}},{passive:true});'''
nav=''.join('<a href="#'+s['id']+'">'+e(s['title'])+'</a>' for s in content['sections'])
doc='<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>关卡简图工坊 · 使用说明</title><style>'+style+'</style></head><body><header><h1>关卡简图工坊 · 使用说明</h1></header><nav aria-label="操作目录">'+nav+'</nav><main><p>'+e(content['intro'])+'</p>'+''.join(sections)+'<section><h2>常用快捷键</h2><dl>'+''.join(shortcuts)+'</dl><p>'+e(content['shortcutNote'])+'</p></section></main><script>'+script+'</script></body></html>'
(root/'docs/使用说明.html').write_text(doc,encoding='utf-8')
print('Built synchronized manuals: 8 sections, 7 self-contained on-demand GIFs')
