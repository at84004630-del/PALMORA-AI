import cv2
clean = cv2.imread("scratch/clean_user_palm.jpg")
clean = clean[:, 25:]
cv2.imwrite("scratch/clean_user_palm.jpg", clean)
print("Trimmed:", clean.shape)
