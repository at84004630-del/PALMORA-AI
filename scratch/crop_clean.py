import cv2
img = cv2.imread("scratch/actual_user_upload.jpg")
# The actual photo has borders
# In the 498x541 image, let's look at the black columns
# left is around x=78, right is around x=420, top is around y=38
clean = img[38:490, 78:420]
cv2.imwrite("scratch/clean_user_palm.jpg", clean)
print("Saved clean_user_palm.jpg:", clean.shape)
