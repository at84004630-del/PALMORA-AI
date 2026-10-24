import sys
sys.path.insert(0, '.')
import cv2
import numpy as np

img = cv2.imread("scratch/clean_user_palm.jpg")
vis = img.copy()

from scratch.diagnose_user_palm import f, roi

colors = {
    'heart_line': (0, 0, 255),    # Red
    'head_line': (255, 128, 0),   # Blue / Cyan
    'life_line': (0, 255, 0),     # Green
    'fate_line': (255, 0, 255),   # Magenta / Purple
}

for name, col in colors.items():
    feat = getattr(f, name)
    if feat.status == 'detected' and feat.pixel_path:
        pts = np.array([[int(round(p.x)), int(round(p.y))] for p in feat.pixel_path], dtype=np.int32)
        cv2.polylines(vis, [pts], False, col, 3, cv2.LINE_AA)
        cv2.circle(vis, tuple(pts[0]), 5, (255, 255, 255), -1)
        cv2.circle(vis, tuple(pts[-1]), 5, (0, 255, 255), -1)

cv2.imwrite("scratch/diag_lines_on_image.png", vis)
print("Saved scratch/diag_lines_on_image.png")
