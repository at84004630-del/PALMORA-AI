import cv2
import numpy as np

img = cv2.imread(r"C:\Users\ABHINAV TRIPATHI\.gemini\antigravity-ide\brain\582a6a65-3031-4f99-a5b1-48db69a01c42\before_analyze_click_1792451384742.png")
h, w = img.shape[:2]

# Detect where pixels are not the dark navy background (r, g, b != 11, 14, 21)
# Background is dark, BGR ~ (21, 14, 11) or V < 30
hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
content_mask = (hsv[:, :, 2] > 40).astype(np.uint8)

# Find bounding box in y: 0 to 500, x: 600 to 1400
cnts, _ = cv2.findContours(content_mask[50:550, 650:1300], cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
best_box = None
max_a = 0
for c in cnts:
    x, y, bw, bh = cv2.boundingRect(c)
    if bw * bh > max_a:
        max_a = bw * bh
        best_box = (x + 650, y + 50, bw, bh)

print("Best box found:", best_box)
if best_box:
    x, y, bw, bh = best_box
    crop = img[y:y+bh, x:x+bw]
    cv2.imwrite("scratch/actual_user_upload.jpg", crop)
    print("Saved crop:", crop.shape)
