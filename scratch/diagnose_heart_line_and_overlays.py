import os
import sys
import glob
import cv2
import math
import numpy as np
from collections import Counter
from typing import Dict, List, Any, Tuple, Optional

# Add repository root to path
REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, REPO_ROOT)

from services.api.cv.validator import validate_palm_image
from services.api.cv.crease_analyzer import (
    analyze_palm_creases,
    _refine_skin_mask,
    _detect_hand_anatomy,
    _rectify_hand,
    _extract_creases_hybrid_sota,
    _morphological_skeleton,
    _extract_geodesic_diameter_path,
    _link_collinear_segments_tangential,
    _compute_smoothed_arclength,
    _compute_polyline_orientation_pca,
    _resample_polyline_by_arclength,
    _invert_rotate_points,
    DETECTOR_VERSION
)
from scratch.reproducibility_audit import replace_white_background

OVERLAY_DIR = os.path.join(REPO_ROOT, "scratch", "overlays")
os.makedirs(OVERLAY_DIR, exist_ok=True)

LINE_COLORS = {
    "heart": (0, 0, 255),       # Red
    "head":  (255, 140, 0),     # Azure / Sky Blue (BGR: B=255, G=140, R=0)
    "life":  (0, 220, 0),       # Green
    "fate":  (210, 0, 210),     # Magenta / Purple
}

def draw_overlay_on_original(
    orig_img: np.ndarray,
    features: Any,
    hand_side: str,
    roi_box: Optional[List[float]],
    fname: str
) -> str:
    overlay = orig_img.copy()
    h, w = overlay.shape[:2]

    # Draw ROI Box if available
    if roi_box and len(roi_box) == 4:
        ymin, xmin, ymax, xmax = roi_box
        pt1 = (int(xmin * w), int(ymin * h))
        pt2 = (int(xmax * w), int(ymax * h))
        cv2.rectangle(overlay, pt1, pt2, (80, 80, 80), 2, cv2.LINE_AA)

    # Draw Crease Lines
    line_order = ["life", "head", "fate", "heart"]  # draw heart on top
    for lk in line_order:
        feat = getattr(features, f"{lk}_line", None)
        if not feat or not feat.pixel_path:
            continue
        
        color = LINE_COLORS[lk]
        pts = np.array([[int(round(p.x)), int(round(p.y))] for p in feat.pixel_path], dtype=np.int32)
        if len(pts) >= 2:
            # Draw glow outline
            cv2.polylines(overlay, [pts], isClosed=False, color=(0, 0, 0), thickness=6, lineType=cv2.LINE_AA)
            # Draw core line (dashed style if uncertain)
            if feat.status == "uncertain":
                # Draw points and thin line
                cv2.polylines(overlay, [pts], isClosed=False, color=color, thickness=3, lineType=cv2.LINE_AA)
                for pt in pts[::3]:
                    cv2.circle(overlay, tuple(pt), 4, (255, 255, 255), -1, cv2.LINE_AA)
                    cv2.circle(overlay, tuple(pt), 4, color, 1, cv2.LINE_AA)
            else:
                cv2.polylines(overlay, [pts], isClosed=False, color=color, thickness=4, lineType=cv2.LINE_AA)
                for pt in [pts[0], pts[-1]]:
                    cv2.circle(overlay, tuple(pt), 6, color, -1, cv2.LINE_AA)
                    cv2.circle(overlay, tuple(pt), 2, (255, 255, 255), -1, cv2.LINE_AA)

    # Draw Legend Box
    leg_w, leg_h = 360, 195
    leg_x, leg_y = 20, 20
    # Background card
    sub_img = overlay[leg_y:leg_y+leg_h, leg_x:leg_x+leg_w]
    card = np.zeros_like(sub_img)
    cv2.rectangle(card, (0, 0), (leg_w, leg_h), (25, 25, 25), -1)
    cv2.addWeighted(sub_img, 0.25, card, 0.75, 0, sub_img)
    overlay[leg_y:leg_y+leg_h, leg_x:leg_x+leg_w] = sub_img
    cv2.rectangle(overlay, (leg_x, leg_y), (leg_x+leg_w, leg_y+leg_h), (120, 120, 120), 1, cv2.LINE_AA)

    # Legend text
    cv2.putText(overlay, f"{fname} ({hand_side.upper()} HAND)", (leg_x + 12, leg_y + 26),
                cv2.FONT_HERSHEY_SIMPLEX, 0.65, (255, 255, 255), 2, cv2.LINE_AA)

    y_off = leg_y + 58
    for lk in ["heart", "head", "life", "fate"]:
        feat = getattr(features, f"{lk}_line", None)
        stat = feat.status if feat else "not_detected"
        conf = feat.confidence if feat and feat.confidence is not None else 0.0
        meas = feat.measurements if feat and feat.measurements else {}
        l_ratio = meas.get("length_ratio", 0.0)
        
        # Color bar
        cv2.rectangle(overlay, (leg_x + 12, y_off - 12), (leg_x + 28, y_off + 4), LINE_COLORS[lk], -1)
        txt = f"{lk.capitalize():5s}: {stat:12s} (len={l_ratio:.2f}, conf={conf:.2f})"
        txt_color = (240, 240, 240) if stat == "detected" else ((220, 180, 100) if stat == "uncertain" else (140, 140, 140))
        cv2.putText(overlay, txt, (leg_x + 36, y_off), cv2.FONT_HERSHEY_SIMPLEX, 0.44, txt_color, 1, cv2.LINE_AA)
        y_off += 30

    out_path = os.path.join(OVERLAY_DIR, f"overlay_{fname.replace('.jpg', '.png')}")
    cv2.imwrite(out_path, overlay)
    return out_path

def trace_heart_line_failure(
    img: np.ndarray,
    quality: Any,
    fname: str
) -> Dict[str, Any]:
    """
    Traces intermediate stages for heart line extraction to pinpoint exactly
    where and why it was lost (not_detected) or downgraded (uncertain).
    """
    h, w = img.shape[:2]
    mask = _refine_skin_mask(img, quality)
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return {
            "failure_stage": "Skin segmentation",
            "reason": "No valid skin contour identified"
        }
    hand_cnt = max(contours, key=cv2.contourArea)
    palm_cx, palm_cy, palm_radius, hand_side, rectify_angle = _detect_hand_anatomy(hand_cnt, mask, w, h)
    work_img, work_mask = _rectify_hand(img, mask, palm_cx, palm_cy, rectify_angle)

    # Stage 1: Illumination & Black-Hat response
    # Compute LAB L_clahe & Black-Hat
    lab = cv2.cvtColor(work_img, cv2.COLOR_BGR2LAB)
    L = lab[:, :, 0].astype(np.float32)
    k_illum = max(15, int(palm_radius * 0.35)) | 1
    illum = cv2.GaussianBlur(L, (k_illum, k_illum), 0)
    L_norm = np.clip((L / (illum + 1e-4)) * 128.0, 0, 255).astype(np.uint8)
    L_smooth = cv2.bilateralFilter(L_norm, d=5, sigmaColor=30, sigmaSpace=5)
    clahe = cv2.createCLAHE(clipLimit=3.5, tileGridSize=(8, 8))
    L_clahe = clahe.apply(L_smooth)

    # Heart zone mask in rectified coordinate system:
    # Heart line is in the upper transverse region: rel_y in [-0.95, -0.30] relative to palm_cy
    y_min_heart = max(0, int(palm_cy - 0.95 * palm_radius))
    y_max_heart = min(h, int(palm_cy - 0.30 * palm_radius))
    x_min_palm = max(0, int(palm_cx - 1.25 * palm_radius))
    x_max_palm = min(w, int(palm_cx + 1.25 * palm_radius))

    heart_zone_mask = np.zeros((h, w), dtype=np.uint8)
    heart_zone_mask[y_min_heart:y_max_heart, x_min_palm:x_max_palm] = 1
    heart_zone_mask = cv2.bitwise_and(heart_zone_mask, work_mask)

    # 1. Black-Hat response
    bhat_combined = np.zeros_like(L_clahe, dtype=np.float32)
    angles = [0, 15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165]
    scales = [
        max(7, int(palm_radius * 0.10)),
        max(13, int(palm_radius * 0.18)),
        max(21, int(palm_radius * 0.28))
    ]
    for s in scales:
        k_size = s + 2
        for angle in angles:
            rad = np.deg2rad(angle)
            dx = int(np.round((s // 2) * np.cos(rad)))
            dy = int(np.round((s // 2) * np.sin(rad)))
            line_k = np.zeros((k_size, k_size), dtype=np.uint8)
            cv2.line(line_k, (k_size // 2 - dx, k_size // 2 - dy), (k_size // 2 + dx, k_size // 2 + dy), 1, thickness=1)
            b1 = cv2.morphologyEx(L_clahe, cv2.MORPH_BLACKHAT, line_k)
            bhat_combined = np.maximum(bhat_combined, b1.astype(np.float32))

    bhat_heart_pts = bhat_combined[heart_zone_mask > 0]
    bhat_max = float(np.max(bhat_heart_pts)) if len(bhat_heart_pts) > 0 else 0.0
    bhat_mean = float(np.mean(bhat_heart_pts)) if len(bhat_heart_pts) > 0 else 0.0
    bhat_p95 = float(np.percentile(bhat_heart_pts, 95)) if len(bhat_heart_pts) > 0 else 0.0

    # Full crease map
    crease_map = _extract_creases_hybrid_sota(work_img, work_mask, palm_cx, palm_cy, palm_radius, quality)
    crease_heart_pts = crease_map[heart_zone_mask > 0]
    crease_p95 = float(np.percentile(crease_heart_pts, 95)) if len(crease_heart_pts) > 0 else 0.0

    # Stage 2: Thresholding
    crease_vals = crease_map[crease_map > 0]
    clip_p = 48 if (quality.contrast_score < 40.0 or quality.brightness_score < 65.0) else 54
    thresh_val = np.percentile(crease_vals, clip_p) if len(crease_vals) > 40 else 12
    _, binary_creases = cv2.threshold(crease_map, int(thresh_val), 255, cv2.THRESH_BINARY)
    binary_creases_open = cv2.morphologyEx(binary_creases, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2)))
    bin_heart_px = int(np.count_nonzero(cv2.bitwise_and(binary_creases_open, binary_creases_open, mask=heart_zone_mask)))

    # Stage 3: Skeleton & Connected Components
    skel = _morphological_skeleton(binary_creases_open, max_iters=16)
    skel_heart_px = int(np.count_nonzero(cv2.bitwise_and(skel, skel, mask=heart_zone_mask)))

    num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(skel, connectivity=8)
    min_comp_pixels = max(10, int(palm_radius * 0.08))

    segments = []
    heart_zone_segments = []
    for i in range(1, num_labels):
        area = stats[i, cv2.CC_STAT_AREA]
        if area < min_comp_pixels:
            continue
        comp_mask = (labels == i).astype(np.uint8)
        raw_path = _extract_geodesic_diameter_path(comp_mask)
        if len(raw_path) < 3:
            continue
        diffs = np.diff(raw_path, axis=0)
        arc_l = float(np.sum(np.sqrt((diffs**2).sum(axis=1))))
        if arc_l < min_comp_pixels:
            continue

        xs = raw_path[:, 0]
        ys = raw_path[:, 1]
        mean_x = float(np.mean(xs))
        mean_y = float(np.mean(ys))
        rel_x = (mean_x - palm_cx) / float(palm_radius)
        rel_y = (mean_y - palm_cy) / float(palm_radius)
        dx_span = float(np.ptp(xs))
        dy_span = float(np.ptp(ys))
        canonical_u = rel_x if hand_side == "right" else -rel_x

        seg_info = {
            'idx': len(segments),
            'path': raw_path,
            'arc_length': arc_l,
            'mean_x': mean_x,
            'mean_y': mean_y,
            'rel_x': rel_x,
            'rel_y': rel_y,
            'canonical_u': canonical_u,
            'dx_span': dx_span,
            'dy_span': dy_span,
        }
        segments.append(seg_info)
        if -0.95 <= rel_y <= -0.30:
            heart_zone_segments.append(seg_info)

    # Stage 4 & 5: Candidate scoring & line-role assignment
    candidate_scores = []
    for idx, seg in enumerate(segments):
        ry = seg['rel_y']
        u = seg['canonical_u']
        dx = seg['dx_span']
        dy = seg['dy_span']
        l = seg['arc_length']

        s_heart = 0.0
        if -0.95 <= ry <= -0.30 and dx >= dy * 0.65:
            z_score = max(0.0, 1.0 - abs(ry - (-0.55)) / 0.35)
            t_score = min(1.0, dx / max(dy * 0.8, 1.0))
            l_score = min(1.0, l / (0.45 * float(palm_radius)))
            u_boost = 1.15 if u >= -0.20 else 0.85
            s_heart = (0.40 * z_score + 0.35 * t_score + 0.25 * l_score) * u_boost

        s_head = 0.0
        if -0.38 <= ry <= +0.18 and dx >= dy * 0.75 and abs(u) <= 0.85:
            z_score = max(0.0, 1.0 - abs(ry - (-0.10)) / 0.28)
            t_score = min(1.0, (dx / max(dy * 0.7, 1.0)) / 1.5)
            span_score = min(1.0, dx / (0.50 * float(palm_radius)))
            l_score = min(1.0, l / (0.50 * float(palm_radius)))
            rad_boost = 1.20 if u <= 0.10 else 0.85
            s_head = (0.30 * z_score + 0.25 * span_score + 0.25 * t_score + 0.20 * l_score) * rad_boost

        s_fate = 0.0
        if abs(u) <= 0.22 and dy >= 1.20 * dx and dx <= 0.45 * float(palm_radius) and -0.35 <= ry <= +0.85:
            c_score = max(0.0, 1.0 - abs(u) / 0.22)
            v_score = min(1.0, dy / max(dx * 1.2, 1.0))
            l_score = min(1.0, l / (0.40 * float(palm_radius)))
            s_fate = 0.40 * c_score + 0.40 * v_score + 0.20 * l_score

        s_life = 0.0
        is_central_vertical = (abs(u) <= 0.16 and dy >= 1.20 * dx)
        if not is_central_vertical and u <= -0.10 and -0.35 <= ry <= +1.15:
            u_score = max(0.0, 1.0 - abs(u - (-0.55)) / 0.55)
            z_score = max(0.0, 1.0 - abs(ry - 0.35) / 0.60)
            arc_shape_score = min(1.0, (dy + dx * 0.50) / (0.45 * float(palm_radius)))
            l_score = min(1.0, l / (0.40 * float(palm_radius)))
            s_life = 0.35 * u_score + 0.30 * z_score + 0.20 * arc_shape_score + 0.15 * l_score

        candidate_scores.append({
            'idx': idx,
            'seg': seg,
            'heart': s_heart,
            'head': s_head,
            'life': s_life,
            'fate': s_fate
        })

    # Greedy assignment
    assigned_segs = set()
    crease_segs = {'heart': [], 'head': [], 'life': [], 'fate': []}
    primary_assigned_roles = {}
    for line_key in ['fate', 'head', 'life', 'heart']:
        unassigned = [c for c in candidate_scores if c['idx'] not in assigned_segs]
        if not unassigned:
            continue
        best_cand = max(unassigned, key=lambda c: c[line_key])
        if best_cand[line_key] >= 0.20:
            crease_segs[line_key].append(best_cand['seg'])
            assigned_segs.add(best_cand['idx'])
            primary_assigned_roles[best_cand['idx']] = line_key

    # Check collinear linking for heart line
    heart_initial_segs = list(crease_segs['heart'])
    linked_segs_count = len(heart_initial_segs)
    
    # Run collinear linking step
    if crease_segs['heart']:
        max_curv = 1.80
        max_allowed_gap = max(28.0, float(palm_radius * 0.28))
        chain_changed = True
        while chain_changed:
            chain_changed = False
            unassigned = sorted(
                [c for c in candidate_scores if c['idx'] not in assigned_segs],
                key=lambda c: c['seg']['arc_length'],
                reverse=True
            )
            for c in unassigned:
                if c['heart'] < 0.15:
                    continue
                sB = c['seg']['path']
                matched = False
                for existing_seg in list(crease_segs['heart']):
                    sA = existing_seg['path']
                    vA_end = sA[-1] - sA[max(0, len(sA) - 3)]
                    vA_start = sA[0] - sA[min(2, len(sA) - 1)]
                    vB_start = sB[min(2, len(sB) - 1)] - sB[0]
                    vB_end = sB[max(0, len(sB) - 3)] - sB[-1]

                    nA_e = float(np.hypot(vA_end[0], vA_end[1])) + 1e-6
                    nA_s = float(np.hypot(vA_start[0], vA_start[1])) + 1e-6
                    nB_s = float(np.hypot(vB_start[0], vB_start[1])) + 1e-6
                    nB_e = float(np.hypot(vB_end[0], vB_end[1])) + 1e-6

                    uA_end = vA_end / nA_e
                    uA_start = vA_start / nA_s
                    uB_start = vB_start / nB_s
                    uB_end = vB_end / nB_e

                    cases = [
                        (sA[-1], sB[0], uA_end, uB_start, np.vstack([sA, sB])),
                        (sA[-1], sB[-1], uA_end, uB_end, np.vstack([sA, sB[::-1]])),
                        (sA[0], sB[0], uA_start, uB_start, np.vstack([sA[::-1], sB])),
                        (sB[-1], sA[0], -uB_end, -uA_start, np.vstack([sB, sA])),
                    ]
                    chord_A = float(np.hypot(sA[-1, 0] - sA[0, 0], sA[-1, 1] - sA[0, 1]))
                    for p_from, p_to, out_dir, in_dir, cand_merged in cases:
                        bridge = p_to - p_from
                        gap = float(np.hypot(bridge[0], bridge[1]))
                        if gap <= max_allowed_gap:
                            cos_tan = float(np.dot(out_dir, in_dir))
                            min_tan = 0.40
                            if cos_tan >= min_tan:
                                cos_bridge = float(np.dot(out_dir, bridge / gap)) if gap > 2.0 else 1.0
                                min_bridge = 0.35
                                if cos_bridge >= min_bridge:
                                    m_dx = float(np.ptp(cand_merged[:, 0]))
                                    m_dy = float(np.ptp(cand_merged[:, 1]))
                                    if m_dy > m_dx * 0.90:
                                        continue
                                    diffs_m = np.diff(cand_merged, axis=0)
                                    tot_l_m = float(np.sum(np.sqrt((diffs_m**2).sum(axis=1))))
                                    chord_cand = float(np.hypot(cand_merged[-1, 0] - cand_merged[0, 0], cand_merged[-1, 1] - cand_merged[0, 1]))
                                    curv_cand = tot_l_m / max(chord_cand, 1.0)
                                    if curv_cand <= max_curv and chord_cand >= chord_A * 0.75:
                                        matched = True
                                        break
                    if matched:
                        crease_segs['heart'].append(c['seg'])
                        assigned_segs.add(c['idx'])
                        chain_changed = True
                        break

    # Determine failure stage
    # Check 1: Black-Hat response
    if bhat_p95 < 8.0:
        return {
            "failure_stage": "Black-Hat response",
            "reason": f"Shallow/faint crease in upper transverse zone (Black-Hat 95th pct={bhat_p95:.1f} < 8.0)",
            "details": f"bhat_p95={bhat_p95:.1f}, crease_p95={crease_p95:.1f}"
        }

    # Check 2: Thresholding
    if bin_heart_px < 35:
        return {
            "failure_stage": "thresholding",
            "reason": f"Crease response extinguished by adaptive threshold (thresh={thresh_val:.1f}, surviving px={bin_heart_px} < 35)",
            "details": f"thresh={thresh_val:.1f}, bin_heart_px={bin_heart_px}"
        }

    # Check 3: Skeleton
    if skel_heart_px < 15 or len(heart_zone_segments) == 0:
        return {
            "failure_stage": "skeleton",
            "reason": f"Skeleton eroded or fragmented below minimum component threshold (min_comp_px={min_comp_pixels}, surviving segments=0)",
            "details": f"skel_px={skel_heart_px}, min_comp_px={min_comp_pixels}"
        }

    # Check 4: Line-role assignment (did any segment score >= 0.20 for heart?)
    heart_cands = [c for c in candidate_scores if -0.95 <= c['seg']['rel_y'] <= -0.30]
    best_heart_score = max([c['heart'] for c in candidate_scores]) if candidate_scores else 0.0

    if not crease_segs['heart']:
        # Was it preempted or below threshold?
        preempted = [c for c in heart_cands if c['idx'] in assigned_segs]
        if preempted:
            other_role = primary_assigned_roles.get(preempted[0]['idx'], 'other')
            return {
                "failure_stage": "line-role assignment",
                "reason": f"Candidate segment in heart zone was preemptively claimed by {other_role} line (greedy assignment order)",
                "details": f"best_heart_score={best_heart_score:.2f}, preempted_by={other_role}"
            }
        else:
            return {
                "failure_stage": "line-role assignment",
                "reason": f"No segment met anatomical heart-line criteria (best s_heart={best_heart_score:.2f} < 0.20, dx vs dy constraint)",
                "details": f"best_heart_score={best_heart_score:.2f}, candidate_count={len(heart_cands)}"
            }

    # If it reached here, heart segments were assigned, but status was "uncertain" or "not_detected"
    # Let's inspect collinear linking & confidence calculation
    final_segs = crease_segs['heart']
    raw_paths = [s['path'] for s in sorted(final_segs, key=lambda s: s['arc_length'], reverse=True)]
    max_gap = max(28.0, float(palm_radius * 0.28))
    linked = _link_collinear_segments_tangential(raw_paths, max_gap_px=max_gap, max_curvature=1.80)
    primary_chain = linked[0] if linked else raw_paths[0]
    sampled_pts = _resample_polyline_by_arclength(primary_chain, target_count=22)
    arc_len, chord_len = _compute_smoothed_arclength(sampled_pts, smoothing_passes=2)
    palm_width_px = max(1.0, float(palm_radius * 2.0))
    length_ratio = round(float(arc_len / palm_width_px), 2)

    xs_px = np.clip(sampled_pts[:, 0].astype(int), 0, w - 1)
    ys_px = np.clip(sampled_pts[:, 1].astype(int), 0, h - 1)
    sample_intensities = crease_map[ys_px, xs_px]
    quality_score = round(float(np.mean(sample_intensities)) / 255.0, 3)

    length_score = min(1.0, length_ratio / 0.45)
    continuity_score = min(1.0, len(sampled_pts) / 18.0)
    raw_conf = 0.50 * length_score + 0.30 * continuity_score + 0.20 * min(1.0, quality_score * 3.5)
    conf_val = round(float(raw_conf), 2)

    if len(heart_zone_segments) > 1 and len(final_segs) == 1:
        return {
            "failure_stage": "collinear linking",
            "reason": f"Collinear linking failed to bridge fragmented segments across sub-finger mounts (gap > {max_allowed_gap:.1f}px or curvature violation), leaving short trace (length_ratio={length_ratio:.2f} < 0.25)",
            "details": f"length_ratio={length_ratio:.2f}, conf={conf_val:.2f}, unlinked_fragments={len(heart_zone_segments)}"
        }

    return {
        "failure_stage": "line-role assignment",
        "reason": f"Assigned trace failed confidence/length gate for 'detected' status (length_ratio={length_ratio:.2f} [need >=0.18], conf={conf_val:.2f} [need >=0.40]) -> downgraded to 'uncertain'",
        "details": f"length_ratio={length_ratio:.2f}, conf={conf_val:.2f}, quality_score={quality_score:.2f}"
    }

def run_diagnostic():
    sample_folder = r"D:\benchmark_public\sample40"
    images = sorted(glob.glob(os.path.join(sample_folder, "*.jpg")))[:12]
    
    print(f"================================================================================")
    print(f"PALMORA AI CREASE DIAGNOSTIC & OVERLAY GENERATOR (FIRST 12 IMAGES)")
    print(f"================================================================================\n")

    results = []
    failure_causes = []

    for idx, img_path in enumerate(images, 1):
        fname = os.path.basename(img_path)
        img = cv2.imread(img_path)
        if img is None:
            print(f"Skipping {fname}: Cannot read")
            continue

        # Benchmark mode background normalization
        norm_img = replace_white_background(img)
        _, enc = cv2.imencode(".jpg", norm_img)
        is_usable, quality, decoded_img = validate_palm_image(enc.tobytes())
        
        if not is_usable or decoded_img is None:
            print(f"{idx:2d}. {fname}: REJECTED by validator: {quality.issues}")
            continue

        features, hand_side, roi_box = analyze_palm_creases(decoded_img, quality)
        
        # Save overlay PNG on ORIGINAL image
        overlay_path = draw_overlay_on_original(img, features, hand_side, roi_box, fname)

        heart_status = features.heart_line.status if features.heart_line else "not_detected"
        head_status = features.head_line.status if features.head_line else "not_detected"
        life_status = features.life_line.status if features.life_line else "not_detected"
        fate_status = features.fate_line.status if features.fate_line else "not_detected"

        print(f"{idx:2d}. {fname} | Hand: {hand_side:5s} | Heart: {heart_status:12s} | Head: {head_status:12s} | Life: {life_status:12s} | Fate: {fate_status:12s}")
        print(f"    Saved Overlay: {os.path.basename(overlay_path)}")

        diag = None
        if heart_status in ("not_detected", "uncertain"):
            diag = trace_heart_line_failure(norm_img, quality, fname)
            print(f"    [Heart Line Loss Point] Stage: <{diag['failure_stage']}>")
            print(f"      Reason: {diag['reason']}")
            failure_causes.append((diag['failure_stage'], diag['reason']))
        else:
            print(f"    [Heart Line Confidently Detected]")

        print()
        results.append({
            "idx": idx,
            "image": fname,
            "hand_side": hand_side,
            "heart_status": heart_status,
            "head_status": head_status,
            "life_status": life_status,
            "fate_status": fate_status,
            "overlay_path": overlay_path,
            "diag": diag
        })

    # Summary of Top 3 Failure Causes
    print("=" * 80)
    print("SUMMARY OF HEART LINE FAILURE STAGES (not_detected / uncertain)")
    print("=" * 80)
    stage_counts = Counter([c[0] for c in failure_causes])
    for stage, cnt in stage_counts.most_common():
        print(f"  Stage <{stage}>: {cnt} occurrences")
    
    print("\nTOP FAILURE ROOT CAUSES:")
    reason_counts = Counter([c[1] for c in failure_causes])
    for rank, (reason, cnt) in enumerate(reason_counts.most_common(5), 1):
        print(f"  {rank}. [{cnt}x] {reason}")

if __name__ == "__main__":
    run_diagnostic()
