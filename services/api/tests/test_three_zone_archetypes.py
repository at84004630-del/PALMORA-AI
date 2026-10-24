import pytest
from services.api.readings.generator import (
    classify_heart_archetype,
    classify_head_archetype,
    classify_life_archetype,
    classify_fate_archetype,
    _evaluate_heart,
    _evaluate_head,
    _evaluate_life,
    _evaluate_fate,
    _synthesize_reading_title,
    generate_palm_reading
)
from services.api.schemas.palm import PalmFeatures, CreaseFeature, Point2D

def test_heart_three_zone_classification():
    # 1. Clear-Low (Straight Saturn)
    arch, conf = classify_heart_archetype(curv=1.02, length=0.50, angle=0.0, max_up=0.010)
    assert arch == "heart_straight_saturn"
    assert conf == "high"

    # 2. Ambiguous Low-Mid
    arch, conf = classify_heart_archetype(curv=1.045, length=0.52, angle=1.0, max_up=0.020)
    assert arch == "heart_straight_saturn__heart_moderate_gentle"
    assert conf == "low"

    # 3. Clear-Mid (Moderate Gentle)
    arch, conf = classify_heart_archetype(curv=1.07, length=0.54, angle=2.5, max_up=0.025)
    assert arch == "heart_moderate_gentle"
    assert conf == "high"

    # 4. Ambiguous Mid-High
    arch, conf = classify_heart_archetype(curv=1.095, length=0.55, angle=4.5, max_up=0.032)
    assert arch == "heart_moderate_gentle__heart_curved_high_jupiter"
    assert conf == "low"

    # 5. Clear-High (Curved High Jupiter)
    arch, conf = classify_heart_archetype(curv=1.14, length=0.60, angle=9.0, max_up=0.045)
    assert arch == "heart_curved_high_jupiter"
    assert conf == "high"

    # 6. Clear-Long Span (4th archetype)
    arch, conf = classify_heart_archetype(curv=1.05, length=0.72, angle=2.0, max_up=0.015)
    assert arch == "heart_long_sweeping_percussion"
    assert conf == "high"

def test_heart_hysteresis():
    # Boundary between clear-high (1.11) and ambiguous mid-high (1.08-1.11)
    # Without prior state, 1.10 is in ambiguous zone
    arch_neutral, conf_neutral = classify_heart_archetype(curv=1.10, length=0.55, angle=3.0, max_up=0.025)
    assert arch_neutral == "heart_moderate_gentle__heart_curved_high_jupiter"
    assert conf_neutral == "low"

    # With prior state 'heart_curved_high_jupiter', hysteresis threshold drops from 1.11 to 1.095
    arch_hyst, conf_hyst = classify_heart_archetype(curv=1.10, length=0.55, angle=3.0, max_up=0.025, prev_state="heart_curved_high_jupiter")
    assert arch_hyst == "heart_curved_high_jupiter"
    assert conf_hyst == "high"

def test_head_three_zone_classification():
    # 1. Clear-Low (Straight Horizontal)
    arch, conf = classify_head_archetype(curv=1.02, length=0.50, angle=-1.0, max_down=0.010)
    assert arch == "head_straight_horizontal"
    assert conf == "high"

    # 2. Ambiguous Slope
    arch, conf = classify_head_archetype(curv=1.06, length=0.52, angle=-5.0, max_down=0.024)
    assert arch == "head_straight_horizontal__head_sloping_moon"
    assert conf == "low"

    # 3. Clear-High Slope (Sloping Moon)
    arch, conf = classify_head_archetype(curv=1.10, length=0.55, angle=-10.0, max_down=0.040)
    assert arch == "head_sloping_moon"
    assert conf == "high"

    # 4. Clear-High Span (Long Sweeping)
    arch, conf = classify_head_archetype(curv=1.04, length=0.72, angle=-2.0, max_down=0.012)
    assert arch == "head_long_sweeping"
    assert conf == "high"

    # 5. Ambiguous Span
    arch, conf = classify_head_archetype(curv=1.03, length=0.65, angle=-1.5, max_down=0.010)
    assert arch == "head_straight_horizontal__head_long_sweeping"
    assert conf == "low"

def test_head_hysteresis():
    # Angle boundary between clear-high slope (-7.0 deg) and ambiguous slope (-3.0 to -7.0)
    # Neutral: -6.0 deg is ambiguous
    arch_neutral, conf_neutral = classify_head_archetype(curv=1.05, length=0.50, angle=-6.0, max_down=0.020)
    assert arch_neutral == "head_straight_horizontal__head_sloping_moon"
    assert conf_neutral == "low"

    # With prior 'head_sloping_moon', hysteresis threshold widens by 1.5 deg (-7.0 -> -5.5 deg)
    arch_hyst, conf_hyst = classify_head_archetype(curv=1.05, length=0.50, angle=-6.0, max_down=0.020, prev_state="head_sloping_moon")
    assert arch_hyst == "head_sloping_moon"
    assert conf_hyst == "high"

def test_life_three_zone_classification():
    # 1. Clear-Low (Close Radial)
    arch, conf = classify_life_archetype(curv=1.03, length=0.48)
    assert arch == "life_close_radial"
    assert conf == "high"

    # 2. Ambiguous Low-Mid
    arch, conf = classify_life_archetype(curv=1.055, length=0.54)
    assert arch == "life_close_radial__life_long_grounded"
    assert conf == "low"

    # 3. Clear-Mid (Long Grounded)
    arch, conf = classify_life_archetype(curv=1.09, length=0.62)
    assert arch == "life_long_grounded"
    assert conf == "high"

    # 4. Ambiguous Mid-High
    arch, conf = classify_life_archetype(curv=1.125, length=0.62)
    assert arch == "life_long_grounded__life_wide_expansive"
    assert conf == "low"

    # 5. Clear-High (Wide Expansive)
    arch, conf = classify_life_archetype(curv=1.16, length=0.72)
    assert arch == "life_wide_expansive"
    assert conf == "high"

def test_fate_three_zone_classification():
    # 1. Clear-Absent
    arch, conf = classify_fate_archetype(length=0.15, angle=90.0, status="detected")
    assert arch == "fate_absent_or_subtle"
    assert conf == "high"

    # 2. Ambiguous Emergence
    arch, conf = classify_fate_archetype(length=0.26, angle=90.0, status="detected")
    assert arch == "fate_absent_or_subtle__fate_central_vertical"
    assert conf == "low"

    # 3. Clear-Vertical
    arch, conf = classify_fate_archetype(length=0.45, angle=85.0, status="detected")
    assert arch == "fate_central_vertical"
    assert conf == "high"

    # 4. Ambiguous Angle
    arch, conf = classify_fate_archetype(length=0.45, angle=65.0, status="detected")
    assert arch == "fate_central_vertical__fate_origin_moon"
    assert conf == "low"

    # 5. Clear-Diagonal
    arch, conf = classify_fate_archetype(length=0.45, angle=45.0, status="detected")
    assert arch == "fate_origin_moon"
    assert conf == "high"

@pytest.mark.asyncio
async def test_ambiguous_zone_returns_blended_label_and_low_confidence():
    # Create hand in ambiguous zone for all three lines
    feat = lambda name, measurements: CreaseFeature(
        name=name,
        status="detected",
        path=[Point2D(x=0.2, y=0.4), Point2D(x=0.5, y=0.45), Point2D(x=0.7, y=0.48)],
        measurements=measurements,
        quality_score=0.25,
        confidence=0.80
    )

    hand = PalmFeatures(
        heart_line=feat("Heart Line", {"curvature_index": 1.095, "length_ratio": 0.55, "orientation_angle_deg": 4.5}),
        head_line=feat("Head Line", {"curvature_index": 1.06, "length_ratio": 0.54, "orientation_angle_deg": -5.0}),
        life_line=feat("Life Line", {"curvature_index": 1.125, "length_ratio": 0.62}),
        fate_line=feat("Fate Line", {"length_ratio": 0.40, "orientation_angle_deg": 65.0})
    )

    report = await generate_palm_reading(hand)

    # 1. Love reading (Heart Line)
    assert "__" in report.love_reading.interpretation_id
    assert report.love_reading.confidence == "low"
    assert "confidence='low'" in report.love_reading.confidence_note
    assert "ambiguous" in report.love_reading.confidence_note.lower()

    # 2. Career reading (Head Line)
    assert "__" in report.career_reading.interpretation_id
    assert report.career_reading.confidence == "low"
    assert "confidence='low'" in report.career_reading.confidence_note

    # 3. Personality reading (Life Line)
    assert "__" in report.personality_reading.interpretation_id
    assert report.personality_reading.confidence == "low"
    assert "confidence='low'" in report.personality_reading.confidence_note

    # 4. Verified measurements record confidence='low'
    assert hand.heart_line.measurements["archetype_confidence"] == "low"
    assert hand.head_line.measurements["archetype_confidence"] == "low"
    assert hand.life_line.measurements["archetype_confidence"] == "low"
    assert hand.fate_line.measurements["archetype_confidence"] == "low"

    # 5. Reading title seamlessly incorporates blended labels
    assert report.reading_title != ""
    assert "Thoughtful" in report.reading_title or "Independent" in report.reading_title
