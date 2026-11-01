"""Inspect this round's downloaded files independently of the browser checks."""
from pathlib import Path
import json
import math
import struct
import xml.etree.ElementTree as ET
import zlib
from PIL import Image, ImageChops

qa = Path(__file__).resolve().parent.parent / 'qa/legend-ux-2026-10-31'
report = json.loads((qa / 'offline-results.json').read_text(encoding='utf-8-sig'))
assert not report['errors'] and not report['requests'], 'offline browser run must pass first'
exports = {entry['file']: entry for entry in report['exports']}
checks = []
for name, entry in exports.items():
    file = qa / name
    if file.suffix == '.png':
        data = file.read_bytes()
        assert data[:8] == b'\x89PNG\r\n\x1a\n', name
        offset = 8
        while offset < len(data):
            size = struct.unpack('>I', data[offset:offset + 4])[0]
            crc = struct.unpack('>I', data[offset + size + 8:offset + size + 12])[0]
            assert zlib.crc32(data[offset + 4:offset + size + 8]) & 0xffffffff == crc, name + ' CRC'
            offset += size + 12
        assert offset == len(data), name + ' complete PNG chunks'
        with Image.open(file) as image:
            image.load()
            assert image.size == (entry['size']['width'], entry['size']['height']), name
            assert image.convert('RGBA').getchannel('A').getextrema() == (255, 255), name + ' opacity'
        checks.append(name + ': PNG decodes, dimensions match, all CRCs valid, background opaque')
    else:
        svg = ET.parse(file).getroot()
        assert abs(float(svg.get('width')) - entry['size']['width']) < 1, name
        assert abs(float(svg.get('height')) - entry['size']['height']) < 1, name
        forbidden = {'data-legend-source-preview', 'data-edge-mid', 'data-vertex', 'data-selection-outline', 'data-placement-ghost', 'data-world-gizmo'}
        assert not any(forbidden.intersection(node.attrib) for node in svg.iter()), name + ' editor overlays'
        for bar in (node for node in svg.iter() if node.get('data-scale-bar') == 'true'):
            assert math.isclose(float(bar.get('data-distance-m')), float(bar.get('data-bar-length')) * entry['metersPerUnit'], rel_tol=1e-9), name + ' calibration'
        checks.append(name + ': XML valid, dimensions match, real ruler calibration preserved, no editor overlays')

with Image.open(qa / 'no-info.png') as plain, Image.open(qa / 'info-only.png') as info:
    assert info.width == plain.width and info.height == plain.height + 110
    assert ImageChops.difference(plain.convert('RGB'), info.crop((0, 0, *plain.size)).convert('RGB')).getbbox() is None
checks.append('Information footer: adds exactly 110 pixels; original map pixels unchanged')

one, two = exports['current-1.png'], exports['current-2.png']
assert one['range'] == two['range'] and one['mapHeight'] == two['mapHeight'] and one['footerHeight'] == two['footerHeight']
assert two['size']['width'] == one['size']['width'] * 2 and abs(two['size']['height'] - one['size']['height'] * 2) <= 1
svg = ET.parse(qa / 'current-1.svg').getroot()
bar = next(node for node in svg.iter() if node.get('data-scale-bar') == 'true')
distance = float(bar.get('data-distance-m'))
for name, entry in [('current-1.png', one), ('current-2.png', two)]:
    with Image.open(qa / name) as original:
        image = original.convert('RGB')
        density = image.width / entry['width']
        length = distance / entry['metersPerUnit'] / entry['range']['w'] * image.width
        logical_height = entry['mapHeight'] + entry['footerHeight']
        y = (logical_height - 24) / logical_height * image.height
        left, right = image.width - 20 * density - length, image.width - 20 * density
        samples = [min(max(image.getpixel((x, j))) for j in range(round(y) - math.ceil(density), round(y) + math.ceil(density) + 1)) < 120
                   for x in range(math.ceil(left + 2 * density), math.floor(right - 2 * density))]
        assert samples and sum(samples) / len(samples) > .9, name + ' ruler line pixels at expected position and length'
checks.append('Current-view PNG 1x/2x: same camera and distance; actual ruler pixels follow density')

boundary = exports['512m-info.png']
assert math.isclose(boundary['range']['w'] * boundary['metersPerUnit'], 512)
assert math.isclose(boundary['range']['h'] * boundary['metersPerUnit'], 512)
assert boundary['size']['width'] == 1200 and boundary['mapHeight'] == 1200 and boundary['size']['height'] == 1310
checks.append('512m boundary: square 1200px map represents 512x512m; footer adds height only')

(qa / 'file-checks.json').write_text(json.dumps({'checks': checks, 'downloads': len(exports)}, ensure_ascii=False, indent=2), encoding='utf-8')
print(f'PASS {len(checks)} independent file checks across {len(exports)} actual downloads')
