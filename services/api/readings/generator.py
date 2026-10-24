import uuid
import math
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional, Tuple
from ..schemas.palm import PalmFeatures, CreaseFeature, Point2D
from ..schemas.readings import (
    PalmReadingReport,
    ReadingSection,
    DualHandReadingReport,
    DualHandComparisonSection,
    TemporalDriftReport,
    CreaseDriftMeasurement,
    MountDriftMeasurement,
    RelationalDimensionComparison,
    RelationalSynastryReport,
    RelationshipCategory
)
from .library import (
    InterpretationRecord,
    HEART_LINE_RECORDS,
    HEAD_LINE_RECORDS,
    LIFE_LINE_RECORDS,
    FATE_LINE_RECORDS
)
from .llm_provider import call_llm_for_reading

def _extract_metric(measurements: Dict[str, Any], key: str, default: float) -> float:
    """Extracts a numeric measurement with type-safe fallback."""
    val = measurements.get(key)
    if val is None:
        return default
    try:
        return float(val)
    except (ValueError, TypeError):
        return default

def _normalize_curvature(measurements: Dict[str, Any], default: float = 1.05) -> float:
    """
    Normalizes curvature across different representations:
    - curvature_index (ratio: e.g. 1.02 - 1.25)
    - curvature (deflection ratio: e.g. 0.05 - 0.25 -> converts to 1.05 - 1.25)
    """
    curv = measurements.get("curvature_index")
    if curv is None:
        curv = measurements.get("curvature")
    if curv is None:
        return default
    try:
        c = float(curv)
        # If passed as deflection fraction (e.g. 0.12), convert to chord-arc index (1.12)
        if c < 0.70:
            return round(1.0 + c, 3)
        return round(c, 3)
    except (ValueError, TypeError):
        return default

def _calculate_vertical_deflection(path: List[Point2D]) -> Tuple[float, float]:
    """
    Computes maximum upward (toward fingers) and downward (toward wrist) deflection
    relative to the straight chord connecting start and end points.
    Returns: (max_upward_deflection, max_downward_deflection) in normalized units.
    """
    if not path or len(path) < 3:
        return 0.0, 0.0

    p0 = path[0]
    p1 = path[-1]
    dx = p1.x - p0.x
    dy = p1.y - p0.y
    chord_len = math.hypot(dx, dy)
    if chord_len < 1e-5:
        return 0.0, 0.0

    max_up = 0.0
    max_down = 0.0

    for pt in path[1:-1]:
        # Linear interpolation of chord y at pt.x if dx != 0
        if abs(dx) > 1e-4:
            t = (pt.x - p0.x) / dx
            expected_y = p0.y + t * dy
            diff = expected_y - pt.y  # Screen coords: smaller y is higher (closer to fingers)
            if diff > max_up:
                max_up = diff
            elif -diff > max_down:
                max_down = -diff
        else:
            # Vertical line: check x displacement
            t = (pt.y - p0.y) / (dy + 1e-5)
            expected_x = p0.x + t * dx
            diff = abs(pt.x - expected_x)
            if diff > max_up:
                max_up = diff

    return round(max_up, 4), round(max_down, 4)

class CreaseEvaluation(tuple):
    """
    Evaluation container that unpacks as a 5-tuple:
    (record, observed_summary, confidence_note, retake_recommended, archetype_key)
    for backwards compatibility, while exposing .confidence ('high' or 'low')
    and named attributes.
    """
    def __new__(cls, record, observed_summary, confidence_note, retake_recommended, archetype_key, confidence="high"):
        obj = super().__new__(cls, (record, observed_summary, confidence_note, retake_recommended, archetype_key))
        obj.record = record
        obj.observed_summary = observed_summary
        obj.confidence_note = confidence_note
        obj.retake_recommended = retake_recommended
        obj.archetype_key = archetype_key
        obj.confidence = confidence
        return obj

    def __repr__(self):
        return f"CreaseEvaluation(archetype_key='{self.archetype_key}', confidence='{self.confidence}')"

class FateEvaluation(tuple):
    """
    Evaluation container for Fate Line that unpacks as a 4-tuple:
    (record, observed_summary, confidence_note, archetype_key)
    while exposing .confidence ('high' or 'low').
    """
    def __new__(cls, record, observed_summary, confidence_note, archetype_key, confidence="high"):
        obj = super().__new__(cls, (record, observed_summary, confidence_note, archetype_key))
        obj.record = record
        obj.observed_summary = observed_summary
        obj.confidence_note = confidence_note
        obj.archetype_key = archetype_key
        obj.confidence = confidence
        return obj

    def __repr__(self):
        return f"FateEvaluation(archetype_key='{self.archetype_key}', confidence='{self.confidence}')"

_BLENDED_RECORD_CACHE: Dict[str, InterpretationRecord] = {}

def _get_or_create_record(feature_name: str, key: str, confidence: str = "high") -> InterpretationRecord:
    """
    Retrieves the InterpretationRecord for an archetype key.
    If the key is a blended label (e.g. 'arch_a__arch_b'), dynamically synthesizes
    a blended record combining both traditions with transparent limitations.
    """
    if feature_name == "Heart Line" and key in HEART_LINE_RECORDS:
        return HEART_LINE_RECORDS[key]
    elif feature_name == "Head Line" and key in HEAD_LINE_RECORDS:
        return HEAD_LINE_RECORDS[key]
    elif feature_name == "Life Line" and key in LIFE_LINE_RECORDS:
        return LIFE_LINE_RECORDS[key]
    elif feature_name == "Fate Line" and key in FATE_LINE_RECORDS:
        return FATE_LINE_RECORDS[key]

    if key in _BLENDED_RECORD_CACHE:
        return _BLENDED_RECORD_CACHE[key]

    if "__" in key:
        k1, k2 = key.split("__", 1)
        rec1 = _get_or_create_record(feature_name, k1, confidence="high")
        rec2 = _get_or_create_record(feature_name, k2, confidence="high")

        name1 = k1.replace('_', ' ').title()
        name2 = k2.replace('_', ' ').title()
        blended_desc = (
            f"This crease occupies an intermediate morphological transition zone between "
            f"two documented traditional formations: {name1} and {name2}. "
            f"In cultural palmistry lore, such transitional contours symbolize a dynamic equilibrium—blending "
            f"the qualities of both archetypes rather than conforming strictly to a single pattern. "
            f"Specifically: {rec1.description} Meanwhile, {rec2.description}"
        )

        blended_prompts = []
        if rec1.reflections:
            blended_prompts.append(rec1.reflections[0])
        if rec2.reflections:
            blended_prompts.append(rec2.reflections[0])
        if len(rec1.reflections) > 1:
            blended_prompts.append(rec1.reflections[1])
        elif len(rec2.reflections) > 1:
            blended_prompts.append(rec2.reflections[1])

        blended_rec = InterpretationRecord(
            interpretation_id=f"{rec1.interpretation_id}__{rec2.interpretation_id}",
            feature=feature_name,
            tradition_attribution=f"{rec1.tradition_attribution} / {rec2.tradition_attribution} (Blended Synthesis)",
            description=blended_desc,
            applicable_limitations=(
                f"Crease measurements reside in an ambiguous transition zone (classification confidence: {confidence}). "
                "Cultural folklore only; not diagnostic or predictive."
            ),
            reflections=blended_prompts
        )
        _BLENDED_RECORD_CACHE[key] = blended_rec
        return blended_rec

    if feature_name == "Heart Line":
        return HEART_LINE_RECORDS.get("heart_moderate_gentle", list(HEART_LINE_RECORDS.values())[0])
    elif feature_name == "Head Line":
        return HEAD_LINE_RECORDS.get("head_straight_horizontal", list(HEAD_LINE_RECORDS.values())[0])
    elif feature_name == "Life Line":
        return LIFE_LINE_RECORDS.get("life_long_grounded", list(LIFE_LINE_RECORDS.values())[0])
    else:
        return FATE_LINE_RECORDS.get("fate_central_vertical", list(FATE_LINE_RECORDS.values())[0])


# ============================================================================
# THREE-ZONE ARCHETYPE CLASSIFICATION WITH HYSTERESIS
# ============================================================================

def classify_heart_archetype(
    curv: float,
    length: float,
    angle: float,
    max_up: float,
    prev_state: Optional[str] = None
) -> Tuple[str, str]:
    """
    Three-zone archetype selection for Heart Line with hysteresis:
    - Clear-Low: heart_straight_saturn (confidence='high')
    - Ambiguous Low-Mid: heart_straight_saturn__heart_moderate_gentle (confidence='low')
    - Clear-Mid: heart_moderate_gentle (confidence='high')
    - Ambiguous Mid-High: heart_moderate_gentle__heart_curved_high_jupiter (confidence='low')
    - Clear-High: heart_curved_high_jupiter (confidence='high')
    - Clear-Long: heart_long_sweeping_percussion (confidence='high' when span dominates)
    """
    delta_c = 0.015
    delta_u = 0.005

    # 1. Clear-High (Curved High Jupiter)
    high_curv_thresh = 1.11
    high_up_thresh = 0.040
    if prev_state == "heart_curved_high_jupiter":
        high_curv_thresh -= delta_c
        high_up_thresh -= delta_u

    if curv >= high_curv_thresh or max_up >= high_up_thresh or angle >= 7.0:
        return "heart_curved_high_jupiter", "high"

    # 2. Clear-Long Span check (Long Sweeping Percussion: 4th archetype)
    long_thresh = 0.68
    if prev_state == "heart_long_sweeping_percussion":
        long_thresh -= 0.03
    if length >= long_thresh and curv < 1.09:
        return "heart_long_sweeping_percussion", "high"

    # 3. Ambiguous Mid-High Transition Zone
    amb_mid_high_curv = 1.08
    amb_mid_high_up = 0.028
    if prev_state == "heart_moderate_gentle__heart_curved_high_jupiter":
        amb_mid_high_curv -= delta_c / 2.0
    if (curv > amb_mid_high_curv and curv < 1.11) or (max_up > amb_mid_high_up and max_up < 0.040) or (angle > 3.5 and angle < 7.0):
        return "heart_moderate_gentle__heart_curved_high_jupiter", "low"

    # 4. Clear-Mid (Moderate Gentle)
    mid_low_c = 1.06
    mid_high_c = 1.08
    if prev_state == "heart_moderate_gentle":
        mid_low_c -= delta_c
        mid_high_c += delta_c
    if mid_low_c <= curv <= mid_high_c and max_up <= 0.035:
        return "heart_moderate_gentle", "high"

    # 5. Ambiguous Low-Mid Transition Zone
    amb_low_mid_c = 1.03
    if prev_state == "heart_straight_saturn__heart_moderate_gentle":
        amb_low_mid_c -= delta_c / 2.0
    if (amb_low_mid_c < curv < 1.06) or (0.015 < max_up <= 0.025):
        return "heart_straight_saturn__heart_moderate_gentle", "low"

    # 6. Clear-Low (Straight Saturn)
    return "heart_straight_saturn", "high"


def classify_head_archetype(
    curv: float,
    length: float,
    angle: float,
    max_down: float,
    prev_state: Optional[str] = None
) -> Tuple[str, str]:
    """
    Three-zone archetype selection for Head Line with hysteresis (max 3 archetypes):
    - Clear-Low: head_straight_horizontal (confidence='high')
    - Ambiguous Slope: head_straight_horizontal__head_sloping_moon (confidence='low')
    - Clear-High Slope: head_sloping_moon (confidence='high')
    - Clear-High Span: head_long_sweeping (confidence='high')
    - Ambiguous Span: head_straight_horizontal__head_long_sweeping (confidence='low')
    """
    delta_d = 0.005
    delta_ang = 1.5
    delta_l = 0.03

    # 1. Clear-High Span check
    long_thresh = 0.68
    if prev_state == "head_long_sweeping":
        long_thresh -= delta_l
    if length >= long_thresh:
        return "head_long_sweeping", "high"

    # 2. Ambiguous Span check
    if 0.62 <= length < 0.68:
        if max_down > 0.025 or angle < -5.0 or curv >= 1.07:
            return "head_sloping_moon__head_long_sweeping", "low"
        return "head_straight_horizontal__head_long_sweeping", "low"

    # 3. Clear-High Slope (Sloping Moon)
    high_down_thresh = 0.035
    high_ang_thresh = -7.0
    high_curv_thresh = 1.08
    if prev_state == "head_sloping_moon":
        high_down_thresh -= delta_d
        high_ang_thresh += delta_ang
        high_curv_thresh -= 0.015

    if max_down >= high_down_thresh or angle <= high_ang_thresh or curv >= high_curv_thresh:
        return "head_sloping_moon", "high"

    # 4. Ambiguous Slope check
    low_down_thresh = 0.018
    low_ang_thresh = -3.0
    low_curv_thresh = 1.04
    if prev_state == "head_straight_horizontal__head_sloping_moon":
        low_ang_thresh += delta_ang / 2.0
    if max_down > low_down_thresh or angle < low_ang_thresh or curv > low_curv_thresh:
        return "head_straight_horizontal__head_sloping_moon", "low"

    # 5. Clear-Low Slope (Straight Horizontal)
    return "head_straight_horizontal", "high"


def classify_life_archetype(
    curv: float,
    length: float,
    quality: float = 0.22,
    prev_state: Optional[str] = None
) -> Tuple[str, str]:
    """
    Three-zone archetype selection for Life Line with hysteresis (max 3 archetypes):
    - Clear-Low: life_close_radial (confidence='high')
    - Ambiguous Low-Mid: life_close_radial__life_long_grounded (confidence='low')
    - Clear-Mid: life_long_grounded (confidence='high')
    - Ambiguous Mid-High: life_long_grounded__life_wide_expansive (confidence='low')
    - Clear-High: life_wide_expansive (confidence='high')
    """
    delta_c = 0.015
    delta_l = 0.03

    # 1. Clear-High (Wide Expansive)
    high_c_thresh = 1.14
    if prev_state == "life_wide_expansive":
        high_c_thresh -= delta_c

    if curv >= high_c_thresh or (curv >= 1.11 and length >= 0.68):
        return "life_wide_expansive", "high"

    # 2. Ambiguous Mid-High Transition
    amb_high_c = 1.11
    if prev_state == "life_long_grounded__life_wide_expansive":
        amb_high_c -= delta_c / 2.0
    if amb_high_c < curv < 1.14:
        return "life_long_grounded__life_wide_expansive", "low"

    # 3. Clear-Mid (Long Grounded)
    mid_low_c = 1.07
    mid_high_c = 1.11
    mid_len_thresh = 0.58
    if prev_state == "life_long_grounded":
        mid_low_c -= delta_c
        mid_high_c += delta_c
        mid_len_thresh -= delta_l
    if mid_low_c <= curv <= mid_high_c and length >= mid_len_thresh:
        return "life_long_grounded", "high"

    # 4. Clear-Low (Close Radial)
    low_c_thresh = 1.04
    low_l_thresh = 0.52
    if prev_state == "life_close_radial":
        low_c_thresh += delta_c
        low_l_thresh += delta_l
    if curv <= low_c_thresh and length <= low_l_thresh:
        return "life_close_radial", "high"

    # 5. Ambiguous Low-Mid Transition (fallback transition)
    return "life_close_radial__life_long_grounded", "low"


def classify_fate_archetype(
    length: float,
    angle: float,
    status: str = "detected",
    prev_state: Optional[str] = None
) -> Tuple[str, str]:
    """
    Three-zone archetype selection for Fate Line with hysteresis (max 3 archetypes):
    - Clear-Absent: fate_absent_or_subtle (confidence='high')
    - Ambiguous Emergence: fate_absent_or_subtle__fate_central_vertical (confidence='low')
    - Clear-Vertical: fate_central_vertical (confidence='high')
    - Ambiguous Angle: fate_central_vertical__fate_origin_moon (confidence='low')
    - Clear-Diagonal: fate_origin_moon (confidence='high')
    """
    delta_ang = 3.0

    if status in ("not_detected", "unsupported") or length < 0.22:
        return "fate_absent_or_subtle", "high"

    if status == "uncertain" or (0.22 <= length < 0.32):
        return "fate_absent_or_subtle__fate_central_vertical", "low"

    abs_ang = abs(angle)
    # Clear-Vertical
    vert_thresh = 72.0
    if prev_state == "fate_central_vertical":
        vert_thresh -= delta_ang
    if abs_ang >= vert_thresh:
        return "fate_central_vertical", "high"

    # Clear-Diagonal
    diag_thresh = 58.0
    if prev_state == "fate_origin_moon":
        diag_thresh += delta_ang
    if abs_ang < diag_thresh:
        return "fate_origin_moon", "high"

    # Ambiguous Angle
    return "fate_central_vertical__fate_origin_moon", "low"


def _evaluate_heart(feat: CreaseFeature) -> CreaseEvaluation:
    """
    Evaluates Heart Line based on calibrated anatomical curvature, length, angle, and prominence.
    Uses three-zone hysteresis classifier.
    Returns: CreaseEvaluation (unpacks as 5-tuple: rec, obs, note, retake_recommended, archetype_key)
    """
    measurements = feat.measurements or {}
    curv = _normalize_curvature(measurements, default=1.04)
    length = _extract_metric(measurements, "length_ratio", 0.52)
    angle = _extract_metric(measurements, "orientation_angle_deg", 0.0)
    prominence = measurements.get("visual_prominence", "moderate")
    quality = feat.quality_score if feat.quality_score is not None else 0.20
    conf = feat.confidence if feat.confidence is not None else 0.65
    prev_state = measurements.get("previous_archetype") or measurements.get("_hysteresis_state")

    if feat.status in ("not_detected", "unsupported"):
        rec = HEART_LINE_RECORDS["heart_not_detected"]
        obs = "No continuous crease detected in the upper transverse palm zone."
        note = feat.confidence_explanation or "Feature was not detected. Visual data abstention applied."
        return CreaseEvaluation(rec, obs, note, True, "not_detected", "high")

    if feat.status == "uncertain":
        rec = HEART_LINE_RECORDS["heart_uncertain_faint"]
        obs = f"Faint or fragmented crease observed (length ratio: {length:.2f}, curvature: {curv:.2f}, contrast: {quality:.2f})."
        note = f"Visual detection was marked uncertain (confidence: {conf:.2f}). A retake under angled directional lighting is recommended."
        return CreaseEvaluation(rec, obs, note, True, "uncertain", "low")

    # Check for test-time ensemble majority archetype
    if measurements.get("ensemble_archetype"):
        archetype = measurements["ensemble_archetype"]
        vote_share = measurements.get("vote_share", feat.confidence if feat.confidence is not None else 1.0)
        conf_level = "low" if vote_share < 0.8 else "high"
    else:
        # Compute upward deflection
        max_up, _ = _calculate_vertical_deflection(feat.path or [])
        # Three-zone classification with hysteresis
        archetype, conf_level = classify_heart_archetype(curv, length, angle, max_up, prev_state=prev_state)
        if feat.confidence is not None and feat.confidence < 0.8:
            conf_level = "low"

    rec = _get_or_create_record("Heart Line", archetype, confidence=conf_level)

    # Persist state
    feat.measurements["archetype_confidence"] = conf_level
    feat.measurements["confidence"] = conf_level
    feat.measurements["archetype_key"] = archetype
    feat.measurements["_hysteresis_state"] = archetype
    feat.measurements["low_confidence"] = (conf_level == "low")

    if conf_level == "low":
        obs = (
            f"Upper transverse crease measured in an intermediate contour zone (curvature: {curv:.2f}, "
            f"length ratio: {length:.2f}, angle: {angle:+.1f}°)."
        )
        note = (
            f"Crease measurements occupy an ambiguous transition zone (confidence='low', visual_prominence: {prominence}). "
            f"Blended archetype '{archetype}' applied to prevent boundary oscillation."
        )
    elif archetype == "heart_curved_high_jupiter":
        obs = (
            f"Continuous upper transverse crease measured with pronounced upward curvature "
            f"(curvature index: {curv:.2f}, length ratio: {length:.2f}, angle: {angle:+.1f}°)."
        )
        note = f"Pronounced upward curvature measured above threshold (curvature index: {curv:.2f}, confidence='high')."
    elif archetype == "heart_long_sweeping_percussion":
        obs = (
            f"Extended transverse crease measured spanning widely across upper palm (length ratio: {length:.2f}, "
            f"curvature index: {curv:.2f}, orientation angle: {angle:+.1f}°)."
        )
        note = f"High continuous transverse length ratio measured across upper palm (length ratio: {length:.2f}, confidence='high')."
    elif archetype == "heart_moderate_gentle":
        obs = (
            f"Gently contoured crease measured across upper palm (length ratio: {length:.2f}, "
            f"curvature index: {curv:.2f}, angle: {angle:+.1f}°)."
        )
        note = f"Balanced curvature measured in moderate contour zone (curvature index: {curv:.2f}, confidence='high')."
    else:
        obs = (
            f"Horizontal transverse crease measured across upper palm "
            f"with length ratio {length:.2f} and curvature index {curv:.2f}."
        )
        note = f"Direct linear trajectory measured in clear-low curvature zone (confidence='high')."

    return CreaseEvaluation(rec, obs, note, False, archetype, conf_level)


def _evaluate_head(feat: CreaseFeature) -> CreaseEvaluation:
    """
    Evaluates Head Line based on calibrated downward slope, span, and prominence.
    Uses three-zone hysteresis classifier.
    Returns: CreaseEvaluation (unpacks as 5-tuple: rec, obs, note, retake_recommended, archetype_key)
    """
    measurements = feat.measurements or {}
    curv = _normalize_curvature(measurements, default=1.04)
    length = _extract_metric(measurements, "length_ratio", 0.54)
    angle = _extract_metric(measurements, "orientation_angle_deg", 0.0)
    prominence = measurements.get("visual_prominence", "moderate")
    quality = feat.quality_score if feat.quality_score is not None else 0.20
    conf = feat.confidence if feat.confidence is not None else 0.65
    prev_state = measurements.get("previous_archetype") or measurements.get("_hysteresis_state")

    if feat.status in ("not_detected", "unsupported"):
        rec = HEAD_LINE_RECORDS["head_not_detected"]
        obs = "No continuous crease detected in the mid-palm zone."
        note = feat.confidence_explanation or "Feature was not detected. Visual data abstention applied."
        return CreaseEvaluation(rec, obs, note, True, "not_detected", "high")

    if feat.status == "uncertain":
        rec = HEAD_LINE_RECORDS["head_uncertain_faint"]
        obs = f"Subtle mid-palm crease trace observed (length ratio: {length:.2f}, curvature: {curv:.2f}, contrast: {quality:.2f})."
        note = f"Visual detection was marked uncertain (confidence: {conf:.2f}). Retake recommended for higher fidelity."
        return CreaseEvaluation(rec, obs, note, True, "uncertain", "low")

    # Check for test-time ensemble majority archetype
    if measurements.get("ensemble_archetype"):
        archetype = measurements["ensemble_archetype"]
        vote_share = measurements.get("vote_share", feat.confidence if feat.confidence is not None else 1.0)
        conf_level = "low" if vote_share < 0.8 else "high"
    else:
        # Compute downward deflection
        _, max_down = _calculate_vertical_deflection(feat.path or [])
        # Three-zone classification with hysteresis
        archetype, conf_level = classify_head_archetype(curv, length, angle, max_down, prev_state=prev_state)
        if feat.confidence is not None and feat.confidence < 0.8:
            conf_level = "low"

    rec = _get_or_create_record("Head Line", archetype, confidence=conf_level)

    # Persist state
    feat.measurements["archetype_confidence"] = conf_level
    feat.measurements["confidence"] = conf_level
    feat.measurements["archetype_key"] = archetype
    feat.measurements["_hysteresis_state"] = archetype
    feat.measurements["low_confidence"] = (conf_level == "low")

    if conf_level == "low":
        obs = (
            f"Mid-palm crease measured in a transitional slope/span zone (curvature: {curv:.2f}, "
            f"length ratio: {length:.2f}, angle: {angle:+.1f}°)."
        )
        note = (
            f"Trajectory occupies an ambiguous transition zone between linear and sloping tendencies (confidence='low'). "
            f"Blended archetype '{archetype}' assigned."
        )
    elif archetype == "head_sloping_moon":
        obs = (
            f"Clear mid-palm crease measured sloping downward toward the lower hypothenar sector "
            f"with curvature {curv:.2f}, length ratio {length:.2f}, and decline angle {angle:+.1f}°."
        )
        note = f"Downward slope measured toward lower hypothenar sector (curvature: {curv:.2f}, confidence='high')."
    elif archetype == "head_long_sweeping":
        obs = (
            f"Extended mid-palm crease measured traversing broadly across central palm (length ratio: {length:.2f}, "
            f"curvature: {curv:.2f}, angle: {angle:+.1f}°)."
        )
        note = f"Extensive transverse span measured across mid-palm (length ratio: {length:.2f}, confidence='high')."
    else:
        obs = (
            f"Direct, horizontal mid-palm crease measured traversing steadily across central plane "
            f"with length ratio {length:.2f} and curvature index {curv:.2f}."
        )
        note = f"Direct horizontal orientation measured across mid-palm (confidence='high')."

    return CreaseEvaluation(rec, obs, note, False, archetype, conf_level)


def _evaluate_life(feat: CreaseFeature) -> CreaseEvaluation:
    """
    Evaluates Life Line based on radial curvature around thenar eminence, length, and depth.
    Uses three-zone hysteresis classifier.
    Returns: CreaseEvaluation (unpacks as 5-tuple: rec, obs, note, retake_recommended, archetype_key)
    """
    measurements = feat.measurements or {}
    curv = _normalize_curvature(measurements, default=1.08)
    length = _extract_metric(measurements, "length_ratio", 0.62)
    prominence = measurements.get("visual_prominence", "moderate")
    quality = feat.quality_score if feat.quality_score is not None else 0.22
    conf = feat.confidence if feat.confidence is not None else 0.70
    prev_state = measurements.get("previous_archetype") or measurements.get("_hysteresis_state")

    if feat.status in ("not_detected", "unsupported"):
        rec = LIFE_LINE_RECORDS["life_not_detected"]
        obs = "No clear thenar radial crease detected around thumb base."
        note = feat.confidence_explanation or "Feature was not detected. Visual data abstention applied."
        return CreaseEvaluation(rec, obs, note, True, "not_detected", "high")

    if feat.status == "uncertain":
        rec = LIFE_LINE_RECORDS["life_uncertain_faint"]
        obs = f"Delicate radial crease trace observed around thumb base (length: {length:.2f}, contrast: {quality:.2f})."
        note = f"Visual detection was marked uncertain (confidence: {conf:.2f}). Symbolic pacing reflection provided."
        return CreaseEvaluation(rec, obs, note, True, "uncertain", "low")

    # Check for test-time ensemble majority archetype
    if measurements.get("ensemble_archetype"):
        archetype = measurements["ensemble_archetype"]
        vote_share = measurements.get("vote_share", feat.confidence if feat.confidence is not None else 1.0)
        conf_level = "low" if vote_share < 0.8 else "high"
    else:
        # Three-zone classification with hysteresis
        archetype, conf_level = classify_life_archetype(curv, length, quality=quality, prev_state=prev_state)
        if feat.confidence is not None and feat.confidence < 0.8:
            conf_level = "low"

    rec = _get_or_create_record("Life Line", archetype, confidence=conf_level)

    # Persist state
    feat.measurements["archetype_confidence"] = conf_level
    feat.measurements["confidence"] = conf_level
    feat.measurements["archetype_key"] = archetype
    feat.measurements["_hysteresis_state"] = archetype
    feat.measurements["low_confidence"] = (conf_level == "low")

    if conf_level == "low":
        obs = (
            f"Radial crease contour measured in an intermediate curvature zone "
            f"(curvature index: {curv:.2f}, length ratio: {length:.2f})."
        )
        note = (
            f"Curvature index resides in an ambiguous transition zone (confidence='low', prominence: {prominence}). "
            f"Blended archetype '{archetype}' assigned."
        )
    elif archetype == "life_wide_expansive":
        obs = (
            f"Broad radial arch measured with wide sweep radius around the thumb base "
            f"(curvature index: {curv:.2f}, length ratio: {length:.2f}, prominence: {prominence})."
        )
        note = f"Wide sweep radius measured around thumb base (curvature: {curv:.2f}, confidence='high')."
    elif archetype == "life_close_radial":
        obs = (
            f"Narrow radial crease measured tracing close to the thumb base "
            f"(curvature index: {curv:.2f}, length ratio: {length:.2f})."
        )
        note = f"Close radial contour measured along thumb base (curvature: {curv:.2f}, confidence='high')."
    else:
        obs = (
            f"Continuous radial crease measured extending toward lower palm boundary "
            f"(length ratio: {length:.2f}, curvature: {curv:.2f}, contrast: {quality:.2f})."
        )
        note = f"Continuous radial arch measured toward lower palm boundary (confidence='high')."

    return CreaseEvaluation(rec, obs, note, False, archetype, conf_level)


def _evaluate_fate(feat: Optional[CreaseFeature]) -> FateEvaluation:
    """
    Evaluates Fate Line (central longitudinal crease) if present.
    Uses three-zone hysteresis classifier.
    Returns: FateEvaluation (unpacks as 4-tuple: rec, obs, note, archetype_key)
    """
    if not feat or feat.status in ("not_detected", "unsupported"):
        rec = FATE_LINE_RECORDS["fate_absent_or_subtle"]
        obs = "No dominant vertical longitudinal ridge detected in central palm column."
        note = "Absence of a prominent fate line is normal anatomical variation representing an unscripted, self-authored path."
        return FateEvaluation(rec, obs, note, "fate_absent_or_subtle", "high")

    measurements = feat.measurements or {}
    angle = _extract_metric(measurements, "orientation_angle_deg", 90.0)
    length = _extract_metric(measurements, "length_ratio", 0.45)
    prev_state = measurements.get("previous_archetype") or measurements.get("_hysteresis_state")
    # Check for test-time ensemble majority archetype
    if measurements.get("ensemble_archetype"):
        archetype = measurements["ensemble_archetype"]
        vote_share = measurements.get("vote_share", feat.confidence if feat.confidence is not None else 1.0)
        conf_level = "low" if vote_share < 0.8 else "high"
    else:
        archetype, conf_level = classify_fate_archetype(length, angle, status=feat.status, prev_state=prev_state)
        if feat.confidence is not None and feat.confidence < 0.8:
            conf_level = "low"

    rec = _get_or_create_record("Fate Line", archetype, confidence=conf_level)

    feat.measurements["archetype_confidence"] = conf_level
    feat.measurements["confidence"] = conf_level
    feat.measurements["archetype_key"] = archetype
    feat.measurements["_hysteresis_state"] = archetype
    feat.measurements["low_confidence"] = (conf_level == "low")

    if conf_level == "low":
        obs = f"Central longitudinal crease observed in a transitional zone (angle: {angle:+.1f}°, length: {length:.2f})."
        note = f"Crease orientation resides in an ambiguous zone (confidence='low'). Blended archetype '{archetype}' applied."
    elif archetype == "fate_origin_moon":
        obs = f"Diagonal longitudinal crease measured ascending from lower palm toward center (angle: {angle:+.1f}°, length: {length:.2f})."
        note = "Observed diagonal trajectory suggesting vocation shaped through collaboration and public resonance (confidence='high')."
    elif archetype == "fate_central_vertical":
        obs = f"Vertical crease measured ascending along the central longitudinal axis with length ratio {length:.2f}."
        note = "Observed defined central vertical column reflecting focused vocation and self-directed discipline (confidence='high')."
    else:
        obs = "Subtle or emerging longitudinal crease trace observed in central palm column."
        note = "Unscripted, self-authored vocational path with subtle trace contour (confidence='high')."

    return FateEvaluation(rec, obs, note, archetype, conf_level)


def _check_head_life_origin(head_feat: CreaseFeature, life_feat: CreaseFeature) -> Tuple[str, str]:
    """
    Evaluates whether Head Line and Life Line are joined at their origin, separated, or ambiguous.
    Returns: (origin_status: 'joined' | 'separated' | 'ambiguous' | 'indeterminate', commentary: str)
    """
    if head_feat.status != "detected" or life_feat.status != "detected":
        return "indeterminate", "Origin relationship could not be determined due to unsegmented crease margins."

    # Prefer precomputed origin status from CV measurements
    meas_status = (head_feat.measurements or {}).get("origin_status")
    if meas_status:
        if meas_status == "joined":
            return (
                "joined",
                "Head and Life lines share a conjoined origin at the radial margin, traditionally reflecting "
                "a thoughtful, reflective start in life with deep loyalty to family roots and measured consideration before action."
            )
        elif meas_status == "separated":
            return (
                "separated",
                "Head and Life lines exhibit a distinct separation at their origin, traditionally symbolizing "
                "an early independent spirit, bold self-reliance, and readiness to pioneer one's own direction."
            )
        elif meas_status == "ambiguous":
            return (
                "ambiguous",
                "Head and Life lines emerge in close proximity with a transitional margin at the radial origin, "
                "traditionally indicating an adaptable blend of measured family mindfulness and independent initiative."
            )
        elif meas_status == "indeterminate":
            return "indeterminate", "Origin relationship could not be determined due to unsegmented crease margins."

    h_path = head_feat.path or []
    l_path = life_feat.path or []
    if not h_path or not l_path:
        return "indeterminate", "Origin coordinates unavailable."

    # Compare starting coordinates with deadband fallback
    h_start = h_path[0]
    l_start = l_path[0]
    dist = math.hypot(h_start.x - l_start.x, h_start.y - l_start.y)

    if dist < 0.045:
        return (
            "joined",
            "Head and Life lines share a conjoined origin at the radial margin, traditionally reflecting "
            "a thoughtful, reflective start in life with deep loyalty to family roots and measured consideration before action."
        )
    elif dist > 0.075:
        return (
            "separated",
            "Head and Life lines exhibit a distinct separation at their origin, traditionally symbolizing "
            "an early independent spirit, bold self-reliance, and readiness to pioneer one's own direction."
        )
    else:
        return (
            "ambiguous",
            "Head and Life lines emerge in close proximity with a transitional margin at the radial origin, "
            "traditionally indicating an adaptable blend of measured family mindfulness and independent initiative."
        )

def _synthesize_reading_title(
    heart_key: str,
    head_key: str,
    life_key: str,
    fate_key: str,
    origin_status: str,
    hand_side: str,
    low_confidence_lines: Optional[set] = None
) -> str:
    """
    Synthesizes a distinct, poetic title derived from the exact combination of measured archetypes.
    Supports clear archetypes as well as blended transition archetypes.
    Excludes any line under 0.8 vote_share (low_confidence) from contributing to the title.
    """
    low_conf = set(low_confidence_lines) if low_confidence_lines else set()

    heart_descriptors = {
        "heart_curved_high_jupiter": ("Visionary", "Idealist", "Harmonious Heart"),
        "heart_straight_saturn": ("Grounded", "Steadfast", "Pragmatic Loyalty"),
        "heart_moderate_gentle": ("Balanced", "Equilibrium", "Empathetic Compass"),
        "heart_long_sweeping_percussion": ("Devoted", "Expansive Love", "Generous Nurturer"),
        "heart_straight_low_contour": ("Autonomous", "Discernment", "Sacred Boundaries"),
        "heart_delicate_whisper": ("Introspective", "Nuance", "Gentle Reverie"),
        "heart_uncertain_faint": ("Quiet", "Contemplation", "Subtle Radiance"),
        "heart_not_detected": ("Open", "Receptivity", "Uncharted Space"),
        # Blended
        "heart_straight_saturn__heart_moderate_gentle": ("Steadfast", "Balanced Heart", "Equilibrium"),
        "heart_moderate_gentle__heart_curved_high_jupiter": ("Harmonious", "Empathetic Seeker", "Warmth"),
        "heart_straight_saturn__heart_curved_high_jupiter": ("Discerning", "Integrative Heart", "Depth"),
    }

    head_descriptors = {
        "head_sloping_moon": ("Creative Intuition", "Imaginative Explorer"),
        "head_straight_horizontal": ("Pragmatic Strategist", "Empirical Architect"),
        "head_long_sweeping": ("Foundational Scholar", "Deep Inquirer"),
        "head_dual_creative_fork": ("Versatile Inventor", "Bridge of Art & Logic"),
        "head_compact_focused": ("Decisive Catalyst", "Action-Oriented Mind"),
        "head_delicate_fluid": ("Adaptable Thinker", "Fluid Perspectives"),
        "head_uncertain_faint": ("Reflective Mind", "Flexible Focus"),
        "head_not_detected": ("Inceptive Mind", "Clear Horizon"),
        # Blended
        "head_straight_horizontal__head_sloping_moon": ("Integrative Strategy", "Integrative Thinker"),
        "head_straight_horizontal__head_long_sweeping": ("Systematic Inquirer", "Comprehensive Strategist"),
        "head_sloping_moon__head_long_sweeping": ("Visionary Curiosity", "Visionary Inquirer"),
    }

    life_descriptors = {
        "life_wide_expansive": "Expansive Vitality",
        "life_close_radial": "Sanctuary & Mindful Conservation",
        "life_distinct_continuous": "Resilient Rhythms",
        "life_long_grounded": "Deeply Rooted Foundations",
        "life_delicate_receptive": "Sensitive Attunement",
        "life_uncertain_faint": "Gentle Pacing",
        "life_not_detected": "Open Vitality",
        # Blended
        "life_close_radial__life_long_grounded": "Anchored Sanctuary",
        "life_long_grounded__life_wide_expansive": "Expansive Foundations",
        "life_close_radial__life_wide_expansive": "Adaptive Vitality",
    }

    # Nuanced combinatorics based on interplay
    if origin_status == "separated":
        prefix = "The Independent"
    elif origin_status == "joined":
        prefix = "The Thoughtful"
    elif origin_status == "ambiguous":
        prefix = "The Adaptable"
    else:
        prefix = "The"

    # Middle phrase (Heart & Head descriptors with low-confidence exclusion)
    heart_excluded = "heart" in low_conf or heart_key in ("heart_not_detected", "heart_uncertain_faint", "uncertain", "not_detected")
    head_excluded = "head" in low_conf or head_key in ("head_not_detected", "head_uncertain_faint", "uncertain", "not_detected")

    h_adj = heart_descriptors.get(heart_key, ("Mindful", "Seeker", "Heart"))[0]
    head_noun = head_descriptors.get(head_key, ("Contemplative", "Thinker"))[1]

    if not heart_excluded and not head_excluded:
        middle = f"{h_adj} {head_noun}"
    elif heart_excluded and not head_excluded:
        middle = head_noun
    elif not heart_excluded and head_excluded:
        middle = f"{h_adj} Spirit"
    else:
        middle = "Seeker"

    # Suffix (Fate and Life descriptors with low-confidence exclusion)
    fate_excluded = "fate" in low_conf or fate_key in ("fate_absent_or_subtle", "not_detected", "uncertain")
    life_excluded = "life" in low_conf or life_key in ("life_not_detected", "life_uncertain_faint", "not_detected", "uncertain")
    life_trait = life_descriptors.get(life_key, "Purposeful Balance")

    if not fate_excluded:
        if fate_key == "fate_central_vertical":
            suffix = "of Purpose"
        elif fate_key == "fate_origin_moon":
            suffix = "of Collaborative Synergy"
        elif "central_vertical" in fate_key and "origin_moon" in fate_key:
            suffix = "of Collaborative Purpose"
        elif "absent_or_subtle" in fate_key and "central_vertical" in fate_key:
            suffix = "of Emergent Purpose"
        else:
            suffix = f"of {life_trait}" if not life_excluded else "of Balance"
    else:
        if not life_excluded:
            suffix = f"of {life_trait}"
        else:
            suffix = "of Balance"

    parts = [prefix, middle, suffix]
    return " ".join(p.strip() for p in parts if p and p.strip())

def _generate_combinatorial_synthesis(
    heart_rec: InterpretationRecord,
    head_rec: InterpretationRecord,
    life_rec: InterpretationRecord,
    fate_rec: InterpretationRecord,
    heart_key: str,
    head_key: str,
    life_key: str,
    fate_key: str,
    origin_status: str,
    origin_commentary: str,
    hand_side: str,
    heart_obs: str,
    head_obs: str,
    life_obs: str,
    mounts: Optional[Any] = None
) -> str:
    """
    Constructs a rich, dynamic multi-paragraph synthesis that weaves together
    the exact physical observations, traditional archetypes, hand side, and line interplay.
    Guarantees diverse, individualized text for every distinct palm.
    """
    # 1. Hand side framing
    if hand_side == "right":
        hand_context = (
            "Analyzed on your right hand—traditionally celebrated in classical chiromancy as the active "
            "vessel of deliberate cultivation, conscious choices, and manifested external purpose."
        )
    elif hand_side == "left":
        hand_context = (
            "Analyzed on your left hand—traditionally regarded as the receptive mirror of innate temperament, "
            "subconscious instincts, and the foundational emotional landscape you bring into the world."
        )
    else:
        hand_context = (
            "Analyzed across your palm's primary geometric plane—grounded in measured morphological ridge tracing."
        )

    # 2. Interplay paragraph (Heart & Head dynamic + origin)
    if "curved_high_jupiter" in heart_key and "moderate_gentle" in heart_key:
        emotional_tone = "an adaptable synthesis of emotional warmth, generous empathy, and grounded relational equilibrium"
    elif "straight_saturn" in heart_key and "moderate_gentle" in heart_key:
        emotional_tone = "measured composure, thoughtful boundaries, and quiet empathetic attentiveness"
    elif heart_key == "heart_curved_high_jupiter":
        emotional_tone = "generous emotional idealism and strong relational warmth"
    elif heart_key == "heart_straight_saturn":
        emotional_tone = "deliberate composure, self-reliance, and thoughtful emotional boundaries"
    elif heart_key == "heart_moderate_gentle":
        emotional_tone = "harmonious empathy balanced by pragmatic common sense"
    elif heart_key == "heart_long_sweeping_percussion":
        emotional_tone = "deep, expansive devotion and wholehearted community loyalty"
    elif heart_key == "heart_straight_low_contour":
        emotional_tone = "autonomous discernment and selective, deeply trusted alliances"
    else:
        emotional_tone = "gentle sensitivity and reflective nuance"

    if "straight_horizontal" in head_key and "sloping_moon" in head_key:
        intellectual_tone = "an integrative mindset bridging structured empirical reasoning with creative lateral intuition"
    elif "straight_horizontal" in head_key and "long_sweeping" in head_key:
        intellectual_tone = "systematic thoroughness, pairing rigorous empirical logic with comprehensive inquiry"
    elif "sloping_moon" in head_key and "long_sweeping" in head_key:
        intellectual_tone = "expansive imaginative curiosity, synthesizing deep exploration with lateral insight"
    elif head_key == "head_sloping_moon":
        intellectual_tone = "lateral creative imagination and conceptual intuition"
    elif head_key == "head_straight_horizontal":
        intellectual_tone = "empirical reasoning, structured problem-solving, and practical execution"
    elif head_key == "head_long_sweeping":
        intellectual_tone = "wide-ranging intellectual curiosity and deep investigative thoroughness"
    elif head_key == "head_dual_creative_fork":
        intellectual_tone = "a versatile intellect bridging creative vision with pragmatic mechanics"
    elif head_key == "head_compact_focused":
        intellectual_tone = "action-oriented clarity and decisive problem solving"
    else:
        intellectual_tone = "mental adaptability and an openness to shifting perspectives"

    p1 = (
        f"{hand_context} Your palm reveals a distinctive dialogue between emotional expression and intellectual strategy. "
        f"With your Heart Line exhibiting {emotional_tone} and your Head Line characterized by {intellectual_tone}, "
        f"your natural instinct is to navigate life's opportunities through a tailored synthesis of feeling and deliberation. "
        f"{origin_commentary}"
    )

    # 3. Vitality & Pacing paragraph (Life line & Fate line)
    if "close_radial" in life_key and "long_grounded" in life_key:
        vitality_tone = (
            "Your Life Line traces an anchored, conserving contour toward the lower wrist, symbolizing "
            "a harmonious integration of quiet personal sanctuary with patient, enduring daily stamina."
        )
    elif "long_grounded" in life_key and "wide_expansive" in life_key:
        vitality_tone = (
            "Your Life Line charts an expansive yet deeply rooted arch, traditionally reflecting a balance "
            "between outward sensory adventure and enduring, patient foundations."
        )
    elif life_key == "life_wide_expansive":
        vitality_tone = (
            "Your Life Line charts a wide, expansive radial arch around the base of the thumb, symbolically reflecting "
            "an outward appetite for sensory engagement, physical vitality, and enthusiasm for life's adventures."
        )
    elif life_key == "life_close_radial":
        vitality_tone = (
            "Your Life Line traces a gentle contour closer to the thumb base, traditionally representing an instinct for "
            "mindful energy conservation, intentional daily pacing, and deep appreciation for quiet personal sanctuaries."
        )
    elif life_key == "life_long_grounded":
        vitality_tone = (
            "Your Life Line extends steadily toward the wrist base, symbolizing rooted stability, patience, and a "
            "commitment to building enduring foundations that weather changing seasons."
        )
    elif life_key == "life_delicate_receptive":
        vitality_tone = (
            "Your Life Line presents a delicate, finely etched trace, reflecting somatic receptivity—flourishing best "
            "when supported by rhythmic restorative habits and unhurried daily breathing room."
        )
    else:
        vitality_tone = (
            "Your Life Line displays a steady, continuous radial contour, traditionally regarded as an emblem of tenacity, "
            "grounded resolve, and rhythmic equilibrium."
        )

    if "central_vertical" in fate_key and "origin_moon" in fate_key:
        fate_tone = (
            " An intermediate central crease orientation indicates that your vocation blends self-directed "
            "craft mastery with collaborative synergy, flourishing through both personal agency and teamwork."
        )
    elif "absent_or_subtle" in fate_key and "central_vertical" in fate_key:
        fate_tone = (
            " An emerging central crease trace suggests an evolving vocational focus, transitioning from an "
            "unscripted exploratory phase toward defined personal craft and disciplined calling."
        )
    elif fate_key == "fate_central_vertical":
        fate_tone = (
            " The presence of a defined central vertical longitudinal crease (Saturn Line) underscores a strong "
            "sense of personal vocation, self-directed discipline, and commitment to an authentic professional craft."
        )
    elif fate_key == "fate_origin_moon":
        fate_tone = (
            " The diagonal ascent of your central crease indicates that your vocation flourishes most dynamically "
            "through creative collaboration, public resonance, and adaptive teamwork."
        )
    else:
        fate_tone = (
            " An unscripted central palm column indicates freedom from rigid career dogmas, offering you the autonomy "
            "to reinvent your vocational goals as your wisdom and interests evolve."
        )

    skin_contrast_text = ""
    if mounts:
        contrast_notes = []
        venus_m = getattr(mounts, "venus", None)
        if venus_m and venus_m.prominence in ["developed", "prominent"]:
            contrast_notes.append("thenar zone")
        jup_m = getattr(mounts, "jupiter", None)
        if jup_m and jup_m.prominence in ["developed", "prominent"]:
            contrast_notes.append("sub-index zone")
        moon_m = getattr(mounts, "moon", None)
        if moon_m and moon_m.prominence in ["developed", "prominent"]:
            contrast_notes.append("hypothenar zone")
        apo_m = getattr(mounts, "apollo", None)
        if apo_m and apo_m.prominence in ["developed", "prominent"]:
            contrast_notes.append("sub-ring zone")
        if contrast_notes:
            skin_contrast_text = f" Palmar skin contrast analysis records distinctive surface shading across the {', '.join(contrast_notes)}."

    p2 = f"{vitality_tone}{fate_tone}{skin_contrast_text}"

    # 4. Integrative mindfulness conclusion
    p3 = (
        "In the rich traditions of historical chiromancy, these major creases are not immutable prophecies of destiny, "
        "but living anatomical maps for self-reflection. By honoring both your heart's desire for genuine connection "
        "and your mind's unique analytical style, you can cultivate sustainable equilibrium across your relationships, "
        "work, and personal well-being."
    )

    return f"{p1}\n\n{p2}\n\n{p3}"


async def generate_palm_reading(
    features: PalmFeatures,
    user_notes: Optional[str] = None,
    tier: str = "free",
    language: str = "en"
) -> PalmReadingReport:
    """
    Constructs a grounded, respectful palmistry report using calibrated computer vision measurements.
    Strictly separates:
      1. Observed visual measurements
      2. Documented traditional folklore symbolism
      3. Contemplative mindfulness prompts
    Calibrated across Western classical, Indian Samudrika Shastra, and Chinese Shouxiang traditions.
    Provides rich, dynamic combinatorial synthesis for every distinct hand with optional LLM enhancement.
    """
    hand_side = features.hand_side or "unknown"

    heart_eval = _evaluate_heart(features.heart_line)
    head_eval = _evaluate_head(features.head_line)
    life_eval = _evaluate_life(features.life_line)
    fate_eval = _evaluate_fate(features.fate_line)

    heart_rec, heart_obs, heart_note, heart_retake, heart_key = heart_eval
    head_rec, head_obs, head_note, head_retake, head_key = head_eval
    life_rec, life_obs, life_note, life_retake, life_key = life_eval
    fate_rec, fate_obs, fate_note, fate_key = fate_eval

    origin_status, origin_commentary = _check_head_life_origin(features.head_line, features.life_line)

    detected_features_list = []
    if features.heart_line.status == "detected":
        detected_features_list.append("Heart Line (Distal Transverse Crease)")
    if features.head_line.status == "detected":
        detected_features_list.append("Head Line (Proximal Transverse Crease)")
    if features.life_line.status == "detected":
        detected_features_list.append("Life Line (Thenar Radial Crease)")
    if features.fate_line and features.fate_line.status == "detected":
        detected_features_list.append("Fate Line (Central Longitudinal Crease)")

    if features.mount_topography:
        m = features.mount_topography
        if m.jupiter.prominence in ["developed", "prominent"]:
            detected_features_list.append(f"Palmar Skin Contrast (Sub-index Zone: {m.jupiter.prominence.capitalize()})")
        if m.venus.prominence in ["developed", "prominent"]:
            detected_features_list.append(f"Palmar Skin Contrast (Thenar Zone: {m.venus.prominence.capitalize()})")
        if m.moon.prominence in ["developed", "prominent"]:
            detected_features_list.append(f"Palmar Skin Contrast (Hypothenar Zone: {m.moon.prominence.capitalize()})")
        if m.apollo.prominence in ["developed", "prominent"]:
            detected_features_list.append(f"Palmar Skin Contrast (Sub-ring Zone: {m.apollo.prominence.capitalize()})")

    # Dynamic personalized title and synthesis tailored to this specific hand profile
    low_confidence_lines = set()
    for l_name, l_eval, l_feat in [
        ("heart", heart_eval, features.heart_line),
        ("head", head_eval, features.head_line),
        ("life", life_eval, features.life_line),
        ("fate", fate_eval, features.fate_line)
    ]:
        if l_feat is None:
            low_confidence_lines.add(l_name)
        elif l_eval.confidence == "low":
            low_confidence_lines.add(l_name)
        elif l_feat.confidence is not None and l_feat.confidence < 0.80:
            low_confidence_lines.add(l_name)
        elif (l_feat.measurements or {}).get("vote_share", 1.0) < 0.80:
            low_confidence_lines.add(l_name)

    reading_title = _synthesize_reading_title(
        heart_key, head_key, life_key, fate_key, origin_status, hand_side,
        low_confidence_lines=low_confidence_lines
    )

    synthesis_text = _generate_combinatorial_synthesis(
        heart_rec, head_rec, life_rec, fate_rec,
        heart_key, head_key, life_key, fate_key,
        origin_status, origin_commentary, hand_side,
        heart_obs, head_obs, life_obs,
        mounts=features.mount_topography
    )

    report_id = str(uuid.uuid4())
    now_iso = datetime.now(timezone.utc).isoformat()
    generation_method = "grounded_cultural_library"

    love_symbolism = heart_rec.description
    career_symbolism = head_rec.description
    personality_symbolism = life_rec.description

    # Attempt LLM enhancement if configured, passing calibrated measurements and archetypes
    if any(feat.status == "detected" for feat in [features.heart_line, features.head_line, features.life_line]):
        llm_prompt = f"""
        CALIBRATED COMPUTER VISION MEASUREMENTS (STRICTLY GROUNDED):
        - Hand Side: {hand_side}
        - Heart Line: status={features.heart_line.status}, key={heart_key}, measurements={features.heart_line.measurements}
        - Head Line: status={features.head_line.status}, key={head_key}, measurements={features.head_line.measurements}
        - Life Line: status={features.life_line.status}, key={life_key}, measurements={features.life_line.measurements}
        - Fate Line: status={features.fate_line.status if features.fate_line else 'none'}, key={fate_key}
        - Head-Life Origin Relationship: {origin_status} ({origin_commentary})
        - User Focus Intention: {user_notes or 'General self-discovery'}

        DOCUMENTED TRADITIONAL ARCHETYPES IDENTIFIED:
        - Heart ({heart_rec.tradition_attribution}): {heart_rec.description}
        - Head ({head_rec.tradition_attribution}): {head_rec.description}
        - Life ({life_rec.tradition_attribution}): {life_rec.description}
        - Fate ({fate_rec.tradition_attribution}): {fate_rec.description}

        CALIBRATED WORKING TITLE:
        {reading_title}

        CRITICAL ETHICAL RULES:
        - Maintain strict grounding in these physical characteristics and archetypes.
        - NEVER predict future life events, illness, longevity, wealth, or divorce.
        - Frame all insights as cultural folklore and contemplative mindfulness reflections.
        - Tailor the reading title and overall synthesis uniquely to this hand's specific combination.
        """

        schema_instructions = f"""
        Return JSON with this exact structure:
        {{
          "reading_title": "string (personalized poetic title reflecting these exact features, e.g. '{reading_title}')",
          "love_interpretation": "string (2-3 paragraphs expanding on the heart line cultural symbolism and reflective communication)",
          "career_interpretation": "string (2-3 paragraphs expanding on the head line intellectual style and creative problem solving)",
          "personality_interpretation": "string (2-3 paragraphs expanding on vitality pacing and personal equilibrium)",
          "overall_synthesis": "string (multi-paragraph integrative reflection connecting the heart, head, life pacing, and origin interplay)"
        }}
        """

        llm_result = await call_llm_for_reading(llm_prompt, schema_instructions)
        if llm_result and "love_interpretation" in llm_result:
            reading_title = llm_result.get("reading_title", reading_title)
            if features.heart_line.status == "detected":
                love_symbolism = llm_result.get("love_interpretation", love_symbolism)
            if features.head_line.status == "detected":
                career_symbolism = llm_result.get("career_interpretation", career_symbolism)
            if features.life_line.status == "detected":
                personality_symbolism = llm_result.get("personality_interpretation", personality_symbolism)
            synthesis_text = llm_result.get("overall_synthesis", synthesis_text)
            generation_method = "llm_augmented"

    report = PalmReadingReport(
        id=report_id,
        reading_title=reading_title,
        created_at=now_iso,
        features_analyzed=detected_features_list if detected_features_list else ["General Hand Geometry"],
        love_reading=ReadingSection(
            title="Heart Line: Emotional Expression & Harmony",
            feature_name="Heart Line",
            feature_status=features.heart_line.status,
            interpretation_id=heart_rec.interpretation_id,
            tradition_attribution=heart_rec.tradition_attribution,
            observed_measurements_summary=heart_obs,
            traditional_interpretation=love_symbolism,
            reflective_prompts=heart_rec.reflections,
            confidence_note=heart_note,
            applicable_limitations=heart_rec.applicable_limitations,
            retake_recommended=heart_retake,
            confidence=heart_eval.confidence
        ),
        career_reading=ReadingSection(
            title="Head Line: Focus, Strategy & Curiosity",
            feature_name="Head Line",
            feature_status=features.head_line.status,
            interpretation_id=head_rec.interpretation_id,
            tradition_attribution=head_rec.tradition_attribution,
            observed_measurements_summary=head_obs,
            traditional_interpretation=career_symbolism,
            reflective_prompts=head_rec.reflections,
            confidence_note=head_note,
            applicable_limitations=head_rec.applicable_limitations,
            retake_recommended=head_retake,
            confidence=head_eval.confidence
        ),
        personality_reading=ReadingSection(
            title="Life Line: Vitality, Pacing & Equilibrium",
            feature_name="Life Line",
            feature_status=features.life_line.status,
            interpretation_id=life_rec.interpretation_id,
            tradition_attribution=life_rec.tradition_attribution,
            observed_measurements_summary=life_obs,
            traditional_interpretation=personality_symbolism,
            reflective_prompts=life_rec.reflections,
            confidence_note=life_note,
            applicable_limitations=life_rec.applicable_limitations,
            retake_recommended=life_retake,
            confidence=life_eval.confidence
        ),
        overall_synthesis=synthesis_text,
        is_free_tier=(tier == "free"),
        generation_method=generation_method,
        language="en",
        features=features
    )

    if language and language.strip().lower() not in ["en", "english"]:
        from .translator import translate_palm_reading
        return await translate_palm_reading(report, language.strip())

    return report


async def generate_dual_hand_comparison(
    non_dominant_features: PalmFeatures,
    dominant_features: PalmFeatures,
    dominant_hand: str = "right",
    user_notes: Optional[str] = None,
    language: str = "en"
) -> DualHandReadingReport:
    """
    Synthesizes a dual-hand comparative reading contrasting the non-dominant palm
    (innate subconscious potential & constitutional blueprint) with the dominant palm
    (conscious manifested reality & acquired adaptations).
    """
    # 1. Generate individual grounded readings for both hands in English first
    innate_rep = await generate_palm_reading(
        features=non_dominant_features,
        user_notes=user_notes,
        tier="premium_report",
        language="en"
    )
    manifested_rep = await generate_palm_reading(
        features=dominant_features,
        user_notes=user_notes,
        tier="premium_report",
        language="en"
    )

    nd_side = "left" if dominant_hand == "right" else "right"

    # 2. Compare Heart Line (Emotional Architecture)
    h_innate_curv = _normalize_curvature(non_dominant_features.heart_line.measurements)
    h_manif_curv = _normalize_curvature(dominant_features.heart_line.measurements)
    delta_h = h_manif_curv - h_innate_curv

    if abs(delta_h) <= 0.04:
        h_div = "aligned"
        h_narrative = (
            "Your manifested emotional life directly reflects your innate capacity for connection. "
            "You express vulnerability and warmth authentically, keeping your conscious relationships "
            "deeply anchored in your constitutional values."
        )
        h_rec = "Honor this natural emotional clarity; continue engaging with loved ones from a place of grounded presence."
    elif delta_h > 0.04:
        h_div = "expanded"
        h_narrative = (
            "Through deliberate life choices, you have expanded your capacity for empathy and warmth beyond "
            "your constitutional baseline. Where you may have felt innate reserve, life experience has taught "
            "you the profound power of open-hearted connection."
        )
        h_rec = "Celebrate how your lived experience has opened your heart, while remaining mindful of emotional boundaries."
    else:
        h_div = "recalibrated"
        h_narrative = (
            "You have developed practical emotional discernment and healthy boundary structures. Your innate "
            "openness has been tempered into wisdom, protecting your emotional energy in complex environments."
        )
        h_rec = "Ensure boundaries serve as protective filters rather than impenetrable walls against genuine intimacy."

    heart_comparison = DualHandComparisonSection(
        line_name="Heart Line (Emotional Evolution)",
        innate_summary=f"Innate curvature index: {h_innate_curv:.2f} — {innate_rep.love_reading.observed_measurements_summary or 'Constitutional baseline'}",
        manifested_summary=f"Manifested curvature index: {h_manif_curv:.2f} — {manifested_rep.love_reading.observed_measurements_summary or 'Lived expression'}",
        divergence_type=h_div,
        evolution_narrative=h_narrative,
        growth_recommendation=h_rec
    )

    # 3. Compare Head Line (Intellectual Focus & Career Direction)
    head_innate_curv = _normalize_curvature(non_dominant_features.head_line.measurements)
    head_manif_curv = _normalize_curvature(dominant_features.head_line.measurements)
    head_innate_len = _extract_metric(non_dominant_features.head_line.measurements, "length_ratio", 0.5)
    head_manif_len = _extract_metric(dominant_features.head_line.measurements, "length_ratio", 0.5)
    delta_head = head_manif_curv - head_innate_curv

    if abs(delta_head) <= 0.04 and abs(head_manif_len - head_innate_len) <= 0.08:
        head_div = "aligned"
        head_narrative = (
            "Your professional thought processes harmonize naturally with your innate temperament. "
            "You pursue vocational paths that feel intellectually organic rather than forced."
        )
        head_rec = "Lean into this cognitive congruence; your instinct and structured logic reinforce each other."
    elif delta_head < -0.04:
        head_div = "recalibrated"
        head_narrative = (
            "Your lived trajectory has sharpened your natural thinking into direct, pragmatic execution. "
            "Where your innate disposition may enjoy theoretical wandering, your career life has rewarded "
            "tangible deliverables and structured problem-solving."
        )
        head_rec = "Schedule regular unstructured creative time to let your natural imaginative curiosity breathe."
    else:
        head_div = "expanded"
        head_narrative = (
            "You have broadened your cognitive approach, introducing intuitive flexibility into your decision-making. "
            "Your lived experience has enriched pure analytical deduction with creative nuance."
        )
        head_rec = "Continue trusting holistic pattern recognition when evaluating complex career decisions."

    head_comparison = DualHandComparisonSection(
        line_name="Head Line (Intellectual & Career Evolution)",
        innate_summary=f"Innate chord index: {head_innate_curv:.2f} (length: {head_innate_len:.2f})",
        manifested_summary=f"Manifested chord index: {head_manif_curv:.2f} (length: {head_manif_len:.2f})",
        divergence_type=head_div,
        evolution_narrative=head_narrative,
        growth_recommendation=head_rec
    )

    # 4. Compare Life Line (Vitality, Equilibrium & Pacing)
    life_innate_cont = _extract_metric(non_dominant_features.life_line.measurements, "continuity_ratio", 0.7)
    life_manif_cont = _extract_metric(dominant_features.life_line.measurements, "continuity_ratio", 0.7)
    delta_life = life_manif_cont - life_innate_cont

    if delta_life >= 0.05:
        life_div = "expanded"
        life_narrative = (
            "Your conscious lifestyle practices and mindful pacing have strengthened your constitutional vitality. "
            "Your active hand demonstrates physical resilience reinforced through intentional routine."
        )
        life_rec = "Maintain restorative habits that nourish your autonomic equilibrium."
    elif delta_life <= -0.05:
        life_div = "recalibrated"
        life_narrative = (
            "Your daily responsibilities and active pursuits demand substantial vital energy. "
            "Your hand suggests a mindful call to harmonize active expenditure with structured somatic rest."
        )
        life_rec = "Prioritize circadian rhythm restoration and conscious digital boundaries."
    else:
        life_div = "aligned"
        life_narrative = (
            "Your physical energy distribution remains in balanced accord with your constitutional capacity. "
            "You pace your commitments with natural sustainability."
        )
        life_rec = "Continue listening to your body's innate cues regarding rest and exertion."

    life_comparison = DualHandComparisonSection(
        line_name="Life Line (Vitality & Lifestyle Pacing)",
        innate_summary=f"Innate continuity ratio: {life_innate_cont:.2f}",
        manifested_summary=f"Manifested continuity ratio: {life_manif_cont:.2f}",
        divergence_type=life_div,
        evolution_narrative=life_narrative,
        growth_recommendation=life_rec
    )

    # 5. Compare Fate Line (Vocational Agency & Self-Directed Career)
    fate_innate_status = non_dominant_features.fate_line.status if non_dominant_features.fate_line else "not_detected"
    fate_manif_status = dominant_features.fate_line.status if dominant_features.fate_line else "not_detected"
    fate_innate_len = _extract_metric(non_dominant_features.fate_line.measurements if non_dominant_features.fate_line else {}, "length_ratio", 0.0)
    fate_manif_len = _extract_metric(dominant_features.fate_line.measurements if dominant_features.fate_line else {}, "length_ratio", 0.0)

    if fate_manif_status == "detected" and fate_innate_status != "detected":
        fate_div = "self_directed"
        fate_narrative = (
            "Your active hand reveals an emergent, self-forged column of purpose. While your constitutional baseline "
            "left vocational direction open and unprescribed, your conscious decisions, perseverance, and dedication "
            "have etched a distinct line of self-made mastery and personal agency."
        )
        fate_rec = "Trust your proven capacity to create your own opportunities; let your self-authored vision continue guiding your career."
    elif fate_manif_status == "detected" and fate_innate_status == "detected":
        if fate_manif_len >= fate_innate_len + 0.10:
            fate_div = "expanded"
            fate_narrative = (
                "Your manifested career trajectory has deepened beyond its early promises. You have taken natural "
                "aptitudes and sharpened them through focused professional discipline into an expansive vocational vehicle."
            )
            fate_rec = "Channel your deepening career mastery into mentorship, thought leadership, or creative independence."
        else:
            fate_div = "aligned"
            fate_narrative = (
                "A steady, cohesive current of purpose connects your innate vocation with your lived work. "
                "You have pursued goals that honor your constitutional talents, creating stability across career chapters."
            )
            fate_rec = "Protect this vocational coherence; ground future pivots in the core strengths that have always sustained you."
    elif fate_manif_status != "detected" and fate_innate_status == "detected":
        fate_div = "recalibrated"
        fate_narrative = (
            "Your life journey has intentionally liberated itself from rigid, linear expectations. Where early conditioning "
            "may have outlined a singular conventional track, you have chosen organic adaptability and multi-faceted exploration."
        )
        fate_rec = "Celebrate your fluid versatility; define career success through personal meaning rather than external convention."
    else:
        fate_div = "emergent"
        fate_narrative = (
            "Both hands reflect an autonomous, unbound journey unconstrained by predetermined dogma. You navigate "
            "your professional life through agile curiosity, crafting a portfolio of diverse skills rather than a single fixed role."
        )
        fate_rec = "Structure your ambitions through iterative creative milestones and self-directed projects."

    fate_comparison = DualHandComparisonSection(
        line_name="Fate Line (Vocational Agency & Destiny)",
        innate_summary=f"Innate status: {fate_innate_status} (length ratio: {fate_innate_len:.2f})",
        manifested_summary=f"Manifested status: {fate_manif_status} (length ratio: {fate_manif_len:.2f})",
        divergence_type=fate_div,
        evolution_narrative=fate_narrative,
        growth_recommendation=fate_rec
    )

    # 6. Holistic synthesis & growth index
    growth_index = round(
        74.0
        + (8.0 if h_div in ["expanded", "transcended"] else 4.0)
        + (8.0 if head_div != "aligned" else 4.0)
        + (8.0 if fate_div in ["self_directed", "expanded"] else 5.0)
        + (5.0 if life_div == "expanded" else 3.0),
        1
    )
    growth_index = min(98.5, max(68.0, growth_index))

    overall_synthesis = (
        f"Contrasting your {nd_side.capitalize()} Palm (Innate Potential) with your {dominant_hand.capitalize()} Palm (Lived Path) "
        "reveals a journey of conscious cultivation. You have neither squandered your constitutional gifts nor remained static; "
        "rather, lived experience has refined your emotional discernment, channeled your intellectual curiosity into practical focus, "
        "strengthened your vital equilibrium, and forged active vocational agency. The differences between your hands reflect your personal autonomy: "
        "the conscious authoring of your own life story."
    )

    report_id = f"dual_{uuid.uuid4().hex[:12]}"
    created_at = datetime.now(timezone.utc).isoformat()

    dual_report = DualHandReadingReport(
        id=report_id,
        reading_title="Dual-Hand Evolution: Innate Blueprint vs. Lived Reality",
        created_at=created_at,
        dominant_hand=dominant_hand,  # type: ignore
        non_dominant_hand=nd_side,    # type: ignore
        innate_reading=innate_rep,
        manifested_reading=manifested_rep,
        comparative_sections=[heart_comparison, head_comparison, life_comparison, fate_comparison],
        overall_evolution_synthesis=overall_synthesis,
        growth_index=growth_index,
        language="en",
        innate_features=non_dominant_features,
        manifested_features=dominant_features
    )

    return dual_report


async def generate_temporal_drift_analysis(
    baseline_features: PalmFeatures,
    current_features: PalmFeatures,
    hand_side: str = "right",
    baseline_date: Optional[str] = None,
    current_date: Optional[str] = None,
    user_notes: Optional[str] = None,
    language: str = "en"
) -> TemporalDriftReport:
    """
    Computes visual crease drift differencing between two temporal scans of the same palm
    (typically 3 to 6 months apart). Accurately distinguishes fading chronic tension lines
    from deepening purpose and focus lines, computing palmar stability and evolutionary shifts.
    """
    now_iso = datetime.now(timezone.utc).isoformat()
    drift_id = f"drift_{uuid.uuid4().hex[:12]}"

    # Dynamically compute elapsed months from scan dates if provided
    elapsed_months = 4.0
    if baseline_date and current_date:
        try:
            b_str = baseline_date.replace('Z', '+00:00')
            c_str = current_date.replace('Z', '+00:00')
            b_dt = datetime.fromisoformat(b_str)
            c_dt = datetime.fromisoformat(c_str)
            diff_days = abs((c_dt - b_dt).days)
            elapsed_months = max(0.5, round(diff_days / 30.4375, 1))
        except Exception:
            elapsed_months = 4.0

    def _get_line_prominence(feature: Optional[CreaseFeature]) -> float:
        if not feature or feature.status not in ["detected", "uncertain"]:
            return 0.0
        conf = feature.confidence if feature.confidence is not None else 0.5
        q = feature.quality_score if feature.quality_score is not None else conf
        # Blend confidence and quality
        return round((conf * 0.6 + q * 0.4), 3)

    crease_drifts: List[CreaseDriftMeasurement] = []

    # 1. Heart Line Differencing
    prev_h = _get_line_prominence(baseline_features.heart_line)
    curr_h = _get_line_prominence(current_features.heart_line)
    delta_h = round(curr_h - prev_h, 3)

    if delta_h > 0.04:
        trend_h = "deepened"
        mean_h = (
            "Deepening along the Heart Line indicates enhanced emotional clarity and intentional "
            "vulnerability. You are investing energy into meaningful relational bonds with less hesitancy."
        )
    elif delta_h < -0.04:
        trend_h = "faded"
        mean_h = (
            "Softening along secondary heart branches reflects the healthy shedding of historical emotional friction. "
            "Past relationship anxieties are settling, yielding greater inner calm."
        )
    else:
        trend_h = "stabilized"
        mean_h = "Emotional continuity remains anchored; relational values have maintained steady constitutional balance."

    crease_drifts.append(CreaseDriftMeasurement(
        line_name="Heart Line (Emotional Expression)",
        previous_prominence=prev_h,
        current_prominence=curr_h,
        delta_prominence=delta_h,
        trend=trend_h,
        symbolic_meaning=mean_h
    ))

    # 2. Head Line Differencing
    prev_head = _get_line_prominence(baseline_features.head_line)
    curr_head = _get_line_prominence(current_features.head_line)
    delta_head = round(curr_head - prev_head, 3)

    if delta_head > 0.04:
        trend_head = "deepened"
        mean_head = (
            "Deepening of the Head Line is a classical sign of cognitive consolidation. Lived experience "
            "and purposeful intellectual focus have carved clearer mental conviction."
        )
    elif delta_head < -0.04:
        trend_head = "faded"
        mean_head = (
            "Softening of lateral tension creases shows reduced mental hyper-vigilance and mental over-thinking, "
            "allowing creative intuition to breathe."
        )
    else:
        trend_head = "stabilized"
        mean_head = "Mental stamina and analytical decision-making framework remain consistently grounded."

    crease_drifts.append(CreaseDriftMeasurement(
        line_name="Head Line (Intellectual Focus & Strategy)",
        previous_prominence=prev_head,
        current_prominence=curr_head,
        delta_prominence=delta_head,
        trend=trend_head,
        symbolic_meaning=mean_head
    ))

    # 3. Life Line Differencing
    prev_l = _get_line_prominence(baseline_features.life_line)
    curr_l = _get_line_prominence(current_features.life_line)
    delta_l = round(curr_l - prev_l, 3)

    if delta_l > 0.04:
        trend_l = "deepened"
        mean_l = (
            "Deepening vitality trace signifies fortified daily endurance, restorative lifestyle habits, "
            "and a conscious anchoring into physical well-being."
        )
    elif delta_l < -0.04:
        trend_l = "faded"
        mean_l = (
            "Diffusing of cross-hatching stress marks around the Thenar zone demonstrates recovery from past exhaustion "
            "and reduced nervous strain."
        )
    else:
        trend_l = "stabilized"
        mean_l = "Core vitality reserves and physiological equilibrium have remained resiliently sustained."

    crease_drifts.append(CreaseDriftMeasurement(
        line_name="Life Line (Vitality & Constitutional Pacing)",
        previous_prominence=prev_l,
        current_prominence=curr_l,
        delta_prominence=delta_l,
        trend=trend_l,
        symbolic_meaning=mean_l
    ))

    # 4. Fate Line Differencing
    prev_f = _get_line_prominence(baseline_features.fate_line)
    curr_f = _get_line_prominence(current_features.fate_line)
    delta_f = round(curr_f - prev_f, 3)

    if (baseline_features.fate_line is None or baseline_features.fate_line.status != "detected") and (current_features.fate_line and current_features.fate_line.status == "detected"):
        trend_f = "branching"
        mean_f = "Emergence of an active Fate line trace signals the arrival of a distinctive personal vocation or renewed sense of life mission."
    elif delta_f > 0.04:
        trend_f = "deepened"
        mean_f = "Deepening vocational crease marks decisive career alignment and growing professional autonomy."
    elif delta_f < -0.04:
        trend_f = "faded"
        mean_f = "Softening of rigid vocational tracks shows greater adaptability and freedom from externally imposed career rigidity."
    else:
        trend_f = "stabilized"
        mean_f = "Vocational agency follows a steady, uninterrupted trajectory."

    crease_drifts.append(CreaseDriftMeasurement(
        line_name="Fate Line (Vocational Agency)",
        previous_prominence=prev_f,
        current_prominence=curr_f,
        delta_prominence=delta_f,
        trend=trend_f,
        symbolic_meaning=mean_f
    ))

    # 5. Mount Topography Differencing (if available)
    mount_drifts: List[MountDriftMeasurement] = []
    if baseline_features.mount_topography and current_features.mount_topography:
        bm = baseline_features.mount_topography
        cm = current_features.mount_topography

        mount_pairs = [
            ("Mount of Jupiter", bm.jupiter.relative_elevation, cm.jupiter.relative_elevation, "Leadership initiative and social confidence"),
            ("Mount of Saturn", bm.saturn.relative_elevation, cm.saturn.relative_elevation, "Contemplative depth and ethical boundaries"),
            ("Mount of Apollo (Sun)", bm.apollo.relative_elevation, cm.apollo.relative_elevation, "Creative vitality and charismatic joy"),
            ("Mount of Mercury", bm.mercury.relative_elevation, cm.mercury.relative_elevation, "Commercial agility and clear communication"),
            ("Mount of Venus (Thenar)", bm.venus.relative_elevation, cm.venus.relative_elevation, "Constitutional warmth and restorative resilience"),
            ("Mount of Moon (Hypothenar)", bm.moon.relative_elevation, cm.moon.relative_elevation, "Intuitive receptivity and imaginative depth"),
        ]

        for m_name, prev_e, curr_e, trait in mount_pairs:
            d_e = round(curr_e - prev_e, 3)
            if d_e > 0.03:
                m_trend = "elevated"
                m_mean = f"Increased photometric skin contrast in {m_name} denotes subtle shift in surface illumination relating to {trait}."
            elif d_e < -0.03:
                m_trend = "softened"
                m_mean = f"Subtle tempering of skin contrast in {m_name} indicates steady, muted surface illumination relating to {trait}."
            else:
                m_trend = "steady"
                m_mean = f"Surface skin contrast balance in {m_name} remains securely preserved."

            mount_drifts.append(MountDriftMeasurement(
                mount_name=m_name,
                previous_elevation=round(prev_e, 3),
                current_elevation=round(curr_e, 3),
                delta_elevation=d_e,
                trend=m_trend,
                symbolic_meaning=m_mean
            ))

    deepened_count = sum(1 for d in crease_drifts if d.trend in ["deepened", "branching"])
    softened_count = sum(1 for d in crease_drifts if d.trend == "faded")

    total_crease_delta = sum(abs(d.delta_prominence) for d in crease_drifts)
    stability_score = round(max(65.0, min(98.0, 100.0 - (total_crease_delta * 32.0))), 1)

    # Narrative synthesis
    if deepened_count > softened_count:
        synthesis = (
            f"Over the recorded period, your {hand_side.capitalize()} Palm exhibits active morphological consolidation. "
            f"Specifically, {deepened_count} primary crease vectors show marked deepening, signifying conscious mental and emotional alignment. "
            "Where life previously felt ambiguous, purposeful action has etched deeper neurological pathways that physically express in palmar skin tension."
        )
    elif softened_count > 0:
        synthesis = (
            f"Your temporal comparison reveals an encouraging decompression pattern. "
            f"Secondary stress lines and hyper-creased interference patterns have visibly softened by {softened_count} nodes, "
            "demonstrating that your nervous system is successfully releasing chronic pressure and settling into restorative coherence."
        )
    else:
        synthesis = (
            f"Your {hand_side.capitalize()} Palm displays exceptional topographic stability ({stability_score}% continuity). "
            "Your constitutional habits provide a sturdy foundation through shifting life circumstances, allowing you to build forward without disruptive turbulence."
        )

    mindfulness = (
        "Take a slow breath and gently rub the center of your palm with your thumb. Acknowledge the lines that have deepened as your conscious achievements, "
        "and bless the faint, fading creases as old anxieties you no longer need to carry."
    )

    report = TemporalDriftReport(
        id=drift_id,
        created_at=now_iso,
        hand_side=hand_side,
        baseline_scan_date=baseline_date,
        current_scan_date=current_date,
        elapsed_months_estimate=elapsed_months,
        crease_drifts=crease_drifts,
        mount_drifts=mount_drifts if mount_drifts else None,
        stability_score=stability_score,
        deepened_lines_count=deepened_count,
        softened_lines_count=softened_count,
        temporal_synthesis=synthesis,
        mindfulness_reflection=mindfulness,
        baseline_features=baseline_features,
        current_features=current_features
    )

    return report


async def generate_relational_synastry(
    person_a_features: PalmFeatures,
    person_b_features: PalmFeatures,
    person_a_name: str = "Person A",
    person_b_name: str = "Person B",
    relationship_type: RelationshipCategory = "romantic",
    user_notes: Optional[str] = None,
    language: str = "en"
) -> RelationalSynastryReport:
    """
    Computes a Dual-User Relational Dynamics Matrix comparing:
    - Head lines (Communication temperaments & problem-solving styles)
    - Heart lines (Emotional vulnerability, attachment, and affective cadence)
    - Life lines (Pacing, circadian stamina, and lifestyle vitality rhythms)

    Generates a constructive, growth-focused compatibility synthesis with zero fatalistic predictions.
    """
    now_iso = datetime.now(timezone.utc).isoformat()
    synastry_id = f"synastry_{uuid.uuid4().hex[:12]}"

    p_a_name = person_a_name.strip() if person_a_name else "Person A"
    p_b_name = person_b_name.strip() if person_b_name else "Person B"

    # --- 1. Head Line (Communication & Cognitive Temperament) ---
    head_a = person_a_features.head_line
    head_b = person_b_features.head_line
    curv_a = _normalize_curvature(head_a.measurements or {}, default=1.05)
    curv_b = _normalize_curvature(head_b.measurements or {}, default=1.05)
    len_a = _extract_metric(head_a.measurements or {}, "length_ratio", 0.50)
    len_b = _extract_metric(head_b.measurements or {}, "length_ratio", 0.50)

    def _head_style(curv: float, length: float) -> str:
        if curv < 1.08:
            return "Linear, sequential, logic-first, and outcome-oriented"
        elif curv <= 1.18:
            return "Adaptive, balanced pragmatist with practical creative flexibility"
        else:
            return "Conceptual, intuitive, imaginative, and holistic lateral thinker"

    style_a_head = _head_style(curv_a, len_a)
    style_b_head = _head_style(curv_b, len_b)

    delta_head = abs(curv_a - curv_b)
    head_score = round(max(55.0, min(97.0, 96.0 - delta_head * 75.0)), 1)

    if delta_head <= 0.05:
        head_tier = "harmonious"
        head_narrative = (
            f"{p_a_name} and {p_b_name} share closely synchronized intellectual pacing. "
            "Both approach discussions with similar cognitive structures, allowing conversations to flow effortlessly "
            "without needing constant translation between abstract vision and practical reality."
        )
        head_growth = "Guard against groupthink or mutual blind spots by deliberately seeking contrary perspectives on complex decisions."
    elif delta_head <= 0.14:
        head_tier = "complementary"
        head_narrative = (
            f"{p_a_name} and {p_b_name} offer complementary mental frameworks. While one brings structured clarity and "
            "sequential analysis, the other injects lateral possibilities and imaginative synthesis. "
            "Together, discussions naturally cover both operational feasibility and expansive vision."
        )
        head_growth = "When solving urgent dilemmas, explicitly clarify whether you are currently brainstorming possibilities or finalizing concrete decisions."
    else:
        head_tier = "dynamic_growth"
        head_narrative = (
            f"{p_a_name}'s {style_a_head.lower()} contrasts dynamically with {p_b_name}'s {style_b_head.lower()}. "
            "This gap creates immense opportunity for innovation and strategic completeness, but requires patience "
            "during high-stress problem solving."
        )
        head_growth = "Adopt the 'repeat back before responding' rule during disagreements to confirm you are addressing intent rather than vocabulary differences."

    head_comp = RelationalDimensionComparison(
        dimension_name="Head Line & Communication Temperament",
        person_a_style=style_a_head,
        person_b_style=style_b_head,
        synergy_score=head_score,
        compatibility_tier=head_tier,
        dynamics_narrative=head_narrative,
        growth_recommendation=head_growth
    )

    # --- 2. Heart Line (Emotional Expression & Affective Cadence) ---
    heart_a = person_a_features.heart_line
    heart_b = person_b_features.heart_line
    h_curv_a = _normalize_curvature(heart_a.measurements or {}, default=1.06)
    h_curv_b = _normalize_curvature(heart_b.measurements or {}, default=1.06)
    h_len_a = _extract_metric(heart_a.measurements or {}, "length_ratio", 0.48)
    h_len_b = _extract_metric(heart_b.measurements or {}, "length_ratio", 0.48)

    def _heart_style(curv: float, length: float) -> str:
        if curv >= 1.15 and length >= 0.45:
            return "Warm, demonstrative, openly expressive, and deeply empathic"
        elif curv < 1.08:
            return "Measured, steady, private, expressing affection through deeds and calm reliability"
        else:
            return "Discerning, emotionally balanced, responsive yet boundary-conscious"

    style_a_heart = _heart_style(h_curv_a, h_len_a)
    style_b_heart = _heart_style(h_curv_b, h_len_b)

    delta_heart = abs(h_curv_a - h_curv_b)
    heart_score = round(max(52.0, min(98.0, 95.0 - delta_heart * 70.0)), 1)

    if delta_heart <= 0.06:
        heart_tier = "harmonious"
        heart_narrative = (
            f"There is a natural emotional resonance between {p_a_name} and {p_b_name}. "
            "Both have comparable comfort levels with emotional vulnerability and express warmth "
            "in intuitive, mutually reassuring ways."
        )
        heart_growth = "Ensure that mutual harmony does not lead to withholding difficult truths in an effort to maintain comfort."
    elif delta_heart <= 0.15:
        heart_tier = "complementary"
        heart_narrative = (
            f"{p_a_name} and {p_b_name} balance each other's emotional atmospheres. The more expressive partner provides "
            "warmth and heart-centered openness, while the more grounded partner offers grounding stability and "
            "an anchor during emotional storms."
        )
        heart_growth = "Recognize each other's native love language: celebrate quiet acts of service with the same reverence as vocal affirmation."
    else:
        heart_tier = "dynamic_growth"
        heart_narrative = (
            f"Emotional expression cadences differ markedly between {p_a_name} and {p_b_name}. "
            "One partner processes feelings aloud in real time, while the other requires quiet internal contemplation "
            "before sharing."
        )
        heart_growth = "Grant each other a 'cooling buffer' of 30 minutes after an emotional spike before attempting resolution."

    heart_comp = RelationalDimensionComparison(
        dimension_name="Heart Line & Emotional Resonance",
        person_a_style=style_a_heart,
        person_b_style=style_b_heart,
        synergy_score=heart_score,
        compatibility_tier=heart_tier,
        dynamics_narrative=heart_narrative,
        growth_recommendation=heart_growth
    )

    # --- 3. Life Line (Lifestyle Pacing & Vitality Rhythm) ---
    life_a = person_a_features.life_line
    life_b = person_b_features.life_line
    l_curv_a = _normalize_curvature(life_a.measurements or {}, default=1.12)
    l_curv_b = _normalize_curvature(life_b.measurements or {}, default=1.12)
    l_len_a = _extract_metric(life_a.measurements or {}, "length_ratio", 0.55)
    l_len_b = _extract_metric(life_b.measurements or {}, "length_ratio", 0.55)

    def _life_style(curv: float, length: float) -> str:
        if curv >= 1.20:
            return "High-stimulus, expansive vitality; thrives on dynamic exploration and social mobility"
        elif curv < 1.10:
            return "Contained, rhythmic vitality; thrives on tranquil sanctuaries, predictable routines, and deliberate recovery"
        else:
            return "Adaptable endurance; balances focused productivity with intentional periods of restoration"

    style_a_life = _life_style(l_curv_a, l_len_a)
    style_b_life = _life_style(l_curv_b, l_len_b)

    delta_life = abs(l_curv_a - l_curv_b)
    life_score = round(max(54.0, min(97.0, 94.0 - delta_life * 65.0)), 1)

    if delta_life <= 0.08:
        life_tier = "harmonious"
        life_narrative = (
            f"{p_a_name} and {p_b_name} share matching physical stamina and daily pacing rhythms. "
            "Planning calendars, travel adventures, domestic downtime, and work intensity feels natural and unforced."
        )
        life_growth = "Schedule intentional adventures or restorative retreats together to celebrate your shared rhythm."
    elif delta_life <= 0.18:
        life_tier = "complementary"
        life_narrative = (
            f"Pacing dynamics between {p_a_name} and {p_b_name} form a rhythmic counterweight. "
            "The more outward-bound partner encourages fresh horizons, while the restorative partner ensures "
            "the sanctuary of home and wellness are lovingly safeguarded."
        )
        life_growth = "Agree in advance on social calendars and weekend downtime so neither partner feels either drained or restrained."
    else:
        life_tier = "dynamic_growth"
        life_narrative = (
            f"{p_a_name} and {p_b_name} operate on distinctly different energetic frequencies. "
            "Navigating spontaneous outings versus contemplative home rest requires deliberate communication."
        )
        life_growth = "Honor independent recharging styles without interpreting the need for solo downtime as a lack of affection or commitment."

    life_comp = RelationalDimensionComparison(
        dimension_name="Life Line & Lifestyle Vitality Rhythm",
        person_a_style=style_a_life,
        person_b_style=style_b_life,
        synergy_score=life_score,
        compatibility_tier=life_tier,
        dynamics_narrative=life_narrative,
        growth_recommendation=life_growth
    )

    # --- 4. Composite Synergy Score & Archetypal Dynamic ---
    composite = round(0.35 * head_score + 0.35 * heart_score + 0.30 * life_score, 1)

    rel_category = relationship_type if relationship_type in ["romantic", "business_partners", "friendship"] else "romantic"

    if rel_category == "business_partners":
        if composite >= 88.0:
            archetype = "The Synergistic Co-Founders (Unified Execution & Strategic Vision)"
        elif composite >= 75.0:
            archetype = "The Builder & The Strategist (Complementary Enterprise Leadership)"
        else:
            archetype = "The Dynamic Innovators (High-Impact Tension with Rigorous Synthesis)"
    elif rel_category == "friendship":
        if composite >= 88.0:
            archetype = "Kindred Spirits (Effortless Rapport & Lifelong Sanctuary)"
        elif composite >= 75.0:
            archetype = "The Mirror & The Anchor (Mutual Growth & Grounded Companionship)"
        else:
            archetype = "The Horizon Expanders (Contrasting Perspectives & Continuous Discovery)"
    else:  # romantic
        if composite >= 88.0:
            archetype = "The Harmonious Flame (Profound Empathic Attunement & Shared Direction)"
        elif composite >= 75.0:
            archetype = "The Anchor & The Sail (Complementary Balance of Depth and Momentum)"
        else:
            archetype = "The Transformative Crucible (Dynamic Evolutionary Mirroring & Rich Growth)"

    strengths = [
        f"Multi-dimensional balance across cognitive thinking and emotional expression ({head_tier} communication & {heart_tier} resonance).",
        "Ability to leverage each other's native strengths rather than competing for identical roles.",
        "High mutual potential for personal evolution and grounded self-reflection."
    ]

    growth_edges = [
        "Clarifying operational intent early during discussions to avoid misaligned expectations.",
        "Respecting each other's recovery thresholds during periods of prolonged external stress.",
        "Creating conscious rituals for mutual appreciation and check-ins."
    ]

    prompts = [
        f"When we face complex decisions, how can we best blend {p_a_name}'s approach with {p_b_name}'s perspective?",
        "What is one daily ritual that helps both of us feel seen, grounded, and emotionally supported?",
        "How do we each signal when our personal social or mental battery is running low?"
    ]

    return RelationalSynastryReport(
        id=synastry_id,
        created_at=now_iso,
        person_a_name=p_a_name,
        person_b_name=p_b_name,
        relationship_type=rel_category,
        head_communication=head_comp,
        heart_emotional=heart_comp,
        life_pacing=life_comp,
        composite_synergy_score=composite,
        archetypal_dynamic=archetype,
        shared_strengths=strengths,
        growth_edges=growth_edges,
        collaborative_prompts=prompts,
        person_a_features=person_a_features,
        person_b_features=person_b_features
    )

