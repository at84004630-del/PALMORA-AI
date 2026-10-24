import sys
import os
import math
import cv2
import numpy as np

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from services.api.routers.palm import _process_palm_image
from services.api.readings.generator import (
    _check_head_life_origin,
    _synthesize_reading_title,
    _calculate_vertical_deflection
)
from scratch.reproducibility_audit import replace_white_background, apply_perturbation, PERTURBATIONS

def classify_pre_ae(features, hand_side):
    # Pre-Prompt A-E Hard Thresholds & logic
    h_feat = getattr(features, "heart_line", None)
    hd_feat = getattr(features, "head_line", None)
    l_feat = getattr(features, "life_line", None)
    f_feat = getattr(features, "fate_line", None)
    
    # Heart
    if not h_feat or h_feat.status in ("not_detected", "unsupported"):
        h_arch = "not_detected"
    elif h_feat.status == "uncertain":
        h_arch = "uncertain"
    else:
        m = h_feat.measurements or {}
        curv = float(m.get("curvature_index", 1.04))
        length = float(m.get("length_ratio", 0.52))
        p = h_feat.path or []
        ang = math.degrees(math.atan2(p[-1].y - p[0].y, p[-1].x - p[0].x)) if len(p) >= 2 else float(m.get("orientation_angle_deg", 0.0))
        max_up, _ = _calculate_vertical_deflection(p)
        if curv >= 1.09 or ang > 4.5 or max_up > 0.035:
            h_arch = "heart_curved_high_jupiter"
        elif length >= 0.65:
            h_arch = "heart_long_sweeping_percussion"
        elif curv >= 1.05 and length >= 0.48:
            h_arch = "heart_moderate_gentle"
        else:
            h_arch = "heart_straight_saturn"

    # Head
    if not hd_feat or hd_feat.status in ("not_detected", "unsupported"):
        hd_arch = "not_detected"
    elif hd_feat.status == "uncertain":
        hd_arch = "uncertain"
    else:
        m = hd_feat.measurements or {}
        curv = float(m.get("curvature_index", 1.04))
        length = float(m.get("length_ratio", 0.54))
        p = hd_feat.path or []
        ang = math.degrees(math.atan2(p[-1].y - p[0].y, p[-1].x - p[0].x)) if len(p) >= 2 else float(m.get("orientation_angle_deg", 0.0))
        _, max_down = _calculate_vertical_deflection(p)
        if curv >= 1.08 or ang < -7.0 or max_down > 0.035:
            hd_arch = "head_sloping_moon"
        elif length >= 0.65:
            hd_arch = "head_long_sweeping"
        elif curv >= 1.05 and length >= 0.50:
            hd_arch = "head_dual_creative_fork"
        elif length < 0.48:
            hd_arch = "head_compact_focused"
        else:
            hd_arch = "head_straight_horizontal"

    # Life
    if not l_feat or l_feat.status in ("not_detected", "unsupported"):
        l_arch = "not_detected"
    elif l_feat.status == "uncertain":
        l_arch = "uncertain"
    else:
        m = l_feat.measurements or {}
        curv = float(m.get("curvature_index", 1.08))
        length = float(m.get("length_ratio", 0.62))
        q = l_feat.quality_score if l_feat.quality_score is not None else 0.22
        prom = m.get("visual_prominence", "moderate")
        if curv >= 1.12 or length >= 0.68:
            l_arch = "life_wide_expansive"
        elif curv < 1.06 or length < 0.52:
            l_arch = "life_close_radial"
        elif length >= 0.65 and q >= 0.20:
            l_arch = "life_long_grounded"
        elif q < 0.16 or prom != "distinct":
            l_arch = "life_delicate_receptive"
        else:
            l_arch = "life_distinct_continuous"

    # Fate
    if not f_feat or f_feat.status in ("not_detected", "unsupported", "uncertain"):
        f_arch = "fate_absent_or_subtle"
    else:
        m = f_feat.measurements or {}
        p = f_feat.path or []
        ang = math.degrees(math.atan2(p[-1].y - p[0].y, p[-1].x - p[0].x)) if len(p) >= 2 else float(m.get("orientation_angle_deg", 90.0))
        if abs(ang) < 65.0:
            f_arch = "fate_origin_moon"
        else:
            f_arch = "fate_central_vertical"

    # Origin (binary threshold 0.055, no deadband)
    if not hd_feat or not l_feat or hd_feat.status != "detected" or l_feat.status != "detected":
        orig = "indeterminate"
    else:
        hp = hd_feat.path or []
        lp = l_feat.path or []
        if not hp or not lp:
            orig = "indeterminate"
        else:
            dist = math.hypot(hp[0].x - lp[0].x, hp[0].y - lp[0].y)
            orig = "joined" if dist < 0.055 else "separated"

    title = _synthesize_reading_title(h_arch, hd_arch, l_arch, f_arch, orig, hand_side, low_confidence_lines=None)
    return {
        "heart": h_arch,
        "head": hd_arch,
        "life": l_arch,
        "fate": f_arch,
        "origin": orig,
        "title": title
    }

def run_image(img_path):
    img = cv2.imread(img_path)
    img = replace_white_background(img)
    _, base_bytes = cv2.imencode(".jpg", img)

    # 1. Real Endpoint Baseline
    is_usable, quality, features, hand_side, roi_box, elapsed_ms = _process_palm_image(base_bytes)
    
    # Pre-AE Baseline
    pre_base = classify_pre_ae(features, hand_side)
    
    # Real Endpoint Archetypes
    post_base = {
        "heart": features.heart_line.measurements.get("ensemble_archetype", "not_detected") if features.heart_line else "not_detected",
        "head": features.head_line.measurements.get("ensemble_archetype", "not_detected") if features.head_line else "not_detected",
        "life": features.life_line.measurements.get("ensemble_archetype", "not_detected") if features.life_line else "not_detected",
        "fate": features.fate_line.measurements.get("ensemble_archetype", "not_detected") if features.fate_line else "not_detected",
    }
    origin_status, _ = _check_head_life_origin(features.head_line, features.life_line)
    post_base["origin"] = origin_status
    low_conf = {lk for lk in ["heart", "head", "life", "fate"] if getattr(features, f"{lk}_line") and getattr(features, f"{lk}_line").measurements.get("low_confidence")}
    post_base["title"] = _synthesize_reading_title(post_base["heart"], post_base["head"], post_base["life"], post_base["fate"], origin_status, hand_side, low_confidence_lines=low_conf)

    print(f"=== {os.path.basename(img_path)} ===")
    print(f"Pre-AE Base:  {pre_base['title']}")
    print(f"Post-AE Base: {post_base['title']}")
    print(f"Archetypes Pre-AE:  {pre_base}")
    print(f"Archetypes Post-AE: {post_base}")
    print(f"Low conf lines: {low_conf}")

if __name__ == "__main__":
    run_image(r"D:\benchmark_public\sample40\Hand_0000114.jpg")
