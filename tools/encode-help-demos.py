"""Encode the real browser frames recorded by tests/record-help-demos.js."""
from pathlib import Path
import json
from PIL import Image

root = Path(__file__).resolve().parents[1]
frames_dir = root / 'qa/world-move/frames'
assets = root / 'src/help'
assets.mkdir(exist_ok=True)
report = []
for name in ('shape', 'world'):
    files = sorted(frames_dir.glob(f'{name}_*.png'))
    frames = [Image.open(p).convert('RGB').resize((960, 580), Image.Resampling.LANCZOS) for p in files]
    if not frames:
        raise RuntimeError(f'Missing actual browser frames for {name}')
    samples = [frames[round(i * (len(frames) - 1) / 7)] for i in range(8)]
    montage = Image.new('RGB', (960, 580 * len(samples)), 'white')
    for i, im in enumerate(samples):
        montage.paste(im, (0, 580 * i))
    palette = montage.quantize(colors=128, method=Image.Quantize.MEDIANCUT)
    colors = palette.getpalette()
    for i, rgb in enumerate(((197, 59, 53), (37, 131, 66), (37, 102, 197), (173, 106, 0), (36, 61, 96))):
        colors[(128 + i) * 3:(129 + i) * 3] = rgb
    palette.putpalette(colors)
    encoded = [im.quantize(palette=palette, dither=Image.Dither.NONE) for im in frames]
    durations = [int(p.stem.rsplit('_', 1)[1]) for p in files]
    target = assets / f'{name}.gif'
    encoded[0].save(target, save_all=True, append_images=encoded[1:], duration=durations, loop=0, optimize=True, disposal=1)
    encoded[-1].save(assets / f'{name}.png', optimize=True)
    # Include readable first/final captures separately; the contact is only QA.
    frames[0].save(root / f'qa/world-move/{name}-first.png')
    frames[-1].save(root / f'qa/world-move/{name}-last.png')
    with Image.open(target) as gif:
        assert gif.size == (960, 580) and gif.n_frames > 20
        report.append({'name': name, 'size': gif.size, 'frames': gif.n_frames, 'duration_ms': sum(durations), 'gif_bytes': target.stat().st_size, 'poster_bytes': (assets / f'{name}.png').stat().st_size})
(root / 'qa/world-move/gif-checks.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(report, ensure_ascii=False))
