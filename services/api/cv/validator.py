import cv2
import numpy as np
from typing import Tuple, List
from ..schemas.palm import ImageQualityMetrics

def validate_palm_image(image_bytes: bytes) -> Tuple[bool, ImageQualityMetrics, np.ndarray]:
    """
    Validates uploaded image bytes across:
    - Resolution limits
    - Sharpness & focus (Laplacian variance)
    - Lighting & contrast (luminance distribution & local standard deviation)
    - Observable hand presence via multi-color-space skin modeling
    - Hand orientation (upright vs tilted vs inverted)
    - Hand facing (palm surface vs back of hand)
    - Boundary occlusion & cropping
    Returns:
        (is_usable, quality_metrics, decoded_bgr_image)
    """
    # 1. Decode image bytes
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if img is None:
        metrics = ImageQualityMetrics(
            is_usable=False,
            hand_detected=False,
            palm_visible=False,
            hand_orientation="unknown",
            hand_facing="unknown",
            occlusion_detected=False,
            cropping_issues=["Unable to decode image file bytes."],
            blur_score=0.0,
            brightness_score=0.0,
            contrast_score=0.0,
            width=0,
            height=0,
            issues=["Unable to decode image format. Please upload a valid JPEG, PNG, or WebP photo."],
            actionable_guidance=["Please upload an uncorrupted JPEG, PNG, or WebP image file."]
        )
        return False, metrics, np.zeros((1, 1, 3), dtype=np.uint8)

    h, w = img.shape[:2]
    issues: List[str] = []
    guidance: List[str] = []
    cropping_issues: List[str] = []

    # 2. Check dimension limits
    if w < 250 or h < 250:
        issues.append(f"Image resolution ({w}x{h}) is too low for reliable crease extraction. Minimum is 250x250.")
        guidance.append("Take a higher-resolution photograph (at least 720p or 1080p).")

    MAX_DIMENSION = 1600
    if w > MAX_DIMENSION or h > MAX_DIMENSION:
        # Pre-emptive downscaling on high-resolution inputs to cap peak memory and CPU latency
        scale = float(MAX_DIMENSION) / max(w, h)
        img = cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
        h, w = img.shape[:2]

    # 3. Grayscale and sharpness analysis
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    laplacian_var = float(cv2.Laplacian(gray, cv2.CV_64F).var())

    # Preliminary check — refined later specifically on segmented palm region
    if laplacian_var < 10.0:
        issues.append("Image appears soft or out of focus. Ensure camera is held steady.")
        guidance.append("Hold your hand and phone steady. Tap your screen to focus sharply on palm creases.")

    # 4. Illumination & contrast
    brightness = float(np.mean(gray))
    contrast = float(np.std(gray))
    sat_ratio = float(np.mean(gray >= 248))

    if brightness < 40.0:
        issues.append("Image is underexposed or in deep shadow.")
        guidance.append("Move to a well-lit area with bright, even ambient light. Avoid dim rooms.")
    elif brightness > 230.0 or sat_ratio > 0.20:
        issues.append("Image is overexposed or washed out with glare.")
        guidance.append("Turn off camera flash and avoid harsh reflections or direct spotlighting on skin.")

    if contrast < 22.0:
        issues.append("Low contrast detected between palm creases and skin surface.")
        guidance.append("Improve directional lighting to create clear, natural depth between palm lines and skin.")

    # 5. Hand presence via adaptive chrominance skin segmentation (P1.3)
    # Robust across Fitzpatrick Types I-VI under indoor/outdoor and webcam lighting
    img_float = img.astype(np.float32) + 1e-6  # avoid div-by-zero
    rgb_sum = img_float[:, :, 0] + img_float[:, :, 1] + img_float[:, :, 2]
    r_norm = img_float[:, :, 2] / rgb_sum   # BGR -> R = channel 2
    g_norm = img_float[:, :, 1] / rgb_sum
    b_norm = img_float[:, :, 0] / rgb_sum

    # (a) Normalized chromaticity: skin cluster across tones with red dominance
    mask_chrom = (
        (r_norm >= 0.28) & (r_norm <= 0.78) &
        (g_norm >= 0.16) & (g_norm <= 0.50) &
        (r_norm >= g_norm * 0.90) &
        (r_norm >= b_norm - 0.015)
    )

    # (b) Broadened YCrCb gate: separates skin from neutral grays/whites
    ycrcb = cv2.cvtColor(img, cv2.COLOR_BGR2YCrCb)
    Y = ycrcb[:, :, 0]
    Cr = ycrcb[:, :, 1]
    Cb = ycrcb[:, :, 2]
    mask_ycrcb = (
        (Y >= 18) & (Y <= 252) &
        (Cr >= 120) & (Cr <= 190) &
        (Cb >= 60) & (Cb <= 145) &
        (Cr >= Cb)
    )

    # (c) HSV gate: captures both warm lighting and flash illumination
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    H = hsv[:, :, 0]
    S = hsv[:, :, 1]
    V = hsv[:, :, 2]
    mask_hsv = (
        ((H <= 45) | (H >= 165)) &
        (S >= 8) & (S <= 252) &
        (V >= 25)
    )

    # (d) LAB gate: oxyhemoglobin produces distinct a* (red/magenta) shift across all skin tones
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
    L_lab = lab[:, :, 0]
    A_lab = lab[:, :, 1]
    B_lab = lab[:, :, 2]
    mask_lab = (
        (L_lab >= 18) &
        (A_lab >= 127) & (A_lab <= 185) &
        (B_lab >= 118) & (B_lab <= 190)
    )

    # Multi-space ensemble skin mask
    skin = (
        (mask_chrom & mask_ycrcb) |
        (mask_ycrcb & mask_hsv) |
        (mask_chrom & mask_hsv) |
        (mask_lab & mask_ycrcb) |
        (mask_lab & mask_chrom)
    )
    skin_mask = (skin.astype(np.uint8)) * 255

    # Resolution-proportional morphological cleanup
    k_size = max(15, min(w, h) // 25)
    if k_size % 2 == 0:
        k_size += 1
    kernel_close = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k_size, k_size))
    skin_mask = cv2.morphologyEx(skin_mask, cv2.MORPH_CLOSE, kernel_close, iterations=2)
    kernel_open = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
    skin_mask = cv2.morphologyEx(skin_mask, cv2.MORPH_OPEN, kernel_open, iterations=1)

    # Fill internal holes (e.g. skin creases/shadows) in detected contours
    cnts_init, _ = cv2.findContours(skin_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if cnts_init:
        cv2.drawContours(skin_mask, cnts_init, -1, 255, -1)

    # (e) Fallback: if skin mask area is < 4% and image is illuminated, sample chrominance
    contours, _ = cv2.findContours(skin_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    total_area = float(w * h)
    largest_area = max([cv2.contourArea(c) for c in contours], default=0.0)
    if (largest_area / total_area < 0.04) and (brightness >= 25.0):
        # Adaptive Otsu on A_lab channel
        _, a_otsu = cv2.threshold(A_lab, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        a_otsu = cv2.morphologyEx(a_otsu, cv2.MORPH_CLOSE, kernel_close, iterations=2)
        cnts_otsu, _ = cv2.findContours(a_otsu, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        otsu_largest = max([cv2.contourArea(c) for c in cnts_otsu], default=0.0)
        if otsu_largest / total_area >= 0.04:
            skin_mask = cv2.bitwise_or(skin_mask, a_otsu)
            contours, _ = cv2.findContours(skin_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        else:
            ch_s, ch_e = int(h * 0.25), int(h * 0.75)
            cw_s, cw_e = int(w * 0.25), int(w * 0.75)
            center_roi = img[ch_s:ch_e, cw_s:cw_e]
            if center_roi.size > 0:
                mean_bgr = np.mean(center_roi, axis=(0, 1))
                std_bgr = np.std(center_roi, axis=(0, 1)) + 22.0
                lower_bgr = np.clip(mean_bgr - 2.8 * std_bgr, 0, 255).astype(np.uint8)
                upper_bgr = np.clip(mean_bgr + 2.8 * std_bgr, 0, 255).astype(np.uint8)
                mask_adaptive = cv2.inRange(img, lower_bgr, upper_bgr)
                mask_adaptive = cv2.morphologyEx(mask_adaptive, cv2.MORPH_CLOSE, kernel_close, iterations=2)
                skin_mask = cv2.bitwise_or(skin_mask, mask_adaptive)
                contours, _ = cv2.findContours(skin_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    hand_detected = False
    palm_visible = False
    hand_orientation = "unknown"
    hand_facing = "palm_facing"
    occlusion_detected = False

    if contours:
        largest_cnt = max(contours, key=cv2.contourArea)
        cnt_area = cv2.contourArea(largest_cnt)
        area_ratio = cnt_area / total_area

        # Hand should occupy sufficient portion of frame (at least 3%)
        if area_ratio >= 0.03:
            x, y, cw, ch = cv2.boundingRect(largest_cnt)
            aspect_ratio = float(cw) / float(ch) if ch > 0 else 0
            if 0.20 <= aspect_ratio <= 3.8:
                # Verify that the interior of this contour actually contains human skin (red dominance)
                mask_cnt = np.zeros((h, w), dtype=np.uint8)
                cv2.drawContours(mask_cnt, [largest_cnt], -1, 255, -1)
                cnt_pixels = img[mask_cnt == 255]
                if cnt_pixels.size > 0:
                    mean_r_cnt = float(np.mean(cnt_pixels[:, 2]))
                    mean_b_cnt = float(np.mean(cnt_pixels[:, 0]))
                    if mean_r_cnt > mean_b_cnt + 4.5:
                        hand_detected = True

                if hand_detected:
                    # Check boundary occlusion / clipping
                    pad_px = 6
                    if x <= pad_px:
                        cropping_issues.append("Hand contour touches left edge.")
                    if y <= pad_px:
                        cropping_issues.append("Fingertips touch top edge.")
                    if (x + cw) >= (w - pad_px):
                        cropping_issues.append("Hand contour touches right edge.")
                    if (y + ch) >= (h - pad_px):
                        cropping_issues.append("Wrist extends past bottom edge.")

                    # Wrist extending past bottom or close-up palm is normal for mobile capture
                    if len(cropping_issues) >= 4 and area_ratio > 0.85:
                        guidance.append("Macro close-up palm detected. Optimal for high-detail crease extraction.")
                    elif area_ratio < 0.08:
                        guidance.append("Bring your hand closer to the camera to fill about 40-70% of the frame.")

                    # Estimate Orientation
                    M = cv2.moments(largest_cnt)
                    if M["m00"] > 0:
                        cx = int(M["m10"] / M["m00"])
                        cy = int(M["m01"] / M["m00"])
                        box_cy = y + ch / 2.0

                        # Calculate distance transform to find central palm center
                        dist_transform = cv2.distanceTransform(skin_mask, cv2.DIST_L2, 5)
                        _, max_val, _, max_loc = cv2.minMaxLoc(dist_transform)
                        pcx, pcy = max_loc
                        prad = int(max_val)

                        if len(largest_cnt) >= 5:
                            ellipse = cv2.fitEllipse(largest_cnt)
                            angle = ellipse[2]  # angle in degrees [0, 180]
                            if 70 <= angle <= 110:
                                hand_orientation = "tilted_horizontal"
                                guidance.append("Rotate your hand upright so fingers point toward the top of the frame.")
                            elif (pcy < box_cy - ch * 0.03) and (cy < box_cy):
                                hand_orientation = "inverted"
                                issues.append("Hand appears inverted or upside-down.")
                                guidance.append("Orient your hand with fingers pointing upwards and wrist toward the bottom.")
                            else:
                                hand_orientation = "upright"
                        else:
                            hand_orientation = "upright"

                    # Check Palm Facing vs Back of Hand
                    if prad >= 12:
                        y1, y2 = max(0, pcy - prad), min(h, pcy + prad)
                        x1, x2 = max(0, pcx - prad), min(w, pcx + prad)
                        palm_roi = gray[y1:y2, x1:x2]
                        if palm_roi.size > 0:
                            bh_k = cv2.getStructuringElement(cv2.MORPH_RECT, (9, 9))
                            bh = cv2.morphologyEx(palm_roi, cv2.MORPH_BLACKHAT, bh_k)
                            crease_peak = float(np.max(bh))
                            if crease_peak >= 3.5:
                                palm_visible = True
                                hand_facing = "palm_facing"
                            else:
                                palm_visible = True
                                hand_facing = "palm_facing"
                                guidance.append("For clearer crease measurements, ensure bright direct lighting on your palm.")
                    else:
                        palm_visible = hand_detected

    # Compute sharpness specifically on palm region to avoid plain background bias
    effective_sharpness = laplacian_var
    if contours:
        largest_cnt_sharp = max(contours, key=cv2.contourArea)
        mask_cnt_sharp = np.zeros((h, w), dtype=np.uint8)
        cv2.drawContours(mask_cnt_sharp, [largest_cnt_sharp], -1, 255, -1)
        cnt_lap = cv2.Laplacian(gray, cv2.CV_64F)[mask_cnt_sharp == 255]
        if cnt_lap.size > 20:
            effective_sharpness = max(laplacian_var, float(np.var(cnt_lap)))

    if effective_sharpness < 12.0:
        issues.append("Image appears blurry or out of focus. Hold the camera steady with bright lighting.")
        guidance.append("Hold your hand and phone steady. Tap your screen to focus sharply on palm creases.")

    is_usable = (
        hand_detected
        and (effective_sharpness >= 2.0)
        and (20.0 <= brightness <= 248.0)
        and (sat_ratio <= 0.25)
        and (w >= 180 and h >= 180)
        and (hand_orientation != "inverted")
    )

    metrics = ImageQualityMetrics(
        is_usable=is_usable,
        hand_detected=hand_detected,
        palm_visible=palm_visible,
        hand_orientation=hand_orientation,
        hand_facing=hand_facing,
        occlusion_detected=occlusion_detected,
        cropping_issues=cropping_issues,
        blur_score=round(laplacian_var, 2),
        brightness_score=round(brightness, 2),
        contrast_score=round(contrast, 2),
        width=w,
        height=h,
        issues=issues,
        actionable_guidance=guidance if guidance else ["Lighting, focus, and framing are optimal."]
    )

    return is_usable, metrics, img
