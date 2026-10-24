import time
import os
import cv2
import numpy as np
from concurrent.futures import ThreadPoolExecutor
from services.api.cv.validator import validate_palm_image
from services.api.cv.crease_analyzer import analyze_palm_creases
from services.api.schemas.palm import Point2D
from services.api.readings.generator import (
    _evaluate_heart,
    _evaluate_head,
    _evaluate_life,
    _evaluate_fate
)

PERTURBATIONS = [
    (0.0, 1.00),    # Original
    (-2.0, 0.95),   # Perturbation 1: -2 deg, -5% brightness
    (2.0, 1.05),    # Perturbation 2: +2 deg, +5% brightness
    (-2.0, 1.05),   # Perturbation 3: -2 deg, +5% brightness
    (2.0, 0.95),    # Perturbation 4: +2 deg, -5% brightness
]

def perturb_image(img: np.ndarray, angle: float, brightness: float) -> np.ndarray:
    out = img
    if abs(angle) >= 1e-4:
        h, w = out.shape[:2]
        center = (w / 2.0, h / 2.0)
        M = cv2.getRotationMatrix2D(center, angle, 1.0)
        out = cv2.warpAffine(out, M, (w, h), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
    if abs(brightness - 1.0) >= 1e-4:
        out = cv2.convertScaleAbs(out, alpha=brightness, beta=0)
    return out

def run_single(args):
    img_work, quality, angle, brightness = args
    pert_img = perturb_image(img_work, angle, brightness)
    feats, side, roi = analyze_palm_creases(pert_img, quality)
    
    # Extract archetypes
    h_eval = _evaluate_heart(feats.heart_line)
    hd_eval = _evaluate_head(feats.head_line)
    l_eval = _evaluate_life(feats.life_line)
    f_eval = _evaluate_fate(feats.fate_line)
    
    return {
        "features": feats,
        "hand_side": side,
        "roi_box": roi,
        "archetypes": {
            "heart": h_eval[4],
            "head": hd_eval[4],
            "life": l_eval[4],
            "fate": f_eval[3]
        }
    }

benchmark_dir = "benchmark"
images = [f for f in os.listdir(benchmark_dir) if f.endswith(".jpg")]
images.sort()

print(f"Testing {len(images)} benchmark images with 5-run ensemble:")
for img_name in images:
    img_path = os.path.join(benchmark_dir, img_name)
    with open(img_path, "rb") as f:
        content = f.read()
    
    is_usable, quality, decoded_img = validate_palm_image(content)
    if not is_usable or decoded_img is None:
        print(f"{img_name}: Not usable")
        continue
    
    orig_h, orig_w = decoded_img.shape[:2]
    
    t0 = time.perf_counter()
    
    # Downscale for performance if larger than 800
    max_dim = max(orig_h, orig_w)
    if max_dim > 800:
        scale = 800.0 / max_dim
        work_w = int(orig_w * scale)
        work_h = int(orig_h * scale)
        work_img = cv2.resize(decoded_img, (work_w, work_h), interpolation=cv2.INTER_AREA)
    else:
        work_img = decoded_img
        scale = 1.0

    tasks = [(work_img, quality, ang, br) for ang, br in PERTURBATIONS]
    with ThreadPoolExecutor(max_workers=min(4, os.cpu_count() or 4)) as pool:
        results = list(pool.map(run_single, tasks))
    
    elapsed = time.perf_counter() - t0
    
    # Voting
    line_keys = ["heart", "head", "life", "fate"]
    votes_summary = {}
    for lk in line_keys:
        votes = [r["archetypes"][lk] for r in results]
        from collections import Counter
        counts = Counter(votes)
        majority, maj_count = counts.most_common(1)[0]
        vote_share = round(maj_count / len(results), 2)
        votes_summary[lk] = (majority, vote_share, maj_count)
    
    print(f"{img_name}: {elapsed:.3f}s | {votes_summary}")
