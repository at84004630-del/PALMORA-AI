import cv2
import numpy as np

img = cv2.imread(r"C:\Users\ABHINAV TRIPATHI\.gemini\antigravity-ide\brain\582a6a65-3031-4f99-a5b1-48db69a01c42\before_analyze_click_1792451384742.png")
# The preview image is in the center container
# Let's find the image boundaries
# In the screenshot (1920x1080 or 1536x730), let's find the inner palm photo
# It has a dark background around it
# Let's crop x: 540 to 900, y: 70 to 450 approximately, or find the color image box
gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
# Find non-dark area in upper-middle
h, w = img.shape[:2]
print("Screenshot shape:", h, w)

# Find coordinates where color variance is high (the palm photo)
crop = img[70:450, 540:900]
cv2.imwrite("scratch/actual_user_upload.jpg", crop)
print("Saved scratch/actual_user_upload.jpg, shape:", crop.shape)
