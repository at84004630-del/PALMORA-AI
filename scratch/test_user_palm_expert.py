import cv2
import numpy as np
import math

img = cv2.imread(r"scratch\user_real_palm.jpg")
h, w = img.shape[:2]
from services.api.cv.validator import validate_palm_image
from services.api.cv.crease_analyzer import (
    _refine_skin_mask, _detect_hand_anatomy, _rectify_hand,
    _extract_creases_hybrid_sota, _morphological_skeleton,
    _extract_geodesic_diameter_path, _link_collinear_segments_tangential,
    _resample_polyline_by_arclength, _invert_rotate_points
)

_, quality, _ = validate_palm_image(open(r"scratch\user_real_palm.jpg", "rb").read())
mask = _refine_skin_mask(img)
contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
hand_cnt = max(contours, key=cv2.contourArea)

palm_cx = 162.0
palm_cy = 610.0
palm_radius = 120.0
hand_side = "right"
deviation = -5.0

work_img, work_mask = _rectify_hand(img, mask, palm_cx, palm_cy, deviation)
palmar_envelope = np.zeros((h, w), dtype=np.uint8)
cv2.ellipse(
    palmar_envelope,
    (int(palm_cx), int(palm_cy)),
    (int(round(1.30 * palm_radius)), int(round(1.15 * palm_radius))),
    0, 0, 360, 255, -1
)
work_mask_palm = cv2.bitwise_and(work_mask, palmar_envelope)
creases = _extract_creases_hybrid_sota(work_img, work_mask_palm, palm_cx, palm_cy, palm_radius, quality)

thresh_val = np.percentile(creases[creases > 0], 52)
_, bin_c = cv2.threshold(creases, int(thresh_val), 255, cv2.THRESH_BINARY)
skel = _morphological_skeleton(bin_c, 16)

num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(skel, connectivity=8)
segments = []
for i in range(1, num_labels):
    if stats[i, cv2.CC_STAT_AREA] < max(12, int(palm_radius * 0.08)):
        continue
    comp_mask = (labels == i).astype(np.uint8)
    p = _extract_geodesic_diameter_path(comp_mask)
    if len(p) < 4:
        continue
    diffs = np.diff(p, axis=0)
    l = float(np.sum(np.sqrt((diffs**2).sum(axis=1))))
    if l < max(18.0, palm_radius * 0.10):
        continue

    xs, ys = p[:, 0], p[:, 1]
    rel_x = (np.mean(xs) - palm_cx) / palm_radius
    rel_y = (np.mean(ys) - palm_cy) / palm_radius
    dx, dy = float(np.ptp(xs)), float(np.ptp(ys))
    u = rel_x if hand_side == "right" else -rel_x
    segments.append({
        "idx": i,
        "path": p,
        "arc_length": l,
        "canonical_u": u,
        "rel_y": rel_y,
        "dx": dx,
        "dy": dy
    })

candidate_scores = []
for idx, seg in enumerate(segments):
    u = seg['canonical_u']
    ry = seg['rel_y']
    dx = seg['dx']
    dy = seg['dy']
    l = seg['arc_length']

    s_heart = 0.0
    if -0.95 <= ry <= -0.30 and dx >= dy * 0.65:
        z = max(0.0, 1.0 - abs(ry - (-0.50)) / 0.40)
        t = min(1.0, dx / max(dy * 0.9, 1.0))
        len_s = min(1.0, l / (0.60 * palm_radius))
        s_heart = 0.40 * z + 0.35 * t + 0.25 * len_s

    s_head = 0.0
    if -0.35 <= ry <= +0.10 and dx >= dy * 0.65:
        z = max(0.0, 1.0 - abs(ry - (-0.18)) / 0.30)
        t = min(1.0, dx / max(dy * 0.9, 1.0))
        len_s = min(1.0, l / (0.60 * palm_radius))
        s_head = 0.40 * z + 0.35 * t + 0.25 * len_s

    s_life = 0.0
    if u <= 0.20 and -0.15 <= ry <= +1.05 and (dy >= dx * 0.40 or ry >= 0.20):
        z = max(0.0, 1.0 - abs(ry - 0.45) / 0.50)
        v = min(1.0, dy / max(dx * 0.5, 1.0))
        len_s = min(1.0, l / (0.60 * palm_radius))
        s_life = 0.40 * z + 0.35 * v + 0.25 * len_s

    candidate_scores.append({'idx': idx, 'seg': seg, 'heart': s_heart, 'head': s_head, 'life': s_life})

for line_key in ['heart', 'head', 'life']:
    cands = [c for c in candidate_scores if c[line_key] > 0]
    if cands:
        best = max(cands, key=lambda c: c[line_key])
        s = best['seg']
        print(f"{line_key.upper()}: best idx={s['idx']}, score={best[line_key]:.3f}, len={s['arc_length']:.1f}, u={s['canonical_u']:.2f}, ry={s['rel_y']:.2f}, dx={s['dx']:.1f}, dy={s['dy']:.1f}")
    else:
        print(f"{line_key.upper()}: no candidate")

