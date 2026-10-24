import sys
sys.path.insert(0, '.')
import cv2
import numpy as np

def score_and_extract(path):
    from services.api.cv.validator import validate_palm_image
    from services.api.cv.crease_analyzer import (
        _refine_skin_mask, _detect_hand_anatomy, _rectify_hand,
        _extract_creases_hybrid_sota, _morphological_skeleton,
        _extract_geodesic_diameter_path
    )
    b = open(path, 'rb').read()
    _, q, _ = validate_palm_image(b)
    img = cv2.imread(path)
    h, w = img.shape[:2]
    mask = _refine_skin_mask(img, q)
    cnts, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    hc = max(cnts, key=cv2.contourArea)
    cx, cy, r, hs, dev = _detect_hand_anatomy(hc, mask, w, h)
    wimg, wmask = _rectify_hand(img, mask, cx, cy, dev)
    cmap = _extract_creases_hybrid_sota(wimg, wmask, cx, cy, r, q)
    vals = cmap[cmap > 0]
    clip_p = 48 if (q.contrast_score < 40.0 or q.brightness_score < 65.0) else 54
    th = np.percentile(vals, clip_p) if len(vals) > 40 else 12
    _, binc = cv2.threshold(cmap, int(th), 255, cv2.THRESH_BINARY)
    binc = cv2.morphologyEx(binc, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2)))
    skel = _morphological_skeleton(binc, 16)
    num_l, lbls, stats, _ = cv2.connectedComponentsWithStats(skel, connectivity=8)

    min_comp_pixels = max(10, int(r * 0.08))
    segs = []
    for i in range(1, num_l):
        if stats[i, cv2.CC_STAT_AREA] < min_comp_pixels:
            continue
        comp = (lbls == i).astype(np.uint8)
        p = _extract_geodesic_diameter_path(comp)
        if len(p) < 3:
            continue
        diffs = np.diff(p, axis=0)
        arc_l = float(np.sum(np.sqrt((diffs**2).sum(axis=1))))
        if arc_l < min_comp_pixels:
            continue
        xs, ys = p[:, 0], p[:, 1]
        mean_x, mean_y = float(np.mean(xs)), float(np.mean(ys))
        rel_x = (mean_x - cx) / float(r)
        rel_y = (mean_y - cy) / float(r)
        dx_span = float(np.ptp(xs))
        dy_span = float(np.ptp(ys))
        canonical_u = rel_x if hs == "right" else -rel_x
        segs.append({
            'idx': i, 'path': p, 'arc_length': arc_l,
            'rel_y': rel_y, 'canonical_u': canonical_u,
            'dx_span': dx_span, 'dy_span': dy_span,
            'max_ry': float(np.max(ys - cy) / float(r))
        })

    candidate_scores = []
    for idx, seg in enumerate(segs):
        ry = seg['rel_y']
        u = seg['canonical_u']
        dx = seg['dx_span']
        dy = seg['dy_span']
        l = seg['arc_length']
        max_ry = seg['max_ry']

        # Heart Line: Upper transverse zone (-0.95 to -0.30), dx >= dy * 0.65
        s_heart = 0.0
        if -0.95 <= ry <= -0.30 and dx >= dy * 0.65:
            z_score = max(0.0, 1.0 - abs(ry - (-0.50)) / 0.40)
            t_score = min(1.0, dx / max(dy * 0.9, 1.0))
            l_score = min(1.0, l / (0.60 * float(r)))
            s_heart = 0.40 * z_score + 0.35 * t_score + 0.25 * l_score

        # Head Line: Mid transverse zone (-0.38 to +0.12), central palm (|u| <= 0.70), wide dx
        s_head = 0.0
        if -0.38 <= ry <= +0.12 and dx >= dy * 0.65 and abs(u) <= 0.75:
            z_score = max(0.0, 1.0 - abs(ry - (-0.18)) / 0.30)
            u_score = max(0.0, 1.0 - abs(u) / 0.65)
            t_score = min(1.0, (dx / max(dy, 1.0)) / 2.0)
            span_score = min(1.0, dx / (0.70 * float(r)))
            l_score = min(1.0, l / (0.70 * float(r)))
            s_head = 0.25 * z_score + 0.25 * u_score + 0.25 * span_score + 0.15 * t_score + 0.10 * l_score

        # Life Line: Thenar radial zone (u <= -0.10), vertical/diagonal arc around thumb
        s_life = 0.0
        if u <= -0.10 and -0.20 <= ry <= +1.10 and (dy >= dx * 0.55 or (max_ry >= 0.30 and dy >= max(18.0, r * 0.15))):
            u_score = max(0.0, 1.0 - abs(u - (-0.65)) / 0.55)
            z_score = max(0.0, 1.0 - abs(ry - 0.45) / 0.55)
            v_score = min(1.0, dy / max(dx * 0.8, 1.0))
            l_score = min(1.0, l / (0.60 * float(r)))
            s_life = 0.30 * u_score + 0.30 * z_score + 0.25 * v_score + 0.15 * l_score

        # Fate Line: Central column (|u| <= 0.18), longitudinal verticality
        s_fate = 0.0
        if abs(u) <= 0.18 and dy >= 1.40 * dx and dx <= 0.35 * float(r) and -0.30 <= ry <= +0.85:
            c_score = max(0.0, 1.0 - abs(u) / 0.18)
            v_score = min(1.0, dy / max(dx * 1.5, 1.0))
            l_score = min(1.0, l / (0.50 * float(r)))
            s_fate = 0.45 * v_score + 0.35 * c_score + 0.20 * l_score

        candidate_scores.append({
            'idx': idx, 'seg': seg,
            'heart': s_heart, 'head': s_head,
            'life': s_life, 'fate': s_fate
        })

    assigned = set()
    crease_segs = {'heart': [], 'head': [], 'life': [], 'fate': []}
    for line_key in ['heart', 'head', 'life', 'fate']:
        unassigned = [c for c in candidate_scores if c['idx'] not in assigned]
        if not unassigned:
            continue
        best = max(unassigned, key=lambda c: c[line_key])
        min_thresh = 0.30 if line_key == 'fate' else 0.20
        if best[line_key] >= min_thresh:
            crease_segs[line_key].append(best['seg'])
            assigned.add(best['idx'])

    def link_collinear_robust(segments, max_gap_px):
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
                            # Tangent direction alignment must be forward
                            if cos_tan >= 0.45:
                                if gap > 2.0:
                                    cos_bridge = float(np.dot(out_dir, bridge / gap))
                                else:
                                    cos_bridge = 1.0

                                if cos_bridge >= 0.40:
                                    # Verify no hairpin loop / curvature explosion
                                    diffs_m = np.diff(cand_m, axis=0)
                                    tot_l_m = float(np.sum(np.sqrt((diffs_m**2).sum(axis=1))))
                                    chord_m = float(np.hypot(cand_m[-1, 0] - cand_m[0, 0], cand_m[-1, 1] - cand_m[0, 1]))
                                    curv_m = tot_l_m / max(chord_m, 1.0)
                                    if curv_m <= 1.65:
                                        min_gap = gap
                                        best_pair = (i, j)
                                        best_merged = cand_m

            if best_pair is not None and min_gap <= max_gap_px:
                i, j = best_pair
                merged[i] = best_merged
                merged.pop(j)
                changed = True
        return merged

    # Extension linking
    for line_key in ['heart', 'head', 'life', 'fate']:
        if not crease_segs[line_key]:
            continue
        primary = crease_segs[line_key][0]
        unassigned = sorted(
            [c for c in candidate_scores if c['idx'] not in assigned],
            key=lambda c: c['seg']['arc_length'],
            reverse=True
        )
        for c in unassigned:
            if c[line_key] >= 0.20:
                sA = primary['path']
                sB = c['seg']['path']
                vA_end = sA[-1] - sA[max(0, len(sA) - 3)]
                vA_start = sA[0] - sA[min(2, len(sA) - 1)]
                vB_start = sB[min(2, len(sB) - 1)] - sB[0]
                vB_end = sB[max(0, len(sB) - 3)] - sB[-1]

                nA_e = float(np.hypot(vA_end[0], vA_end[1])) + 1e-6
                nA_s = float(np.hypot(vA_start[0], vA_start[1])) + 1e-6
                nB_s = float(np.hypot(vB_start[0], vB_start[1])) + 1e-6
                nB_e = float(np.hypot(vB_end[0], vB_end[1])) + 1e-6

                cases = [
                    (sA[-1], sB[0], vA_end / nA_e, vB_start / nB_s, np.vstack([sA, sB])),
                    (sA[-1], sB[-1], vA_end / nA_e, vB_end / nB_e, np.vstack([sA, sB[::-1]])),
                    (sA[0], sB[0], vA_start / nA_s, vB_start / nB_s, np.vstack([sA[::-1], sB])),
                    (sB[-1], sA[0], -vB_end / nB_e, -vA_start / nA_s, np.vstack([sB, sA])),
                ]
                max_allowed_gap = max(20.0, float(r * 0.25))
                matched = False
                chord_A = float(np.hypot(sA[-1, 0] - sA[0, 0], sA[-1, 1] - sA[0, 1]))
                for p_from, p_to, out_dir, in_dir, cand_merged in cases:
                    bridge = p_to - p_from
                    gap = float(np.hypot(bridge[0], bridge[1]))
                    if gap <= max_allowed_gap:
                        cos_tan = float(np.dot(out_dir, in_dir))
                        if cos_tan >= 0.45:
                            if gap > 2.0:
                                cos_bridge = float(np.dot(out_dir, bridge / gap))
                            else:
                                cos_bridge = 1.0
                            if cos_bridge >= 0.40:
                                diffs_m = np.diff(cand_merged, axis=0)
                                tot_l_m = float(np.sum(np.sqrt((diffs_m**2).sum(axis=1))))
                                chord_cand = float(np.hypot(cand_merged[-1, 0] - cand_merged[0, 0], cand_merged[-1, 1] - cand_merged[0, 1]))
                                curv_cand = tot_l_m / max(chord_cand, 1.0)
                                if curv_cand <= 1.65 and chord_cand >= chord_A * 0.95:
                                    matched = True
                                    break
                if matched:
                    crease_segs[line_key].append(c['seg'])
                    assigned.add(c['idx'])

    print(f"\nRESULTS FOR {path}:")
    for line_key in ['heart', 'head', 'life', 'fate']:
        segs_found = crease_segs[line_key]
        if not segs_found:
            print(f"  {line_key.upper()}: not detected")
            continue
        raw_paths = [s['path'] for s in sorted(segs_found, key=lambda s: s['arc_length'], reverse=True)]
        linked = link_collinear_robust(raw_paths, max_gap_px=max(22.0, float(r * 0.25)))
        chain = linked[0] if linked else raw_paths[0]
        diffs = np.diff(chain, axis=0)
        tot_l = float(np.sum(np.sqrt((diffs**2).sum(axis=1))))
        chord = float(np.hypot(chain[-1, 0] - chain[0, 0], chain[-1, 1] - chain[0, 1]))
        curv = tot_l / max(chord, 1.0)
        if line_key == 'fate' and (tot_l < 0.28 * r or curv > 1.45):
            print(f"  {line_key.upper()}: not_detected (subtle/absent, len={tot_l:.1f}, curv={curv:.2f})")
        else:
            print(f"  {line_key.upper()}: DETECTED! segs={len(segs_found)}, len={tot_l:.1f}px, chord={chord:.1f}px, curv={curv:.2f}")

score_and_extract('apps/web/public/test_palm_sample.jpg')
score_and_extract('scratch/user_real_palm.jpg')
