import numpy as np

def link_segments(segments, max_gap_px=28.0):
    if not segments:
        return []
    merged = [s.copy() for s in segments]
    changed = True
    while changed:
        changed = False
        best_pair = None
        min_gap = max_gap_px + 1.0
        best_orient = None
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
                    ('A_end_B_start', sA[-1], sB[0], uA_end, uB_start),
                    ('A_end_B_end', sA[-1], sB[-1], uA_end, uB_end),
                    ('A_start_B_start', sA[0], sB[0], uA_start, uB_start),
                    ('A_start_B_end', sB[-1], sA[0], -uB_end, -uA_start),
                ]

                for mode, p_from, p_to, out_dir, in_dir in cases:
                    bridge = p_to - p_from
                    gap = float(np.hypot(bridge[0], bridge[1]))
                    if gap < min_gap:
                        cos_tan = float(np.dot(out_dir, in_dir))
                        if gap > 4.0:
                            cos_bridge = float(np.dot(out_dir, bridge / gap))
                        else:
                            cos_bridge = 1.0

                        if cos_tan >= 0.40 and cos_bridge >= 0.35:
                            min_gap = gap
                            best_pair = (i, j)
                            best_orient = mode

        if best_pair is not None and min_gap <= max_gap_px:
            i, j = best_pair
            sA = merged[i]
            sB = merged[j]
            if best_orient == 'A_end_B_start':
                merged[i] = np.vstack([sA, sB])
            elif best_orient == 'A_end_B_end':
                merged[i] = np.vstack([sA, sB[::-1]])
            elif best_orient == 'A_start_B_start':
                merged[i] = np.vstack([sA[::-1], sB])
            elif best_orient == 'A_start_B_end':
                merged[i] = np.vstack([sB, sA])
            merged.pop(j)
            changed = True
    return merged

# Test: Two horizontal segments: seg1 from (10, 50) to (50, 50), seg2 from (60, 50) to (100, 50)
s1 = np.array([[x, 50.0] for x in range(10, 51, 5)])
s2 = np.array([[x, 50.0] for x in range(60, 101, 5)])

# Test all 4 permutations of orientation:
res1 = link_segments([s1, s2])
res2 = link_segments([s1, s2[::-1]])
res3 = link_segments([s1[::-1], s2])
res4 = link_segments([s1[::-1], s2[::-1]])

print("Test 1 (s1, s2): count =", len(res1), "shape =", res1[0].shape)
print("Test 2 (s1, s2 reversed): count =", len(res2), "shape =", res2[0].shape)
print("Test 3 (s1 reversed, s2): count =", len(res3), "shape =", res3[0].shape)
print("Test 4 (s1 reversed, s2 reversed): count =", len(res4), "shape =", res4[0].shape)

for idx, r in enumerate([res1, res2, res3, res4]):
    line = r[0]
    chord = np.hypot(line[-1,0] - line[0,0], line[-1,1] - line[0,1])
    diffs = np.diff(line, axis=0)
    l = float(np.sum(np.sqrt((diffs**2).sum(axis=1))))
    print(f"Permutation {idx+1}: chord={chord:.1f}, l={l:.1f}, curv={l/chord:.2f}")
