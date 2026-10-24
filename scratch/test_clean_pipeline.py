import sys
sys.path.insert(0, '.')
import cv2
import numpy as np
import math
from services.api.cv.validator import validate_palm_image
from services.api.cv.crease_analyzer import (
    _morphological_skeleton, _extract_geodesic_diameter_path,
    _resample_polyline_by_arclength, _link_collinear_segments_tangential,
    _rectify_hand, _invert_rotate_points, _extract_creases_hybrid_sota
)

def refine_skin_mask_expert(img: np.ndarray) -> np.ndarray:
    h, w = img.shape[:2]
    img_float = img.astype(np.float32) + 1e-6
    rgb_sum = img_float[:, :, 0] + img_float[:, :, 1] + img_float[:, :, 2]
    r_norm = img_float[:, :, 2] / rgb_sum
    g_norm = img_float[:, :, 1] / rgb_sum
    b_norm = img_float[:, :, 0] / rgb_sum

    # (a) Normalized chromaticity: red dominance over blue and green
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

    # (c) HSV gate with minimum saturation to reject neutral gray/white walls
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    H = hsv[:, :, 0]
    S = hsv[:, :, 1]
    V = hsv[:, :, 2]
    mask_hsv = (
        ((H <= 45) | (H >= 165)) &
        (S >= 12) & (S <= 252) &
        (V >= 25)
    )

    # (d) LAB gate: a* channel reflects oxyhemoglobin in skin
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

    # Check if mask covers too large a fraction (>42% of image) indicating background leakage
    mask_ratio = np.mean(mask > 0)
    if mask_ratio > 0.42:
        scale = 240.0 / max(h, w)
        sw, sh = int(w * scale), int(h * scale)
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

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    mask = cv2.bitwise_and(mask, mask, mask=(gray >= 20).astype(np.uint8))

    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if contours:
        largest_cnt = max(contours, key=cv2.contourArea)
        clean_mask = np.zeros_like(mask)
        cv2.drawContours(clean_mask, [largest_cnt], -1, 255, thickness=cv2.FILLED)
        mask = clean_mask

    return mask

def detect_hand_anatomy_expert(
    contour: np.ndarray,
    skin_mask: np.ndarray,
    img_w: int,
    img_h: int
) -> tuple:
    dist_map = cv2.distanceTransform(skin_mask, cv2.DIST_L2, 5)
    _, max_val, _, max_loc = cv2.minMaxLoc(dist_map)
    if not math.isfinite(max_val) or max_val >= min(img_w, img_h) or max_val <= 0:
        palm_radius = float(min(img_w, img_h) * 0.25)
        palm_cx, palm_cy = float(img_w // 2), float(img_h * 0.55)
    else:
        palm_cx, palm_cy = float(max_loc[0]), float(max_loc[1])
        palm_radius = max(min(float(max_val), float(min(img_w, img_h) * 0.45)), 35.0)

        # Anatomical Forearm Rejection
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

                    if fy < palm_cy - 0.40 * palm_radius:
                        finger_valleys.append((fx, fy, depth))

                    if (palm_cy - 0.40 * palm_radius <= fy <= palm_cy + 1.15 * palm_radius):
                        thumb_candidates.append((fx, fy, depth))
        except Exception:
            pass

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

if __name__ == '__main__':
    for name, path in [('user_actual', 'scratch/actual_user_upload.jpg'), ('sample', 'apps/web/public/test_palm_sample.jpg')]:
        img = cv2.imread(path)
        h, w = img.shape[:2]
        _, q, _ = validate_palm_image(open(path, 'rb').read())
        mask = refine_skin_mask_expert(img)
        cnts, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        hand_cnt = max(cnts, key=cv2.contourArea)
        cx, cy, r, side, ang = detect_hand_anatomy_expert(hand_cnt, mask, w, h)
        
        work_img, work_mask = _rectify_hand(img, mask, cx, cy, ang)
        
        palmar_envelope = np.zeros((h, w), dtype=np.uint8)
        cv2.ellipse(
            palmar_envelope,
            (int(cx), int(cy)),
            (int(round(1.25 * r)), int(round(1.10 * r))),
            0, 0, 360, 255, -1
        )
        palmar_mask = cv2.bitwise_and(work_mask, palmar_envelope)
        palmar_mask = cv2.erode(palmar_mask, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)))
        
        creases = _extract_creases_hybrid_sota(work_img, palmar_mask, cx, cy, r, q)
        crease_vals = creases[creases > 0]
        clip_p = 48 if (q.contrast_score < 40.0 or q.brightness_score < 65.0) else 52
        thresh_val = np.percentile(crease_vals, clip_p) if len(crease_vals) > 40 else 12
        _, bin_c = cv2.threshold(creases, int(thresh_val), 255, cv2.THRESH_BINARY)
        skel = _morphological_skeleton(bin_c, 16)
        
        num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(skel, connectivity=8)
        min_comp_pixels = max(10, int(r * 0.08))
        
        segments = []
        for i in range(1, num_labels):
            if stats[i, cv2.CC_STAT_AREA] < min_comp_pixels:
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
            rel_x = (np.mean(xs) - cx) / float(r)
            rel_y = (np.mean(ys) - cy) / float(r)
            dx = float(np.ptp(xs))
            dy = float(np.ptp(ys))
            canonical_u = rel_x if side == 'right' else -rel_x
            segments.append({
                'idx': i,
                'path': raw_path,
                'arc_length': arc_l,
                'rel_x': rel_x,
                'rel_y': rel_y,
                'canonical_u': canonical_u,
                'dx': dx,
                'dy': dy
            })
        
        candidate_scores = []
        for idx, seg in enumerate(segments):
            u = seg['canonical_u']
            ry = seg['rel_y']
            dx = seg['dx']
            dy = seg['dy']
            l = seg['arc_length']

            s_heart = 0.0
            if -0.95 <= ry <= -0.20 and dx >= dy * 0.60:
                z = max(0.0, 1.0 - abs(ry - (-0.50)) / 0.40)
                t = min(1.0, dx / max(dy * 0.9, 1.0))
                len_s = min(1.0, l / (0.50 * r))
                s_heart = 0.40 * z + 0.35 * t + 0.25 * len_s

            s_head = 0.0
            if -0.38 <= ry <= +0.15 and dx >= dy * 0.60 and abs(u) <= 0.85:
                z = max(0.0, 1.0 - abs(ry - (-0.12)) / 0.30)
                t = min(1.0, dx / max(dy * 0.9, 1.0))
                len_s = min(1.0, l / (0.50 * r))
                s_head = 0.40 * z + 0.35 * t + 0.25 * len_s

            s_life = 0.0
            if u <= 0.20 and -0.20 <= ry <= +1.05 and (dy >= dx * 0.45 or ry >= 0.15):
                z = max(0.0, 1.0 - abs(ry - 0.40) / 0.50)
                v = min(1.0, dy / max(dx * 0.6, 1.0))
                len_s = min(1.0, l / (0.50 * r))
                s_life = 0.35 * z + 0.35 * v + 0.30 * len_s

            s_fate = 0.0
            if abs(u) <= 0.22 and dy >= 1.25 * dx and -0.30 <= ry <= +0.80:
                c = max(0.0, 1.0 - abs(u) / 0.22)
                v = min(1.0, dy / max(dx * 1.3, 1.0))
                len_s = min(1.0, l / (0.45 * r))
                s_fate = 0.40 * c + 0.40 * v + 0.20 * len_s

            candidate_scores.append({'idx': idx, 'seg': seg, 'heart': s_heart, 'head': s_head, 'life': s_life, 'fate': s_fate})

        assigned = set()
        print(f'=== {name.upper()} ASSIGNMENTS ===')
        for lk in ['heart', 'head', 'life', 'fate']:
            unassigned = [c for c in candidate_scores if c['idx'] not in assigned and c[lk] > 0.20]
            if unassigned:
                best = max(unassigned, key=lambda c: c[lk])
                assigned.add(best['idx'])
                s = best['seg']
                print(f"  {lk.upper()}: score={best[lk]:.3f}, len={s['arc_length']:.1f}, u={s['canonical_u']:.2f}, ry={s['rel_y']:.2f}")
            else:
                print(f"  {lk.upper()}: not detected")
