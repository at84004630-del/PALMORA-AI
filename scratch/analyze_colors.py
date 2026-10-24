import sys
sys.path.insert(0, '.')
import cv2
import numpy as np

img = cv2.imread("scratch/clean_user_palm.jpg")
h, w = img.shape[:2]

# Let's inspect the color and gradients of:
# 1. The palm center: (w//2, int(h * 0.55)) -> around (160, 250)
# 2. The wall on the left: (30, 100)
# 3. The red blanket on the right: (290, 350)
print("Image shape:", img.shape)
palm_sample = img[int(h*0.4):int(h*0.7), int(w*0.35):int(w*0.65)]
wall_sample = img[50:150, 10:50]
blanket_sample = img[300:400, 260:300]

print("Palm mean BGR:", np.mean(palm_sample, axis=(0, 1)))
print("Wall mean BGR:", np.mean(wall_sample, axis=(0, 1)))
print("Blanket mean BGR:", np.mean(blanket_sample, axis=(0, 1)))

# Convert to YCrCb and LAB
ycrcb_palm = cv2.cvtColor(palm_sample, cv2.COLOR_BGR2YCrCb)
ycrcb_wall = cv2.cvtColor(wall_sample, cv2.COLOR_BGR2YCrCb)

print("Palm mean YCrCb:", np.mean(ycrcb_palm, axis=(0, 1)))
print("Wall mean YCrCb:", np.mean(ycrcb_wall, axis=(0, 1)))

lab_palm = cv2.cvtColor(palm_sample, cv2.COLOR_BGR2LAB)
lab_wall = cv2.cvtColor(wall_sample, cv2.COLOR_BGR2LAB)

print("Palm mean LAB:", np.mean(lab_palm, axis=(0, 1)))
print("Wall mean LAB:", np.mean(lab_wall, axis=(0, 1)))
