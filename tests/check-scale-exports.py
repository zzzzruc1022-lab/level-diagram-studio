"""Independently inspect actual browser downloads, including ruler geometry."""
import json, math, struct, zlib
from pathlib import Path
from xml.etree import ElementTree as ET
from PIL import Image

root = Path(__file__).resolve().parents[1]
folder = root / 'qa' / 'scale-local'
report = json.loads((folder / 'browser-results.json').read_text(encoding='utf-8-sig'))
extra = json.loads((folder / 'browser-extra-results.json').read_text(encoding='utf-8-sig'))
assert not report.get('failure') and not report['errors'] and not extra['errors']
results = []
ns = '{http://www.w3.org/2000/svg}'
for item in report['files'] + extra['files']:
    name = item['name']
    data = (folder / name).read_bytes()
    if name.endswith('.png'):
        assert data[:8] == b'\x89PNG\r\n\x1a\n'
        assert struct.unpack('>II', data[16:24]) == (item['size']['width'], item['size']['height'])
        at = 8
        while at < len(data):
            size = struct.unpack('>I', data[at:at+4])[0]
            assert zlib.crc32(data[at+4:at+8+size]) & 0xffffffff == struct.unpack('>I', data[at+8+size:at+12+size])[0]
            at += size + 12
        assert at == len(data)
        image = Image.open(folder / name).convert('RGBA')
        assert image.getchannel('A').getextrema() == (255, 255), name
    else:
        svg = ET.fromstring(data)
        r = item['r']
        assert list(map(float, svg.attrib['viewBox'].split())) == [r[k] for k in ('x', 'y', 'w', 'h')]
        assert not any(any(k in el.attrib for k in ('data-world-gizmo', 'data-selection-outline', 'data-placement-ghost', 'data-vertex')) for el in svg.iter())
        rulers = [el for el in svg.iter() if 'data-scale-bar' in el.attrib]
        assert len(rulers) == (0 if name in ('solid.svg', 'plan-no-ruler.svg') else 1), name
        model = json.loads(svg.find(ns+'metadata').text)
        if rulers:
            bar = rulers[0]
            assert math.isclose(float(bar.attrib['data-distance-m']), float(bar.attrib['data-bar-length'])*model['scaleSettings']['metersPerUnit'])
            assert bar.attrib['pointer-events'] == 'none'
        if name == 'boundary-512.svg':
            assert model['mapBoundary']['width'] == 25600 and model['mapBoundary']['height'] == 25600
            assert any('data-map-boundary' in el.attrib for el in svg.iter())
    results.append({'name': name, 'bytes': len(data)})

# PNG density changes pixel count, while the scale bar still means the same distance.
svg = ET.parse(folder / 'plan-full.svg').getroot()
bar = next(el for el in svg.iter() if 'data-scale-bar' in el.attrib)
camera = next(item['r'] for item in report['files'] if item['name'] == 'plan-full.svg')
for mult in (1, 2):
    image = Image.open(folder / f'plan-full-{mult}x.png').convert('RGB')
    width, height = image.size
    length = float(bar.attrib['data-bar-length']) / camera['w'] * width
    left, right, y = width-20*mult-length, width-20*mult, height-24*mult
    samples = []
    for x in range(math.ceil(left)+2*mult, math.floor(right)-2*mult):
        samples.append(min(max(image.getpixel((x, j))) for j in range(round(y)-mult, round(y)+mult+1)) < 120)
    assert sum(samples)/len(samples) > .9, f'{mult}x PNG has the expected scale-bar line at its declared position and length'

old = json.loads((folder / 'old-published-export.json').read_text(encoding='utf-8-sig'))
saved = json.loads((folder / 'scale-saved.json').read_text(encoding='utf-8-sig'))
for a, b in zip(old['documents'], saved['documents']):
    assert a['objects'] == b['objects']
    assert a.get('floors') == b.get('floors')
    assert a.get('unit') == b.get('unit')
assert old['version'] == saved['version'] == 7
output = {'downloads': results, 'geometry_roundtrip': True, 'png_scale_density': True, 'browser_checks': len(report['checks'])+len(extra['checks'])}
(folder / 'download-checks.json').write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding='utf-8')
print(f'PASS {len(results)} real PNG/SVG downloads: dimensions, all PNG CRCs, opacity, SVG camera/ruler geometry, PNG 1x/2x ruler length and position, no editor handles, original JSON geometry and floors.')
