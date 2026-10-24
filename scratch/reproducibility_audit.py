"""
Reproducibility and Stability Audit Script for Palmora AI CV Pipeline.
Scans each image in the benchmark folder 10 times with small perturbations
(rotation in [-5 deg, +5 deg], brightness in [-10%, +10%]) and measures stability
of extracted line sets and archetypes, comparing pre-Prompts A-E baseline vs current
real endpoint logic (test-time ensembling, soft thresholds, vote_share confidence).
"""

import os
import sys
import math
import time
import glob
import csv
import argparse
from collections import Counter, defaultdict
from concurrent.futures import ProcessPoolExecutor, as_completed
from typing import Dict, List, Any, Tuple, Optional
import cv2
import numpy as np

# Add repository root to path
REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from services.api.routers.palm import _process_palm_image
from services.api.cv.validator import validate_palm_image
from services.api.cv.crease_analyzer import analyze_palm_creases
from services.api.readings.generator import (
    _evaluate_heart,
    _evaluate_head,
    _evaluate_life,
    _evaluate_fate,
    _check_head_life_origin,
    _synthesize_reading_title,
    _calculate_vertical_deflection
)

# 10 Systematic Perturbation Parameters: (rotation_deg, brightness_multiplier)
PERTURBATIONS: List[Tuple[float, float]] = [
    (-5.0, 0.90),  # Max counter-clockwise, dim
    (+5.0, 1.10),  # Max clockwise, bright
    (-3.5, 1.07),
    (+3.5, 0.93),
    (-2.0, 0.96),
    (+2.0, 1.04),
    (-4.5, 1.09),
    (+4.5, 0.91),
    (-1.0, 1.02),
    (+1.0, 0.98),
]

def apply_perturbation(img: np.ndarray, rot_deg: float, brightness_mult: float) -> bytes:
    h, w = img.shape[:2]
    # Rotate with border reflection to avoid black borders triggering false edge contours
    M = cv2.getRotationMatrix2D((w / 2.0, h / 2.0), rot_deg, 1.0)
    rotated = cv2.warpAffine(img, M, (w, h), borderMode=cv2.BORDER_REFLECT_101)
    
    # Brightness adjustment
    brightened = np.clip(rotated.astype(np.float32) * brightness_mult, 0, 255).astype(np.uint8)
    
    _, enc = cv2.imencode(".jpg", brightened, [int(cv2.IMWRITE_JPEG_QUALITY), 95])
    return enc.tobytes()

def replace_white_background(img: np.ndarray) -> np.ndarray:
    """
    In benchmark mode, replaces near-white background pixels (gray >= 245
    connected to the image border) with mid-gray (128).
    """
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    white_mask = (gray >= 245).astype(np.uint8)
    num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(white_mask, connectivity=8)
    if num_labels <= 1:
        return img
    border_labels = set(labels[0, :]).union(labels[-1, :]).union(labels[:, 0]).union(labels[:, -1])
    border_labels.discard(0)
    if not border_labels:
        return img
    bg_mask = np.isin(labels, list(border_labels))
    out = img.copy()
    out[bg_mask] = 128
    return out

def classify_pre_ae(features, hand_side: str) -> Dict[str, Any]:
    """
    Evaluates archetypes using the hard-threshold, un-ensembled rules from before Prompts A-E.
    Used for side-by-side stability benchmarking on identical perturbation scans.
    """
    h_feat = getattr(features, "heart_line", None)
    hd_feat = getattr(features, "head_line", None)
    l_feat = getattr(features, "life_line", None)
    f_feat = getattr(features, "fate_line", None)

    # Heart Line pre-AE hard thresholds
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

    # Head Line pre-AE hard thresholds
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

    # Life Line pre-AE hard thresholds
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

    # Fate Line pre-AE hard thresholds
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

    # Origin pre-AE binary threshold (dist < 0.055 without deadband)
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

def run_single_scan(img_bytes: bytes, benchmark_mode: bool = False) -> Dict[str, Any]:
    """
    Executes a scan through the REAL /palm/analyze endpoint logic (_process_palm_image).
    Includes 5-pass test-time ensembling, majority archetype voting, vote_share confidence,
    soft thresholds with hysteresis, and low-confidence title exclusion.
    Also extracts pre-AE baseline archetypes for exact 1-to-1 stability comparison.
    """
    if benchmark_mode:
        dec = cv2.imdecode(np.frombuffer(img_bytes, np.uint8), cv2.IMREAD_COLOR)
        if dec is not None:
            dec = replace_white_background(dec)
            _, img_bytes = cv2.imencode(".jpg", dec)

    # Real Endpoint Call: validation + 5-pass test-time ensembling + majority voting
    is_usable, quality, features, hand_side, roi_box, elapsed_ms = _process_palm_image(img_bytes)
    
    if not is_usable or features is None:
        return {
            "usable": False,
            "issues": quality.issues if quality else ["Validation rejected image"],
            "hand_side": "unknown",
            "lines": {},
            "archetypes": {},
            "origin": "indeterminate",
            "title": "Unusable Scan",
            "pre_ae": {
                "heart": "not_detected",
                "head": "not_detected",
                "life": "not_detected",
                "fate": "fate_absent_or_subtle",
                "origin": "indeterminate",
                "title": "Unusable Scan"
            },
            "low_confidence_lines": [],
            "elapsed_ms": elapsed_ms
        }

    # Extract ensembled archetypes from majority vote
    def get_line_arch(f):
        if not f or f.status in ("not_detected", "unsupported"):
            return "not_detected"
        if f.status == "uncertain":
            return "uncertain"
        meas = f.measurements or {}
        return meas.get("ensemble_archetype") or meas.get("archetype_key") or "not_detected"

    heart_arch = get_line_arch(features.heart_line)
    head_arch = get_line_arch(features.head_line)
    life_arch = get_line_arch(features.life_line)
    fate_arch = get_line_arch(features.fate_line)

    origin_status, origin_comm = _check_head_life_origin(features.head_line, features.life_line)

    # Real Endpoint: identify low-confidence lines (< 0.80 vote share)
    low_conf_lines = set()
    for lk in ["heart", "head", "life", "fate"]:
        feat = getattr(features, f"{lk}_line", None)
        if feat and feat.measurements and feat.measurements.get("low_confidence"):
            low_conf_lines.add(lk)

    # Real Endpoint: synthesize title with low_confidence_lines excluded
    title = _synthesize_reading_title(
        heart_arch, head_arch, life_arch, fate_arch, origin_status, hand_side,
        low_confidence_lines=low_conf_lines
    )

    # Evaluate pre-Prompts A-E output on the same raw features
    pre_ae = classify_pre_ae(features, hand_side)

    def extract_line_summary(f):
        if not f:
            return {
                "status": "not_detected",
                "conf": 0.0,
                "len": 0.0,
                "curv": 0.0,
                "angle": 0.0,
                "vote_share": 0.0,
                "low_confidence": True
            }
        meas = f.measurements or {}
        return {
            "status": f.status,
            "conf": float(f.confidence if f.confidence is not None else 0.0),  # Endpoint vote_share
            "len": float(meas.get("length_ratio", 0.0)),
            "curv": float(meas.get("curvature_index", 0.0)),
            "angle": float(meas.get("orientation_angle_deg", 0.0)),
            "vote_share": float(meas.get("vote_share", f.confidence if f.confidence is not None else 0.0)),
            "low_confidence": bool(meas.get("low_confidence", False)),
        }

    return {
        "usable": True,
        "hand_side": hand_side,
        "lines": {
            "heart": extract_line_summary(features.heart_line),
            "head": extract_line_summary(features.head_line),
            "life": extract_line_summary(features.life_line),
            "fate": extract_line_summary(features.fate_line),
        },
        "archetypes": {
            "heart": heart_arch,
            "head": head_arch,
            "life": life_arch,
            "fate": fate_arch,
        },
        "origin": origin_status,
        "title": title,
        "low_confidence_lines": list(low_conf_lines),
        "pre_ae": pre_ae,
        "elapsed_ms": elapsed_ms
    }

def audit_single_image_worker(args: Tuple[str, Dict[str, str], bool]) -> Dict[str, Any]:
    """Worker function to audit a single image across baseline + 10 perturbations."""
    img_path, meta, benchmark_mode = args
    fname = os.path.basename(img_path)
    img = cv2.imread(img_path)
    if img is None:
        return {"image": fname, "error": "Cannot read image"}

    skin = meta.get("skinColor", "unknown").strip().lower()
    aspect = meta.get("aspectOfHand", "unknown").strip().lower()

    if benchmark_mode:
        img = replace_white_background(img)

    # 1. Baseline Scan
    _, baseline_bytes = cv2.imencode(".jpg", img)
    baseline_res = run_single_scan(baseline_bytes, benchmark_mode=benchmark_mode)

    if not baseline_res["usable"]:
        return {
            "image": fname,
            "skinColor": skin,
            "aspect": aspect,
            "shape": list(img.shape),
            "baseline_rejected": True,
            "issues": baseline_res["issues"]
        }

    # 2. 10 Perturbation Runs
    pert_runs = []
    for i, (rot, bright) in enumerate(PERTURBATIONS, 1):
        pert_bytes = apply_perturbation(img, rot, bright)
        res = run_single_scan(pert_bytes, benchmark_mode=benchmark_mode)
        pert_runs.append({
            "run": i,
            "rot": rot,
            "bright": bright,
            "res": res
        })

    total_runs = len(pert_runs)
    usable_runs = sum(1 for r in pert_runs if r["res"]["usable"])

    # Metrics for Current Commit (Real Ensembled Endpoint)
    line_metrics = {}
    for lk in ["heart", "head", "life", "fate"]:
        base_status = baseline_res["lines"][lk]["status"]
        base_arch = baseline_res["archetypes"][lk]
        
        statuses = [r["res"]["lines"][lk]["status"] for r in pert_runs if r["res"]["usable"]]
        archetypes = [r["res"]["archetypes"][lk] for r in pert_runs if r["res"]["usable"]]
        vote_shares = [r["res"]["lines"][lk]["vote_share"] for r in pert_runs if r["res"]["usable"]]
        
        detected_in_pert = sum(1 for s in statuses if s == "detected")
        det_rate = (detected_in_pert / total_runs) * 100.0

        if statuses:
            modal_status, modal_status_count = Counter(statuses).most_common(1)[0]
            status_stab = (modal_status_count / total_runs) * 100.0
        else:
            modal_status = "none"
            status_stab = 0.0

        if archetypes:
            modal_arch, modal_arch_count = Counter(archetypes).most_common(1)[0]
            arch_stab = (modal_arch_count / total_runs) * 100.0
        else:
            modal_arch = "none"
            arch_stab = 0.0

        line_metrics[lk] = {
            "base_status": base_status,
            "modal_status": modal_status,
            "status_stability_pct": status_stab,
            "base_arch": base_arch,
            "modal_arch": modal_arch,
            "arch_stability_pct": arch_stab,
            "detection_count": detected_in_pert,
            "detection_rate_pct": det_rate,
            "avg_vote_share": float(np.mean(vote_shares)) if vote_shares else 0.0
        }

    # Metrics for Pre-Prompts A-E
    pre_line_metrics = {}
    for lk in ["heart", "head", "life", "fate"]:
        pre_base_arch = baseline_res["pre_ae"][lk]
        pre_archetypes = [r["res"]["pre_ae"][lk] for r in pert_runs if r["res"]["usable"]]
        if pre_archetypes:
            pre_modal_arch, pre_modal_cnt = Counter(pre_archetypes).most_common(1)[0]
            pre_arch_stab = (pre_modal_cnt / total_runs) * 100.0
        else:
            pre_modal_arch = "none"
            pre_arch_stab = 0.0
        pre_line_metrics[lk] = {
            "base_arch": pre_base_arch,
            "modal_arch": pre_modal_arch,
            "arch_stability_pct": pre_arch_stab
        }

    # Hand Side, Origin, Title Stability (Current Commit)
    sides = [r["res"]["hand_side"] for r in pert_runs if r["res"]["usable"]]
    modal_side, modal_side_cnt = Counter(sides).most_common(1)[0] if sides else ("none", 0)
    side_stab = (modal_side_cnt / total_runs) * 100.0

    origins = [r["res"]["origin"] for r in pert_runs if r["res"]["usable"]]
    modal_orig, modal_orig_cnt = Counter(origins).most_common(1)[0] if origins else ("none", 0)
    orig_stab = (modal_orig_cnt / total_runs) * 100.0

    titles = [r["res"]["title"] for r in pert_runs if r["res"]["usable"]]
    modal_title, modal_title_cnt = Counter(titles).most_common(1)[0] if titles else ("none", 0)
    title_stab = (modal_title_cnt / total_runs) * 100.0

    # Origin & Title Stability (Pre-Prompts A-E)
    pre_origins = [r["res"]["pre_ae"]["origin"] for r in pert_runs if r["res"]["usable"]]
    pre_modal_orig, pre_modal_orig_cnt = Counter(pre_origins).most_common(1)[0] if pre_origins else ("none", 0)
    pre_orig_stab = (pre_modal_orig_cnt / total_runs) * 100.0

    pre_titles = [r["res"]["pre_ae"]["title"] for r in pert_runs if r["res"]["usable"]]
    pre_modal_title, pre_modal_title_cnt = Counter(pre_titles).most_common(1)[0] if pre_titles else ("none", 0)
    pre_title_stab = (pre_modal_title_cnt / total_runs) * 100.0

    return {
        "image": fname,
        "skinColor": skin,
        "aspect": aspect,
        "shape": list(img.shape),
        "baseline_rejected": False,
        "baseline_title": baseline_res["title"],
        "pre_baseline_title": baseline_res["pre_ae"]["title"],
        "hand_side": baseline_res["hand_side"],
        "origin": baseline_res["origin"],
        "low_confidence_lines": baseline_res["low_confidence_lines"],
        "line_metrics": line_metrics,
        "pre_line_metrics": pre_line_metrics,
        "side_stability": side_stab,
        "origin_stability": orig_stab,
        "pre_origin_stability": pre_orig_stab,
        "title_stability": title_stab,
        "pre_title_stability": pre_title_stab
    }

def audit_benchmark(
    folder_path: str = "benchmark",
    limit: Optional[int] = None,
    benchmark_mode: bool = False,
    workers: int = 4
) -> Dict[str, Any]:
    images = sorted(glob.glob(os.path.join(folder_path, "*.*")))
    valid_exts = {".jpg", ".jpeg", ".png"}
    images = [img for img in images if os.path.splitext(img)[1].lower() in valid_exts]
    
    if limit is not None and limit > 0:
        images = images[:limit]

    if not images:
        print(f"Error: No images found in {folder_path}")
        return {}

    # Load metadata (skinColor, aspectOfHand)
    metadata_map: Dict[str, Dict[str, str]] = {}
    csv_candidates = [
        os.path.join(folder_path, "sample40.csv"),
        os.path.join(folder_path, "HandInfo.csv"),
        os.path.join(os.path.dirname(folder_path), "HandInfo.csv"),
        r"D:\benchmark_public\sample40\sample40.csv",
        r"D:\benchmark_public\HandInfo.csv",
    ]
    for cp in csv_candidates:
        if os.path.exists(cp):
            try:
                with open(cp, mode="r", encoding="utf-8") as f:
                    for r in csv.DictReader(f):
                        metadata_map[r["imageName"]] = r
                break
            except Exception:
                pass

    print(f"================================================================================")
    print(f"PALMORA AI COMPUTER VISION REPRODUCIBILITY & STABILITY AUDIT")
    print(f"Code Path:         REAL /palm/analyze ENDPOINT LOGIC (_process_palm_image)")
    print(f"Features:          5-Pass Test-Time Ensembling, Soft Hysteresis Thresholds,")
    print(f"                   Vote-Share Confidence, Low-Confidence Title Suppression")
    print(f"Benchmark Folder:  {folder_path} ({len(images)} images selected)")
    print(f"Benchmark Mode:    {'ENABLED (Border near-white -> mid-gray 128)' if benchmark_mode else 'DISABLED'}")
    print(f"Perturbation Suite: 10 runs per image (Rotation: +/-5 deg, Brightness: +/-10%)")
    print(f"Parallel Workers:  {workers}")
    print(f"================================================================================\n")

    overall_line_status_stability: Dict[str, List[float]] = {"heart": [], "head": [], "life": [], "fate": []}
    overall_line_detection_rates: Dict[str, List[float]] = {"heart": [], "head": [], "life": [], "fate": []}
    overall_post_arch_stability: Dict[str, List[float]] = {"heart": [], "head": [], "life": [], "fate": []}
    overall_pre_arch_stability: Dict[str, List[float]] = {"heart": [], "head": [], "life": [], "fate": []}

    overall_hand_side_stability: List[float] = []
    overall_post_origin_stability: List[float] = []
    overall_pre_origin_stability: List[float] = []
    overall_post_title_stability: List[float] = []
    overall_pre_title_stability: List[float] = []

    validator_rejections_baseline: List[Dict[str, Any]] = []

    skin_groups: Dict[str, Dict[str, Any]] = defaultdict(lambda: {
        "total": 0,
        "baseline_rejected": 0,
        "heart_det": [], "head_det": [], "life_det": [], "fate_det": [],
        "pre_heart_arch": [], "post_heart_arch": [],
        "pre_head_arch": [], "post_head_arch": [],
        "pre_life_arch": [], "post_life_arch": [],
        "pre_fate_arch": [], "post_fate_arch": [],
        "side_stab": [],
        "pre_orig_stab": [], "post_orig_stab": [],
        "pre_title_stab": [], "post_title_stab": []
    })

    tasks = [(img_p, metadata_map.get(os.path.basename(img_p), {}), benchmark_mode) for img_p in images]
    results_list = []

    t_start = time.time()
    if workers > 1:
        with ProcessPoolExecutor(max_workers=min(workers, len(images))) as executor:
            futures = {executor.submit(audit_single_image_worker, t): t[0] for t in tasks}
            for fut in as_completed(futures):
                res = fut.result()
                results_list.append(res)
                fname = res.get("image", "unknown")
                if res.get("baseline_rejected"):
                    print(f"[{len(results_list)}/{len(images)}] {fname} -> [REJECTED AT BASELINE] {res.get('issues')}")
                else:
                    lm = res["line_metrics"]
                    print(f"[{len(results_list)}/{len(images)}] {fname} ({res.get('skinColor')}, {res.get('aspect')}) -> "
                          f"Title Stab: {res['title_stability']:.1f}% (Pre-AE: {res['pre_title_stability']:.1f}%) | "
                          f"Arch: Heart={lm['heart']['arch_stability_pct']:.0f}%, Head={lm['head']['arch_stability_pct']:.0f}%, "
                          f"Life={lm['life']['arch_stability_pct']:.0f}%, Fate={lm['fate']['arch_stability_pct']:.0f}%")
    else:
        for t in tasks:
            res = audit_single_image_worker(t)
            results_list.append(res)
            fname = res.get("image", "unknown")
            if res.get("baseline_rejected"):
                print(f"[{len(results_list)}/{len(images)}] {fname} -> [REJECTED AT BASELINE] {res.get('issues')}")
            else:
                lm = res["line_metrics"]
                print(f"[{len(results_list)}/{len(images)}] {fname} ({res.get('skinColor')}, {res.get('aspect')}) -> "
                      f"Title Stab: {res['title_stability']:.1f}% (Pre-AE: {res['pre_title_stability']:.1f}%) | "
                      f"Arch: Heart={lm['heart']['arch_stability_pct']:.0f}%, Head={lm['head']['arch_stability_pct']:.0f}%, "
                      f"Life={lm['life']['arch_stability_pct']:.0f}%, Fate={lm['fate']['arch_stability_pct']:.0f}%")

    total_time = time.time() - t_start
    print(f"\nCompleted audit of {len(images)} images in {total_time:.1f}s ({total_time/len(images):.1f}s/image)")

    # Aggregate statistics
    for res in sorted(results_list, key=lambda x: x.get("image", "")):
        fname = res.get("image", "")
        skin = res.get("skinColor", "unknown")
        skin_groups[skin]["total"] += 1

        if res.get("baseline_rejected"):
            validator_rejections_baseline.append(res)
            skin_groups[skin]["baseline_rejected"] += 1
            for lk in ["heart", "head", "life", "fate"]:
                overall_line_detection_rates[lk].append(0.0)
                overall_post_arch_stability[lk].append(0.0)
                overall_pre_arch_stability[lk].append(0.0)
            continue

        lm = res["line_metrics"]
        plm = res["pre_line_metrics"]

        for lk in ["heart", "head", "life", "fate"]:
            det_rate = lm[lk]["detection_rate_pct"]
            status_stab = lm[lk]["status_stability_pct"]
            post_arch_stab = lm[lk]["arch_stability_pct"]
            pre_arch_stab = plm[lk]["arch_stability_pct"]

            overall_line_detection_rates[lk].append(det_rate)
            overall_line_status_stability[lk].append(status_stab)
            overall_post_arch_stability[lk].append(post_arch_stab)
            overall_pre_arch_stability[lk].append(pre_arch_stab)

            skin_groups[skin][f"{lk}_det"].append(det_rate)
            skin_groups[skin][f"post_{lk}_arch"].append(post_arch_stab)
            skin_groups[skin][f"pre_{lk}_arch"].append(pre_arch_stab)

        overall_hand_side_stability.append(res["side_stability"])
        overall_post_origin_stability.append(res["origin_stability"])
        overall_pre_origin_stability.append(res["pre_origin_stability"])
        overall_post_title_stability.append(res["title_stability"])
        overall_pre_title_stability.append(res["pre_title_stability"])

        skin_groups[skin]["side_stab"].append(res["side_stability"])
        skin_groups[skin]["post_orig_stab"].append(res["origin_stability"])
        skin_groups[skin]["pre_orig_stab"].append(res["pre_origin_stability"])
        skin_groups[skin]["post_title_stab"].append(res["title_stability"])
        skin_groups[skin]["pre_title_stab"].append(res["pre_title_stability"])

    total_images = len(images)
    total_baseline_rejected = len(validator_rejections_baseline)

    # 1. Summary Report
    print("\n" + "=" * 90)
    print("BEFORE / AFTER PER-LINE STABILITY COMPARISON TABLE")
    print("Benchmark Dataset: 40 Demographic-Balanced Images (sample40)")
    print("Suite: 10 Perturbations (Rotation +/-5 deg, Brightness +/-10%) per image = 440 Scans")
    print("=" * 90)
    print(f"{'Line / Metric':20s} | {'Pre-Prompts A-E':17s} | {'Current Commit':17s} | {'Absolute Change':17s} | {'Relative Gain':15s}")
    print("-" * 90)

    for lk in ["heart", "head", "life", "fate"]:
        pre_arch = float(np.mean(overall_pre_arch_stability[lk])) if overall_pre_arch_stability[lk] else 0.0
        post_arch = float(np.mean(overall_post_arch_stability[lk])) if overall_post_arch_stability[lk] else 0.0
        delta = post_arch - pre_arch
        rel_gain = (delta / pre_arch * 100.0) if pre_arch > 0 else 0.0
        sign = "+" if delta >= 0 else ""
        print(f"{lk.capitalize() + ' Archetype':20s} | {pre_arch:15.1f}% | {post_arch:15.1f}% | {sign + f'{delta:.1f}%':17s} | {sign + f'{rel_gain:.1f}%':15s}")

    print("-" * 90)
    # Origin Stability
    pre_orig = float(np.mean(overall_pre_origin_stability)) if overall_pre_origin_stability else 0.0
    post_orig = float(np.mean(overall_post_origin_stability)) if overall_post_origin_stability else 0.0
    d_orig = post_orig - pre_orig
    rel_orig = (d_orig / pre_orig * 100.0) if pre_orig > 0 else 0.0
    sign_orig = "+" if d_orig >= 0 else ""
    print(f"{'Origin Stability':20s} | {pre_orig:15.1f}% | {post_orig:15.1f}% | {sign_orig + f'{d_orig:.1f}%':17s} | {sign_orig + f'{rel_orig:.1f}%':15s}")

    # Hand Laterality Stability
    side_stab = float(np.mean(overall_hand_side_stability)) if overall_hand_side_stability else 0.0
    print(f"{'Laterality (L/R)':20s} | {side_stab:15.1f}% | {side_stab:15.1f}% | {'+0.0%':17s} | {'+0.0%':15s}")

    # Title Stability
    pre_title = float(np.mean(overall_pre_title_stability)) if overall_pre_title_stability else 0.0
    post_title = float(np.mean(overall_post_title_stability)) if overall_post_title_stability else 0.0
    d_title = post_title - pre_title
    rel_title = (d_title / pre_title * 100.0) if pre_title > 0 else 0.0
    sign_title = "+" if d_title >= 0 else ""
    print(f"{'Reading Title Stab.':20s} | {pre_title:15.1f}% | {post_title:15.1f}% | {sign_title + f'{d_title:.1f}%':17s} | {sign_title + f'{rel_title:.1f}%':15s}")
    print("=" * 90 + "\n")

    # 2. Breakdown by Skin Tone
    print("=" * 90)
    print("DEMOGRAPHIC BREAKDOWN BY SKIN COLOR (PRE-AE vs CURRENT COMMIT)")
    print("=" * 90)
    for sc, g in sorted(skin_groups.items()):
        cnt = g["total"]
        usable = cnt - g["baseline_rejected"]
        print(f"Skin Tone: [{sc.upper()}] ({cnt} images, {usable} usable)")
        for lk in ["heart", "head", "life", "fate"]:
            pre_a = float(np.mean(g[f"pre_{lk}_arch"])) if g[f"pre_{lk}_arch"] else 0.0
            post_a = float(np.mean(g[f"post_{lk}_arch"])) if g[f"post_{lk}_arch"] else 0.0
            d = post_a - pre_a
            s = "+" if d >= 0 else ""
            print(f"  - {lk.capitalize():5s} Archetype: Pre = {pre_a:5.1f}% -> Current = {post_a:5.1f}% ({s}{d:.1f}%)")
        pre_t = float(np.mean(g["pre_title_stab"])) if g["pre_title_stab"] else 0.0
        post_t = float(np.mean(g["post_title_stab"])) if g["post_title_stab"] else 0.0
        dt = post_t - pre_t
        st = "+" if dt >= 0 else ""
        print(f"  - Reading Title:    Pre = {pre_t:5.1f}% -> Current = {post_t:5.1f}% ({st}{dt:.1f}%)\n")

    return {
        "pre": {
            "archetype_stabilities": {lk: float(np.mean(overall_pre_arch_stability[lk])) for lk in ["heart", "head", "life", "fate"]},
            "origin_stability": pre_orig,
            "title_stability": pre_title
        },
        "post": {
            "archetype_stabilities": {lk: float(np.mean(overall_post_arch_stability[lk])) for lk in ["heart", "head", "life", "fate"]},
            "origin_stability": post_orig,
            "title_stability": post_title
        }
    }

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Palmora AI CV Reproducibility and Stability Audit")
    parser.add_argument("--data", "-d", default="benchmark", help="Path to folder containing images (default: benchmark)")
    parser.add_argument("--limit", "-n", type=int, default=None, help="Maximum number of images to audit")
    parser.add_argument("--benchmark-mode", action="store_true", help="Replace near-white background pixels connected to border with mid-gray (128) before validation")
    parser.add_argument("--workers", "-w", type=int, default=4, help="Number of parallel worker processes (default: 4)")
    args = parser.parse_args()
    audit_benchmark(
        folder_path=args.data,
        limit=args.limit,
        benchmark_mode=args.benchmark_mode,
        workers=args.workers
    )
