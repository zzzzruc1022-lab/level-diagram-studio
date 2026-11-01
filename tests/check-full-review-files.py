"""Independent checks of the files actually downloaded in the final browser runs."""
from pathlib import Path
import hashlib
import json
import math
import re
import xml.etree.ElementTree as ET
import zipfile
from PIL import Image, ImageChops

ROOT = Path(__file__).resolve().parents[1]
QA = ROOT / 'qa/full-review-2026-10-31'
DELIVERY = ROOT.parents[1] / 'outputs/关卡简图工坊_综合复核本地试用_2026-10-31'
read = lambda p: json.loads(p.read_text(encoding='utf-8-sig'))
files = []
for report in ['building/results.json', 'export/verified-final.json', 'export/wide-wrap-final.json', 'scale/final-results.json', 'curve/headless-results.json']:
    p = QA / report
    files.extend(p.parent / n for n in read(p)['files'] if Path(n).suffix in {'.png', '.svg'})
files += [QA / 'interaction' / ('interaction-elevation.' + ext) for ext in ['png', 'svg']]
appearance = read(QA / 'appearance/exports-results.json')
files += [QA / 'appearance' / x['file'] for x in appearance['exports']]
assert len(files) == len(set(files))
results = []
for p in files:
    raw = p.read_bytes()
    if p.suffix == '.png':
        with Image.open(p) as im:
            im.load()
            width, height = im.size
            assert width > 0 and height > 0
            assert any(a != b for a, b in im.convert('RGB').getextrema()), p
    else:
        svg = ET.fromstring(raw)
        width, height = (float(svg.attrib[k]) for k in ['width', 'height'])
        assert all(math.isfinite(n) and n > 0 for n in [width, height]), p
        viewbox = [float(n) for n in svg.attrib['viewBox'].split()]
        assert all(math.isfinite(n) for n in viewbox) and viewbox[2] > 0 and viewbox[3] > 0
        controls = {'data-midpoint', 'data-handle', 'data-curve-controls', 'data-event-label-selection', 'data-event-node-selection', 'data-pick-preview'}
        for element in svg.iter():
            assert not controls.intersection(element.attrib), (p, element.attrib)
            for key in ['x', 'y', 'cx', 'cy', 'x1', 'y1', 'x2', 'y2', 'd', 'points', 'transform']:
                assert not re.search(r'\b(?:NaN|Infinity)\b', element.attrib.get(key, '')), (p, key)
    results.append({'file': p.relative_to(QA).as_posix(), 'width': width, 'height': height, 'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest()})

by_name = {x['file']: x for x in results}
for item in results:
    if item['file'].endswith('.svg'):
        png = by_name.get(item['file'][:-4] + '.png')
        if png:
            ratio = png['width'] / item['width']
            assert ratio in (1, 2, 3, 4) and abs(png['height'] - item['height'] * ratio) <= 1, item['file']
for item in appearance['exports']:
    actual = by_name['appearance/' + item['file']]
    # SVG retains a fractional view height; raster/output status rounds to pixels.
    assert abs(actual['width'] - item['size']['width']) <= .5 and abs(actual['height'] - item['size']['height']) <= .5
with Image.open(QA / 'appearance/auto-dark.png') as a, Image.open(QA / 'appearance/custom-light.png') as b:
    height = next(x['mapHeight'] for x in appearance['exports'] if x['file'] == 'auto-dark.png')
    box = (0, 0, a.width, height)
    assert ImageChops.difference(a.convert('RGB').crop(box), b.convert('RGB').crop(box)).getbbox() is None

protected, changed = [], []
with zipfile.ZipFile(QA / 'before-full-review.zip') as z:
    for n in z.namelist():
        if n.endswith('/'):
            continue
        p = ROOT / n
        assert p.exists(), 'Existing file removed: ' + n
        same = p.read_bytes() == z.read(n)
        if n.startswith('tests/') or n.startswith('src/help/') or n in ['package-lock.json', 'LICENSE']:
            assert same, 'Protected file changed: ' + n
            protected.append(n)
        elif not same:
            changed.append(n)
assert (ROOT / 'dist/index.html').read_bytes() == (DELIVERY / 'index.html').read_bytes()
report = {'downloadedFiles': results, 'png': sum(x['file'].endswith('.png') for x in results), 'svg': sum(x['file'].endswith('.svg') for x in results), 'protectedFilesUnchanged': protected, 'existingFilesChanged': changed, 'mapPixelsIdenticalAcrossFooterColors': True, 'deliveryMatchesDist': True}
(QA / 'file-validation.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({'png': report['png'], 'svg': report['svg'], 'protectedFilesUnchanged': len(protected), 'deliveryMatchesDist': True}, ensure_ascii=False))
