"""Independent checks of this round's actual downloaded PNG/SVG files."""
from pathlib import Path
import json
import math
import struct
import xml.etree.ElementTree as ET
import zlib
from PIL import Image, ImageChops

qa = Path(__file__).resolve().parent.parent / 'qa/legend-background-2026-10-31'
report = json.loads((qa / 'exports-results.json').read_text(encoding='utf-8-sig'))
assert not report.get('errors'), 'browser export run must pass first'
exports = {entry['file']: entry for entry in report['exports']}
assert exports, 'actual downloads are required'
checks = []


def rgb(color):
    assert len(color) == 7 and color[0] == '#', color
    return tuple(int(color[i:i + 2], 16) for i in (1, 3, 5))


def luminance(color):
    channels = [v / 255 for v in rgb(color)]
    channels = [v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4 for v in channels]
    return sum(v * w for v, w in zip(channels, (.2126, .7152, .0722)))


def contrast(a, b):
    x, y = sorted((luminance(a), luminance(b)))
    return (y + .05) / (x + .05)


def inherited(node, key, parents):
    while node is not None:
        if node.get(key) is not None:
            return node.get(key)
        node = parents.get(node)
    return None


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
        with Image.open(file) as original:
            original.load()
            assert original.size == (entry['size']['width'], entry['size']['height']), name + ' dimensions'
            assert original.convert('RGBA').getchannel('A').getextrema() == (255, 255), name + ' opaque background'
            image = original.convert('RGB')
            if entry['footerHeight']:
                # The outer corner is clear of the inset ruler, north arrow and text.
                assert image.getpixel((image.width - 4, image.height - 4)) == rgb(entry['footerBackground']), name + ' footer pixels'
        checks.append(name + ': complete PNG, valid CRCs, decoded size, opaque and correct footer background')
        continue

    assert file.suffix == '.svg', name
    svg = ET.parse(file).getroot()
    assert abs(float(svg.get('width')) - entry['size']['width']) < 1, name + ' width'
    assert abs(float(svg.get('height')) - entry['size']['height']) < 1, name + ' height'
    forbidden = {'data-legend-source-preview', 'data-edge-mid', 'data-vertex', 'data-selection-outline', 'data-placement-ghost', 'data-world-gizmo'}
    assert not any(forbidden.intersection(node.attrib) for node in svg.iter()), name + ' editor overlays'
    assert all(node.get('fill').lower() == entry['background'].lower() for node in svg.iter() if node.get('data-background') == 'true'), name + ' map background unchanged'
    footer = next((node for node in svg.iter() if node.get('data-legend') == 'true'), None)
    assert bool(footer is not None) == bool(entry['footerHeight']), name + ' footer presence'
    parents = {child: parent for parent in svg.iter() for child in parent}
    footer_nodes = set(footer.iter()) if footer is not None else set()
    if footer is not None:
        backgrounds = [node for node in footer.iter() if node.get('data-legend-background') == 'true']
        assert backgrounds and all(node.get('fill').lower() == entry['footerBackground'].lower() for node in backgrounds), name + ' resolved footer backgrounds'
        for text in (node for node in footer.iter() if node.tag.endswith('}text')):
            local_background = entry['footerBackground']
            # Marker glyphs contrast against the circle's composited fill, not the surrounding page.
            circles = [node for node in parents[text] if node.tag.endswith('}circle') and node.get('fill') != 'none']
            if circles:
                circle = circles[-1]
                opacity = float(circle.get('opacity', '1'))
                local_background = '#' + ''.join(f'{math.floor(a * opacity + b * (1 - opacity) + .5):02x}'
                                                for a, b in zip(rgb(circle.get('fill')), rgb(local_background)))
            foreground = inherited(text, 'fill', parents)
            assert foreground and contrast(foreground, local_background) >= 4.5, name + ' legible footer text'
            outline = inherited(text, 'stroke', parents)
            assert outline and contrast(foreground, outline) >= 4.5, name + ' adaptive text outline'
            assert inherited(text, 'paint-order', parents) == 'stroke', name + ' outline behind text'
        checks.append(name + ': footer background, local text contrast and adaptive outlines')
    for group in (node for node in svg.iter() if node.get('data-north-arrow') == 'true' or node.get('data-scale-bar') == 'true'):
        background = entry['footerBackground'] if group in footer_nodes else entry['background']
        for text in (node for node in group.iter() if node.tag.endswith('}text')):
            assert contrast(inherited(text, 'fill', parents), background) >= 4.5, name + ' map information follows its own background'
    checks.append(name + ': XML valid, preview dimensions, source map background and no editing overlays')

auto, manual = exports['auto-dark.png'], exports['custom-light.png']
assert auto['range'] == manual['range'] and auto['mapHeight'] == manual['mapHeight']
assert auto['size']['width'] == manual['size']['width']
map_height = round(auto['mapHeight'] * auto['size']['width'] / auto['width'])
with Image.open(qa / auto['file']) as a, Image.open(qa / manual['file']) as b:
    box = (0, 0, a.width, map_height)
    assert ImageChops.difference(a.crop(box).convert('RGB'), b.crop(box).convert('RGB')).getbbox() is None
assert manual['background'].lower() != manual['footerBackground'].lower()
assert manual['footerBackground'].lower() == '#ffffff'
checks.append('Changing only legend background leaves all original map pixels and camera unchanged')

one, two = exports['current-dark.png'], exports['current-dark-2.png']
assert one['range'] == two['range'] and one['mapHeight'] == two['mapHeight'] and one['footerHeight'] == two['footerHeight']
assert two['size']['width'] == one['size']['width'] * 2 and abs(two['size']['height'] - one['size']['height'] * 2) <= 1
assert one['background'] == two['background'] and one['footerBackground'] == two['footerBackground']
checks.append('Current-view 1x/2x keeps camera, map scale and independent page colors')

(qa / 'file-checks.json').write_text(json.dumps({'checks': checks, 'downloads': len(exports)}, ensure_ascii=False, indent=2), encoding='utf-8')
print(f'PASS {len(checks)} independent file checks across {len(exports)} actual downloads')
