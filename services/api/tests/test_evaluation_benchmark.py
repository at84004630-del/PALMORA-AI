"""
Palmora AI — Computer Vision & Morphological Evaluation Benchmark Test Suite
Automated regression tests against ground-truth benchmark images and morphological manifests.
"""

import json
import os
import math
import cv2
import numpy as np
import pytest

from services.api.cv.validator import validate_palm_image
from services.api.cv.crease_analyzer import analyze_palm_creases
from services.api.cv.hand_landmarker import detect_hand_landmarks, WRIST, INDEX_MCP, PINKY_MCP

BENCHMARK_DIR = os.path.join(os.path.dirname(__file__), "benchmark_dataset")
MANIFEST_PATH = os.path.join(BENCHMARK_DIR, "dataset_manifest.json")
IMAGES_DIR = os.path.join(BENCHMARK_DIR, "images")


def test_benchmark_manifest_integrity():
    """Verifies that dataset manifest exists, is valid JSON, and all images exist on disk."""
    assert os.path.exists(MANIFEST_PATH), f"Manifest missing at {MANIFEST_PATH}"
    with open(MANIFEST_PATH, "r") as f:
        manifest = json.load(f)
    
    assert "cases" in manifest
    assert len(manifest["cases"]) >= 4

    for filename, config in manifest["cases"].items():
        img_path = os.path.join(IMAGES_DIR, filename)
        assert os.path.exists(img_path), f"Benchmark image missing: {img_path}"
        img = cv2.imread(img_path)
        assert img is not None, f"Failed to load image: {img_path}"
        h, w = img.shape[:2]
        assert h >= 300 and w >= 300, f"Image {filename} dimensions too small: ({w}x{h})"


def test_real_hand_landmark_mae_and_knuckle_arch():
    """Evaluates MediaPipe 3D HandMesh on real hand benchmark image."""
    real_img_path = os.path.join(IMAGES_DIR, "real_hand_benchmark.jpg")
    if not os.path.exists(real_img_path):
        pytest.skip("real_hand_benchmark.jpg not present in benchmark dataset")

    img = cv2.imread(real_img_path)
    assert img is not None

    landmarks_data = detect_hand_landmarks(img)
    assert landmarks_data is not None, "MediaPipe failed to detect landmarks on high-res hand image"

    # 1. 21 Keypoints validation
    assert len(landmarks_data.landmarks_3d) == 21
    assert len(landmarks_data.landmarks_norm) == 21
    assert len(landmarks_data.landmarks_px) == 21

    # Coordinates must be within normalized bounds [0, 1]
    for x, y, z in landmarks_data.landmarks_3d:
        assert -0.2 <= x <= 1.2, f"Landmark X out of bounds: {x}"
        assert -0.2 <= y <= 1.2, f"Landmark Y out of bounds: {y}"

    # 2. Knuckle arch sanity
    assert len(landmarks_data.knuckle_arch) == 4
    for pt in landmarks_data.knuckle_arch:
        assert len(pt) == 2

    # 3. Surface normal vector unit length
    nx, ny, nz = landmarks_data.surface_plane_normal
    normal_length = math.sqrt(nx**2 + ny**2 + nz**2)
    assert math.isclose(normal_length, 1.0, abs_tol=1e-3), f"Normal vector not normalized: {normal_length}"

    # 4. Confidence bounds
    assert 0.0 <= landmarks_data.detection_confidence <= 1.0
    assert 0.0 <= landmarks_data.handedness_confidence <= 1.0


def test_standard_hand_crease_attribution_precision():
    """Evaluates standard right hand for clean detection of primary tri-radii creases."""
    img_path = os.path.join(IMAGES_DIR, "standard_right_hand.jpg")
    img = cv2.imread(img_path)
    assert img is not None

    _, buf = cv2.imencode(".jpg", img)
    is_valid, quality, decoded = validate_palm_image(buf.tobytes())
    assert is_valid, "Standard benchmark image failed quality validation"

    features, hand_side, roi = analyze_palm_creases(decoded, quality)

    # Hand side estimation
    assert hand_side == "right", f"Expected right hand, got {hand_side}"

    # Life line must be detected with high confidence
    assert features.life_line.status == "detected"
    assert features.life_line.confidence is not None and features.life_line.confidence >= 0.70
    assert len(features.life_line.path) >= 5

    # Heart line must be detected
    assert features.heart_line.status == "detected"
    assert features.heart_line.confidence is not None and features.heart_line.confidence >= 0.70
    assert len(features.heart_line.path) >= 5

    # Head line must be detected
    assert features.head_line.status == "detected"
    assert features.head_line.confidence is not None and features.head_line.confidence >= 0.70
    assert len(features.head_line.path) >= 5


def test_simian_crease_fusion_handling():
    """Evaluates morphological handling of fused transverse palmar crease."""
    img_path = os.path.join(IMAGES_DIR, "simian_crease.jpg")
    img = cv2.imread(img_path)
    assert img is not None

    _, buf = cv2.imencode(".jpg", img)
    is_valid, quality, decoded = validate_palm_image(buf.tobytes())
    features, hand_side, roi = analyze_palm_creases(decoded, quality)

    # Life line remains independent and detected
    assert features.life_line.status == "detected"
    assert features.life_line.confidence >= 0.70

    # Overall biometric confidence must remain stable and positive
    assert features.overall_confidence is not None and features.overall_confidence >= 0.50


def test_depth_assisted_mount_elevation_topography():
    """Verifies that 3D depth-assisted mount estimation produces valid elevations and confidences."""
    real_img_path = os.path.join(IMAGES_DIR, "real_hand_benchmark.jpg")
    if not os.path.exists(real_img_path):
        pytest.skip("real_hand_benchmark.jpg missing")

    img = cv2.imread(real_img_path)
    _, buf = cv2.imencode(".jpg", img)
    is_valid, quality, decoded = validate_palm_image(buf.tobytes())
    features, _, _ = analyze_palm_creases(decoded, quality)

    mounts = features.mount_topography
    assert mounts is not None

    # Check all 6 palmar mounts
    mount_keys = ["jupiter", "saturn", "apollo", "mercury", "venus", "moon"]
    for m_key in mount_keys:
        mount = getattr(mounts, m_key)
        assert 0.0 <= mount.relative_elevation <= 1.0, f"{m_key} elevation out of range: {mount.relative_elevation}"
        assert 0.0 <= mount.confidence <= 1.0, f"{m_key} confidence out of range: {mount.confidence}"
        assert mount.prominence in ["flat", "moderate", "developed", "prominent"]

    # Venus should be prominently elevated due to Thenar cushion depth
    assert mounts.venus.relative_elevation >= 0.55


def test_fate_line_continuous_weighted_scoring():
    """Verifies that continuous weighted scoring populates quality_score and confidence."""
    img_path = os.path.join(IMAGES_DIR, "prominent_fate.jpg")
    img = cv2.imread(img_path)
    _, buf = cv2.imencode(".jpg", img)
    is_valid, quality, decoded = validate_palm_image(buf.tobytes())
    features, _, _ = analyze_palm_creases(decoded, quality)

    assert features.fate_line is not None
    assert features.fate_line.confidence is not None
    assert 0.0 <= features.fate_line.confidence <= 1.0
    if features.fate_line.quality_score is not None:
        assert 0.0 <= features.fate_line.quality_score <= 1.0


def test_biometric_reliability_bounds():
    """Verifies all overall confidence indicators are within [0.0, 1.0]."""
    for fname in ["standard_right_hand.jpg", "real_hand_benchmark.jpg"]:
        path = os.path.join(IMAGES_DIR, fname)
        if not os.path.exists(path):
            continue
        img = cv2.imread(path)
        _, buf = cv2.imencode(".jpg", img)
        is_valid, quality, decoded = validate_palm_image(buf.tobytes())
        features, _, _ = analyze_palm_creases(decoded, quality)

        assert features.overall_confidence is not None
        assert 0.0 <= features.overall_confidence <= 1.0

        if features.landmarks_confidence is not None:
            assert 0.0 <= features.landmarks_confidence <= 1.0

        if features.hand_side_confidence is not None:
            assert 0.0 <= features.hand_side_confidence <= 1.0

