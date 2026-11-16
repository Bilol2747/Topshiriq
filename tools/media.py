#!/usr/bin/env python3
"""Builds everything the page shows from the raw photos and videos in ./manba.

  python3 tools/media.py

Every source file becomes a 3:4 tile (360x480 .webp) plus a big version for the viewer.
Videos lose their sound and are also packed, all together, into ONE video (assets/m/atlas.mp4).
Already-processed sources are skipped by file name, so it is safe to run again after adding files.
To start over: delete assets/m and tools/done.json.

Needs: Python 3 with Pillow (pip install pillow) and ffmpeg on the PATH.
"""
import json, os, subprocess, sys, tempfile
from PIL import Image, ImageFilter, ImageOps

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(REPO, 'assets/m')
DROP = os.path.join(REPO, 'manba')          # the raw photos and videos; never committed
DONE = os.path.join(REPO, 'tools/done.json')
IMG = {'.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif', '.dng', '.tif', '.tiff'}
VID = {'.mp4', '.mov', '.m4v', '.webm'}
TW, TH = 360, 480

# The favourite video: its SOURCE file name in ./manba (for example 'IMG_1234.MOV'), or '' for none.
# It opens the film alone in the middle, stays in front, and takes the centre of the heart.
STAR_SRC = 'document_2026-11-16_08-25-03 (2).mp4'

# Per-file fixes, by source file name. All optional:
#   r=1   recorded sideways: turn it counter-clockwise (r=2: clockwise)
#   ss=2  start this many seconds in          t=6   use only this many seconds   (videos)
#   cx=.4 videos: share of the spare width cropped off the left (default .5)
#         photos: where the person is across the frame (0 = left edge, 1 = right edge)
#   box=(l,t,r,b)  photos: keep only this part first (fractions), e.g. to drop letterbox bars
#   fit=1 photos: show the whole picture in the tile over a blurred copy instead of cropping
SPEC = {
    'document_2026-11-16_08-25-03 (13).mp4': dict(r=1, cx=.15),
    'document_2026-11-16_08-25-03 (8).mp4': dict(r=1, cx=.81),
    'document_2026-11-16_08-25-03 (9).mp4': dict(r=2, cx=.88),
    'photo_2026-11-16_08-25-03 (11).jpg': dict(r=1),
    'photo_2026-11-16_08-25-03 (4).jpg': dict(box=(0, .319, 1, .637), fit=1),
    'photo_2026-11-16_08-25-03 (5).jpg': dict(fit=1),
    'photo_2026-11-16_08-25-03 (1).jpg': dict(cx=.29),
    'photo_2026-11-16_08-25-03 (3).jpg': dict(cx=.29),
    'photo_2026-11-16_08-25-03 (6).jpg': dict(cx=.69),
    'photo_2026-11-16_08-25-04 (1).jpg': dict(cx=.27),
    'photo_2026-11-16_08-25-04.jpg': dict(cx=.36),
}


def tile(im, dst_small, dst_big, o={}):
    im = ImageOps.exif_transpose(im).convert('RGB')
    if o.get('r'):
        im = im.rotate(90 if o['r'] == 1 else 270, expand=True)
    if o.get('box'):
        l, t, r, b = o['box']; w, h = im.size
        im = im.crop((round(l * w), round(t * h), round(r * w), round(b * h)))
    w, h = im.size
    # centre crop to 3:4, biased upward: faces live in the upper half
    if w / h > TW / TH:
        nw = round(h * TW / TH); x = min(max(round(o.get('cx', .5) * w - nw / 2), 0), w - nw); box = (x, 0, x + nw, h)
    else:
        nh = round(w * TH / TW); y = round((h - nh) * .3); box = (0, y, w, y + nh)
    small = im.crop(box).resize((TW, TH), Image.LANCZOS)
    if o.get('fit'):
        small = small.filter(ImageFilter.GaussianBlur(14)).point(lambda v: v * .62)
        fg = im.copy(); fg.thumbnail((TW, TH), Image.LANCZOS)
        small.paste(fg, ((TW - fg.width) // 2, (TH - fg.height) // 2))
    small.save(dst_small, 'WEBP', quality=74, method=6)
    big = im.copy(); big.thumbnail((1100, 1400), Image.LANCZOS)
    big.save(dst_big, 'WEBP', quality=80, method=6)


def open_any(path):
    if os.path.splitext(path)[1].lower() in ('.heic', '.heif', '.dng'):
        # macOS: sips converts these. Elsewhere: pip install pillow-heif and register it instead.
        tmp = tempfile.mktemp(suffix='.jpg')
        subprocess.run(['sips', '-s', 'format', 'jpeg', path, '--out', tmp], check=True, capture_output=True)
        return Image.open(tmp)
    return Image.open(path)


def video(src, name):
    o = SPEC.get(os.path.basename(src), {})
    pre = ['ffmpeg', '-v', 'error', '-y', '-ss', str(o.get('ss', 0)), '-i', src, '-an', '-movflags', '+faststart', '-pix_fmt', 'yuv420p',
           '-c:v', 'libx264', '-profile:v', 'main']
    rot = {1: 'transpose=2,', 2: 'transpose=1,'}.get(o.get('r'), '')
    cx = o.get('cx', .5)
    crop = f"{rot}scale={TW}:{TH}:force_original_aspect_ratio=increase,crop={TW}:{TH}:(iw-{TW})*{cx}:(ih-{TH})*0.3"
    # the tile clip (7 s at most, feeds the atlas) and the big one for the viewer (20 s at most)
    subprocess.run(pre + ['-r', '24', '-t', str(min(o.get('t', 7), 7)), '-vf', crop, '-crf', '28', f'{OUT}/{name}.mp4'], check=True)
    subprocess.run(pre + ['-r', '30', '-t', str(o.get('t', 20)), '-vf', rot + "scale='min(540,iw)':-2", '-crf', '29', f'{OUT}/{name}b.mp4'], check=True)
    png = tempfile.mktemp(suffix='.png')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', '0.6', '-i', f'{OUT}/{name}.mp4', '-frames:v', '1', png], check=True)
    Image.open(png).convert('RGB').save(f'{OUT}/{name}.webp', 'WEBP', quality=74, method=6)


AC, AW, AH = 7, 240, 320   # atlas: 7 columns of 240x320 cells; the favourite gets a 2x2 block


def atlas(names, star):
    """All the clips in ONE video, side by side: a phone then decodes a single stream instead of many."""
    names = [star] * (star in names) + [n for n in names if n != star]
    taken, cells = set(), {}
    def free(c, r, k): return c + k <= AC and all((c + i, r + j) not in taken for i in range(k) for j in range(k))
    for n in names:
        k = 2 if n == star else 1
        r = 0
        while True:
            c = next((c for c in range(AC) if free(c, r, k)), None)
            if c is not None: break
            r += 1
        for i in range(k):
            for j in range(k): taken.add((c + i, r + j))
        cells[n] = [c * AW, r * AH, k * AW, k * AH]
    rows = max(r for _, r in taken) + 1
    cmd = ['ffmpeg', '-v', 'error', '-y']
    for n in names: cmd += ['-stream_loop', '-1', '-i', f'{OUT}/{n}.mp4']
    f = [f"color=black:s={AC * AW}x{rows * AH}:r=24[bg]"]
    last = 'bg'
    for i, n in enumerate(names):
        x, y, w, h = cells[n]
        f.append(f"[{i}:v]fps=24,scale={w}:{h}:flags=lanczos,setsar=1[c{i}]")
        f.append(f"[{last}][c{i}]overlay={x}:{y}[o{i}]"); last = f'o{i}'
    cmd += ['-filter_complex', ';'.join(f), '-map', f'[{last}]', '-t', '7', '-an', '-c:v', 'libx264', '-profile:v', 'high', '-level', '4.0',
            '-pix_fmt', 'yuv420p', '-preset', 'slow', '-crf', '25', '-g', '24', '-movflags', '+faststart', f'{OUT}/atlas.mp4']
    subprocess.run(cmd, check=True)
    return cells


def main():
    os.makedirs(OUT, exist_ok=True)
    done = json.load(open(DONE)) if os.path.exists(DONE) else {}
    todo = sorted(os.path.join(DROP, f) for f in os.listdir(DROP) if not f.startswith('.')) if os.path.isdir(DROP) else []
    if not todo and not done:
        sys.exit(f'Put the photos and videos into {DROP} first.')
    for src in todo:
        key = os.path.basename(src)
        ext = os.path.splitext(src)[1].lower()
        if key in done or ext not in IMG | VID:
            continue
        n = len(done) + 1
        try:
            if ext in VID:
                name = f'v{n:02d}'; video(src, name); done[key] = {'k': 'v', 'n': name}
            else:
                name = f'p{n:02d}'; tile(open_any(src), f'{OUT}/{name}.webp', f'{OUT}/{name}b.webp', SPEC.get(key, {}))
                done[key] = {'k': 'i', 'n': name}
            print('+', key, '->', name)
        except Exception as e:
            print('! skipped', key, e)
    json.dump(done, open(DONE, 'w'), indent=1)

    # s: a 3x4 thumbnail of the tile as hex nibbles, so the page can keep look-alikes apart in the heart
    def sig(n):
        px = Image.open(f'{OUT}/{n}.webp').convert('RGB').resize((3, 4), Image.BOX).getdata()
        return ''.join('%x' % (c >> 4) for p in px for c in p)
    items = [{'k': d['k'], 'n': d['n'], 's': sig(d['n'])} for d in done.values()]
    vids = [i['n'] for i in items if i['k'] == 'v']
    star = done.get(STAR_SRC, {}).get('n', '') if STAR_SRC else ''
    if STAR_SRC and not star:
        print('! STAR_SRC is not one of the processed videos:', STAR_SRC)
    cells = atlas(vids, star) if vids else {}
    os.makedirs(os.path.join(REPO, 'js'), exist_ok=True)
    with open(os.path.join(REPO, 'js/media.js'), 'w') as f:
        f.write('window.MEDIA=' + json.dumps(items, separators=(',', ':')) + ';\n')
        f.write('window.ATLAS=' + json.dumps(cells, separators=(',', ':')) + ';\n')
        f.write('window.STAR=' + json.dumps(star) + ';\n')
    print(len(items), 'tiles:', len(vids), 'videos', '| star:', star or 'none')


main()
