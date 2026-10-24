import sys
sys.path.insert(0, '.')
import cv2
import numpy as np

img = cv2.imread("scratch/clean_user_palm.jpg")
h, w = img.shape[:2]
mask = cv2.imread("scratch/fast_grabcut.png", cv2.IMREAD_GRAYSCALE)

from services.api.cv.crease_analyzer import (
    _detect_hand_anatomy, _rectify_hand,
    _extract_creases_hybrid_sota, _morphological_skeleton,
    analyze_palm_creases
)
from services.api.cv.validator import validate_palm_image

cnts, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
hc = max(cnts, key=cv2.contourArea)
cx, cy, r, hs, dev = _detect_hand_anatomy(hc, mask, w, h)
print(f"Detected anatomy with clean mask: cx={cx:.1f}, cy={cy:.1f}, r={r:.1f}, side={hs}, dev={dev:.1f} deg")

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
cv2.imwrite("scratch/clean_anatomy_vis.png", vis)
