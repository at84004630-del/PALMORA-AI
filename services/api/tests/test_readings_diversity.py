import pytest
from services.api.schemas.palm import PalmFeatures, CreaseFeature, Point2D
from services.api.readings.generator import generate_palm_reading
from services.api.schemas.readings import PalmReadingReport

def _create_feature(name: str, path_pts: list, measurements: dict, quality: float = 0.25, status: str = "detected") -> CreaseFeature:
    points = [Point2D(x=p[0], y=p[1]) for p in path_pts]
    return CreaseFeature(
        name=name,
        status=status,
        path=points,
        pixel_path=points,
        measurements=measurements,
        quality_score=quality,
        confidence=0.85
    )

@pytest.mark.asyncio
async def test_diverse_hands_produce_distinct_readings_and_summaries():
    """
    Verifies that distinct palm geometries produce completely distinct titles,
    interpretations, observations, and overall syntheses.
    """
    # Profile 1: The Visionary Explorer (High curved heart toward Jupiter, sloping head toward Moon, wide expansive life)
    hand_1 = PalmFeatures(
        heart_line=_create_feature(
            "Heart Line",
            [(0.70, 0.40), (0.55, 0.38), (0.40, 0.32), (0.35, 0.26)],  # upward arc
            {"curvature_index": 1.15, "length_ratio": 0.62, "orientation_angle_deg": 12.0, "visual_prominence": "distinct"}
        ),
        head_line=_create_feature(
            "Head Line",
            [(0.32, 0.42), (0.45, 0.48), (0.58, 0.56), (0.68, 0.64)],  # downward slope to Moon
            {"curvature_index": 1.12, "length_ratio": 0.60, "orientation_angle_deg": -14.0, "visual_prominence": "distinct"}
        ),
        life_line=_create_feature(
            "Life Line",
            [(0.32, 0.42), (0.40, 0.55), (0.48, 0.70), (0.45, 0.85)],  # joined at (0.32, 0.42), wide arch
            {"curvature_index": 1.16, "length_ratio": 0.72, "visual_prominence": "distinct"}
        ),
        fate_line=_create_feature(
            "Fate Line",
            [(0.50, 0.80), (0.50, 0.60), (0.50, 0.45)],
            {"length_ratio": 0.45, "orientation_angle_deg": 90.0}
        ),
        hand_side="right"
    )

    # Profile 2: The Grounded Pragmatist (Straight horizontal heart under Saturn, straight head line, close radial life)
    hand_2 = PalmFeatures(
        heart_line=_create_feature(
            "Heart Line",
            [(0.72, 0.38), (0.58, 0.38), (0.46, 0.38)],  # straight horizontal
            {"curvature_index": 1.02, "length_ratio": 0.50, "orientation_angle_deg": 0.5, "visual_prominence": "distinct"}
        ),
        head_line=_create_feature(
            "Head Line",
            [(0.38, 0.42), (0.50, 0.43), (0.64, 0.43)],  # separated from life start
            {"curvature_index": 1.02, "length_ratio": 0.52, "orientation_angle_deg": -1.0, "visual_prominence": "distinct"}
        ),
        life_line=_create_feature(
            "Life Line",
            [(0.26, 0.48), (0.30, 0.60), (0.32, 0.75)],  # hugging close to thumb, separated origin
            {"curvature_index": 1.04, "length_ratio": 0.48, "visual_prominence": "distinct"}
        ),
        fate_line=_create_feature(
            "Fate Line",
            [], {}, status="not_detected"
        ),
        hand_side="left"
    )

    # Profile 3: The Long-Span Scholar (Extended percussion heart line, sweeping head line across palm, grounded life)
    hand_3 = PalmFeatures(
        heart_line=_create_feature(
            "Heart Line",
            [(0.85, 0.37), (0.65, 0.37), (0.45, 0.36), (0.30, 0.34)],
            {"curvature_index": 1.05, "length_ratio": 0.70, "orientation_angle_deg": 3.0, "visual_prominence": "distinct"}
        ),
        head_line=_create_feature(
            "Head Line",
            [(0.30, 0.42), (0.50, 0.46), (0.70, 0.50), (0.82, 0.53)],  # long sweeping
            {"curvature_index": 1.06, "length_ratio": 0.72, "orientation_angle_deg": -6.0, "visual_prominence": "distinct"}
        ),
        life_line=_create_feature(
            "Life Line",
            [(0.30, 0.42), (0.38, 0.56), (0.44, 0.72), (0.48, 0.90)],
            {"curvature_index": 1.10, "length_ratio": 0.68, "visual_prominence": "distinct"}
        ),
        hand_side="right"
    )

    # Profile 4: The Sensitive Introspective (Delicate lightly etched creases, gentle contour)
    hand_4 = PalmFeatures(
        heart_line=_create_feature(
            "Heart Line",
            [(0.68, 0.38), (0.55, 0.38), (0.42, 0.37)],
            {"curvature_index": 1.03, "length_ratio": 0.46, "visual_prominence": "moderate"},
            quality=0.12
        ),
        head_line=_create_feature(
            "Head Line",
            [(0.34, 0.44), (0.48, 0.46), (0.60, 0.47)],
            {"curvature_index": 1.03, "length_ratio": 0.45, "visual_prominence": "moderate"},
            quality=0.13
        ),
        life_line=_create_feature(
            "Life Line",
            [(0.34, 0.44), (0.38, 0.58), (0.40, 0.70)],
            {"curvature_index": 1.05, "length_ratio": 0.48, "visual_prominence": "moderate"},
            quality=0.12
        ),
        hand_side="left"
    )

    # Profile 5: The Empathetic Harmonizer (Gentle balanced heart line, creative fork head, steady continuous life)
    hand_5 = PalmFeatures(
        heart_line=_create_feature(
            "Heart Line",
            [(0.70, 0.38), (0.58, 0.38), (0.44, 0.35)],
            {"curvature_index": 1.07, "length_ratio": 0.56, "orientation_angle_deg": 4.0, "visual_prominence": "distinct"}
        ),
        head_line=_create_feature(
            "Head Line",
            [(0.33, 0.43), (0.48, 0.47), (0.62, 0.51)],
            {"curvature_index": 1.06, "length_ratio": 0.54, "orientation_angle_deg": -5.0, "visual_prominence": "distinct"}
        ),
        life_line=_create_feature(
            "Life Line",
            [(0.33, 0.43), (0.40, 0.58), (0.44, 0.74)],
            {"curvature_index": 1.08, "length_ratio": 0.60, "visual_prominence": "distinct"}
        ),
        hand_side="right"
    )

    report_1 = await generate_palm_reading(hand_1, tier="free")
    report_2 = await generate_palm_reading(hand_2, tier="free")
    report_3 = await generate_palm_reading(hand_3, tier="free")
    report_4 = await generate_palm_reading(hand_4, tier="free")
    report_5 = await generate_palm_reading(hand_5, tier="free")

    reports = [report_1, report_2, report_3, report_4, report_5]

    # 1. Verify Titles are distinct across all 5 hands
    titles = [r.reading_title for r in reports]
    assert len(set(titles)) == 5, f"Expected 5 distinct titles, but got: {titles}"

    # 2. Verify Overall Syntheses are distinct across all 5 hands
    syntheses = [r.overall_synthesis for r in reports]
    assert len(set(syntheses)) == 5, "Expected 5 distinct overall syntheses, but found duplicates"

    # 3. Verify Heart Line interpretations match distinct cultural traditions
    heart_traditions = [r.love_reading.tradition_attribution for r in reports]
    assert len(set(heart_traditions)) >= 3, f"Expected varied heart line traditions, got: {heart_traditions}"

    # 4. Verify Head Line interpretations match distinct cultural traditions
    head_traditions = [r.career_reading.tradition_attribution for r in reports]
    assert len(set(head_traditions)) >= 3, f"Expected varied head line traditions, got: {head_traditions}"

    # 5. Verify Life Line interpretations match distinct cultural traditions
    life_traditions = [r.personality_reading.tradition_attribution for r in reports]
    assert len(set(life_traditions)) >= 3, f"Expected varied life line traditions, got: {life_traditions}"

    # 6. Verify Line Interplay (Conjoined vs Separated origin) is accurately captured
    assert "conjoined" in report_1.overall_synthesis.lower() or "thoughtful" in report_1.overall_synthesis.lower()
    assert "separation" in report_2.overall_synthesis.lower() or "independent" in report_2.overall_synthesis.lower()

    # 7. Verify Hand Side context (right vs left)
    assert "right hand" in report_1.overall_synthesis.lower() or "active" in report_1.overall_synthesis.lower()
    assert "left hand" in report_2.overall_synthesis.lower() or "receptive" in report_2.overall_synthesis.lower()

    # 8. Verify Observed Measurements summaries contain the specific physical values
    assert "1.15" in report_1.love_reading.observed_measurements_summary or "12.0" in report_1.love_reading.observed_measurements_summary
    assert "1.02" in report_2.love_reading.observed_measurements_summary or "0.5" in report_2.love_reading.observed_measurements_summary

    # 9. Verify Safety: No deterministic future prophecies
    for r in reports:
        combined = f"{r.reading_title} {r.overall_synthesis} {r.love_reading.traditional_interpretation} {r.career_reading.traditional_interpretation} {r.personality_reading.traditional_interpretation}".lower()
        assert "will die" not in combined
        assert "guaranteed wealth" not in combined
        assert "medical diagnosis" not in combined

@pytest.mark.asyncio
async def test_fractional_curvature_backwards_compatibility():
    """Verifies that legacy or external curvature format (e.g. 0.18 instead of 1.18) is normalized properly."""
    hand = PalmFeatures(
        heart_line=_create_feature("Heart Line", [(0.7, 0.4), (0.4, 0.3)], {"curvature": 0.18, "length_ratio": 0.65}),
        head_line=_create_feature("Head Line", [(0.3, 0.4), (0.6, 0.5)], {"curvature": 0.14, "length_ratio": 0.60}),
        life_line=_create_feature("Life Line", [(0.3, 0.4), (0.4, 0.8)], {"curvature": 0.22, "length_ratio": 0.70}),
    )
    report = await generate_palm_reading(hand)
    assert "1.18" in report.love_reading.observed_measurements_summary
    assert "1.14" in report.career_reading.observed_measurements_summary
    assert "1.22" in report.personality_reading.observed_measurements_summary
