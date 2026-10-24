import sys
sys.path.insert(0, '.')
import cv2
import numpy as np
from services.api.cv.validator import validate_palm_image
from services.api.cv.crease_analyzer import (
    _refine_skin_mask, _detect_hand_anatomy, _rectify_hand,
    _extract_creases_hybrid_sota, _morphological_skeleton,
    _extract_geodesic_diameter_path
)

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
        'idx': i, 'path': p, 'l': arc_l,
        'ry': (np.mean(p[:, 1]) - cy) / r,
        'u': (np.mean(p[:, 0]) - cx) / r if hs == 'right' else -(np.mean(p[:, 0]) - cx) / r,
        'dx': float(np.ptp(p[:, 0])), 'dy': float(np.ptp(p[:, 1]))
    })

for s in segs:
    ry, u, dx, dy, l = s['ry'], s['u'], s['dx'], s['dy'], s['l']
    s_heart = 0.0
    if -0.95 <= ry <= -0.30 and dx >= dy * 0.65:
        z = max(0.0, 1.0 - abs(ry - (-0.50)) / 0.40)
        t = min(1.0, dx / max(dy * 0.9, 1.0))
        len_s = min(1.0, l / (0.60 * r))
        s_heart = 0.40 * z + 0.35 * t + 0.25 * len_s
    s_head = 0.0
    if -0.35 <= ry <= 0.10 and dx >= dy * 0.65:
        z = max(0.0, 1.0 - abs(ry - (-0.18)) / 0.30)
        t = min(1.0, dx / max(dy * 0.9, 1.0))
        len_s = min(1.0, l / (0.60 * r))
        s_head = 0.40 * z + 0.35 * t + 0.25 * len_s
    s['s_heart'] = s_heart
    s['s_head'] = s_head

for s in segs:
    if s['idx'] in [166, 209, 225, 232]:
        print(f"idx={s['idx']}: l={s['l']:.1f}, ry={s['ry']:.2f}, u={s['u']:.2f}, s_heart={s['s_heart']:.3f}, s_head={s['s_head']:.3f}")

# Check which segment got highest s_head:
top_head = sorted(segs, key=lambda s: s['s_head'], reverse=True)[:5]
print("\nTop s_head segments:")
for s in top_head:
    print(f"idx={s['idx']}, s_head={s['s_head']:.3f}, l={s['l']:.1f}, ry={s['ry']:.2f}, u={s['u']:.2f}, dx={s['dx']:.1f}, dy={s['dy']:.1f}")
