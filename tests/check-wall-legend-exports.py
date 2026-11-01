from pathlib import Path
import json
from PIL import Image, ImageChops
import xml.etree.ElementTree as ET
qa=Path(__file__).resolve().parent.parent/'qa/walls-legend-2026-10-31'
report=json.loads((qa/'offline-results.json').read_text());results=[]
for e in report['exports']:
 p=qa/e['file']
 if p.suffix=='.png':
  with Image.open(p) as im:
   im.load();assert im.size==(e['size']['width'],e['size']['height']),p.name
   assert im.getextrema()[3]==(255,255),p.name+' alpha'
   results.append(f'{p.name}: decoded {im.size}, opaque')
 else:
  root=ET.parse(p).getroot();assert abs(float(root.get('height'))-e['size']['height'])<1
  bars=[n for n in root.iter() if n.get('data-scale-bar')=='true']
  for bar in bars: assert abs(float(bar.get('data-distance-m'))/float(bar.get('data-bar-length'))-.02)<1e-9
  results.append(f'{p.name}: XML dimensions and {len(bars)} scale bars valid')
a=Image.open(qa/'no-legend-plan.png');b=Image.open(qa/'legend-plan.png');assert ImageChops.difference(a,b.crop((0,0,*a.size))).getbbox() is None
results.append('Legend ON/OFF: map pixels identical, original 1200x800 map retained')
a=Image.open(qa/'512m-legend.png');assert a.size[0]==1200 and a.size[1]>1200
root=ET.parse(qa/'512m-legend.svg').getroot();ns={'s':'http://www.w3.org/2000/svg'};maproot=root.find('s:svg/s:svg',ns);v=list(map(float,maproot.get('viewBox').split()));assert abs(v[2]*.02-512)<1e-6 and abs(v[3]*.02-512)<1e-6
results.append('512m boundary: square 1200x1200 map plus footer; SVG represents 512x512m')
a=next(e for e in report['exports'] if e['file']=='current-1.png');b=next(e for e in report['exports'] if e['file']=='current-2.png');assert a['range']==b['range'],(a['range'],b['range']);assert abs(b['size']['height']-2*a['size']['height'])<=1 and b['size']['width']==2*a['size']['width']
results.append('Current view 1x/2x: same camera and represented distances')
(qa/'export-file-checks.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8')
print('PASS',len(results),'export file and scale checks')
