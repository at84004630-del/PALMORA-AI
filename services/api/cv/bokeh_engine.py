import cv2
import numpy as np
import base64
from typing import Tuple

def generate_palm_bokeh_portrait(
    img: np.ndarray,
    blur_kernel_size: int = 65,
    feather_px: float = 22.0
) -> Tuple[np.ndarray, str]:
    """
    Renders an optical depth-of-field background bokeh while preserving
    100% bit-for-bit sharpness inside the hand contour.
    
    Guarantees:
      - Inside palm: alpha == 1.0 (zero blur kernel touches crease lines)
      - Perimeter: outward feathering over feather_px
      - Background: deep Gaussian bokeh
    Returns:
      (bokeh_img_bgr, base64_data_uri)
    """
    if img is None or img.size == 0:
        return img, ""
        
    h, w = img.shape[:2]
    
    # 1. Multi-space skin segmentation matching validator.py ensemble
    ycrcb = cv2.cvtColor(img, cv2.COLOR_BGR2YCrCb)
    Cr, Cb = ycrcb[:, :, 1], ycrcb[:, :, 2]
    mask_ycrcb = (Cr >= 130) & (Cr <= 180) & (Cb >= 75) & (Cb <= 135)
    
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    H, S, V = hsv[:, :, 0], hsv[:, :, 1], hsv[:, :, 2]
    mask_hsv = ((H <= 28) | (H >= 170)) & (S >= 25) & (S <= 245) & (V >= 35)
    
    R = img[:, :, 2].astype(np.float32)
    G = img[:, :, 1].astype(np.float32)
    B = img[:, :, 0].astype(np.float32)
    sum_rgb = R + G + B + 1e-4
    rn, gn = R / sum_rgb, G / sum_rgb
    mask_chrom = (rn >= 0.33) & (rn <= 0.65) & (gn >= 0.22) & (gn <= 0.40) & (R > B + 8.0)
    
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
    mask_lab = (lab[:, :, 0] >= 18) & (lab[:, :, 1] >= 127) & (lab[:, :, 1] <= 185) & (lab[:, :, 2] >= 118) & (lab[:, :, 2] <= 190)
    
    skin = (
        (mask_chrom & mask_ycrcb) |
        (mask_ycrcb & mask_hsv) |
        (mask_chrom & mask_hsv) |
        (mask_lab & mask_ycrcb) |
        (mask_lab & mask_chrom)
    )
    skin_mask = (skin.astype(np.uint8)) * 255
    k_size = max(15, min(w, h) // 25)
    if k_size % 2 == 0:
        k_size += 1
    kernel_close = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k_size, k_size))
    skin_mask = cv2.morphologyEx(skin_mask, cv2.MORPH_CLOSE, kernel_close, iterations=2)
    
    cnts, _ = cv2.findContours(skin_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not cnts:
        return img, ""
        
    largest_cnt = max(cnts, key=cv2.contourArea)
    total_area = float(w * h)
    if cv2.contourArea(largest_cnt) / total_area < 0.03:
        return img, ""
    
    hand_mask = np.zeros((h, w), dtype=np.uint8)
    cv2.drawContours(hand_mask, [largest_cnt], -1, 255, -1)
    
    # Fill internal holes (skin creases, shadows) inside the hand contour
    cnts_holes, _ = cv2.findContours(hand_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if cnts_holes:
        cv2.drawContours(hand_mask, cnts_holes, -1, 255, -1)
    
    # 2. Distance transform strictly outward from the hand perimeter
    # Inside hand: dist_outward == 0 -> alpha == 1.0 (zero blur)
    # Outside hand: dist_outward > 0 -> alpha transitions smoothly to 0.0
    dist_outward = cv2.distanceTransform(255 - hand_mask, cv2.DIST_L2, 5)
    alpha = np.clip(1.0 - (dist_outward / float(feather_px)), 0.0, 1.0).astype(np.float32)
    alpha_3ch = cv2.merge([alpha, alpha, alpha])
    
    # 3. High-radius optical background blur
    k_blur = blur_kernel_size if blur_kernel_size % 2 != 0 else blur_kernel_size + 1
    bg_blurred = cv2.GaussianBlur(img, (k_blur, k_blur), 0)
    
    # 4. Composite: sharp hand + blurred background
    bokeh_img = (img.astype(np.float32) * alpha_3ch + bg_blurred.astype(np.float32) * (1.0 - alpha_3ch))
    bokeh_bgr = np.clip(bokeh_img, 0, 255).astype(np.uint8)
    
    # 5. Encode as Base64 JPEG data URI for web and PDF rendering
    _, encoded = cv2.imencode('.jpg', bokeh_bgr, [int(cv2.IMWRITE_JPEG_QUALITY), 90])
    b64_str = 'data:image/jpeg;base64,' + base64.b64encode(encoded).decode('ascii')
    
    return bokeh_bgr, b64_str

