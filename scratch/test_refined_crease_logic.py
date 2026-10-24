import cv2
import numpy as np
import os
import sys

sys.path.insert(0, os.path.abspath("."))

from services.api.cv.validator import validate_palm_image
from services.api.cv.crease_analyzer import (
    _refine_skin_mask, _detect_hand_anatomy, _rectify_hand,
    _extract_creases_hybrid_sota, _morphological_skeleton,
    _extract_geodesic_diameter_path, _link_collinear_segments_tangential
)

def test_on(img_path: str):
    print("=" * 60)
    print("Testing on:", img_path)
    with open(img_path, "rb") as f:
        b = f.read()
    _, q, img = validate_palm_image(b)
    h, w = img.shape[:2]
    mask = _refine_skin_mask(img, q)
    cnts, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    hand_cnt = max(cnts, key=cv2.contourArea)
    cx, cy, r, hand_side, angle = _detect_hand_anatomy(hand_cnt, mask, w, h)
    work_img, work_mask = _rectify_hand(img, mask, cx, cy, angle)
    crease_map = _extract_creases_hybrid_sota(work_img, work_mask, cx, cy, r, q)

    vals = crease_map[crease_map > 0]
    thresh = np.percentile(vals, 54) if len(vals) > 40 else 12
    _, bin_c = cv2.threshold(crease_map, int(thresh), 255, cv2.THRESH_BINARY)
    skel = _morphological_skeleton(bin_c, 16)
    num_l, labels, stats, _ = cv2.connectedComponentsWithStats(skel, connectivity=8)

    min_comp_pixels = max(10, int(r * 0.08))
    segments = []
    for i in range(1, num_l):
        if stats[i, cv2.CC_STAT_AREA] < min_comp_pixels:
            continue
        raw_path = _extract_geodesic_diameter_path((labels == i).astype(np.uint8))
        if len(raw_path) < 3:
            continue
        diffs = np.diff(raw_path, axis=0)
        arc_l = float(np.sum(np.sqrt((diffs**2).sum(axis=1))))
        if arc_l < min_comp_pixels:
            continue
        xs, ys = raw_path[:, 0], raw_path[:, 1]
        mean_x, mean_y = float(np.mean(xs)), float(np.mean(ys))
        rel_x, rel_y = (mean_x - cx) / float(r), (mean_y - cy) / float(r)
        dx_span, dy_span = float(np.ptp(xs)), float(np.ptp(ys))
        canonical_u = rel_x if hand_side == 'right' else -rel_x
        segments.append({
            'idx': i,
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

    candidate_scores = []
    for s_idx, seg in enumerate(segments):
        ry = seg['rel_y']
        u = seg['canonical_u']
        dx = seg['dx_span']
        dy = seg['dy_span']
        l = seg['arc_length']

        # (a) Heart Line: upper transverse
        s_heart = 0.0
        if -0.95 <= ry <= -0.30 and dx >= dy * 0.65:
            z_score = max(0.0, 1.0 - abs(ry - (-0.55)) / 0.35)
            t_score = min(1.0, dx / max(dy * 0.8, 1.0))
            l_score = min(1.0, l / (0.45 * float(r)))
            u_boost = 1.15 if u >= -0.20 else 0.85
            s_heart = (0.40 * z_score + 0.35 * t_score + 0.25 * l_score) * u_boost

        # (b) Head Line: mid transverse (MUST be transverse: dx >= dy * 0.75)
        s_head = 0.0
        if -0.38 <= ry <= +0.18 and dx >= dy * 0.75 and abs(u) <= 0.85:
            z_score = max(0.0, 1.0 - abs(ry - (-0.10)) / 0.28)
            t_score = min(1.0, (dx / max(dy * 0.7, 1.0)) / 1.5)
            span_score = min(1.0, dx / (0.50 * float(r)))
            l_score = min(1.0, l / (0.50 * float(r)))
            rad_boost = 1.20 if u <= 0.10 else 0.85
            s_head = (0.30 * z_score + 0.25 * span_score + 0.25 * t_score + 0.20 * l_score) * rad_boost

        # (c) Fate Line: central column, longitudinal vertical (dy >= 1.20 * dx)
        s_fate = 0.0
        if abs(u) <= 0.22 and dy >= 1.20 * dx and -0.35 <= ry <= +0.85:
            c_score = max(0.0, 1.0 - abs(u) / 0.22)
            v_score = min(1.0, dy / max(dx * 1.2, 1.0))
            l_score = min(1.0, l / (0.40 * float(r)))
            s_fate = 0.40 * c_score + 0.40 * v_score + 0.20 * l_score

        # (d) Life Line: Thenar radial zone
        s_life = 0.0
        is_central_vertical = (abs(u) <= 0.16 and dy >= 1.20 * dx)
        if not is_central_vertical and u <= -0.10 and -0.35 <= ry <= +1.15:
            u_score = max(0.0, 1.0 - abs(u - (-0.55)) / 0.55)
            z_score = max(0.0, 1.0 - abs(ry - 0.35) / 0.60)
            arc_shape_score = min(1.0, (dy + dx * 0.50) / (0.45 * float(r)))
            l_score = min(1.0, l / (0.40 * float(r)))
            s_life = 0.35 * u_score + 0.30 * z_score + 0.20 * arc_shape_score + 0.15 * l_score

        candidate_scores.append({
            'idx': s_idx,
            'seg': seg,
            'heart': s_heart,
            'head': s_head,
            'life': s_life,
            'fate': s_fate
        })

    assigned_segs = set()
    crease_segs = {'head': [], 'fate': [], 'life': [], 'heart': []}
    for line_key in ['fate', 'head', 'life', 'heart']:
        unassigned = [c for c in candidate_scores if c['idx'] not in assigned_segs]
        if not unassigned:
            continue
        best_cand = max(unassigned, key=lambda c: c[line_key])
        if best_cand[line_key] >= 0.20:
            crease_segs[line_key].append(best_cand['seg'])
            assigned_segs.add(best_cand['idx'])

    for line_key in ['fate', 'head', 'life', 'heart']:
        if not crease_segs[line_key]:
            continue
        max_curv = 2.60 if line_key == 'life' else 1.80
        max_allowed_gap = max(28.0, float(r * (0.35 if line_key == 'life' else 0.28)))
        chain_changed = True
        while chain_changed:
            chain_changed = False
            unassigned = sorted([c for c in candidate_scores if c['idx'] not in assigned_segs], key=lambda c: c['seg']['arc_length'], reverse=True)
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
                    uA_end, uA_start = vA_end / nA_e, vA_start / nA_s
                    uB_start, uB_end = vB_start / nB_s, vB_end / nB_e
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
                                    # Enforce orientation preservation
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

    print("\nFINAL ATTRIBUTIONS:")
    for k in ['heart', 'head', 'life', 'fate']:
        raws = [s['path'] for s in crease_segs[k]]
        linked = _link_collinear_segments_tangential(raws, max_gap_px=30, max_curvature=2.4 if k=='life' else 1.7)
        if linked:
            p = linked[0]
            d = np.diff(p, axis=0)
            tot_l = np.sum(np.sqrt((d**2).sum(axis=1)))
            dx = np.ptp(p[:, 0])
            dy = np.ptp(p[:, 1])
            print(f"  {k.upper()}: len={tot_l:.1f}px, start=({p[0,0]:.1f},{p[0,1]:.1f}), end=({p[-1,0]:.1f},{p[-1,1]:.1f}), dx={dx:.1f}, dy={dy:.1f}")

test_on("scratch/actual_user_upload.jpg")
