import sys
sys.path.insert(0, '.')
import cv2
import numpy as np

img = cv2.imread("scratch/clean_user_palm.jpg")
h, w = img.shape[:2]

from services.api.cv.validator import validate_palm_image
from services.api.cv.crease_analyzer import (
    _refine_skin_mask, _detect_hand_anatomy, _rectify_hand,
    _extract_creases_hybrid_sota, _morphological_skeleton,
    _extract_geodesic_diameter_path
)

_, q, _ = validate_palm_image(open("scratch/clean_user_palm.jpg", "rb").read())
mask = _refine_skin_mask(img, q)

cnts, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
hc = max(cnts, key=cv2.contourArea)
cx, cy, r, hs, dev = _detect_hand_anatomy(hc, mask, w, h)
wimg, wmask = _rectify_hand(img, mask, cx, cy, dev)
cmap = _extract_creases_hybrid_sota(wimg, wmask, cx, cy, r, q)

cv2.imwrite("scratch/diag_crease_map.png", cmap)

vals = cmap[cmap > 0]
_, binc = cv2.threshold(cmap, int(np.percentile(vals, 54)), 255, cv2.THRESH_BINARY)
skel = _morphological_skeleton(binc, 16)
cv2.imwrite("scratch/diag_skeleton.png", skel)

num_l, lbls, stats, _ = cv2.connectedComponentsWithStats(skel, connectivity=8)
print(f"Total skeleton components: {num_l}")

# Check components in the image
vis_skel = cv2.cvtColor(skel, cv2.COLOR_GRAY2BGR)
for i in range(1, num_l):
    if stats[i, cv2.CC_STAT_AREA] < max(10, int(r * 0.08)):
        continue
    comp = (lbls == i).astype(np.uint8)
    p = _extract_geodesic_diameter_path(comp)
    mean_x = np.mean(p[:, 0])
    mean_y = np.mean(p[:, 1])
    diffs = np.diff(p, axis=0)
    l = float(np.sum(np.sqrt((diffs**2).sum(axis=1))))
    print(f"Comp {i}: area={stats[i, cv2.CC_STAT_AREA]}, len={l:.1f}, mean_pos=({mean_x:.1f}, {mean_y:.1f})")

