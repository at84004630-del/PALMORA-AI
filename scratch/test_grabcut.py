import cv2
import numpy as np

img = cv2.imread("scratch/clean_user_palm.jpg")
h, w = img.shape[:2]

# Method 1: Edge-Aware GrabCut initialized with a bounding box and center seed
# The hand is in the center column: x from 0.15*w to 0.85*w, y from 0.05*h to 0.95*h
# The perimeter (top corners, left border, right border) is background

# Initialize mask for GrabCut: 0=BGD, 1=FGD, 2=PR_BGD, 3=PR_FGD
gc_mask = np.full((h, w), cv2.GC_PR_BGD, dtype=np.uint8)

# Center region (palm core) is definitely foreground
cx, cy = int(w * 0.52), int(h * 0.52)
cr_w, cr_h = int(w * 0.20), int(h * 0.25)
gc_mask[cy - cr_h:cy + cr_h, cx - cr_w:cx + cr_w] = cv2.GC_PR_FGD
# Small inner core is definitely FGD
gc_mask[cy - cr_h//2:cy + cr_h//2, cx - cr_w//2:cx + cr_w//2] = cv2.GC_FGD

# Upper corners and outer left/right margins are definitely background
gc_mask[0:int(h*0.25), 0:int(w*0.15)] = cv2.GC_BGD
gc_mask[0:int(h*0.25), int(w*0.85):w] = cv2.GC_BGD
gc_mask[int(h*0.75):h, 0:int(w*0.10)] = cv2.GC_BGD
gc_mask[int(h*0.75):h, int(w*0.90):w] = cv2.GC_BGD

bgd_model = np.zeros((1, 65), np.float64)
fgd_model = np.zeros((1, 65), np.float64)

cv2.grabCut(img, gc_mask, None, bgd_model, fgd_model, 5, cv2.GC_INIT_WITH_MASK)

grabcut_res = np.where((gc_mask == cv2.GC_FGD) | (gc_mask == cv2.GC_PR_FGD), 255, 0).astype(np.uint8)
cv2.imwrite("scratch/test_grabcut_mask.png", grabcut_res)

# Let's inspect the largest contour
cnts, _ = cv2.findContours(grabcut_res, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
if cnts:
    c = max(cnts, key=cv2.contourArea)
    vis = img.copy()
    cv2.drawContours(vis, [c], -1, (0, 255, 0), 2)
    cv2.imwrite("scratch/test_grabcut_contour.png", vis)
    print("GrabCut contour area:", cv2.contourArea(c))
