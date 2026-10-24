import sys
sys.path.insert(0, '.')
import cv2
import numpy as np

img = cv2.imread("scratch/clean_user_palm.jpg")
h, w = img.shape[:2]
print(f"Image dimensions: {w}x{h}")

from services.api.cv.validator import validate_palm_image
from services.api.cv.crease_analyzer import (
    _refine_skin_mask, _detect_hand_anatomy, _rectify_hand,
    _extract_creases_hybrid_sota, _morphological_skeleton,
    analyze_palm_creases
)

is_usable, q, reason = validate_palm_image(open("scratch/clean_user_palm.jpg", "rb").read())
print(f"Validation: usable={is_usable}, reason={reason}")

mask = _refine_skin_mask(img, q)
cv2.imwrite("scratch/diag_skin_mask.png", mask)

cnts, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
print(f"Found {len(cnts)} contours in skin mask.")
for i, c in enumerate(cnts):
    area = cv2.contourArea(c)
    x, y, bw, bh = cv2.boundingRect(c)
    print(f"  Contour {i}: area={area:.1f}, bbox=({x}, {y}, {bw}, {bh})")

hc = max(cnts, key=cv2.contourArea)
cx, cy, r, hs, dev = _detect_hand_anatomy(hc, mask, w, h)
print(f"Detected anatomy: cx={cx:.1f}, cy={cy:.1f}, r={r:.1f}, side={hs}, dev={dev:.1f} deg")

# Draw detection on image
vis = img.copy()
cv2.circle(vis, (int(cx), int(cy)), int(r), (0, 255, 0), 2)
cv2.circle(vis, (int(cx), int(cy)), 4, (0, 0, 255), -1)
# Draw palm envelope ellipse
cv2.ellipse(
    vis,
    (int(cx), int(cy)),
    (int(round(1.30 * r)), int(round(1.15 * r))),
    0, 0, 360, (255, 255, 0), 2
)
cv2.imwrite("scratch/diag_anatomy_vis.png", vis)

# Now run analyze_palm_creases
f, side, roi = analyze_palm_creases(img, q)
print(f"Final analysis result:")
print(f"  Hand side: {side}")
print(f"  ROI box: {roi}")
for k in ['heart_line', 'head_line', 'life_line', 'fate_line']:
    feat = getattr(f, k)
    print(f"  {k}: status={feat.status}, measurements={feat.measurements}")
    if feat.pixel_path:
        pts = np.array([[p.x, p.y] for p in feat.pixel_path])
        print(f"    pts count={len(pts)}, start=({pts[0,0]:.1f}, {pts[0,1]:.1f}), end=({pts[-1,0]:.1f}, {pts[-1,1]:.1f}), min_x={np.min(pts[:,0]):.1f}, max_x={np.max(pts[:,0]):.1f}, min_y={np.min(pts[:,1]):.1f}, max_y={np.max(pts[:,1]):.1f}")
