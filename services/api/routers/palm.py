import uuid
import time
import os
import logging
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
import cv2
import numpy as np
from fastapi import APIRouter, UploadFile, File, HTTPException, status, Depends, Request
from fastapi.concurrency import run_in_threadpool
from ..cv.validator import validate_palm_image
from ..cv.crease_analyzer import analyze_palm_creases
from ..cv.bokeh_engine import generate_palm_bokeh_portrait
from ..schemas.palm import (
    ImageQualityMetrics,
    PalmAnalysisResult,
    PalmFeatures,
    Point2D
)
from ..readings.generator import (
    _evaluate_heart,
    _evaluate_head,
    _evaluate_life,
    _evaluate_fate
)
from ..config import settings
from ..security import get_current_user_id
from ..cache import cache_client

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/palm", tags=["Palm Vision Pipeline"])

# In-memory ephemeral store for guest / short-lived session analyses (backward-compatible mirror)
# Schema: {analysis_id: {"user_id": str, "features": dict, "data": dict}}
EPHEMERAL_ANALYSIS_STORE = {}

# 5 deterministic runs: original + 4 perturbations (rotation ±2°, brightness ±5%)
ENSEMBLE_PERTURBATIONS = [
    (0.0, 1.00),    # Original
    (-2.0, 0.95),   # Perturbation 1: -2°, -5% brightness
    (2.0, 1.05),    # Perturbation 2: +2°, +5% brightness
    (-2.0, 1.05),   # Perturbation 3: -2°, +5% brightness
    (2.0, 0.95),    # Perturbation 4: +2°, -5% brightness
]

def _perturb_image(img: np.ndarray, angle: float, brightness: float) -> np.ndarray:
    """Applies rotation (degrees) and brightness scale factor deterministically."""
    out = img
    if abs(angle) >= 1e-4:
        h, w = out.shape[:2]
        center = (w / 2.0, h / 2.0)
        M = cv2.getRotationMatrix2D(center, angle, 1.0)
        out = cv2.warpAffine(out, M, (w, h), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
    if abs(brightness - 1.0) >= 1e-4:
        out = cv2.convertScaleAbs(out, alpha=brightness, beta=0)
    return out

def _run_single_ensemble_pass(args):
    """Executes crease analysis and archetype classification for a single perturbed image."""
    img_work, quality, angle, brightness = args
    pert_img = _perturb_image(img_work, angle, brightness)
    feats, side, roi = analyze_palm_creases(pert_img, quality)
    
    h_eval = _evaluate_heart(feats.heart_line)
    hd_eval = _evaluate_head(feats.head_line)
    l_eval = _evaluate_life(feats.life_line)
    f_eval = _evaluate_fate(feats.fate_line)
    
    return {
        "features": feats,
        "hand_side": side,
        "roi_box": roi,
        "archetypes": {
            "heart": h_eval.archetype_key,
            "head": hd_eval.archetype_key,
            "life": l_eval.archetype_key,
            "fate": f_eval.archetype_key
        }
    }

def _run_test_time_ensemble(decoded_img: np.ndarray, quality_metrics: ImageQualityMetrics):
    """
    Executes Dual-Scale Test-Time Ensembling:
    1. Native High-Precision Base Extraction:
       Runs analyze_palm_creases at full un-downscaled image resolution (capped at 1600px max_dim)
       to capture fine sub-digital ridge details, millimeter-accurate crease paths, and exact lengths.
    2. Concurrent Perturbation Voting:
       Runs 4 deterministic perturbations (rotation ±2°, brightness ±5%) in parallel
       on a fast working resolution (max_dim 800px) purely for archetype stability voting.
    3. Merges majority vote shares into base_features confidence without degrading crease geometry.
    Maintains latency well under 6 seconds.
    """
    t0 = time.perf_counter()
    orig_h, orig_w = decoded_img.shape[:2]
    max_dim = max(orig_h, orig_w)

    # 1. Native High-Precision Base Extraction
    if max_dim > 1600:
        base_scale = 1600.0 / max_dim
        base_w = int(orig_w * base_scale)
        base_h = int(orig_h * base_scale)
        base_img = cv2.resize(decoded_img, (base_w, base_h), interpolation=cv2.INTER_AREA)
    else:
        base_img = decoded_img
        base_scale = 1.0

    base_features, hand_side, roi_box = analyze_palm_creases(base_img, quality_metrics)

    # Base pass archetypes (pass 0 of ensemble)
    h_eval = _evaluate_heart(base_features.heart_line)
    hd_eval = _evaluate_head(base_features.head_line)
    l_eval = _evaluate_life(base_features.life_line)
    f_eval = _evaluate_fate(base_features.fate_line)
    base_archetypes = {
        "heart": h_eval.archetype_key,
        "head": hd_eval.archetype_key,
        "life": l_eval.archetype_key,
        "fate": f_eval.archetype_key
    }

    # Re-project pixel coordinates back to original image space if capped at 1600
    if base_scale < 1.0:
        for feat in [
            base_features.heart_line,
            base_features.head_line,
            base_features.life_line,
            base_features.fate_line
        ]:
            if feat is not None and feat.path:
                feat.pixel_path = [
                    Point2D(x=round(p.x * orig_w, 1), y=round(p.y * orig_h, 1))
                    for p in feat.path
                ]

    # 2. Perturbation Ensemble on Fast Working Resolution (800px)
    if max_dim > 800:
        work_scale = 800.0 / max_dim
        work_w = int(orig_w * work_scale)
        work_h = int(orig_h * work_scale)
        work_img = cv2.resize(decoded_img, (work_w, work_h), interpolation=cv2.INTER_AREA)
    else:
        work_img = decoded_img

    # 4 perturbation passes (runs 1..4)
    pert_tasks = [(work_img, quality_metrics, ang, br) for ang, br in ENSEMBLE_PERTURBATIONS[1:]]
    with ThreadPoolExecutor(max_workers=min(4, os.cpu_count() or 4)) as pool:
        pert_results = list(pool.map(_run_single_ensemble_pass, pert_tasks))

    # All 5 passes: base (run 0) + 4 perturbations (runs 1..4)
    all_archetypes = [base_archetypes] + [r["archetypes"] for r in pert_results]

    # Majority voting per line across all 5 ensemble passes
    line_keys = ["heart", "head", "life", "fate"]
    for lk in line_keys:
        votes = [arch[lk] for arch in all_archetypes]
        counts = Counter(votes)
        majority_arch, maj_count = counts.most_common(1)[0]
        # In case of tie, prioritize original (base) pass
        orig_arch = votes[0]
        if counts[orig_arch] == maj_count:
            majority_arch = orig_arch

        vote_share = round(maj_count / len(all_archetypes), 2)
        is_low_conf = (vote_share < 0.80)

        feat = getattr(base_features, f"{lk}_line", None)
        if feat is not None:
            feat.confidence = vote_share
            if feat.measurements is None:
                feat.measurements = {}
            feat.measurements["vote_share"] = vote_share
            feat.measurements["ensemble_archetype"] = majority_arch
            feat.measurements["ensemble_votes"] = dict(counts)
            feat.measurements["low_confidence"] = is_low_conf
            feat.measurements["confidence_level"] = "low" if is_low_conf else "high"
            feat.measurements["archetype_confidence"] = "low" if is_low_conf else "high"
            feat.measurements["archetype_key"] = majority_arch
            feat.measurements["previous_archetype"] = majority_arch

    elapsed_ms = round((time.perf_counter() - t0) * 1000.0, 1)
    logger.info(
        "Dual-scale test-time ensembling completed in %.1f ms (1 native base + %d fast perturbed passes, %.2fs latency)",
        elapsed_ms,
        len(pert_tasks),
        elapsed_ms / 1000.0
    )
    return base_features, hand_side, roi_box, elapsed_ms

def _get_client_ip(request: Request) -> str:
    """Extracts client IP from X-Forwarded-For header or direct connection."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "127.0.0.1"

def _process_palm_image(content: bytes):
    """Executes CPU-bound OpenCV validation, crease analysis with test-time ensembling, and optical background bokeh portrait generation."""
    is_usable, quality_metrics, decoded_img = validate_palm_image(content)
    if not is_usable or decoded_img is None:
        features, hand_side, roi_box = analyze_palm_creases(decoded_img, quality_metrics)
        return is_usable, quality_metrics, features, hand_side, roi_box, 0.0, None

    features, hand_side, roi_box, elapsed_ms = _run_test_time_ensemble(decoded_img, quality_metrics)
    
    # Dual-Path Bokeh: Generate aesthetic background blur while preserving pristine crease extraction
    bokeh_base64 = None
    try:
        _, bokeh_base64 = generate_palm_bokeh_portrait(decoded_img)
    except Exception as e:
        logger.warning(f"Bokeh portrait generation error: {e}")

    return is_usable, quality_metrics, features, hand_side, roi_box, elapsed_ms, bokeh_base64

@router.post("/validate", response_model=ImageQualityMetrics)
async def validate_image_endpoint(
    request: Request,
    file: UploadFile = File(...)
):
    """
    Validates uploaded image format, dimensions, illumination, blur, and palm presence.
    Returns diagnostic quality metrics without deep crease extraction.
    Offloaded to worker threadpool to prevent blocking the asyncio event loop.
    """
    client_ip = _get_client_ip(request)
    # Distributed rate limit protection keyed by client IP
    is_blocked, _, _ = await cache_client.is_rate_limited(
        f"cv_validate:{client_ip}",
        max_requests=settings.RATE_LIMIT_CV_PER_MINUTE * 2,
        window_seconds=60
    )
    if is_blocked:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Rate limit exceeded. Please wait a moment before validating another photograph."
        )

    if file.content_type not in ["image/jpeg", "image/png", "image/webp", "image/jpg"]:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Unsupported image format. Please upload a JPEG, PNG, or WebP photo."
        )

    content = await file.read()
    if len(content) > settings.MAX_IMAGE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Image exceeds size limit of {settings.MAX_IMAGE_SIZE_BYTES // (1024 * 1024)}MB."
        )

    _, quality_metrics, _ = await run_in_threadpool(validate_palm_image, content)
    return quality_metrics

@router.post("/analyze", response_model=PalmAnalysisResult)
async def analyze_palm_endpoint(
    request: Request,
    file: UploadFile = File(...),
    user_id: str = Depends(get_current_user_id)
):
    """
    Executes the full Computer Vision pipeline:
    1. Checks distributed rate limits for the verified caller and client IP.
    2. Decodes and assesses image quality.
    3. Segments palm region and identifies hand orientation.
    4. Traces anatomical creases (Heart, Head, Life, Fate lines) using directional black-hat filtering.
    5. Computes calibrated curvature and continuity metrics.
    6. Stores ephemeral analysis in Upstash Redis cache with a 15-minute TTL.
    Offloaded to worker threadpool via run_in_threadpool to keep the asyncio event loop responsive.
    """
    client_ip = _get_client_ip(request)

    # 1. Distributed rate limit protection (caller ID & client IP)
    is_blocked_user, _, _ = await cache_client.is_rate_limited(
        f"cv_analyze:{user_id}",
        max_requests=settings.RATE_LIMIT_CV_PER_MINUTE,
        window_seconds=60
    )
    is_blocked_ip, _, _ = await cache_client.is_rate_limited(
        f"cv_analyze_ip:{client_ip}",
        max_requests=settings.RATE_LIMIT_CV_PER_MINUTE * 2,
        window_seconds=60
    )
    if is_blocked_user or is_blocked_ip:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Rate limit exceeded. You may analyze up to 10 palm scans per minute."
        )

    if file.content_type not in ["image/jpeg", "image/png", "image/webp", "image/jpg"]:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Unsupported image format. Please upload a JPEG, PNG, or WebP photo."
        )

    content = await file.read()
    if len(content) > settings.MAX_IMAGE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Image exceeds size limit of {settings.MAX_IMAGE_SIZE_BYTES // (1024 * 1024)}MB."
        )

    is_usable, quality_metrics, features, hand_side, roi_box, elapsed_ms, bokeh_base64 = await run_in_threadpool(
        _process_palm_image, content
    )

    analysis_id = str(uuid.uuid4())
    result = PalmAnalysisResult(
        analysis_id=analysis_id,
        image_quality=quality_metrics,
        features=features,
        detected_hand_side=hand_side,
        palm_roi_box=roi_box,
        isolated_bokeh_image_base64=bokeh_base64,
        analysis_version="2.0",
        detector_model="multiscale_crease_extractor_v2.0",
        ensemble_timing_ms=elapsed_ms,
        ensemble_runs_count=5
    )

    record = {
        "user_id": user_id,
        "features": features.model_dump(),
        "data": result.model_dump()
    }

    # Store analysis metadata ephemerally in in-memory mirror and distributed Redis cache
    EPHEMERAL_ANALYSIS_STORE[analysis_id] = record
    await cache_client.set(
        f"ephemeral:analysis:{analysis_id}",
        record,
        ttl_seconds=settings.CACHE_DEFAULT_TTL_SECONDS
    )

    return result
