import time
import cv2
import numpy as np

img = cv2.imread("scratch/clean_user_palm.jpg")
h, w = img.shape[:2]

# Downsample for lightning-fast graph-cut if larger than 320px
scale = 1.0
if max(h, w) > 320:
    scale = 320.0 / max(h, w)
    small_img = cv2.resize(img, (int(w * scale), int(h * scale)))
else:
    small_img = img

sh, sw = small_img.shape[:2]
t0 = time.time()

gc_mask = np.full((sh, sw), cv2.GC_PR_BGD, dtype=np.uint8)
cx, cy = int(sw * 0.52), int(sh * 0.52)
cr_w, cr_h = int(sw * 0.20), int(sh * 0.25)
gc_mask[cy - cr_h:cy + cr_h, cx - cr_w:cx + cr_w] = cv2.GC_PR_FGD
gc_mask[cy - cr_h//2:cy + cr_h//2, cx - cr_w//2:cx + cr_w//2] = cv2.GC_FGD

gc_mask[0:int(sh*0.20), 0:int(sw*0.15)] = cv2.GC_BGD
gc_mask[0:int(sh*0.20), int(sw*0.85):sw] = cv2.GC_BGD
gc_mask[int(sh*0.80):sh, 0:int(sw*0.12)] = cv2.GC_BGD
gc_mask[int(sh*0.80):sh, int(sw*0.88):sw] = cv2.GC_BGD

bgd_model = np.zeros((1, 65), np.float64)
fgd_model = np.zeros((1, 65), np.float64)

cv2.grabCut(small_img, gc_mask, None, bgd_model, fgd_model, 2, cv2.GC_INIT_WITH_MASK)
small_res = np.where((gc_mask == cv2.GC_FGD) | (gc_mask == cv2.GC_PR_FGD), 255, 0).astype(np.uint8)

if scale != 1.0:
    res = cv2.resize(small_res, (w, h), interpolation=cv2.INTER_NEAREST)
else:
    res = small_res

t1 = time.time()
print(f"Graph-cut took {(t1 - t0)*1000:.1f} ms!")
cv2.imwrite("scratch/fast_grabcut.png", res)
