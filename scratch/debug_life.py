import sys
sys.path.insert(0, '.')
import cv2
import numpy as np
from scratch.debug_segments2 import segs, cx, cy, r, hs

print("Life line candidates:")
for s in segs:
    ry, u, dx, dy, l = s['ry'], s['u'], s['dx'], s['dy'], s['l']
    max_ry = float(np.max(s['path'][:, 1] - cy) / float(r))
    s_life = 0.0
    if u <= 0.20 and -0.15 <= ry <= 1.05 and (max_ry >= 0.20 or dy >= dx * 0.40):
        z_score = max(0.0, 1.0 - abs(ry - 0.45) / 0.50)
        v_score = min(1.0, dy / max(dx * 0.5, 1.0))
        l_score = min(1.0, l / (0.60 * float(r)))
        s_life = 0.40 * z_score + 0.35 * v_score + 0.25 * l_score
        s['s_life'] = s_life
        print(f"idx={s['idx']}, l={s['l']:.1f}, ry={s['ry']:.2f}, u={s['u']:.2f}, dx={s['dx']:.1f}, dy={s['dy']:.1f}, s_life={s_life:.3f}, start={s['path'][0]}, end={s['path'][-1]}")

top_life = sorted([s for s in segs if 's_life' in s and s['s_life'] > 0], key=lambda s: s['s_life'], reverse=True)[:5]
print("\nTop Life segments:")
for s in top_life:
    print(f"idx={s['idx']}, s_life={s['s_life']:.3f}, l={s['l']:.1f}, ry={s['ry']:.2f}, u={s['u']:.2f}")

from services.api.cv.validator import validate_palm_image
from services.api.cv.crease_analyzer import analyze_palm_creases
b = open('apps/web/public/test_palm_sample.jpg', 'rb').read()
_, q, _ = validate_palm_image(b)
img = cv2.imread('apps/web/public/test_palm_sample.jpg')
f, _, _ = analyze_palm_creases(img, q)
print("\nFinal Life Line in analyze_palm_creases:")
print("Status:", f.life_line.status)
print("Measurements:", f.life_line.measurements)
if f.life_line.pixel_path:
    pts = np.array([[p.x, p.y] for p in f.life_line.pixel_path])
    print("Start:", pts[0], "End:", pts[-1])
    chord = np.hypot(pts[-1,0] - pts[0,0], pts[-1,1] - pts[0,1])
    diffs = np.diff(pts, axis=0)
    arc_l = float(np.sum(np.sqrt((diffs**2).sum(axis=1))))
    print(f"Arc={arc_l:.1f}, Chord={chord:.1f}, Curv={arc_l/chord:.2f}")
