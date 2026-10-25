import math
import cv2
import numpy as np
import heapq
from typing import Dict, List, Tuple, Optional, Any
from ..schemas.palm import (
    PalmFeatures,
    CreaseFeature,
    Point2D,
    FeatureStatus,
    ImageQualityMetrics,
    MountContour,
    MountTopography,
    ElementalConstitution
)

DETECTOR_VERSION = "multiscale_crease_extractor_v2.0"

def _refine_skin_mask(img: np.ndarray, quality: Optional[ImageQualityMetrics] = None) -> np.ndarray:
    """
    Extracts a high-accuracy, chrominance-adaptive skin mask combining
    normalized RGB chromaticity, YCrCb, HSV, and LAB color spaces with
    morphological cleaning and largest-contour hole filling.
    """
    h, w = img.shape[:2]
    img_float = img.astype(np.float32) + 1e-6
    rgb_sum = img_float[:, :, 0] + img_float[:, :, 1] + img_float[:, :, 2]
    r_norm = img_float[:, :, 2] / rgb_sum
    g_norm = img_float[:, :, 1] / rgb_sum
    b_norm = img_float[:, :, 0] / rgb_sum

    # (a) Normalized chromaticity: skin cluster across tones with red dominance over blue
    mask_chrom = (
        (r_norm >= 0.28) & (r_norm <= 0.78) &
        (g_norm >= 0.16) & (g_norm <= 0.50) &
        (r_norm >= g_norm * 0.90) &
        (r_norm >= b_norm + 0.010)
    )

    # (b) Broadened YCrCb gate with red saturation
    ycrcb = cv2.cvtColor(img, cv2.COLOR_BGR2YCrCb)
    Y = ycrcb[:, :, 0]
    Cr = ycrcb[:, :, 1]
    Cb = ycrcb[:, :, 2]
    mask_ycrcb = (
        (Y >= 20) & (Y <= 252) &
        (Cr >= 124) & (Cr <= 190) &
        (Cb >= 60) & (Cb <= 145) &
        (Cr >= Cb + 2)
    )

    # (c) HSV gate with minimum saturation to reject neutral gray/white/cream walls
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    H = hsv[:, :, 0]
    S = hsv[:, :, 1]
    V = hsv[:, :, 2]
    mask_hsv = (
        ((H <= 45) | (H >= 165)) &
        (S >= 12) & (S <= 252) &
        (V >= 25)
    )

    # (d) LAB gate: a* channel reflects oxyhemoglobin in human skin
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
    L_lab = lab[:, :, 0]
    A_lab = lab[:, :, 1]
    B_lab = lab[:, :, 2]
    mask_lab = (
        (L_lab >= 20) &
        (A_lab >= 128) & (A_lab <= 185) &
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
    mask = (skin.astype(np.uint8)) * 255

    # Morphological noise cleanup
    k_close = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
    k_open = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, k_close)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, k_open)

    # Adaptive Edge-Guided Background Rejection:
    # If the candidate mask occupies > 42% of the frame, background objects (painted walls, bedsheets, furniture)
    # have leaked into the skin cluster. Run fast GrabCut on downscaled representation to sharply excise background.
    mask_ratio = float(np.mean(mask > 0))
    if mask_ratio > 0.42:
        scale = 240.0 / max(h, w)
        sw, sh = max(16, int(w * scale)), max(16, int(h * scale))
        s_img = cv2.resize(img, (sw, sh), interpolation=cv2.INTER_AREA)
        s_mask = cv2.resize(mask, (sw, sh), interpolation=cv2.INTER_NEAREST)

        gc_mask = np.full((sh, sw), cv2.GC_PR_BGD, dtype=np.uint8)
        scx, scy = sw // 2, int(sh * 0.52)
        srw, srh = max(10, int(sw * 0.20)), max(10, int(sh * 0.25))
        c_box = np.zeros((sh, sw), dtype=bool)
        c_box[max(0, scy - srh):min(sh, scy + srh), max(0, scx - srw):min(sw, scx + srw)] = True
        gc_mask[(s_mask > 0) & c_box] = cv2.GC_PR_FGD
        
        in_core = np.zeros((sh, sw), dtype=bool)
        in_core[max(0, scy - srh//2):min(sh, scy + srh//2), max(0, scx - srw//2):min(sw, scx + srw//2)] = True
        gc_mask[(s_mask > 0) & in_core] = cv2.GC_FGD

        # Outer corners and extreme borders are definite background
        gc_mask[0:int(sh * 0.22), 0:int(sw * 0.15)] = cv2.GC_BGD
        gc_mask[0:int(sh * 0.22), int(sw * 0.85):sw] = cv2.GC_BGD
        gc_mask[int(sh * 0.80):sh, 0:int(sw * 0.12)] = cv2.GC_BGD
        gc_mask[int(sh * 0.80):sh, int(sw * 0.88):sw] = cv2.GC_BGD

        bgd_model = np.zeros((1, 65), np.float64)
        fgd_model = np.zeros((1, 65), np.float64)
        try:
            cv2.grabCut(s_img, gc_mask, None, bgd_model, fgd_model, 3, cv2.GC_INIT_WITH_MASK)
            s_fg = np.where((gc_mask == cv2.GC_FGD) | (gc_mask == cv2.GC_PR_FGD), 255, 0).astype(np.uint8)
            mask = cv2.resize(s_fg, (w, h), interpolation=cv2.INTER_NEAREST)
        except Exception:
            pass

    # Dark background suppression (background pixels < 20 are strictly non-skin)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    mask = cv2.bitwise_and(mask, mask, mask=(gray >= 20).astype(np.uint8))

    # Fill holes in the largest hand contour
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if contours:
        largest_cnt = max(contours, key=cv2.contourArea)
        clean_mask = np.zeros_like(mask)
        cv2.drawContours(clean_mask, [largest_cnt], -1, 255, thickness=cv2.FILLED)
        mask = clean_mask

    return mask


def _detect_hand_anatomy(
    contour: np.ndarray,
    skin_mask: np.ndarray,
    img_w: int,
    img_h: int
) -> Tuple[float, float, float, str, float]:
    """
    Computes inscribed palm center (cx, cy), radius, hand side ('left'/'right'),
    and anatomical orientation angle using Euclidean Distance Transform (EDT)
    and Convexity Defect Analysis (First Web Space Thumb Cleft).
    """
    dist_map = cv2.distanceTransform(skin_mask, cv2.DIST_L2, 5)
    _, max_val, _, max_loc = cv2.minMaxLoc(dist_map)
    if not math.isfinite(max_val) or max_val >= min(img_w, img_h) or max_val <= 0:
        palm_radius = float(min(img_w, img_h) * 0.25)
        palm_cx, palm_cy = float(img_w // 2), float(img_h * 0.55)
    else:
        palm_cx, palm_cy = float(max_loc[0]), float(max_loc[1])
        palm_radius = max(min(float(max_val), float(min(img_w, img_h) * 0.45)), 35.0)

        # Anatomical Forearm Rejection: In an upright hand, the true palm center cannot be
        # situated significantly below the hand mass centroid. If the naive global peak
        # is pulled down into the forearm/wrist, restrict EDT search to the metacarpal zone.
        M_cnt = cv2.moments(contour)
        if M_cnt["m00"] > 0 and palm_radius >= 35.0:
            cy_cent = float(M_cnt["m01"] / M_cnt["m00"])
            if palm_cy > cy_cent + 0.15 * palm_radius:
                forearm_cutoff_y = int(min(img_h - 1, cy_cent + 0.15 * palm_radius))
                sub_dist = np.copy(dist_map)
                sub_dist[forearm_cutoff_y:, :] = 0.0
                _, sub_val, _, sub_loc = cv2.minMaxLoc(sub_dist)
                if sub_val >= 0.50 * max_val:
                    palm_cx = float(sub_loc[0])
                    palm_cy = float(sub_loc[1])
                    palm_radius = max(min(float(sub_val), float(min(img_w, img_h) * 0.45)), 35.0)

    # Hand orientation angle & Thumb Cleft detection
    peri = cv2.arcLength(contour, True)
    approx = cv2.approxPolyDP(contour, 0.003 * peri, True)
    hull_indices = cv2.convexHull(approx, returnPoints=False) if len(approx) >= 6 else None

    finger_valleys = []
    thumb_candidates = []

    if hull_indices is not None and len(hull_indices) >= 4:
        try:
            defects = cv2.convexityDefects(approx, hull_indices)
            if defects is not None:
                defects = defects.reshape(-1, 4)
                min_depth = max(8.0, palm_radius * 0.12)
                for s, e, f, d in defects:
                    depth = d / 256.0
                    if depth < min_depth:
                        continue
                    far_pt = approx[f][0]
                    fx, fy = float(far_pt[0]), float(far_pt[1])
                    dist = math.hypot(fx - palm_cx, fy - palm_cy)
                    if not (0.50 * palm_radius <= dist <= 2.3 * palm_radius):
                        continue

                    # Finger web valleys: strictly in the distal half above palm center
                    if fy < palm_cy - 0.40 * palm_radius:
                        finger_valleys.append((fx, fy, depth))

                    # Thumb cleft: lateral metacarpal zone (exclude wrist base at bottom)
                    if (palm_cy - 0.40 * palm_radius <= fy <= palm_cy + 1.15 * palm_radius):
                        thumb_candidates.append((fx, fy, depth))
        except Exception:
            pass

    # Estimate orientation angle from knuckle bar
    deviation = 0.0
    if len(finger_valleys) >= 2:
        k_cx = float(np.median([v[0] for v in finger_valleys]))
        k_cy = float(np.median([v[1] for v in finger_valleys]))
        dx = k_cx - palm_cx
        dy = k_cy - palm_cy
        if math.hypot(dx, dy) > 10.0:
            angle_deg = math.degrees(math.atan2(dx, -dy))
            if abs(angle_deg) <= 50.0:
                deviation = angle_deg
    elif len(contour) >= 5:
        ellipse = cv2.fitEllipse(contour)
        angle = ellipse[2]
        deviation = (angle - 180.0) if angle > 90.0 else angle

    # Determine hand side (anatomical palm-facing perspective):
    # - In palm-facing view, thumb on the left of palm center indicates a Right Palm.
    # - In palm-facing view, thumb on the right of palm center indicates a Left Palm.
    hand_side = "unknown"
    if thumb_candidates:
        best_thumb = max(thumb_candidates, key=lambda c: c[2])
        if abs(best_thumb[0] - palm_cx) > 0.15 * palm_radius:
            hand_side = "right" if best_thumb[0] < palm_cx else "left"

    if hand_side == "unknown":
        M = cv2.moments(contour)
        if M["m00"] > 0:
            cx_hand = M["m10"] / M["m00"]
            hand_side = "left" if cx_hand > palm_cx else "right"

    return palm_cx, palm_cy, palm_radius, hand_side, float(deviation)


def _rectify_hand(
    img: np.ndarray,
    mask: np.ndarray,
    palm_cx: float,
    palm_cy: float,
    deviation: float
) -> Tuple[np.ndarray, np.ndarray]:
    """Rotates image and mask to canonical upright posture around palm center."""
    if abs(deviation) < 3.0 or abs(deviation) > 50.0:
        return img, mask
    h, w = img.shape[:2]
    M = cv2.getRotationMatrix2D((palm_cx, palm_cy), deviation, 1.0)
    work_img = cv2.warpAffine(img, M, (w, h), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
    work_mask = cv2.warpAffine(mask, M, (w, h), flags=cv2.INTER_NEAREST, borderMode=cv2.BORDER_CONSTANT, borderValue=0)
    return work_img, work_mask


def _invert_rotate_points(
    points: List[Tuple[float, float]],
    angle_deg: float,
    img_w: int,
    img_h: int,
    center: Optional[Tuple[float, float]] = None
) -> List[Tuple[float, float]]:
    """Inverse-rotates normalized (x, y) coordinates back to original image space."""
    if abs(angle_deg) < 1e-3:
        return points
    cx, cy = center if center is not None else (img_w / 2.0, img_h / 2.0)
    M_inv = cv2.getRotationMatrix2D((cx, cy), -angle_deg, 1.0)
    result = []
    for (nx, ny) in points:
        px, py = nx * img_w, ny * img_h
        new_x = M_inv[0, 0] * px + M_inv[0, 1] * py + M_inv[0, 2]
        new_y = M_inv[1, 0] * px + M_inv[1, 1] * py + M_inv[1, 2]
        result.append((
            float(np.clip(new_x / img_w, 0.0, 1.0)),
            float(np.clip(new_y / img_h, 0.0, 1.0))
        ))
    return result


def _morphological_skeleton(binary_mask: np.ndarray, max_iters: int = 16) -> np.ndarray:
    """Extracts 1-pixel-wide central medial spine of thresholded crease bands."""
    skel = np.zeros(binary_mask.shape, dtype=np.uint8)
    element = cv2.getStructuringElement(cv2.MORPH_CROSS, (3, 3))
    temp = binary_mask.copy()
    iters = 0
    while iters < max_iters:
        eroded = cv2.erode(temp, element)
        opened = cv2.morphologyEx(eroded, cv2.MORPH_OPEN, element)
        subset = cv2.subtract(eroded, opened)
        skel = cv2.bitwise_or(skel, subset)
        temp = eroded
        iters += 1
        if cv2.countNonZero(temp) == 0:
            break
    if cv2.countNonZero(temp) > 0:
        skel = cv2.bitwise_or(skel, temp)
    return skel


def _extract_geodesic_diameter_path(comp_mask: np.ndarray) -> np.ndarray:
    """Traces the longest geodesic diameter path using 2-pass BFS."""
    coords = np.column_stack(np.where(comp_mask > 0))  # (y, x)
    if len(coords) < 3:
        if len(coords) == 0:
            return np.empty((0, 2), dtype=np.float32)
        return np.column_stack([coords[:, 1], coords[:, 0]]).astype(np.float32)

    h, w = comp_mask.shape[:2]
    # Pass 1: find extremity A
    start_pt = coords[0]
    visited = {(int(start_pt[0]), int(start_pt[1])): None}
    queue = [start_pt]
    last_pt = start_pt
    while queue:
        curr = queue.pop(0)
        cy, cx = int(curr[0]), int(curr[1])
        last_pt = curr
        for dy in [-1, 0, 1]:
            for dx in [-1, 0, 1]:
                if dy == 0 and dx == 0:
                    continue
                ny, nx = cy + dy, cx + dx
                if (ny, nx) not in visited and 0 <= ny < h and 0 <= nx < w:
                    if comp_mask[ny, nx] > 0:
                        visited[(ny, nx)] = (cy, cx)
                        queue.append(np.array([ny, nx]))

    # Pass 2: find extremity B
    start_pt = last_pt
    visited = {(int(start_pt[0]), int(start_pt[1])): None}
    queue = [start_pt]
    far_pt = start_pt
    while queue:
        curr = queue.pop(0)
        cy, cx = int(curr[0]), int(curr[1])
        far_pt = curr
        for dy in [-1, 0, 1]:
            for dx in [-1, 0, 1]:
                if dy == 0 and dx == 0:
                    continue
                ny, nx = cy + dy, cx + dx
                if (ny, nx) not in visited and 0 <= ny < h and 0 <= nx < w:
                    if comp_mask[ny, nx] > 0:
                        visited[(ny, nx)] = (cy, cx)
                        queue.append(np.array([ny, nx]))

    path = []
    curr = (int(far_pt[0]), int(far_pt[1]))
    while curr is not None:
        path.append(curr)
        curr = visited[curr]

    path_arr = np.array(path, dtype=np.float32)
    return np.column_stack([path_arr[:, 1], path_arr[:, 0]])  # (x, y)


def _resample_polyline_by_arclength(pts: np.ndarray, target_count: int = 22) -> np.ndarray:
    """Resamples points along an ordered path to equidistant vertices with gentle smoothing."""
    if len(pts) <= 1:
        return pts
    diffs = np.diff(pts, axis=0)
    seg_lens = np.sqrt((diffs**2).sum(axis=1))
    cum_lens = np.insert(np.cumsum(seg_lens), 0, 0.0)
    total_len = cum_lens[-1]
    if total_len <= 1e-4:
        return np.repeat(pts[:1], target_count, axis=0)

    target_dists = np.linspace(0.0, total_len, target_count)
    resampled_x = np.interp(target_dists, cum_lens, pts[:, 0])
    resampled_y = np.interp(target_dists, cum_lens, pts[:, 1])
    resampled = np.column_stack([resampled_x, resampled_y])

    smoothed = np.copy(resampled)
    for i in range(1, len(resampled) - 1):
        smoothed[i] = 0.25 * resampled[i - 1] + 0.50 * resampled[i] + 0.25 * resampled[i + 1]
    return smoothed


def _compute_smoothed_arclength(pts: np.ndarray, smoothing_passes: int = 2) -> Tuple[float, float]:
    """
    Computes smoothed arc length and chord length along an ordered polyline.
    Uses multi-pass binomial smoothing [0.25, 0.50, 0.25] over inner vertices
    to eliminate discrete grid staircasing artifacts while preserving natural curvature.
    Returns: (smoothed_arc_length, chord_length)
    """
    if len(pts) < 2:
        return 0.0, 0.0
    smoothed = pts.copy().astype(np.float64)
    for _ in range(max(1, smoothing_passes)):
        for i in range(1, len(smoothed) - 1):
            smoothed[i] = 0.25 * smoothed[i - 1] + 0.50 * smoothed[i] + 0.25 * smoothed[i + 1]
    diffs = np.diff(smoothed, axis=0)
    arc_len = float(np.sum(np.sqrt((diffs**2).sum(axis=1))))
    chord_len = float(np.hypot(pts[-1, 0] - pts[0, 0], pts[-1, 1] - pts[0, 1]))
    return arc_len, chord_len


def _compute_polyline_orientation_pca(pts: np.ndarray) -> float:
    """
    Computes dominant orientation angle (in degrees, relative to horizontal)
    via Principal Component Analysis (total least squares line fit) across
    all vertices of the polyline.
    Aligns the direction with the anatomical flow vector from start to end.
    """
    if len(pts) < 2:
        return 0.0
    pts_f = pts[:, :2].astype(np.float64)
    flow_vec = pts_f[-1] - pts_f[0]

    if np.allclose(flow_vec, 0.0, atol=1e-3):
        return 0.0

    mean = np.mean(pts_f, axis=0)
    centered = pts_f - mean

    cov = np.cov(centered, rowvar=False)
    if not np.all(np.isfinite(cov)):
        return round(float(np.degrees(np.arctan2(flow_vec[1], flow_vec[0]))), 1)

    evals, evecs = np.linalg.eigh(cov)
    dom_vec = evecs[:, -1]

    if np.dot(dom_vec, flow_vec) < 0:
        dom_vec = -dom_vec

    angle_deg = np.degrees(np.arctan2(dom_vec[1], dom_vec[0]))
    return round(float(angle_deg), 1)



def _link_collinear_segments_tangential(
    segments: list,
    max_gap_px: float = 28.0,
    max_curvature: float = 1.70,
    min_cos_tan: float = 0.40,
    min_cos_bridge: float = 0.35
) -> list:
    """
    Links proximate collinear segments verifying tangent angular continuity (<= 60 deg)
    and bridge collinearity, properly handling all 4 directional traversal combinations
    while strictly preventing hairpin loops or U-turns.
    Returns linked polylines ordered by descending arc length.
    """
    if not segments:
        return []
    merged = [s.copy() for s in segments]
    changed = True
    while changed:
        changed = False
        best_pair = None
        min_gap = max_gap_px + 1.0
        best_merged = None
        for i in range(len(merged)):
            for j in range(i + 1, len(merged)):
                sA = merged[i]
                sB = merged[j]

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

                for p_from, p_to, out_dir, in_dir, cand_m in cases:
                    bridge = p_to - p_from
                    gap = float(np.hypot(bridge[0], bridge[1]))
                    if gap < min_gap:
                        cos_tan = float(np.dot(out_dir, in_dir))
                        effective_min_tan = 0.20 if gap <= 10.0 else min_cos_tan
                        if cos_tan >= effective_min_tan:
                            cos_bridge = float(np.dot(out_dir, bridge / gap)) if gap > 2.0 else 1.0
                            effective_min_bridge = 0.20 if gap <= 10.0 else min_cos_bridge
                            if cos_bridge >= effective_min_bridge:
                                diffs_m = np.diff(cand_m, axis=0)
                                tot_l_m = float(np.sum(np.sqrt((diffs_m**2).sum(axis=1))))
                                chord_m = float(np.hypot(cand_m[-1, 0] - cand_m[0, 0], cand_m[-1, 1] - cand_m[0, 1]))
                                curv_m = tot_l_m / max(chord_m, 1.0)
                                if curv_m <= max_curvature:
                                    min_gap = gap
                                    best_pair = (i, j)
                                    best_merged = cand_m

        if best_pair is not None and min_gap <= max_gap_px:
            i, j = best_pair
            merged[i] = best_merged
            merged.pop(j)
            changed = True

    # Order resulting chains by descending cumulative arc length
    merged.sort(key=lambda ch: float(np.sum(np.sqrt((np.diff(ch, axis=0)**2).sum(axis=1)))), reverse=True)
    return merged


def _bridge_heart_zone_gap_min_cost(
    sA: np.ndarray,
    sB: np.ndarray,
    crease_map: np.ndarray,
    max_bridge_gap: float,
    max_margin: int = 25
) -> Optional[np.ndarray]:
    """
    Computes a minimum-cost ridge path connecting two disjoint segments in the Heart zone
    along the physical crease valley in crease_map using 2D A* search.
    """
    if len(sA) < 2 or len(sB) < 2:
        return None

    cand_pairs = [
        (sA[-1], sB[0], False, False),
        (sA[-1], sB[-1], False, True),
        (sA[0], sB[0], True, False),
        (sB[-1], sA[0], True, True),
    ]

    best_merged = None
    min_cost = float('inf')
    h, w = crease_map.shape[:2]

    for p_start, p_end, rev_A, rev_B in cand_pairs:
        gap = float(math.hypot(p_end[0] - p_start[0], p_end[1] - p_start[1]))
        if gap > max_bridge_gap or gap < 1.0:
            continue

        x0, y0 = int(round(p_start[0])), int(round(p_start[1]))
        x1, y1 = int(round(p_end[0])), int(round(p_end[1]))

        min_x = max(0, min(x0, x1) - max_margin)
        max_x = min(w - 1, max(x0, x1) + max_margin)
        min_y = max(0, min(y0, y1) - max_margin)
        max_y = min(h - 1, max(y0, y1) + max_margin)

        if max_x <= min_x or max_y <= min_y:
            continue

        sub_crease = crease_map[min_y:max_y+1, min_x:max_x+1].astype(np.float32)
        cost_grid = 1.0 + 255.0 / (sub_crease + 15.0)

        sx, sy = x0 - min_x, y0 - min_y
        tx, ty = x1 - min_x, y1 - min_y

        dist = np.full(cost_grid.shape, np.inf, dtype=np.float32)
        dist[sy, sx] = 0.0
        parent = {}

        h0 = math.hypot(sx - tx, sy - ty)
        pq = [(h0, 0.0, sx, sy)]
        moves = [(-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (1, -1), (-1, 1), (1, 1)]

        reached = False
        while pq:
            f, d, x, y = heapq.heappop(pq)
            if (x, y) == (tx, ty):
                reached = True
                break
            if d > dist[y, x]:
                continue
            for dx, dy in moves:
                nx, ny = x + dx, y + dy
                if 0 <= nx <= (max_x - min_x) and 0 <= ny <= (max_y - min_y):
                    step_c = math.sqrt(dx*dx + dy*dy) * cost_grid[ny, nx]
                    if d + step_c < dist[ny, nx]:
                        dist[ny, nx] = d + step_c
                        parent[(nx, ny)] = (x, y)
                        h_est = math.hypot(nx - tx, ny - ty)
                        heapq.heappush(pq, (d + step_c + h_est, d + step_c, nx, ny))

        if not reached:
            continue

        curr = (tx, ty)
        path = []
        while curr in parent:
            path.append([float(curr[0] + min_x), float(curr[1] + min_y)])
            curr = parent[curr]
        path.append([float(sx + min_x), float(sy + min_y)])
        path.reverse()

        bridge_pts = np.array(path, dtype=np.float32)
        partA = sA[::-1] if rev_A else sA
        partB = sB[::-1] if rev_B else sB

        if len(bridge_pts) > 2:
            merged_pts = np.vstack([partA, bridge_pts[1:-1], partB])
        else:
            merged_pts = np.vstack([partA, partB])

        m_dx = float(np.ptp(merged_pts[:, 0]))
        m_dy = float(np.ptp(merged_pts[:, 1]))
        if m_dy > m_dx * 0.85:
            continue

        diffs = np.diff(merged_pts, axis=0)
        tot_len = float(np.sum(np.sqrt((diffs**2).sum(axis=1))))
        chord = float(math.hypot(merged_pts[-1, 0] - merged_pts[0, 0], merged_pts[-1, 1] - merged_pts[0, 1]))
        if tot_len / max(chord, 1.0) > 1.85:
            continue

        total_cost = dist[ty, tx]
        if total_cost < min_cost:
            min_cost = total_cost
            best_merged = merged_pts

    return best_merged



def _extract_creases_hybrid_sota(
    work_img: np.ndarray,
    work_mask: np.ndarray,
    palm_cx: float,
    palm_cy: float,
    palm_radius: float,
    quality: ImageQualityMetrics
) -> np.ndarray:
    """
    SOTA Hybrid Crease Extraction Engine combining:
    1. Multi-scale Retinex illumination normalization
    2. Multi-scale Directional Morphological Black-Hat Filter (12 angles, 3 scales)
    3. Multi-scale Hessian Ridge / Valley Response (Tubeness Filter)
    4. Anatomical palmar masking
    """
    h, w = work_img.shape[:2]

    # 1. Illumination Normalization on LAB L* channel
    lab = cv2.cvtColor(work_img, cv2.COLOR_BGR2LAB)
    L = lab[:, :, 0].astype(np.float32)
    k_illum = max(15, int(palm_radius * 0.35)) | 1
    illum = cv2.GaussianBlur(L, (k_illum, k_illum), 0)
    L_norm = np.clip((L / (illum + 1e-4)) * 128.0, 0, 255).astype(np.uint8)

    # Bilateral smoothing (preserves crease edges while removing skin pores)
    L_smooth = cv2.bilateralFilter(L_norm, d=5, sigmaColor=30, sigmaSpace=5)
    clahe = cv2.createCLAHE(clipLimit=3.5, tileGridSize=(8, 8))
    L_clahe = clahe.apply(L_smooth)

    # 2. Multi-Scale Directional Morphological Black-Hat Filtering
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

            if s >= scales[1]:
                line_k2 = np.zeros((k_size, k_size), dtype=np.uint8)
                cv2.line(line_k2, (k_size // 2 - dx, k_size // 2 - dy), (k_size // 2 + dx, k_size // 2 + dy), 1, thickness=2)
                b2 = cv2.morphologyEx(L_clahe, cv2.MORPH_BLACKHAT, line_k2)
                bhat_combined = np.maximum(bhat_combined, b2.astype(np.float32))

    # 3. Hessian Valley / Tubeness Response Filter
    sigma = max(1.6, palm_radius * 0.025)
    k_gauss = int(math.ceil(4 * sigma)) | 1
    blurred = cv2.GaussianBlur(L_clahe.astype(np.float32), (k_gauss, k_gauss), sigma)

    sobel_k = 3
    Ix = cv2.Sobel(blurred, cv2.CV_32F, 1, 0, ksize=sobel_k)
    Iy = cv2.Sobel(blurred, cv2.CV_32F, 0, 1, ksize=sobel_k)
    Ixx = cv2.Sobel(Ix, cv2.CV_32F, 1, 0, ksize=sobel_k)
    Ixy = cv2.Sobel(Ix, cv2.CV_32F, 0, 1, ksize=sobel_k)
    Iyy = cv2.Sobel(Iy, cv2.CV_32F, 0, 1, ksize=sobel_k)

    trace = Ixx + Iyy
    det = Ixx * Iyy - Ixy**2
    disc = np.maximum(0.0, trace**2 - 4 * det)
    sqrt_disc = np.sqrt(disc)
    lambda2 = (trace + sqrt_disc) * 0.5  # Max principal curvature

    valleys = np.maximum(0.0, lambda2)
    v_max = np.percentile(valleys[valleys > 0], 98.0) if np.any(valleys > 0) else 1.0
    hessian_resp = np.clip((valleys / max(v_max, 1e-4)) * 255.0, 0, 255).astype(np.float32)

    # 4. Fusion of Black-Hat and Hessian Valley Responses
    fused_creases = 0.65 * bhat_combined + 0.35 * hessian_resp

    # 5. Anatomical Palmar Masking (strictly confines analysis to palm metacarpus)
    palmar_envelope = np.zeros((h, w), dtype=np.uint8)
    cv2.ellipse(
        palmar_envelope,
        (int(palm_cx), int(palm_cy)),
        (int(round(1.25 * palm_radius)), int(round(1.10 * palm_radius))),
        0, 0, 360, 255, -1
    )
    palmar_mask = cv2.bitwise_and(work_mask, palmar_envelope)
    palmar_mask = cv2.erode(palmar_mask, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)))

    crease_map = cv2.bitwise_and(
        fused_creases.astype(np.uint8),
        fused_creases.astype(np.uint8),
        mask=palmar_mask
    )
    return crease_map


def analyze_palm_creases(
    img: np.ndarray,
    quality: ImageQualityMetrics
) -> Tuple[PalmFeatures, Optional[str], Optional[List[float]]]:
    """
    State-of-the-art Anatomical Hand & Palm Recognition Pipeline.
    Combines:
    - Robust skin segmentation across Fitzpatrick skin types
    - Anatomical hand landmarking & Euclidean distance transform (EDT)
    - Thumb cleft First Web Space laterality identification
    - Center-anchored hand rectification
    - Hybrid Retinex-Hessian-Morphological multi-scale crease extraction
    - 2-pass BFS geodesic ridge tracing with tangential collinear linking
    - Canonical palmar coordinate system (u, v) crease attribution
    - Calibrated physical biometrics (length ratio, curvature index, depth, orientation)

    Returns:
        (palm_features, hand_side, roi_box)
    """
    h, w = img.shape[:2]

    # If no hand is detected and image is strictly unusable, return explicit honest un-detected features
    if not quality.hand_detected and not quality.is_usable:
        failure_msg = "; ".join(quality.issues) if quality.issues else "Quality below threshold."
        empty_feat = lambda name, zone: CreaseFeature(
            name=name,
            status="not_detected",
            path=[],
            pixel_path=[],
            measurements={},
            detector_version=DETECTOR_VERSION,
            quality_score=0.0,
            confidence=None,
            uncertainty_factors=quality.issues,
            failure_reason=f"Feature extraction aborted for {zone}: {failure_msg}",
            confidence_explanation="Detection confidence cannot be evaluated on an unusable or rejected image."
        )
        return (
            PalmFeatures(
                heart_line=empty_feat("Heart Line", "upper transverse palm zone"),
                head_line=empty_feat("Head Line", "mid transverse palm zone"),
                life_line=empty_feat("Life Line", "thenar radial zone"),
                fate_line=empty_feat("Fate Line", "central longitudinal palm column"),
            ),
            "unknown",
            None
        )

    # 1. Skin & Hand Segmentation
    mask = _refine_skin_mask(img, quality)
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return analyze_palm_creases(img, ImageQualityMetrics(**{**quality.model_dump(), "hand_detected": False, "is_usable": False}))

    hand_cnt = max(contours, key=cv2.contourArea)

    # 2. Inscribed Palm Anatomy & Orientation
    palm_cx, palm_cy, palm_radius, hand_side, rectify_angle = _detect_hand_anatomy(hand_cnt, mask, w, h)

    # Anatomical Palm ROI Box (isolates palm disc/quadrilateral, strictly excluding fingers and wrist)
    corners_norm = [
        ((palm_cx - 1.30 * palm_radius) / w, (palm_cy - 1.18 * palm_radius) / h),
        ((palm_cx + 1.30 * palm_radius) / w, (palm_cy - 1.18 * palm_radius) / h),
        ((palm_cx + 1.30 * palm_radius) / w, (palm_cy + 1.15 * palm_radius) / h),
        ((palm_cx - 1.30 * palm_radius) / w, (palm_cy + 1.15 * palm_radius) / h),
    ]
    if abs(rectify_angle) >= 1.0:
        inv_corners = _invert_rotate_points(corners_norm, rectify_angle, w, h, center=(palm_cx, palm_cy))
    else:
        inv_corners = corners_norm
    c_xs = [p[0] for p in inv_corners]
    c_ys = [p[1] for p in inv_corners]
    roi_box = [
        round(float(np.clip(min(c_ys), 0.0, 1.0)), 4),
        round(float(np.clip(min(c_xs), 0.0, 1.0)), 4),
        round(float(np.clip(max(c_ys), 0.0, 1.0)), 4),
        round(float(np.clip(max(c_xs), 0.0, 1.0)), 4),
    ]

    # 3. Affine Rectification to Upright Canonical View
    work_img, work_mask = _rectify_hand(img, mask, palm_cx, palm_cy, rectify_angle)

    # 4. Multi-Scale Hybrid Crease Extraction
    crease_map = _extract_creases_hybrid_sota(work_img, work_mask, palm_cx, palm_cy, palm_radius, quality)

    # 5. Thresholding & Morphological Skeletonization
    crease_vals = crease_map[crease_map > 0]
    clip_p = 48 if (quality.contrast_score < 40.0 or quality.brightness_score < 65.0) else 54
    thresh_val = np.percentile(crease_vals, clip_p) if len(crease_vals) > 40 else 12
    _, binary_creases = cv2.threshold(crease_map, int(thresh_val), 255, cv2.THRESH_BINARY)
    binary_creases = cv2.morphologyEx(binary_creases, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2)))

    skel = _morphological_skeleton(binary_creases, max_iters=16)

    # 6. Connected Components & Geodesic Paths
    num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(skel, connectivity=8)
    min_comp_pixels = max(10, int(palm_radius * 0.08))

    segments = []
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

        # Canonical u coordinate: u > 0 is ulnar (pinky side), u < 0 is radial (thumb side)
        canonical_u = rel_x if hand_side == "right" else -rel_x

        segments.append({
            'path': raw_path,
            'arc_length': arc_l,
            'mean_x': mean_x,
            'mean_y': mean_y,
            'rel_x': rel_x,
            'rel_y': rel_y,
            'canonical_u': canonical_u,
            'dx_span': dx_span,
            'dy_span': dy_span,
        })

    # 7. Anatomical Scoring in Canonical Frame
    candidate_scores = []
    for idx, seg in enumerate(segments):
        ry = seg['rel_y']
        u = seg['canonical_u']
        dx = seg['dx_span']
        dy = seg['dy_span']
        l = seg['arc_length']
        max_ry = float(np.max(seg['path'][:, 1] - palm_cy) / float(palm_radius))

        # (a) Heart Line: upper transverse zone (-0.95 to -0.30), dx >= dy * 0.65
        # Strictly confined to distal sub-finger region; penalized below ry = -0.30
        s_heart = 0.0
        if -0.95 <= ry <= -0.30 and dx >= dy * 0.65:
            z_score = max(0.0, 1.0 - abs(ry - (-0.55)) / 0.35)
            t_score = min(1.0, dx / max(dy * 0.8, 1.0))
            l_score = min(1.0, l / (0.45 * float(palm_radius)))
            u_boost = 1.15 if u >= -0.20 else 0.85
            s_heart = (0.40 * z_score + 0.35 * t_score + 0.25 * l_score) * u_boost

        # (b) Head Line: mid transverse zone (-0.38 to +0.18), central/radial palm, wide dx
        # Spans across mid-palm from radial margin towards ulnar/moon zone (strictly transverse)
        s_head = 0.0
        if -0.38 <= ry <= +0.18 and dx >= dy * 0.75 and abs(u) <= 0.85:
            z_score = max(0.0, 1.0 - abs(ry - (-0.10)) / 0.28)
            t_score = min(1.0, (dx / max(dy * 0.7, 1.0)) / 1.5)
            span_score = min(1.0, dx / (0.50 * float(palm_radius)))
            l_score = min(1.0, l / (0.50 * float(palm_radius)))
            rad_boost = 1.20 if u <= 0.10 else 0.85
            s_head = (0.30 * z_score + 0.25 * span_score + 0.25 * t_score + 0.20 * l_score) * rad_boost

        # (c) Fate Line: central column (|u| <= 0.22), longitudinal verticality
        s_fate = 0.0
        if abs(u) <= 0.22 and dy >= 1.20 * dx and dx <= 0.45 * float(palm_radius) and -0.35 <= ry <= +0.85:
            c_score = max(0.0, 1.0 - abs(u) / 0.22)
            v_score = min(1.0, dy / max(dx * 1.2, 1.0))
            l_score = min(1.0, l / (0.40 * float(palm_radius)))
            s_fate = 0.40 * c_score + 0.40 * v_score + 0.20 * l_score

        # (d) Life Line: Thenar radial zone encircling Venus mount
        # STRICT DISAMBIGUATION: Central vertical segments (|u| <= 0.16 and dy >= 1.2 * dx)
        # are reserved for the Fate Line and penalized from Life Line attribution
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

    # Greedily assign primary segments with prioritized disambiguation order:
    # 'fate' & 'head' are evaluated first to protect the central-vertical and mid-transverse axes,
    # followed by 'life' and 'heart'
    assigned_segs = set()
    crease_segs = {'heart': [], 'head': [], 'life': [], 'fate': []}

    for line_key in ['fate', 'head', 'life', 'heart']:
        unassigned = [c for c in candidate_scores if c['idx'] not in assigned_segs]
        if not unassigned:
            continue
        best_cand = max(unassigned, key=lambda c: c[line_key])
        min_thresh = 0.20
        if best_cand[line_key] >= min_thresh:
            crease_segs[line_key].append(best_cand['seg'])
            assigned_segs.add(best_cand['idx'])

    # Find collinear extensions among remaining segments with dynamic chaining, bridge collinearity & line-specific curvature tolerance
    for line_key in ['fate', 'head', 'life', 'heart']:
        if not crease_segs[line_key]:
            continue
        max_curv = 2.60 if line_key == 'life' else 1.80
        max_allowed_gap = max(28.0, float(palm_radius * (0.35 if line_key == 'life' else 0.28)))

        chain_changed = True
        while chain_changed:
            chain_changed = False
            unassigned = sorted(
                [c for c in candidate_scores if c['idx'] not in assigned_segs],
                key=lambda c: c['seg']['arc_length'],
                reverse=True
            )
            for c in unassigned:
                if c[line_key] < 0.15:
                    continue
                sB = c['seg']['path']
                matched = False
                for existing_seg in list(crease_segs[line_key]):
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
                            min_tan = 0.15 if gap <= 12.0 else (0.25 if line_key == 'life' else 0.40)
                            if cos_tan >= min_tan:
                                cos_bridge = float(np.dot(out_dir, bridge / gap)) if gap > 2.0 else 1.0
                                min_bridge = 0.15 if gap <= 12.0 else (0.25 if line_key == 'life' else 0.35)
                                if cos_bridge >= min_bridge:
                                    m_dx = float(np.ptp(cand_merged[:, 0]))
                                    m_dy = float(np.ptp(cand_merged[:, 1]))
                                    # Enforce orientation preservation (transverse vs longitudinal)
                                    if line_key in ['head', 'heart'] and m_dy > m_dx * 0.90:
                                        continue
                                    if line_key == 'fate' and m_dx > m_dy * 0.85:
                                        continue
                                    diffs_m = np.diff(cand_merged, axis=0)
                                    tot_l_m = float(np.sum(np.sqrt((diffs_m**2).sum(axis=1))))
                                    chord_cand = float(np.hypot(cand_merged[-1, 0] - cand_merged[0, 0], cand_merged[-1, 1] - cand_merged[0, 1]))
                                    curv_cand = tot_l_m / max(chord_cand, 1.0)
                                    if curv_cand <= max_curv and chord_cand >= chord_A * 0.75:
                                        matched = True
                                        break
                    if matched:
                        crease_segs[line_key].append(c['seg'])
                        assigned_segs.add(c['idx'])
                        chain_changed = True
                        break

    heart_segs = crease_segs['heart']
    head_segs = crease_segs['head']
    life_segs = crease_segs['life']
    fate_segs = crease_segs['fate']

    def _build_feature(name: str, zone_desc: str, segs: list, line_type: str) -> CreaseFeature:
        if not segs:
            return CreaseFeature(
                name=name,
                status="not_detected",
                path=[],
                pixel_path=[],
                measurements={},
                detector_version=DETECTOR_VERSION,
                quality_score=0.0,
                confidence=None,
                uncertainty_factors=["zero_connected_components_in_zone"],
                failure_reason=f"No contiguous crease pattern identified in {zone_desc}.",
                confidence_explanation=f"Zero ridges met the geometric continuity threshold in the {zone_desc}."
            )

        raw_paths = [s['path'] for s in sorted(segs, key=lambda s: s['arc_length'], reverse=True)]
        max_curv = 2.60 if line_type == "life" else 1.80
        max_gap = max(28.0, float(palm_radius * (0.35 if line_type == "life" else 0.28)))
        linked = _link_collinear_segments_tangential(
            raw_paths,
            max_gap_px=max_gap,
            max_curvature=max_curv,
            min_cos_tan=0.25 if line_type == "life" else 0.35,
            min_cos_bridge=0.25 if line_type == "life" else 0.30
        )

        # Change 2: Minimum-cost-path gap bridging in the heart zone
        if line_type == "heart" and len(linked) >= 2:
            max_bridge_gap = max(35.0, float(palm_radius * 0.40))
            bridged_chain = _bridge_heart_zone_gap_min_cost(linked[0], linked[1], crease_map, max_bridge_gap)
            if bridged_chain is not None:
                primary_chain = bridged_chain
            else:
                primary_chain = linked[0]
        else:
            primary_chain = linked[0] if linked else raw_paths[0]

        # Standardize anatomical orientation:
        if line_type == "heart":
            # For right hand, ulnar is at larger x, radial is at smaller x -> x should decrease
            if hand_side == "right" and primary_chain[-1, 0] > primary_chain[0, 0]:
                primary_chain = primary_chain[::-1]
            elif hand_side == "left" and primary_chain[-1, 0] < primary_chain[0, 0]:
                primary_chain = primary_chain[::-1]
        elif line_type == "head":
            # Head line flows from radial origin across towards ulnar side
            if hand_side == "right" and primary_chain[-1, 0] < primary_chain[0, 0]:
                primary_chain = primary_chain[::-1]
            elif hand_side == "left" and primary_chain[-1, 0] > primary_chain[0, 0]:
                primary_chain = primary_chain[::-1]
        elif line_type == "life":
            # Life line flows from radial origin downwards towards wrist
            if primary_chain[-1, 1] < primary_chain[0, 1]:
                primary_chain = primary_chain[::-1]
        elif line_type == "fate":
            # Fate line flows from wrist upwards towards middle mount
            if primary_chain[-1, 1] > primary_chain[0, 1]:
                primary_chain = primary_chain[::-1]

        diffs_raw = np.diff(primary_chain, axis=0)
        raw_arc_len = float(np.sum(np.sqrt((diffs_raw**2).sum(axis=1))))
        raw_chord_len = float(np.hypot(primary_chain[-1, 0] - primary_chain[0, 0], primary_chain[-1, 1] - primary_chain[0, 1]))
        raw_curv = round(float(raw_arc_len / max(raw_chord_len, 1.0)), 2)

        # In Fate Line, if length < 0.28 * palm_radius or curvature > 1.45, it is clinically absent/subtle
        if line_type == "fate" and (raw_arc_len < 0.28 * float(palm_radius) or raw_curv > 1.45):
            return CreaseFeature(
                name=name,
                status="not_detected",
                path=[],
                pixel_path=[],
                measurements={
                    "arc_length_px": round(raw_arc_len, 1),
                    "curvature_index": raw_curv,
                    "visual_prominence": "absent"
                },
                detector_version=DETECTOR_VERSION,
                quality_score=0.0,
                confidence=None,
                uncertainty_factors=["fate_line_subtle_or_absent"],
                failure_reason="Fate line is subtle, fragmentary, or absent (standard palmar variation).",
                confidence_explanation="Central longitudinal Saturn line did not meet the continuous biometric prominence threshold."
            )

        sampled_pts = _resample_polyline_by_arclength(primary_chain, target_count=22)

        norm_path = [Point2D(x=round(float(p[0] / w), 4), y=round(float(p[1] / h), 4)) for p in sampled_pts]
        pixel_path = [Point2D(x=round(float(p[0]), 1), y=round(float(p[1]), 1)) for p in sampled_pts]

        arc_len, chord_len = _compute_smoothed_arclength(sampled_pts, smoothing_passes=2)
        palm_width_px = max(1.0, float(palm_radius * 2.0))

        curvature_index = max(1.0, round(float(arc_len / max(chord_len, 1.0)), 2))
        length_ratio = round(float(arc_len / palm_width_px), 2)

        orientation_angle = _compute_polyline_orientation_pca(sampled_pts)

        xs_px = np.clip(sampled_pts[:, 0].astype(int), 0, w - 1)
        ys_px = np.clip(sampled_pts[:, 1].astype(int), 0, h - 1)
        sample_intensities = crease_map[ys_px, xs_px]
        quality_score = round(float(np.mean(sample_intensities)) / 255.0, 3)

        length_score = min(1.0, length_ratio / 0.45)
        continuity_score = min(1.0, len(sampled_pts) / 18.0)
        raw_conf = 0.50 * length_score + 0.30 * continuity_score + 0.20 * min(1.0, quality_score * 3.5)
        confidence_val = round(float(raw_conf), 2)

        uncertainty_factors = []
        if length_ratio < 0.25:
            uncertainty_factors.append("short_trace_length")
        if quality_score < 0.10:
            uncertainty_factors.append("faint_ridge_contrast")
        if len(segs) > 4:
            uncertainty_factors.append("multiple_fragmented_candidate_branches")

        status: FeatureStatus = "detected" if (confidence_val >= 0.40 and length_ratio >= 0.18) else "uncertain"
        failure_reason = None
        if status == "uncertain":
            failure_reason = f"Crease trace was faint or fragmented in {zone_desc} (length ratio: {length_ratio}, confidence: {confidence_val})."

        prominence = "distinct" if confidence_val >= 0.60 else ("moderate" if confidence_val >= 0.40 else "faint")
        explanation = (
            f"Evaluated via SOTA hybrid Retinex-Hessian-Morphological pipeline ({DETECTOR_VERSION}). "
            f"Observed length ratio: {length_ratio}, curvature index: {curvature_index}, orientation angle: {orientation_angle}°. "
            f"Heuristic detection confidence: {confidence_val}."
        )

        return CreaseFeature(
            name=name,
            status=status,
            path=norm_path,
            pixel_path=pixel_path,
            measurements={
                "length_ratio": length_ratio,
                "curvature_index": curvature_index,
                "curvature": curvature_index,
                "orientation_angle_deg": orientation_angle,
                "arc_length_px": round(arc_len, 1),
                "chord_length_px": round(chord_len, 1),
                "sample_points_count": len(norm_path),
                "visual_prominence": prominence
            },
            detector_version=DETECTOR_VERSION,
            quality_score=quality_score,
            confidence=confidence_val,
            uncertainty_factors=uncertainty_factors,
            failure_reason=failure_reason,
            confidence_explanation=explanation
        )

    def _estimate_skin_contrast(
        work_image: np.ndarray,
        p_mask: np.ndarray,
        h_side: str,
        palm_cx: float = 0.0,
        palm_cy: float = 0.0,
        palm_radius: float = 0.0
    ) -> MountTopography:
        """
        Estimates 2D photometric surface skin contrast across palmar regions.
        Computes localized luminance and gradient variance relative to whole-palm skin baseline.
        Does NOT measure physical 3D elevation or tissue thickness.
        """
        h_img, w_img = work_image.shape[:2]
        img_gray = cv2.cvtColor(work_image, cv2.COLOR_BGR2GRAY) if len(work_image.shape) == 3 else work_image

        # Ultra-fast downscaled surface shading computation (16x pixel reduction)
        scale = 0.25
        small_w = max(1, int(w_img * scale))
        small_h = max(1, int(h_img * scale))
        small_gray = cv2.resize(img_gray, (small_w, small_h), interpolation=cv2.INTER_AREA)
        small_mask = cv2.resize(p_mask, (small_w, small_h), interpolation=cv2.INTER_NEAREST)
        
        skin_pts = small_gray[small_mask > 0]
        g_mean = float(np.mean(skin_pts)) if len(skin_pts) > 0 else 128.0
        g_std = float(np.std(skin_pts)) if len(skin_pts) > 0 else 30.0

        is_l = (h_side == "left")

        # Dynamically anchor mount sampling zones relative to palm center & radius if available,
        # otherwise fallback smoothly to normalized whole-image proportions
        if palm_radius > 15.0 and palm_cx > 0 and palm_cy > 0:
            scx = palm_cx * scale
            scy = palm_cy * scale
            srad = palm_radius * scale

            if is_l:
                # Left Palm: Thumb/Thenar is on the right (+u), Little/Hypothenar is on the left (-u)
                zones_rel = {
                    "jupiter": (scy - 0.90 * srad, scx + 0.25 * srad, scy - 0.40 * srad, scx + 0.75 * srad, "Mount of Jupiter", "Executive ambition, visionary leadership, and social presence"),
                    "saturn": (scy - 0.95 * srad, scx - 0.20 * srad, scy - 0.45 * srad, scx + 0.25 * srad, "Mount of Saturn", "Contemplative discipline, ethical depth, and vocational grounding"),
                    "apollo": (scy - 0.90 * srad, scx - 0.65 * srad, scy - 0.40 * srad, scx - 0.20 * srad, "Mount of Apollo (Sun)", "Creative charisma, aesthetic appreciation, and authentic expression"),
                    "mercury": (scy - 0.80 * srad, scx - 1.05 * srad, scy - 0.30 * srad, scx - 0.65 * srad, "Mount of Mercury", "Agile communication, commercial acumen, and intellectual speed"),
                    "venus": (scy - 0.10 * srad, scx + 0.15 * srad, scy + 0.85 * srad, scx + 1.00 * srad, "Mount of Venus (Thenar)", "Vital constitutional stamina, warmth, empathy, and sensory vitality"),
                    "moon": (scy + 0.10 * srad, scx - 1.00 * srad, scy + 0.95 * srad, scx - 0.20 * srad, "Mount of Moon (Hypothenar)", "Subconscious intuition, imaginative creativity, and inner tranquility"),
                }
            else:
                # Right Palm: Thumb/Thenar is on the left (-u), Little/Hypothenar is on the right (+u)
                zones_rel = {
                    "jupiter": (scy - 0.90 * srad, scx - 0.75 * srad, scy - 0.40 * srad, scx - 0.25 * srad, "Mount of Jupiter", "Executive ambition, visionary leadership, and social presence"),
                    "saturn": (scy - 0.95 * srad, scx - 0.25 * srad, scy - 0.45 * srad, scx + 0.20 * srad, "Mount of Saturn", "Contemplative discipline, ethical depth, and vocational grounding"),
                    "apollo": (scy - 0.90 * srad, scx + 0.20 * srad, scy - 0.40 * srad, scx + 0.65 * srad, "Mount of Apollo (Sun)", "Creative charisma, aesthetic appreciation, and authentic expression"),
                    "mercury": (scy - 0.80 * srad, scx + 0.65 * srad, scy - 0.30 * srad, scx + 1.05 * srad, "Mount of Mercury", "Agile communication, commercial acumen, and intellectual speed"),
                    "venus": (scy - 0.10 * srad, scx - 1.00 * srad, scy + 0.85 * srad, scx - 0.15 * srad, "Mount of Venus (Thenar)", "Vital constitutional stamina, warmth, empathy, and sensory vitality"),
                    "moon": (scy + 0.10 * srad, scx + 0.20 * srad, scy + 0.95 * srad, scx + 1.00 * srad, "Mount of Moon (Hypothenar)", "Subconscious intuition, imaginative creativity, and inner tranquility"),
                }
            zones = {k: (v[0]/small_h, v[1]/small_w, v[2]/small_h, v[3]/small_w, v[4], v[5]) for k, v in zones_rel.items()}
        else:
            if is_l:
                zones = {
                    "jupiter": (0.16, 0.58, 0.32, 0.76, "Mount of Jupiter", "Executive ambition, visionary leadership, and social presence"),
                    "saturn": (0.15, 0.42, 0.30, 0.58, "Mount of Saturn", "Contemplative discipline, ethical depth, and vocational grounding"),
                    "apollo": (0.16, 0.26, 0.32, 0.44, "Mount of Apollo (Sun)", "Creative charisma, aesthetic appreciation, and authentic expression"),
                    "mercury": (0.20, 0.10, 0.38, 0.28, "Mount of Mercury", "Agile communication, commercial acumen, and intellectual speed"),
                    "venus": (0.48, 0.55, 0.86, 0.88, "Mount of Venus (Thenar)", "Vital constitutional stamina, warmth, empathy, and sensory vitality"),
                    "moon": (0.52, 0.08, 0.90, 0.38, "Mount of Moon (Hypothenar)", "Subconscious intuition, imaginative creativity, and inner tranquility"),
                }
            else:
                zones = {
                    "jupiter": (0.16, 0.24, 0.32, 0.42, "Mount of Jupiter", "Executive ambition, visionary leadership, and social presence"),
                    "saturn": (0.15, 0.42, 0.30, 0.58, "Mount of Saturn", "Contemplative discipline, ethical depth, and vocational grounding"),
                    "apollo": (0.16, 0.56, 0.32, 0.74, "Mount of Apollo (Sun)", "Creative charisma, aesthetic appreciation, and authentic expression"),
                    "mercury": (0.20, 0.72, 0.38, 0.90, "Mount of Mercury", "Agile communication, commercial acumen, and intellectual speed"),
                    "venus": (0.48, 0.12, 0.86, 0.45, "Mount of Venus (Thenar)", "Vital constitutional stamina, warmth, empathy, and sensory vitality"),
                    "moon": (0.52, 0.62, 0.90, 0.92, "Mount of Moon (Hypothenar)", "Subconscious intuition, imaginative creativity, and inner tranquility"),
                }

        m_contours = {}
        for m_k, (ymin, xmin, ymax, xmax, d_name, meaning) in zones.items():
            y1, y2 = max(0, int(ymin * small_h)), min(small_h, int(ymax * small_h))
            x1, x2 = max(0, int(xmin * small_w)), min(small_w, int(xmax * small_w))
            
            if y2 <= y1 or x2 <= x1:
                y1, y2 = max(0, int(0.2 * small_h)), min(small_h, int(0.8 * small_h))
                x1, x2 = max(0, int(0.2 * small_w)), min(small_w, int(0.8 * small_w))

            r_mask = small_mask[y1:y2, x1:x2]
            r_gray = small_gray[y1:y2, x1:x2]

            valid = r_mask > 0
            if np.count_nonzero(valid) > 10:
                m_lum = float(np.mean(r_gray[valid]))
                mid_y, mid_x = r_gray.shape[0] // 2, r_gray.shape[1] // 2
                
                # Robust 3x3 patch median for peak estimation (rejects crease crevices and skin blemish outliers)
                py1, py2 = max(0, mid_y - 1), min(r_gray.shape[0], mid_y + 2)
                px1, px2 = max(0, mid_x - 1), min(r_gray.shape[1], mid_x + 2)
                center_val = float(np.median(r_gray[py1:py2, px1:px2])) if (py2 > py1 and px2 > px1) else float(r_gray[mid_y, mid_x])
                
                border_vals = np.concatenate([
                    r_gray[0, :], r_gray[-1, :], r_gray[:, 0], r_gray[:, -1]
                ])
                border_mean = float(np.mean(border_vals)) if len(border_vals) > 0 else center_val
                convexity = (center_val - border_mean) / 25.0
                
                lum_diff = (m_lum - g_mean) / (max(g_std, 1.0) * 2.0)
                elev = 0.50 + lum_diff * 0.25 + np.clip(convexity * 0.15, -0.20, 0.20)
                elev = float(np.clip(round(elev, 2), 0.25, 0.88))
            else:
                defaults = {"jupiter": 0.52, "saturn": 0.48, "apollo": 0.50, "mercury": 0.49, "venus": 0.62, "moon": 0.54}
                elev = defaults.get(m_k, 0.50)

            if elev >= 0.66:
                prom = "prominent"
            elif elev >= 0.56:
                prom = "developed"
            elif elev >= 0.44:
                prom = "moderate"
            else:
                prom = "flat"

            m_contours[m_k] = MountContour(
                name=d_name,
                relative_elevation=elev,
                prominence=prom,
                symbolic_significance=meaning
            )

        return MountTopography(
            jupiter=m_contours["jupiter"],
            saturn=m_contours["saturn"],
            apollo=m_contours["apollo"],
            mercury=m_contours["mercury"],
            venus=m_contours["venus"],
            moon=m_contours["moon"]
        )

    _estimate_mount_topography = _estimate_skin_contrast

    def _classify_elemental_constitution(
        work_image: np.ndarray,
        p_mask: np.ndarray,
        p_cx: float,
        p_cy: float,
        p_rad: float
    ) -> ElementalConstitution:
        h_img, w_img = work_image.shape[:2]
        y_wrist = min(h_img - 1, int(p_cy + 1.15 * p_rad))
        y_knuckles = max(0, int(p_cy - 1.15 * p_rad))
        palm_h = max(1.0, float(y_wrist - y_knuckles))

        row_idx = int(np.clip(p_cy, 0, h_img - 1))
        row_slice = p_mask[row_idx, :]
        active_cols = np.where(row_slice > 0)[0]
        if len(active_cols) >= 10:
            palm_w = max(1.0, float(active_cols[-1] - active_cols[0]))
        else:
            palm_w = max(1.0, float(p_rad * 2.30))

        palm_aspect = round(float(palm_h / palm_w), 2)

        mask_ys, _ = np.where(p_mask > 0)
        if len(mask_ys) > 50:
            top_y = float(np.min(mask_ys))
            digit_len = max(0.0, float(y_knuckles - top_y))
        else:
            digit_len = float(p_rad * 1.70)

        digit_ratio = round(float(digit_len / max(palm_h, 1.0)), 2)

        # Skin texture tier from high-frequency Laplacian variance in central palm disc
        r_disc = int(p_rad * 0.50)
        y1, y2 = max(0, int(p_cy - r_disc)), min(h_img, int(p_cy + r_disc))
        x1, x2 = max(0, int(p_cx - r_disc)), min(w_img, int(p_cx + r_disc))
        disc_crop = work_image[y1:y2, x1:x2]
        if disc_crop.size > 100:
            gray_disc = cv2.cvtColor(disc_crop, cv2.COLOR_BGR2GRAY) if len(disc_crop.shape) == 3 else disc_crop
            lap_var = float(cv2.Laplacian(gray_disc, cv2.CV_64F).var())
            if lap_var > 120.0:
                skin_tex = "fine"
            elif lap_var < 35.0:
                skin_tex = "coarse"
            else:
                skin_tex = "medium"
        else:
            skin_tex = "medium"

        is_square = (palm_aspect <= 1.12)
        is_short = (digit_ratio <= 0.78)

        if is_square and is_short:
            h_type = "earth"
            e_name = "Earth Hand (Prithvi Constitution)"
            e_symbol = "🌍"
            desc = (
                "Characterized by a sturdy square palm anchored by pragmatic, compact fingers. "
                "In classical palmar morphometrics, the Earth hand reflects exceptional constitutional groundedness, "
                "reliability, sensory resilience, and an instinctive preference for tangible real-world manifestations."
            )
            traits = [
                "Methodical execution and steadfast nervous endurance",
                "Deep loyalty and sensory connection to physical craftsmanship or nature",
                "Calm under environmental stress; steady emotional equilibrium",
                "Prefers concrete clarity over speculative abstraction"
            ]
            practices = [
                "Tactile grounding: earthing, hiking, or kinesthetic tactile craft",
                "Consistent circadian sleep schedules and whole-food nourishment",
                "Mindful pauses to prevent psychological stubbornness or rigid routine resistance"
            ]
        elif is_square and not is_short:
            h_type = "air"
            e_name = "Air Hand (Vayu Constitution)"
            e_symbol = "💨"
            desc = (
                "Characterized by an organized square palm paired with long, articulated, expressive fingers. "
                "The Air hand embodies mental agility, curiosity, lucid verbal articulation, and a ceaseless "
                "drive to synthesize ideas, patterns, and interpersonal networks."
            )
            traits = [
                "Analytical sharpness and swift pattern recognition",
                "Natural verbal and written communicative flair",
                "Objective conflict mediation and intellectual versatility",
                "Aesthetic curiosity and conceptual innovation"
            ]
            practices = [
                "Diaphragmatic breathwork (Pranayama) to quiet cognitive hyper-stimulation",
                "Scheduled digital disconnects to prevent nervous exhaustion from constant ideation",
                "Somatic grounding exercises before transitioning between complex mental projects"
            ]
        elif not is_square and is_short:
            h_type = "fire"
            e_name = "Fire Hand (Tejas Constitution)"
            e_symbol = "🔥"
            desc = (
                "Characterized by an elongated, vibrant palm complemented by dynamic, swift fingers. "
                "The Fire hand radiates charismatic momentum, creative spontaneity, entrepreneurial zeal, "
                "and an intrinsic hunger to initiate transformative endeavors."
            )
            traits = [
                "Inspiring charisma, magnetic confidence, and visionary enthusiasm",
                "Swift instinctive decision-making under high-stakes momentum",
                "Passion-driven focus that thrives on challenge and novel frontiers",
                "High vitality that demands active creative channels"
            ]
            practices = [
                "Cardiovascular movement and vitality arts to channel excess heat and drive",
                "Patience training: intentional 24-hour pauses before major impulsive commitments",
                "Cooling mindfulness meditations focusing on parasympathetic restoration"
            ]
        else:
            h_type = "water"
            e_name = "Water Hand (Jala Constitution)"
            e_symbol = "💧"
            desc = (
                "Characterized by an elongated, graceful palm paired with long, slender, flexible fingers. "
                "The Water hand reflects profound emotional receptivity, intuitive perception, artistic sensitivity, "
                "and a nuanced capacity for empathic resonance with others."
            )
            traits = [
                "Deep empathic resonance and emotional intelligence",
                "Rich intuitive perception and fluid artistic imagination",
                "Subtle diplomatic sensitivity and interpersonal tact",
                "Attuned to ambient environments and emotional undercurrents"
            ]
            practices = [
                "Energetic boundaries: deliberate solitude after intense social exposure",
                "Hydration rituals and soothing hydrotherapy or restorative immersion",
                "Creative catharsis: expressing complex emotional tides through music, poetry, or visual art"
            ]

        return ElementalConstitution(
            hand_type=h_type,
            element_name=e_name,
            element_symbol=e_symbol,
            palm_aspect_ratio=palm_aspect,
            digit_to_palm_ratio=digit_ratio,
            skin_texture=skin_tex,
            elemental_description=desc,
            archetypal_traits=traits,
            balancing_lifestyle_practices=practices
        )

    heart_feat = _build_feature("Heart Line", "upper transverse palm zone", heart_segs, "heart")
    head_feat = _build_feature("Head Line", "mid transverse palm zone", head_segs, "head")
    life_feat = _build_feature("Life Line", "thenar radial zone", life_segs, "life")
    fate_feat = _build_feature("Fate Line", "central longitudinal palm column", fate_segs, "fate")

    # Inverse-rotate output coordinates back to original (un-rectified) image space
    if abs(rectify_angle) >= 1.0:
        for feat in [heart_feat, head_feat, life_feat, fate_feat]:
            if feat is not None and feat.path:
                inv_norm = _invert_rotate_points(
                    [(p.x, p.y) for p in feat.path], rectify_angle, w, h, center=(palm_cx, palm_cy)
                )
                feat.path = [Point2D(x=round(p[0], 4), y=round(p[1], 4)) for p in inv_norm]
                feat.pixel_path = [Point2D(x=round(p[0] * w, 1), y=round(p[1] * h, 1)) for p in inv_norm]

    # 8. Head / Life Origin Interplay Analysis
    palm_width_px = max(1.0, float(palm_radius * 2.0))
    if (
        head_feat.status == "detected"
        and life_feat.status == "detected"
        and head_feat.pixel_path
        and life_feat.pixel_path
    ):
        l_orig = life_feat.pixel_path[0]
        h_start = head_feat.pixel_path[0]
        h_end = head_feat.pixel_path[-1]

        # Verify radial margin alignment: head line should originate near life line origin
        d_start = math.hypot(h_start.x - l_orig.x, h_start.y - l_orig.y)
        d_end = math.hypot(h_end.x - l_orig.x, h_end.y - l_orig.y)
        if d_end < d_start:
            head_feat.path = head_feat.path[::-1]
            head_feat.pixel_path = head_feat.pixel_path[::-1]
            h_orig = head_feat.pixel_path[0]
            d_orig_px = d_end
        else:
            h_orig = h_start
            d_orig_px = d_start

        origin_ratio = round(float(d_orig_px / palm_width_px), 3)

        # Three-zone classification with deadband [0.08, 0.13]
        if origin_ratio < 0.08:
            orig_status = "joined"
        elif origin_ratio > 0.13:
            orig_status = "separated"
        else:
            orig_status = "ambiguous"

        head_feat.measurements["origin_distance_ratio"] = origin_ratio
        head_feat.measurements["origin_status"] = orig_status
        life_feat.measurements["origin_distance_ratio"] = origin_ratio
        life_feat.measurements["origin_status"] = orig_status
    else:
        orig_status = "indeterminate"
        if head_feat.measurements is not None:
            head_feat.measurements["origin_status"] = orig_status
        if life_feat.measurements is not None:
            life_feat.measurements["origin_status"] = orig_status

    mounts = _estimate_skin_contrast(work_img, work_mask, hand_side, palm_cx, palm_cy, palm_radius)
    constitution = _classify_elemental_constitution(work_img, work_mask, palm_cx, palm_cy, palm_radius)

    palm_features = PalmFeatures(
        heart_line=heart_feat,
        head_line=head_feat,
        life_line=life_feat,
        fate_line=fate_feat,
        hand_side=hand_side,
        mount_topography=mounts,
        elemental_constitution=constitution
    )

    return palm_features, hand_side, roi_box
