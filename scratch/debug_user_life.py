import sys
sys.path.insert(0, '.')
import cv2
import numpy as np

from scratch.test_expert_scoring import score_and_extract
# Let's inspect the segments for user_real_palm.jpg:
from services.api.cv.validator import validate_palm_image
from services.api.cv.crease_analyzer import (
    _refine_skin_mask, _detect_hand_anatomy, _rectify_hand,
    _extract_creases_hybrid_sota, _morphological_skeleton,
    _extract_geodesic_diameter_path, _link_collinear_segments_tangential
)
b = open('scratch/user_real_palm.jpg', 'rb').read()
_, q, _ = validate_palm_image(b)
img = cv2.imread('scratch/user_real_palm.jpg')
h, w = img.shape[:2]
mask = _refine_skin_mask(img, q)
cnts, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
hc = max(cnts, key=cv2.contourArea)
cx, cy, r, hs, dev = _detect_hand_anatomy(hc, mask, w, h)
wimg, wmask = _rectify_hand(img, mask, cx, cy, dev)
cmap = _extract_creases_hybrid_sota(wimg, wmask, cx, cy, r, q)
vals = cmap[cmap > 0]
clip_p = 48 if (q.contrast_score < 40.0 or q.brightness_score < 65.0) else 54
th = np.percentile(vals, clip_p) if len(vals) > 40 else 12
_, binc = cv2.threshold(cmap, int(th), 255, cv2.THRESH_BINARY)
binc = cv2.morphologyEx(binc, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2)))
skel = _morphological_skeleton(binc, 16)
num_l, lbls, stats, _ = cv2.connectedComponentsWithStats(skel, connectivity=8)

min_comp_pixels = max(10, int(r * 0.08))
segs = []
for i in range(1, num_l):
    if stats[i, cv2.CC_STAT_AREA] < min_comp_pixels:
        continue
    comp = (lbls == i).astype(np.uint8)
    p = _extract_geodesic_diameter_path(comp)
    if len(p) < 3:
        continue
    diffs = np.diff(p, axis=0)
    arc_l = float(np.sum(np.sqrt((diffs**2).sum(axis=1))))
    if arc_l < min_comp_pixels:
        continue
    xs, ys = p[:, 0], p[:, 1]
    mean_x, mean_y = float(np.mean(xs)), float(np.mean(ys))
    rel_x = (mean_x - cx) / float(r)
    rel_y = (mean_y - cy) / float(r)
    dx_span = float(np.ptp(xs))
    dy_span = float(np.ptp(ys))
    canonical_u = rel_x if hs == "right" else -rel_x
    segs.append({
        'idx': i, 'path': p, 'arc_length': arc_l,
        'rel_y': rel_y, 'canonical_u': canonical_u,
        'dx_span': dx_span, 'dy_span': dy_span,
        'max_ry': float(np.max(ys - cy) / float(r))
    })

print("Life candidates in user_real_palm.jpg:")
for s in segs:
    u = s['canonical_u']
    ry = s['rel_y']
    dx = s['dx_span']
    dy = s['dy_span']
    l = s['arc_length']
    max_ry = s['max_ry']
    if u <= -0.10 and -0.20 <= ry <= +1.10 and (dy >= dx * 0.35 or max_ry >= 0.20):
        u_score = max(0.0, 1.0 - abs(u - (-0.65)) / 0.55)
        z_score = max(0.0, 1.0 - abs(ry - 0.45) / 0.55)
        v_score = min(1.0, dy / max(dx * 0.5, 1.0))
        l_score = min(1.0, l / (0.60 * float(r)))
        s_life = 0.30 * u_score + 0.30 * z_score + 0.25 * v_score + 0.15 * l_score
        print(f"idx={s['idx']}, l={l:.1f}, u={u:.2f}, ry={ry:.2f}, dx={dx:.1f}, dy={dy:.1f}, s_life={s_life:.3f}, start={s['path'][0]}, end={s['path'][-1]}")
