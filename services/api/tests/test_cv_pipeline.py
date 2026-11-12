import cv2
import numpy as np
import pytest
from services.api.cv.validator import validate_palm_image
from services.api.cv.crease_analyzer import analyze_palm_creases
from services.api.cv.bokeh_engine import generate_palm_bokeh_portrait

def test_validate_palm_image_valid(synthetic_palm_image_bytes):
    is_usable, metrics, img = validate_palm_image(synthetic_palm_image_bytes)
    assert is_usable is True
    assert metrics.hand_detected is True
    assert metrics.width == 600
    assert metrics.height == 600
    assert metrics.blur_score > 20.0
    assert len(metrics.issues) == 0

def test_validate_palm_image_blank(blank_image_bytes):
    is_usable, metrics, img = validate_palm_image(blank_image_bytes)
    assert is_usable is False
    assert metrics.hand_detected is False
    assert any("hand or palm" in issue.lower() or "underexposed" in issue.lower() for issue in metrics.issues)

def test_validate_palm_image_invalid_bytes(invalid_bytes):
    is_usable, metrics, img = validate_palm_image(invalid_bytes)
    assert is_usable is False
    assert metrics.hand_detected is False
    assert any("unable to decode" in issue.lower() for issue in metrics.issues)

def test_analyze_palm_creases_on_synthetic_hand(synthetic_palm_image_bytes):
    is_usable, metrics, img = validate_palm_image(synthetic_palm_image_bytes)
    assert is_usable is True

    features, hand_side, roi_box = analyze_palm_creases(img, metrics)
    assert roi_box is not None
    assert len(roi_box) == 4

    # Check Heart, Head, and Life line schemas
    assert features.heart_line.name == "Heart Line"
    assert features.head_line.name == "Head Line"
    assert features.life_line.name == "Life Line"

    # Status must be valid enum
    for feat in [features.heart_line, features.head_line, features.life_line]:
        assert feat.status in ["detected", "uncertain", "not_detected", "unsupported"]
        assert feat.confidence_explanation is not None

def test_analyze_palm_creases_on_unusable_image(blank_image_bytes):
    is_usable, metrics, img = validate_palm_image(blank_image_bytes)
    assert is_usable is False

    features, hand_side, roi_box = analyze_palm_creases(img, metrics)
    assert features.heart_line.status == "not_detected"
    assert features.head_line.status == "not_detected"
    assert features.life_line.status == "not_detected"
    assert len(features.heart_line.path) == 0
    assert features.heart_line.failure_reason is not None

def test_crease_analyzer_returns_pixel_paths_and_detector_version(synthetic_palm_image_bytes):
    is_usable, metrics, img = validate_palm_image(synthetic_palm_image_bytes)
    assert is_usable is True

    features, hand_side, roi_box = analyze_palm_creases(img, metrics)
    # Check that pixel paths and detector version are populated
    for feat in [features.heart_line, features.head_line, features.life_line]:
        assert feat.detector_version == "multiscale_crease_extractor_v2.0"
        if feat.status == "detected":
            assert len(feat.pixel_path) > 0
            assert feat.pixel_path[0].x > 0
            assert feat.pixel_path[0].y > 0
            assert "length_ratio" in feat.measurements
            assert "curvature_index" in feat.measurements

def test_deterministic_repeatability_on_identical_image(synthetic_palm_image_bytes):
    """Verifies that analyzing the exact same image twice yields bit-identical measurements and coordinates."""
    _, metrics1, img1 = validate_palm_image(synthetic_palm_image_bytes)
    _, metrics2, img2 = validate_palm_image(synthetic_palm_image_bytes)

    features1, side1, roi1 = analyze_palm_creases(img1, metrics1)
    features2, side2, roi2 = analyze_palm_creases(img2, metrics2)

    assert side1 == side2
    assert roi1 == roi2
    for feat_name in ["heart_line", "head_line", "life_line"]:
        f1 = getattr(features1, feat_name)
        f2 = getattr(features2, feat_name)
        assert f1.status == f2.status
        assert f1.confidence == f2.confidence
        assert f1.measurements == f2.measurements
        assert len(f1.path) == len(f2.path)
        if f1.path:
            assert f1.path[0].x == f2.path[0].x
            assert f1.path[0].y == f2.path[0].y

def test_validator_returns_actionable_guidance_on_issues(blank_image_bytes, blurry_image_bytes):
    # Blank image guidance
    _, metrics_blank, _ = validate_palm_image(blank_image_bytes)
    assert len(metrics_blank.actionable_guidance) > 0
    assert any("open" in g.lower() or "lighting" in g.lower() or "hand" in g.lower() for g in metrics_blank.actionable_guidance)

    # Blurry image guidance
    _, metrics_blurry, _ = validate_palm_image(blurry_image_bytes)
    assert metrics_blurry.blur_score < 35.0
    assert any("blurry" in issue.lower() or "focus" in issue.lower() for issue in metrics_blurry.issues)
    assert any("steady" in g.lower() or "focus" in g.lower() for g in metrics_blurry.actionable_guidance)

def test_evaluation_suite_benchmark():
    from services.api.cv.evaluator import run_vision_evaluation_suite
    eval_res = run_vision_evaluation_suite()
    assert eval_res["total_test_cases"] == 7
    metrics = eval_res["metrics"]
    assert metrics["valid_image_acceptance_rate_pct"] == 100.0
    assert metrics["unusable_image_rejection_rate_pct"] >= 80.0
    assert metrics["mean_pipeline_latency_ms"] < 2500.0
    assert metrics["cost_per_evaluation_usd"] == 0.00


def test_preemptive_downscaling_on_high_res_image():
    """Verifies that an image exceeding 1600px max dimension is downscaled to cap CPU and memory footprint."""
    # Create a 2400x1800 test image
    high_res = np.zeros((1800, 2400, 3), dtype=np.uint8)
    high_res[:] = (30, 25, 20)
    # Add synthetic hand
    cv2.circle(high_res, (1200, 900), 500, (150, 180, 220), -1)
    _, encoded = cv2.imencode(".jpg", high_res)

    is_usable, metrics, img = validate_palm_image(encoded.tobytes())
    assert max(metrics.width, metrics.height) <= 1600
    assert max(img.shape[:2]) <= 1600


def test_landmark_guided_hand_rotation_rectification(synthetic_palm_image_bytes):
    """Verifies that hand rotation up to ±45° is rectified via knuckle/anatomical landmarks."""
    _, base_metrics, base_img = validate_palm_image(synthetic_palm_image_bytes)
    h, w = base_img.shape[:2]
    cx, cy = w / 2.0, h / 2.0

    for tilt_angle in [-42.0, -25.0, 25.0, 42.0]:
        M = cv2.getRotationMatrix2D((cx, cy), tilt_angle, 1.0)
        tilted = cv2.warpAffine(base_img, M, (w, h), borderMode=cv2.BORDER_REPLICATE)
        _, enc = cv2.imencode(".jpg", tilted)
        is_usable, metrics, img = validate_palm_image(enc.tobytes())
        assert is_usable is True

        features, side, roi = analyze_palm_creases(img, metrics)
        # Should detect creases despite tilt up to ±45°
        assert features.heart_line.status in ["detected", "uncertain"]
        assert features.head_line.status in ["detected", "uncertain"]
        assert features.life_line.status in ["detected", "uncertain"]


def test_smoothed_arclength_and_pca_orientation():
    from services.api.cv.crease_analyzer import (
        _compute_smoothed_arclength,
        _compute_polyline_orientation_pca
    )
    import numpy as np

    # 1. Smoothed Arc Length: test staircased discrete polyline
    # 5 steps horizontal, 5 vertical stair steps: raw length = 10.0, chord = hypot(5, 5) = 7.071
    staircase = np.array([
        [0.0, 0.0], [1.0, 0.0], [1.0, 1.0], [2.0, 1.0], [2.0, 2.0],
        [3.0, 2.0], [3.0, 3.0], [4.0, 3.0], [4.0, 4.0], [5.0, 4.0], [5.0, 5.0]
    ])
    arc_len, chord_len = _compute_smoothed_arclength(staircase, smoothing_passes=2)
    assert chord_len == pytest.approx(float(np.hypot(5.0, 5.0)), 0.001)
    # Smoothed arc length must be less than raw jagged sum (10.0) but greater than or equal to chord (7.071)
    assert chord_len <= arc_len < 10.0

    # 2. PCA Orientation: straight line with a hook at the very end
    # Line from (0, 0) to (100, 0) with a 90° hook at (100, 30)
    hooked_line = np.array([[x, 0.0] for x in np.linspace(0, 100, 20)] + [[100.0, 15.0], [100.0, 30.0]])
    # Endpoint chord would report arctan2(30, 100) = 16.7°
    # PCA over whole polyline should align dominantly with horizontal axis (close to 0°)
    pca_angle = _compute_polyline_orientation_pca(hooked_line)
    assert abs(pca_angle) < 6.0


def test_head_life_origin_deadband_and_ambiguous():
    from services.api.readings.generator import _check_head_life_origin
    from services.api.schemas.palm import CreaseFeature, Point2D

    def make_feat(name, status, origin_ratio=None, origin_status=None, path=None):
        meas = {}
        if origin_ratio is not None:
            meas["origin_distance_ratio"] = origin_ratio
        if origin_status is not None:
            meas["origin_status"] = origin_status
        return CreaseFeature(
            name=name,
            status=status,
            path=path or [Point2D(x=0.2, y=0.4), Point2D(x=0.6, y=0.4)],
            pixel_path=[Point2D(x=100.0, y=200.0)],
            measurements=meas
        )

    # Joined: ratio < 0.08
    h_j = make_feat("Head Line", "detected", origin_ratio=0.05, origin_status="joined")
    l_j = make_feat("Life Line", "detected", origin_ratio=0.05, origin_status="joined")
    status, _ = _check_head_life_origin(h_j, l_j)
    assert status == "joined"

    # Ambiguous (deadband): 0.08 <= ratio <= 0.13
    h_a = make_feat("Head Line", "detected", origin_ratio=0.10, origin_status="ambiguous")
    l_a = make_feat("Life Line", "detected", origin_ratio=0.10, origin_status="ambiguous")
    status, comm = _check_head_life_origin(h_a, l_a)
    assert status == "ambiguous"
    assert "transitional" in comm.lower() or "adaptable" in comm.lower()

    # Separated: ratio > 0.13
    h_s = make_feat("Head Line", "detected", origin_ratio=0.18, origin_status="separated")
    l_s = make_feat("Life Line", "detected", origin_ratio=0.18, origin_status="separated")
    status, _ = _check_head_life_origin(h_s, l_s)
    assert status == "separated"


def test_face_and_non_hand_anatomical_rejection():
    """
    Verifies that human faces, heads, room furniture, or oval blobs lacking palmar anatomy
    are firmly rejected as non-hands, preventing hallucinated crease lines and false detections.
    """
    # Create an oval face-like image (skin oval without finger rays or web clefts)
    face_img = np.zeros((600, 600, 3), dtype=np.uint8)
    face_img[:] = (35, 30, 25)
    # Head / Face oval in center
    cv2.ellipse(face_img, (300, 320), (140, 190), 0, 0, 360, (150, 180, 220), -1)
    # Hair on top
    cv2.ellipse(face_img, (300, 180), (145, 70), 0, 180, 360, (20, 20, 20), -1)
    _, enc_face = cv2.imencode(".jpg", face_img)

    is_usable, metrics, img = validate_palm_image(enc_face.tobytes())
    assert is_usable is False
    assert metrics.hand_detected is False
    assert metrics.palm_visible is False
    assert any("face" in issue.lower() or "non-hand" in issue.lower() or "no open palm" in issue.lower() for issue in metrics.issues)

    features, side, roi = analyze_palm_creases(img, metrics)
    assert side == "unknown"
    assert roi is None
    assert features.heart_line.status == "not_detected"
    assert features.head_line.status == "not_detected"
    assert features.life_line.status == "not_detected"


def test_dual_path_bokeh_engine_preserves_palm_interior(synthetic_palm_image_bytes):
    """
    Verifies that the Dual-Path Bokeh Engine:
    1. Generates an aesthetic background blur without error.
    2. Returns a valid base64 data URI for frontend display.
    3. Strictly preserves palm center pixels (alpha == 1.0, bit-for-bit identical to original).
    """
    nparr = np.frombuffer(synthetic_palm_image_bytes, np.uint8)
    original_bgr = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    bokeh_bgr, bokeh_data_uri = generate_palm_bokeh_portrait(original_bgr, blur_kernel_size=31, feather_px=10.0)

    assert bokeh_bgr is not None
    assert bokeh_bgr.shape == original_bgr.shape
    assert bokeh_data_uri.startswith("data:image/jpeg;base64,")

    # In synthetic palm, center (x=300, y=360) is deeply inside the palm mask
    # Palm interior must be bit-for-bit identical to original
    palm_center_orig = original_bgr[360, 300]
    palm_center_bokeh = bokeh_bgr[360, 300]
    np.testing.assert_array_equal(
        palm_center_orig,
        palm_center_bokeh,
        err_msg="Bokeh engine must NOT alter or blur pixels inside the palm interior"
    )


def test_bezier_spline_and_cross_sectional_valley_profiling(synthetic_palm_image_bytes):
    """
    Stage 1 Verification:
    Ensures that detected creases produce valid cubic Bézier control points [P0, P1, P2, P3]
    and honest physical valley depth measurements without arbitrary or randomized values.
    """
    is_usable, metrics, img = validate_palm_image(synthetic_palm_image_bytes)
    assert is_usable is True

    features, hand_side, roi = analyze_palm_creases(img, metrics)

    # Check at least one detected line
    detected_feats = [f for f in [features.heart_line, features.head_line, features.life_line] if f.status == "detected"]
    assert len(detected_feats) > 0

    for feat in detected_feats:
        # Bézier control points verification
        assert feat.bezier_control_points is not None
        assert len(feat.bezier_control_points) == 4
        p0, p1, p2, p3 = feat.bezier_control_points
        assert 0.0 <= p0.x <= 1.0 and 0.0 <= p0.y <= 1.0
        assert 0.0 <= p3.x <= 1.0 and 0.0 <= p3.y <= 1.0

        # Physical cross-sectional measurements verification
        m = feat.measurements
        assert "valley_depth_px" in m
        assert "relative_depth" in m
        assert "continuity_ratio" in m
        assert "detected_breaks" in m
        assert "detected_forks" in m
        assert "tortuosity" in m
        assert m["tortuosity"] >= 1.0
        assert isinstance(m["detected_forks"], int)
        assert isinstance(m["detected_breaks"], int)






def test_tradition_weighting_and_confidence_gating_schema():
    from services.api.schemas.readings import PalmReadingReport, ReadingSection
    from datetime import datetime, timezone

    section = ReadingSection(
        title="Heart Line: Emotional Expression and Harmony",
        feature_name="Heart Line",
        feature_status="detected",
        traditional_interpretation="Classical interpretation",
        reflective_prompts=["Prompt 1", "Prompt 2"],
        confidence_note="Clear line visible"
    )

    report = PalmReadingReport(
        id="test_id",
        reading_title="Test Synthesis",
        created_at=datetime.now(timezone.utc).isoformat(),
        love_reading=section,
        career_reading=section,
        personality_reading=section,
        overall_synthesis="Integrative reflection",
        confidence_score=0.88,
        primary_tradition="Synthesis",
        tradition_weighting={
            "western_ratio": 0.45,
            "samudrika_ratio": 0.35,
            "shouxiang_ratio": 0.20
        },
        confidence_advisory=None
    )

    assert report.confidence_score == 0.88
    assert report.primary_tradition == "Synthesis"
    assert report.tradition_weighting["western_ratio"] == 0.45
    assert report.tradition_weighting["samudrika_ratio"] == 0.35
    assert report.tradition_weighting["shouxiang_ratio"] == 0.20
    assert sum(report.tradition_weighting.values()) == 1.0
    assert report.confidence_advisory is None

    # Low confidence gating
    report_low = PalmReadingReport(
        id="test_low",
        reading_title="Low Confidence Test",
        created_at=datetime.now(timezone.utc).isoformat(),
        love_reading=section,
        career_reading=section,
        personality_reading=section,
        overall_synthesis="Integrative reflection",
        confidence_score=0.55,
        confidence_advisory="Scan clarity advisory: Overall confidence score is below 0.70."
    )
    assert report_low.confidence_score == 0.55
    assert report_low.confidence_advisory is not None
