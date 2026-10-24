import pytest
from services.api.cv.validator import validate_palm_image
from services.api.cv.crease_analyzer import analyze_palm_creases
from services.api.readings.generator import generate_palm_reading
from services.api.schemas.readings import PalmReadingReport

@pytest.mark.asyncio
async def test_generate_reading_grounded_fallback(synthetic_palm_image_bytes):
    _, metrics, img = validate_palm_image(synthetic_palm_image_bytes)
    features, _, _ = analyze_palm_creases(img, metrics)

    report = await generate_palm_reading(features=features, user_notes="Career transition", tier="free")
    assert isinstance(report, PalmReadingReport)
    assert report.id is not None
    assert report.reading_title != ""

    # Check that Love, Career, and Personality reports exist
    assert report.love_reading.feature_name == "Heart Line"
    assert len(report.love_reading.reflective_prompts) >= 2
    assert report.career_reading.feature_name == "Head Line"
    assert len(report.career_reading.reflective_prompts) >= 2
    assert report.personality_reading.feature_name == "Life Line"
    assert len(report.personality_reading.reflective_prompts) >= 2

    # Check disclaimer presence
    assert "entertainment" in report.disclaimer.lower() or "cultural" in report.disclaimer.lower()

    # Integrity rule: No predictive claims
    forbidden_terms = ["will die at", "will marry on", "guaranteed wealth", "medical diagnosis", "cancer"]
    full_text = f"{report.love_reading.traditional_interpretation} {report.career_reading.traditional_interpretation} {report.personality_reading.traditional_interpretation}".lower()
    for term in forbidden_terms:
        assert term not in full_text

    # Verify evidence-linked fields
    assert report.love_reading.interpretation_id is not None
    assert report.love_reading.tradition_attribution is not None
    assert report.love_reading.applicable_limitations is not None

@pytest.mark.asyncio
async def test_unsupported_or_not_detected_features_never_fabricated():
    from services.api.schemas.palm import PalmFeatures, CreaseFeature
    empty_feat = lambda name: CreaseFeature(
        name=name,
        status="not_detected",
        path=[],
        measurements={},
        confidence=None,
        confidence_explanation="No crease detected"
    )
    features = PalmFeatures(
        heart_line=empty_feat("Heart Line"),
        head_line=empty_feat("Head Line"),
        life_line=empty_feat("Life Line"),
    )

    report = await generate_palm_reading(features=features, user_notes="General", tier="free")
    # Verify features are NEVER presented as detected
    assert report.love_reading.feature_status == "not_detected"
    assert report.love_reading.retake_recommended is True
    assert "not detected" in report.love_reading.applicable_limitations.lower()
    assert "no simulated reading is fabricated" in report.love_reading.traditional_interpretation.lower()

    assert report.career_reading.feature_status == "not_detected"
    assert report.career_reading.retake_recommended is True
    assert "not detected" in report.career_reading.applicable_limitations.lower()
    assert "no clear head line crease" in report.career_reading.traditional_interpretation.lower()

    assert report.personality_reading.feature_status == "not_detected"
    assert report.personality_reading.retake_recommended is True
    assert "not detected" in report.personality_reading.applicable_limitations.lower()
    assert "no distinct life line contour" in report.personality_reading.traditional_interpretation.lower()

@pytest.mark.asyncio
async def test_palm_consultation_money_health_career():
    from services.api.readings.consultant import answer_consultation_question
    from services.api.schemas.readings import PalmConsultationRequest
    from services.api.schemas.palm import PalmFeatures, CreaseFeature, Point2D

    feat = lambda name, curv, length: CreaseFeature(
        name=name,
        status="detected",
        path=[Point2D(x=0.1, y=0.1), Point2D(x=0.5, y=0.5)],
        measurements={"curvature": curv, "length_ratio": length},
        confidence=0.88
    )
    features = PalmFeatures(
        heart_line=feat("Heart Line", 0.18, 0.65),
        head_line=feat("Head Line", 0.12, 0.60),
        life_line=feat("Life Line", 0.28, 0.72),
        fate_line=feat("Fate Line", 0.04, 0.45)
    )

    # 1. Money question
    money_req = PalmConsultationRequest(
        category="money",
        question="What does my palm indicate about wealth creation and business opportunities?",
        features=features
    )
    money_resp = await answer_consultation_question(money_req)
    assert money_resp.category == "money"
    assert len(money_resp.answer) > 100
    assert len(money_resp.palm_features_referenced) >= 1
    assert len(money_resp.key_insights) >= 2
    assert "financial" in money_resp.cautionary_guidance.lower()

    # 2. Health question
    health_req = PalmConsultationRequest(
        category="health",
        question="How does my life line reflect my physical energy and daily stamina?",
        features=features
    )
    health_resp = await answer_consultation_question(health_req)
    assert health_resp.category == "health"
    assert len(health_resp.answer) > 100
    assert "vitality" in health_resp.answer.lower()
    assert "medical" in health_resp.cautionary_guidance.lower()

    # 3. Career question
    career_req = PalmConsultationRequest(
        category="career",
        question="What career scope best matches my head line focus?",
        features=features
    )
    career_resp = await answer_consultation_question(career_req)
    assert career_resp.category == "career"
    assert len(career_resp.answer) > 100
    assert len(career_resp.suggested_followups) == 3


@pytest.mark.asyncio
async def test_dual_hand_comparison_endpoint_and_generator():
    from services.api.readings.generator import generate_dual_hand_comparison
    from services.api.schemas.readings import DualHandReadingReport, CompareReadingsRequest
    from services.api.schemas.palm import PalmFeatures, CreaseFeature, Point2D

    feat = lambda name, curv, length: CreaseFeature(
        name=name,
        status="detected",
        path=[Point2D(x=0.1, y=0.1), Point2D(x=0.5, y=0.5)],
        measurements={"curvature_index": curv, "length_ratio": length, "continuity_ratio": 0.85},
        confidence=0.90
    )
    # Non-dominant (innate): more reserved/straight heart line, artistic sloping head line
    innate_features = PalmFeatures(
        heart_line=feat("Heart Line", 1.02, 0.48),
        head_line=feat("Head Line", 1.15, 0.55),
        life_line=feat("Life Line", 1.25, 0.65),
    )
    # Dominant (manifested): more curved open heart line, pragmatic straight head line
    manifested_features = PalmFeatures(
        heart_line=feat("Heart Line", 1.14, 0.58),
        head_line=feat("Head Line", 1.02, 0.62),
        life_line=feat("Life Line", 1.28, 0.72),
    )

    report: DualHandReadingReport = await generate_dual_hand_comparison(
        non_dominant_features=innate_features,
        dominant_features=manifested_features,
        dominant_hand="right"
    )

    assert report.id.startswith("dual_")
    assert report.dominant_hand == "right"
    assert report.non_dominant_hand == "left"
    assert len(report.comparative_sections) == 4

    # Heart line should reflect expanded warmth
    heart_comp = report.comparative_sections[0]
    assert heart_comp.divergence_type == "expanded"
    assert "open-hearted" in heart_comp.evolution_narrative.lower()

    # Head line should reflect pragmatic execution
    head_comp = report.comparative_sections[1]
    assert head_comp.divergence_type == "recalibrated"
    assert "pragmatic execution" in head_comp.evolution_narrative.lower()

    # Fate line should reflect vocational agency
    fate_comp = report.comparative_sections[3]
    assert "Fate Line" in fate_comp.line_name
    assert fate_comp.divergence_type in ["self_directed", "aligned", "expanded", "recalibrated", "emergent"]
    assert report.growth_index >= 70.0
    assert len(report.overall_evolution_synthesis) > 100
    assert report.innate_features is not None
    assert report.manifested_features is not None


@pytest.mark.asyncio
async def test_dual_evolution_consultation():
    from services.api.readings.consultant import answer_consultation_question
    from services.api.schemas.readings import PalmConsultationRequest
    from services.api.schemas.palm import PalmFeatures, CreaseFeature, Point2D

    feat = lambda name, curv, length: CreaseFeature(
        name=name,
        status="detected",
        path=[Point2D(x=0.1, y=0.1), Point2D(x=0.5, y=0.5)],
        measurements={"curvature_index": curv, "length_ratio": length},
        confidence=0.92
    )
    features = PalmFeatures(
        heart_line=feat("Heart Line", 1.15, 0.60),
        head_line=feat("Head Line", 1.05, 0.65),
        life_line=feat("Life Line", 1.25, 0.70),
        fate_line=feat("Fate Line", 1.02, 0.50),
    )

    req = PalmConsultationRequest(
        category="dual_evolution",
        question="What does the divergence between my hands say about my conscious personal growth?",
        features=features,
        dual_report_context={
            "growth_index": 78.5,
            "overall_evolution_synthesis": "Your hands reveal strong conscious evolution from receptive contemplation to active leadership.",
            "comparative_sections": [
                {
                    "line_name": "Heart Line",
                    "divergence_type": "expanded",
                    "evolution_narrative": "Deepened emotional resonance and conscious openness."
                },
                {
                    "line_name": "Fate Line",
                    "divergence_type": "self_directed",
                    "evolution_narrative": "Clear shift toward entrepreneurial self-directed autonomy."
                }
            ]
        }
    )

    resp = await answer_consultation_question(req)
    assert resp.category == "dual_evolution"
    assert len(resp.answer) > 100
    assert "conscious growth index" in resp.answer.lower() or "evolution" in resp.answer.lower()
    assert len(resp.palm_features_referenced) >= 1
    assert len(resp.key_insights) >= 2
    assert len(resp.suggested_followups) == 3


@pytest.mark.asyncio
async def test_temporal_crease_drift_analysis():
    from services.api.schemas.palm import PalmFeatures, CreaseFeature, Point2D, MountTopography, MountContour
    from services.api.readings.generator import generate_temporal_drift_analysis

    def make_cf(name: str, confidence: float, quality: float, status: str = "detected") -> CreaseFeature:
        return CreaseFeature(
            name=name,
            status=status,
            path=[Point2D(x=0.2, y=0.3), Point2D(x=0.6, y=0.5)],
            measurements={"length_ratio": 0.6, "curvature_index": 1.1},
            confidence=confidence,
            quality_score=quality,
            confidence_explanation="Evaluated"
        )

    # Baseline scan: high stress, lower mental focus
    baseline = PalmFeatures(
        heart_line=make_cf("Heart Line", confidence=0.75, quality=0.70), # High emotional tension
        head_line=make_cf("Head Line", confidence=0.50, quality=0.48),   # Unfocused/emerging
        life_line=make_cf("Life Line", confidence=0.60, quality=0.55),
        fate_line=None,
        mount_topography=MountTopography(
            venus=MountContour(name="Mount of Venus (Thenar)", relative_elevation=0.55, prominence="moderate"),
            jupiter=MountContour(name="Mount of Jupiter", relative_elevation=0.45, prominence="moderate")
        )
    )

    # Current scan (4 months later): Head line deepened, Heart line faded/softened, Fate line branched
    current = PalmFeatures(
        heart_line=make_cf("Heart Line", confidence=0.60, quality=0.58), # Faded/softened tension
        head_line=make_cf("Head Line", confidence=0.72, quality=0.70),   # Deepened focus!
        life_line=make_cf("Life Line", confidence=0.62, quality=0.58),   # Stabilized
        fate_line=make_cf("Fate Line", confidence=0.55, quality=0.50),   # Newly branched
        mount_topography=MountTopography(
            venus=MountContour(name="Mount of Venus (Thenar)", relative_elevation=0.62, prominence="developed"),
            jupiter=MountContour(name="Mount of Jupiter", relative_elevation=0.52, prominence="moderate")
        )
    )

    drift_report = await generate_temporal_drift_analysis(
        baseline_features=baseline,
        current_features=current,
        hand_side="right",
        baseline_date="2026-06-15",
        current_date="2026-10-20"
    )

    assert drift_report.id.startswith("drift_")
    assert drift_report.hand_side == "right"
    assert len(drift_report.crease_drifts) == 4

    # Verify Head Line deepened
    head_drift = next(d for d in drift_report.crease_drifts if "Head Line" in d.line_name)
    assert head_drift.trend == "deepened"
    assert head_drift.delta_prominence > 0

    # Verify Heart Line faded (stress softened)
    heart_drift = next(d for d in drift_report.crease_drifts if "Heart Line" in d.line_name)
    assert heart_drift.trend == "faded"
    assert heart_drift.delta_prominence < 0

    # Verify Fate Line branched
    fate_drift = next(d for d in drift_report.crease_drifts if "Fate Line" in d.line_name)
    assert fate_drift.trend == "branching"

    # Verify mount elevation shifts
    assert drift_report.mount_drifts is not None
    assert len(drift_report.mount_drifts) >= 2
    venus_m = next(m for m in drift_report.mount_drifts if "Venus" in m.mount_name)
    assert venus_m.trend == "elevated"

    assert drift_report.stability_score >= 65.0
    assert "consolidation" in drift_report.temporal_synthesis.lower() or "deepening" in drift_report.temporal_synthesis.lower()
    assert len(drift_report.mindfulness_reflection) > 50


@pytest.mark.asyncio
async def test_relational_synastry():
    from services.api.schemas.palm import PalmFeatures, CreaseFeature, Point2D
    from services.api.readings.generator import generate_relational_synastry

    def make_cf(name: str, curv: float, length: float) -> CreaseFeature:
        return CreaseFeature(
            name=name,
            status="detected",
            path=[Point2D(x=0.1, y=0.2), Point2D(x=0.8, y=0.7)],
            measurements={"length_ratio": length, "curvature_index": curv},
            confidence=0.85,
            confidence_explanation="High confidence detection"
        )

    # Person A: Linear analytical Head, Expressive curved Heart, Expansive Life
    person_a = PalmFeatures(
        heart_line=make_cf("Heart Line", curv=1.20, length=0.55),
        head_line=make_cf("Head Line", curv=1.04, length=0.50),
        life_line=make_cf("Life Line", curv=1.25, length=0.60),
    )

    # Person B: Curved creative Head, Measured Heart, Grounded Life
    person_b = PalmFeatures(
        heart_line=make_cf("Heart Line", curv=1.05, length=0.45),
        head_line=make_cf("Head Line", curv=1.22, length=0.52),
        life_line=make_cf("Life Line", curv=1.08, length=0.58),
    )

    synastry = await generate_relational_synastry(
        person_a_features=person_a,
        person_b_features=person_b,
        person_a_name="Maya",
        person_b_name="Julian",
        relationship_type="romantic"
    )

    assert synastry.id.startswith("synastry_")
    assert synastry.person_a_name == "Maya"
    assert synastry.person_b_name == "Julian"
    assert synastry.relationship_type == "romantic"
    assert 60.0 <= synastry.composite_synergy_score <= 100.0

    # Dimensions
    assert synastry.head_communication.dimension_name == "Head Line & Communication Temperament"
    assert synastry.heart_emotional.dimension_name == "Heart Line & Emotional Resonance"
    assert synastry.life_pacing.dimension_name == "Life Line & Lifestyle Vitality Rhythm"

    # Qualitative items
    assert len(synastry.shared_strengths) >= 2
    assert len(synastry.growth_edges) >= 2
    assert len(synastry.collaborative_prompts) >= 2
    assert len(synastry.archetypal_dynamic) > 10


@pytest.mark.asyncio
async def test_relational_synastry_api():
    from httpx import AsyncClient, ASGITransport
    from services.api.main import app

    req_payload = {
        "person_a_name": "Elena",
        "person_b_name": "Marcus",
        "relationship_type": "business_partners",
        "person_a_features": {
            "heart_line": {"name": "Heart Line", "status": "detected", "path": [], "measurements": {"curvature_index": 1.15, "length_ratio": 0.5}},
            "head_line": {"name": "Head Line", "status": "detected", "path": [], "measurements": {"curvature_index": 1.05, "length_ratio": 0.55}},
            "life_line": {"name": "Life Line", "status": "detected", "path": [], "measurements": {"curvature_index": 1.20, "length_ratio": 0.65}},
        },
        "person_b_features": {
            "heart_line": {"name": "Heart Line", "status": "detected", "path": [], "measurements": {"curvature_index": 1.10, "length_ratio": 0.48}},
            "head_line": {"name": "Head Line", "status": "detected", "path": [], "measurements": {"curvature_index": 1.08, "length_ratio": 0.52}},
            "life_line": {"name": "Life Line", "status": "detected", "path": [], "measurements": {"curvature_index": 1.15, "length_ratio": 0.60}},
        }
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        sess_resp = await ac.post("/api/v1/account/guest-session")
        token = sess_resp.json()["session_token"]
        headers = {"Authorization": f"Bearer {token}"}

        resp = await ac.post("/api/v1/readings/relational-synastry", headers=headers, json=req_payload)
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"].startswith("synastry_")
        assert data["relationship_type"] == "business_partners"
        assert "Co-Founders" in data["archetypal_dynamic"] or "Architects" in data["archetypal_dynamic"] or "Leadership" in data["archetypal_dynamic"] or "Innovators" in data["archetypal_dynamic"]

        # Test GET by ID
        get_resp = await ac.get(f"/api/v1/readings/relational-synastry/{data['id']}", headers=headers)
        assert get_resp.status_code == 200
        assert get_resp.json()["id"] == data["id"]


def test_elemental_constitution_extraction(synthetic_palm_image_bytes):
    _, metrics, img = validate_palm_image(synthetic_palm_image_bytes)
    features, _, _ = analyze_palm_creases(img, metrics)
    assert features.elemental_constitution is not None
    assert features.elemental_constitution.hand_type in ["earth", "air", "fire", "water"]
    assert len(features.elemental_constitution.archetypal_traits) >= 3
    assert len(features.elemental_constitution.balancing_lifestyle_practices) >= 2
    assert features.elemental_constitution.palm_aspect_ratio > 0.0



