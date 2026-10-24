import time
import os
import sys

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

import cv2
import numpy as np
from concurrent.futures import ProcessPoolExecutor
from services.api.routers.palm import _process_palm_image
from scratch.reproducibility_audit import replace_white_background, apply_perturbation, PERTURBATIONS

def audit_single_image(img_path):
    t0 = time.time()
    img = cv2.imread(img_path)
    if img is None:
        return None
    img = replace_white_background(img)
    _, base_bytes = cv2.imencode('.jpg', img)
    
    # 1 baseline scan
    res_base = _process_palm_image(base_bytes)
    
    # 10 perturbation scans
    results = [res_base]
    for rot, br in PERTURBATIONS:
        p_bytes = apply_perturbation(img, rot, br)
        res_p = _process_palm_image(p_bytes)
        results.append(res_p)
        
    t1 = time.time()
    return os.path.basename(img_path), len(results), t1 - t0

if __name__ == '__main__':
    images = [
        r'D:\benchmark_public\sample40\Hand_0000114.jpg',
        r'D:\benchmark_public\sample40\Hand_0000124.jpg',
    ]
    t_start = time.time()
    with ProcessPoolExecutor(max_workers=2) as executor:
        for name, count, duration in executor.map(audit_single_image, images):
            print(f"Processed {name}: {count} scans in {duration:.1f}s")
    print(f"Total time for 2 images in parallel: {time.time() - t_start:.1f}s")
