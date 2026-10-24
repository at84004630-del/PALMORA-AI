import cv2
import numpy as np

img = cv2.imread('scratch/actual_user_upload.jpg')
h, w = img.shape[:2]

m = cv2.imread('scratch/test_strict_skin.png', 0)
cnts, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
largest = max(cnts, key=cv2.contourArea)

hand_mask = np.zeros_like(m)
cv2.drawContours(hand_mask, [largest], -1, 255, -1)
k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
hand_mask = cv2.morphologyEx(hand_mask, cv2.MORPH_CLOSE, k)

from services.api.cv.validator import validate_palm_image
from services.api.cv.crease_analyzer import (
    _extract_creases_hybrid_sota, _morphological_skeleton,
    _extract_geodesic_diameter_path, _link_collinear_segments_tangential,
    _resample_polyline_by_arclength
)

cx, cy = 271.0, 230.0
r = 122.1
side = 'right'

palmar_envelope = np.zeros((h, w), dtype=np.uint8)
cv2.ellipse(
    palmar_envelope,
    (int(cx), int(cy)),
    (int(round(1.25 * r)), int(round(1.10 * r))),
    0, 0, 360, 255, -1
)
palmar_mask = cv2.bitwise_and(hand_mask, palmar_envelope)
palmar_mask = cv2.erode(palmar_mask, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)))

_, q, _ = validate_palm_image(open('scratch/actual_user_upload.jpg', 'rb').read())
creases = _extract_creases_hybrid_sota(img, palmar_mask, cx, cy, r, q)

thresh_val = np.percentile(creases[creases > 0], 52)
_, bin_c = cv2.threshold(creases, int(thresh_val), 255, cv2.THRESH_BINARY)
skel = _morphological_skeleton(bin_c, 16)

num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(skel, connectivity=8)
min_comp_pixels = max(10, int(r * 0.08))

segments = []
for i in range(1, num_labels):
    if stats[i, cv2.CC_STAT_AREA] < min_comp_pixels:
        continue
    comp_mask = (labels == i).astype(np.uint8)
    raw_path = _extract_geodesic_diameter_path(comp_mask)
    if len(raw_path) < 3:
        continue
    diffs = np.diff(raw_path, axis=0)
    arc_l = float(np.sum(np.sqrt((diffs**2).sum(axis=1))))
    if arc_l < min_comp_pixels:
        continue

    xs = raw_path[:, 0]
    ys = raw_path[:, 1]
    rel_x = (np.mean(xs) - cx) / float(r)
    rel_y = (np.mean(ys) - cy) / float(r)
    dx = float(np.ptp(xs))
    dy = float(np.ptp(ys))
    canonical_u = rel_x if side == 'right' else -rel_x
    segments.append({
        'idx': i,
        'path': raw_path,
        'arc_length': arc_l,
        'rel_x': rel_x,
        'rel_y': rel_y,
        'canonical_u': canonical_u,
        'dx': dx,
        'dy': dy
    })

candidate_scores = []
for idx, seg in enumerate(segments):
    u = seg['canonical_u']
    ry = seg['rel_y']
    dx = seg['dx']
    dy = seg['dy']
    l = seg['arc_length']

    s_heart = 0.0
    if -0.90 <= ry <= -0.20 and dx >= dy * 0.60:
        z = max(0.0, 1.0 - abs(ry - (-0.50)) / 0.40)
        t = min(1.0, dx / max(dy * 0.9, 1.0))
        len_s = min(1.0, l / (0.50 * r))
        s_heart = 0.40 * z + 0.35 * t + 0.25 * len_s

    s_head = 0.0
    if -0.35 <= ry <= +0.15 and dx >= dy * 0.60 and abs(u) <= 0.85:
        z = max(0.0, 1.0 - abs(ry - (-0.12)) / 0.30)
        t = min(1.0, dx / max(dy * 0.9, 1.0))
        len_s = min(1.0, l / (0.50 * r))
        s_head = 0.40 * z + 0.35 * t + 0.25 * len_s

    s_life = 0.0
    if u <= 0.15 and -0.20 <= ry <= +1.00 and (dy >= dx * 0.45 or ry >= 0.15):
        z = max(0.0, 1.0 - abs(ry - 0.40) / 0.50)
        v = min(1.0, dy / max(dx * 0.6, 1.0))
        len_s = min(1.0, l / (0.50 * r))
        s_life = 0.35 * z + 0.35 * v + 0.30 * len_s

    s_fate = 0.0
    if abs(u) <= 0.20 and dy >= 1.25 * dx and -0.30 <= ry <= +0.80:
        c = max(0.0, 1.0 - abs(u) / 0.20)
        v = min(1.0, dy / max(dx * 1.3, 1.0))
        len_s = min(1.0, l / (0.45 * r))
        s_fate = 0.40 * c + 0.40 * v + 0.20 * len_s

    candidate_scores.append({'idx': idx, 'seg': seg, 'heart': s_heart, 'head': s_head, 'life': s_life, 'fate': s_fate})

vis = img.copy()
cv2.ellipse(vis, (int(cx), int(cy)), (int(round(1.25 * r)), int(round(1.10 * r))), 0, 0, 360, (200, 170, 110), 1)

line_colors = {
    'heart': (94, 63, 244),
    'head': (248, 189, 56),
    'life': (153, 211, 52),
    'fate': (252, 132, 192)
}

assigned = set()
for lk in ['heart', 'head', 'life', 'fate']:
    unassigned = [c for c in candidate_scores if c['idx'] not in assigned and c[lk] > 0.20]
    if unassigned:
        best = max(unassigned, key=lambda c: c[lk])
        assigned.add(best['idx'])
        s = best['seg']
        pts = s['path'].astype(np.int32)
        cv2.polylines(vis, [pts], False, line_colors[lk], 3)
        cv2.circle(vis, (pts[0, 0], pts[0, 1]), 5, (255, 255, 255), -1)
        cv2.circle(vis, (pts[-1, 0], pts[-1, 1]), 5, (255, 255, 255), -1)
        cv2.putText(vis, lk.upper(), (pts[0, 0] + 5, pts[0, 1] - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.5, line_colors[lk], 2)
        print(f"{lk.upper()}: score={best[lk]:.3f}, len={s['arc_length']:.1f}, u={s['canonical_u']:.2f}, ry={s['rel_y']:.2f}, start=({pts[0,0]},{pts[0,1]}), end=({pts[-1,0]},{pts[-1,1]})")

cv2.imwrite('scratch/actual_user_pure_palm_detected.jpg', vis)
print('Successfully saved scratch/actual_user_pure_palm_detected.jpg')
