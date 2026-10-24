import sys
sys.path.insert(0, '.')
import cv2
import numpy as np

skel = cv2.imread("scratch/clean_skel.png", cv2.IMREAD_GRAYSCALE)
num_l, lbls, stats, _ = cv2.connectedComponentsWithStats(skel, connectivity=8)

print(f"Total components: {num_l}")
# Print the 10 largest components by area
largest = sorted(range(1, num_l), key=lambda i: stats[i, cv2.CC_STAT_AREA], reverse=True)[:10]
for idx in largest:
    area = stats[idx, cv2.CC_STAT_AREA]
    x, y, w, h = stats[idx, cv2.CC_STAT_LEFT], stats[idx, cv2.CC_STAT_TOP], stats[idx, cv2.CC_STAT_WIDTH], stats[idx, cv2.CC_STAT_HEIGHT]
    print(f"Comp {idx}: area={area}, bbox=({x}, {y}, {w}, {h})")

# Let's see what happens to Comp largest[0]
from services.api.cv.crease_analyzer import _extract_geodesic_diameter_path
c0 = (lbls == largest[0]).astype(np.uint8)
p0 = _extract_geodesic_diameter_path(c0)
diffs = np.diff(p0, axis=0)
l0 = float(np.sum(np.sqrt((diffs**2).sum(axis=1))))
print(f"Comp {largest[0]} geodesic diameter path: len={l0:.1f}, num_pts={len(p0)}")

# Save an image highlighting the top 3 largest components
vis = cv2.cvtColor(skel, cv2.COLOR_GRAY2BGR)
colors = [(0, 0, 255), (0, 255, 0), (255, 128, 0)]
for rank, idx in enumerate(largest[:3]):
    vis[lbls == idx] = colors[rank]
cv2.imwrite("scratch/top_components.png", vis)
print("Saved scratch/top_components.png")
