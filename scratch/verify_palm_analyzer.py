import os
import sys
sys.path.insert(0, os.path.abspath("."))

import cv2
import numpy as np
import json
from services.api.cv.validator import validate_palm_image
from services.api.cv.crease_analyzer import analyze_palm_creases, DETECTOR_VERSION

def test_image_pipeline(img_path: str, output_vis_path: str):
    print("=" * 70)
    print(f"ANALYZING REAL PALM IMAGE: {img_path}")
    print("=" * 70)

    if not os.path.exists(img_path):
        print(f"ERROR: Image not found at {img_path}")
        return

    with open(img_path, "rb") as f:
        img_bytes = f.read()

    # 1. Quality & Pre-flight Validation
    is_valid, quality, img_bgr = validate_palm_image(img_bytes)
    print(f"\n--- 1. IMAGE QUALITY METRICS ---")
    print(f"  Is Usable:           {quality.is_usable}")
    print(f"  Hand Detected:       {quality.hand_detected}")
    print(f"  Palm Disc Discernible:{quality.palm_visible}")
    print(f"  Orientation:         {quality.hand_orientation}")
    print(f"  Facing:              {quality.hand_facing}")
    print(f"  Sharpness (Blur):    {quality.blur_score:.1f} (Threshold >= 20.0)")
    print(f"  Mean Brightness:     {quality.brightness_score:.1f} [0-255]")
    print(f"  Contrast StdDev:     {quality.contrast_score:.1f}")
    print(f"  Issues / Warnings:   {quality.issues}")
    print(f"  Actionable Guidance: {quality.actionable_guidance}")

    # 2. Crease Feature & Anatomy Extraction
    features, hand_side, roi_box = analyze_palm_creases(img_bgr, quality)
    h, w = img_bgr.shape[:2]

    print(f"\n--- 2. ANATOMICAL SEGMENTATION & LATERALITY ---")
    print(f"  Detected Hand Side:  {hand_side.upper()}")
    print(f"  Palmar ROI Box:      {roi_box} [ymin, xmin, ymax, xmax]")

    print(f"\n--- 3. DETECTED FLEXION CREASES ---")
    for line_name, feat in [
        ("Heart Line", features.heart_line),
        ("Head Line", features.head_line),
        ("Life Line", features.life_line),
        ("Fate Line", features.fate_line),
    ]:
        if feat:
            m = feat.measurements
            pts_count = len(feat.path)
            print(f"  [{feat.name.upper()}] Status: {feat.status} | Confidence: {feat.confidence}")
            print(f"    - Arc Length:      {m.get('arc_length_px', 'N/A')} px (Ratio: {m.get('length_ratio', 'N/A')})")
            print(f"    - Curvature Index: {m.get('curvature_index', 'N/A')} (Linear=1.00, Higher=Curved)")
            print(f"    - Sample Points:   {pts_count} normalized control points")
            print(f"    - Prominence:      {m.get('visual_prominence', 'N/A')}")
            if feat.failure_reason:
                print(f"    - Note/Reason:     {feat.failure_reason}")

    print(f"\n--- 4. PHOTOMETRIC MOUNT TOPOGRAPHY ---")
    if features.mount_topography:
        mt = features.mount_topography
        print(f"  Jupiter (Social/Vision):    Elevation={mt.jupiter.relative_elevation:.2f} [{mt.jupiter.prominence}]")
        print(f"  Saturn (Focus/Contemplation):Elevation={mt.saturn.relative_elevation:.2f} [{mt.saturn.prominence}]")
        print(f"  Apollo (Sun/Creativity):    Elevation={mt.apollo.relative_elevation:.2f} [{mt.apollo.prominence}]")
        print(f"  Mercury (Expression/Intellect):Elevation={mt.mercury.relative_elevation:.2f} [{mt.mercury.prominence}]")
        print(f"  Venus (Thenar Vitality):    Elevation={mt.venus.relative_elevation:.2f} [{mt.venus.prominence}]")
        print(f"  Moon (Hypothenar Intuition):Elevation={mt.moon.relative_elevation:.2f} [{mt.moon.prominence}]")

    print(f"\n--- 5. ELEMENTAL CONSTITUTION & DERMATOGLYPHICS ---")
    if features.elemental_constitution:
        ec = features.elemental_constitution
        print(f"  Hand Type:           {ec.hand_type.upper()} ({ec.element_symbol} {ec.element_name})")
        print(f"  Palm Aspect Ratio:   {ec.palm_aspect_ratio:.2f} (L_palm / W_palm)")
        print(f"  Digit-to-Palm Ratio: {ec.digit_to_palm_ratio:.2f} (L_digits / L_palm)")
        print(f"  Skin Texture Tier:   {ec.skin_texture.upper()}")
        print(f"  Traits Count:        {len(ec.archetypal_traits)} traits identified")
        print(f"  Practices Count:     {len(ec.balancing_lifestyle_practices)} balancing practices")

    # 6. Render Full Visual Verification Image
    vis = img_bgr.copy()

    # Draw ROI Box
    if roi_box:
        ymin, xmin, ymax, xmax = [int(roi_box[0]*h), int(roi_box[1]*w), int(roi_box[2]*h), int(roi_box[3]*w)]
        cv2.rectangle(vis, (xmin, ymin), (xmax, ymax), (200, 170, 110), 2)
        cv2.putText(vis, "Palmar ROI Disc", (xmin, max(20, ymin - 8)), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (200, 170, 110), 1, cv2.LINE_AA)

    # Colors for lines (BGR)
    line_colors = {
        "Heart Line": (255, 100, 150),  # Rose/Pink
        "Head Line": (100, 220, 255),   # Cyan
        "Life Line": (100, 255, 150),   # Emerald
        "Fate Line": (220, 150, 255),   # Violet
    }

    for l_name, feat in [
        ("Heart Line", features.heart_line),
        ("Head Line", features.head_line),
        ("Life Line", features.life_line),
        ("Fate Line", features.fate_line),
    ]:
        if feat and feat.path and feat.status in ["detected", "uncertain"]:
            color = line_colors.get(l_name, (0, 255, 255))
            pts = [(int(p.x * w), int(p.y * h)) for p in feat.path]
            for i in range(len(pts) - 1):
                cv2.line(vis, pts[i], pts[i+1], color, 3, cv2.LINE_AA)
            for p in pts:
                cv2.circle(vis, p, 3, (255, 255, 255), -1)

            # Label near start point
            if pts:
                cv2.putText(vis, f"{l_name} ({feat.confidence})", (pts[0][0] + 5, pts[0][1] - 5),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.45, color, 1, cv2.LINE_AA)

    # Save visualization
    cv2.imwrite(output_vis_path, vis)
    print(f"\nSaved detailed verification visualization to: {output_vis_path}")

if __name__ == "__main__":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

    test_image_pipeline("scratch/real_palm_test.jpg", "scratch/real_palm_verification_annotated.jpg")
    print("\n" + "#" * 70 + "\n")
    test_image_pipeline("apps/web/public/test_palm_sample.jpg", "scratch/test_palm_sample_annotated.jpg")
    print("\n" + "#" * 70 + "\n")
    if os.path.exists("scratch/actual_user_upload.jpg"):
        test_image_pipeline("scratch/actual_user_upload.jpg", "scratch/actual_user_annotated.jpg")
