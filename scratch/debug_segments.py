import sys
sys.path.insert(0, '.')
import cv2
import numpy as np
from services.api.cv.crease_analyzer import (
    _refine_skin_mask, _detect_hand_anatomy, _rectify_hand,
    _extract_creases_hybrid_sota, _morphological_skeleton,
    _extract_geodesic_diameter_path, _link_collinear_segments_tangential
)
from services.api.cv.validator import validate_palm_image

b = open('apps/web/public/test_palm_sample.jpg', 'rb').read()
_, q, _ = validate_palm_image(b)
img = cv2.imread('apps/web/public/test_palm_sample.jpg')
h, w = img.shape[:2]
mask = _refine_skin_mask(img, q)
cnts, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
hc = max(cnts, key=cv2.contourArea)
cx, cy, r, hs, dev = _detect_hand_anatomy(hc, mask, w, h)
wimg, wmask = _rectify_hand(img, mask, cx, cy, dev)
cmap = _extract_creases_hybrid_sota(wimg, wmask, cx, cy, r, q)
vals = cmap[cmap > 0]
_, binc = cv2.threshold(cmap, int(np.percentile(vals, 54)), 255, cv2.THRESH_BINARY)
skel = _morphological_skeleton(binc, 16)
num_l, lbls, stats, _ = cv2.connectedComponentsWithStats(skel, connectivity=8)

segs = []
for i in range(1, num_l):
    if stats[i, cv2.CC_STAT_AREA] < max(10, int(r * 0.08)):
        continue
    comp = (lbls == i).astype(np.uint8)
    p = _extract_geodesic_diameter_path(comp)
    if len(p) < 3:
        continue
    diffs = np.diff(p, axis=0)
    arc_l = float(np.sum(np.sqrt((diffs**2).sum(axis=1))))
    segs.append({
        'idx': i,
        'path': p,
        'l': arc_l,
        'ry': (np.mean(p[:, 1]) - cy) / r,
        'u': (np.mean(p[:, 0]) - cx) / r if hs == 'right' else -(np.mean(p[:, 0]) - cx) / r,
        'dx': float(np.ptp(p[:, 0])),
        'dy': float(np.ptp(p[:, 1]))
    })

print("Head line zone candidates (ry in [-0.35, 0.10]):")
head_cands = []
for s in segs:
    if -0.35 <= s['ry'] <= 0.10 and s['dx'] >= s['dy'] * 0.65:
        head_cands.append(s)
        print(f"  idx={s['idx']}, l={s['l']:.1f}, ry={s['ry']:.2f}, u={s['u']:.2f}, dx={s['dx']:.1f}, dy={s['dy']:.1f}, start={s['path'][0]}, end={s['path'][-1]}")

from services.api.cv.crease_analyzer import analyze_palm_creases
f, _, _ = analyze_palm_creases(img, q)
print("\nFinal Head Line in analyze_palm_creases:")
print("Status:", f.head_line.status)
print("Measurements:", f.head_line.measurements)
if f.head_line.pixel_path:
    pts = np.array([[p.x, p.y] for p in f.head_line.pixel_path])
    print("Start:", pts[0], "End:", pts[-1])
    print("Min x:", np.min(pts[:, 0]), "Max x:", np.max(pts[:, 0]))
