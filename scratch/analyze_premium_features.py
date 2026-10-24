import sys
sys.path.insert(0, ".")
import asyncio
import json
import time
from services.api.schemas.palm import PalmFeatures, CreaseFeature, Point2D
from services.api.readings.generator import generate_palm_reading, generate_dual_hand_comparison
from services.api.readings.consultant import answer_consultation_question
from services.api.schemas.readings import PalmConsultationRequest

async def run_analysis():
    print("==================================================================")
    print("        PALMORA AI: LIVE PREMIUM FEATURES ACCURACY BENCHMARK      ")
    print("==================================================================")

    # 1. High-precision Synthetic Non-Dominant (Innate) Palm
    nd_features = PalmFeatures(
        hand_side="left",
        heart_line=CreaseFeature(
            name="Heart Line",
            status="detected",
            confidence=0.94,
            path=[Point2D(x=0.25, y=0.38), Point2D(x=0.50, y=0.36), Point2D(x=0.75, y=0.32)],
            measurements={
                "curvature_index": 1.14,
                "length_ratio": 0.58,
                "orientation_angle_deg": 12.5,
                "visual_prominence": "well_defined",
                "upward_branches": 2
            }
        ),
        head_line=CreaseFeature(
            name="Head Line",
            status="detected",
            confidence=0.91,
            path=[Point2D(x=0.22, y=0.45), Point2D(x=0.55, y=0.52), Point2D(x=0.78, y=0.68)],
            measurements={
                "curvature_index": 1.18,  # Marked downward curve (Moon mount descent)
                "length_ratio": 0.65,
                "orientation_angle_deg": -18.0,
                "visual_prominence": "moderate",
                "continuity_ratio": 0.88
            }
        ),
        life_line=CreaseFeature(
            name="Life Line",
            status="detected",
            confidence=0.96,
            path=[Point2D(x=0.22, y=0.44), Point2D(x=0.32, y=0.62), Point2D(x=0.38, y=0.88)],
            measurements={
                "curvature_index": 1.22,
                "length_ratio": 0.72,
                "continuity_ratio": 0.82,
                "radial_sweep": 0.38,
                "visual_prominence": "deep"
            }
        ),
        fate_line=CreaseFeature(
            name="Fate Line",
            status="not_detected",
            confidence=0.40,
            path=[],
            measurements={"length_ratio": 0.0}
        )
    )

    # 2. High-precision Synthetic Dominant (Lived/Manifested) Palm
    dom_features = PalmFeatures(
        hand_side="right",
        heart_line=CreaseFeature(
            name="Heart Line",
            status="detected",
            confidence=0.95,
            path=[Point2D(x=0.75, y=0.38), Point2D(x=0.50, y=0.35), Point2D(x=0.25, y=0.30)],
            measurements={
                "curvature_index": 1.20,  # Expanded emotional empathy
                "length_ratio": 0.62,
                "orientation_angle_deg": 15.0,
                "visual_prominence": "deep",
                "upward_branches": 3
            }
        ),
        head_line=CreaseFeature(
            name="Head Line",
            status="detected",
            confidence=0.93,
            path=[Point2D(x=0.78, y=0.45), Point2D(x=0.45, y=0.47), Point2D(x=0.20, y=0.49)],
            measurements={
                "curvature_index": 1.04,  # Straightened chord (Pragmatic/analytical execution)
                "length_ratio": 0.60,
                "orientation_angle_deg": -3.5,
                "visual_prominence": "deep",
                "continuity_ratio": 0.94
            }
        ),
        life_line=CreaseFeature(
            name="Life Line",
            status="detected",
            confidence=0.97,
            path=[Point2D(x=0.78, y=0.44), Point2D(x=0.68, y=0.62), Point2D(x=0.62, y=0.88)],
            measurements={
                "curvature_index": 1.24,
                "length_ratio": 0.75,
                "continuity_ratio": 0.92,  # Strengthened vitality via conscious lifestyle
                "radial_sweep": 0.40,
                "visual_prominence": "deep"
            }
        ),
        fate_line=CreaseFeature(
            name="Fate Line",
            status="detected",  # Emergent self-directed career column
            confidence=0.88,
            path=[Point2D(x=0.50, y=0.85), Point2D(x=0.50, y=0.55), Point2D(x=0.48, y=0.35)],
            measurements={
                "curvature_index": 1.02,
                "length_ratio": 0.52,
                "vertical_straightness": 0.94,
                "visual_prominence": "well_defined"
            }
        )
    )

    # TEST A: Single Hand Premium Reading
    t0 = time.perf_counter()
    single_reading = await generate_palm_reading(
        features=dom_features,
        tier="premium_report",
        language="en"
    )
    t_single = (time.perf_counter() - t0) * 1000
    print(f"\n[A] SINGLE HAND PREMIUM REPORT GENERATION ({t_single:.1f}ms):")
    print(f"  - Title: {single_reading.reading_title}")
    print(f"  - Tier: {'Premium' if not single_reading.is_free_tier else 'Free'}")
    print(f"  - Method: {single_reading.generation_method}")
    print(f"  - Features Analyzed: {single_reading.features_analyzed}")
    print(f"  - Love Section: {single_reading.love_reading.title}")
    print(f"    * Observed: {single_reading.love_reading.observed_measurements_summary}")
    print(f"    * Tradition: {single_reading.love_reading.tradition_attribution}")
    print(f"    * Interpretation Length: {len(single_reading.love_reading.traditional_interpretation)} chars")
    print(f"    * Reflective Prompts Count: {len(single_reading.love_reading.reflective_prompts)}")
    print(f"  - Career Section: {single_reading.career_reading.title}")
    print(f"    * Observed: {single_reading.career_reading.observed_measurements_summary}")
    print(f"    * Interpretation Length: {len(single_reading.career_reading.traditional_interpretation)} chars")
    print(f"  - Vitality Section: {single_reading.personality_reading.title}")
    print(f"    * Observed: {single_reading.personality_reading.observed_measurements_summary}")
    print(f"    * Interpretation Length: {len(single_reading.personality_reading.traditional_interpretation)} chars")
    print(f"  - Synthesis Character Count: {len(single_reading.overall_synthesis)} chars")

    # TEST B: Dual-Hand Comparative Evolution Report
    t0 = time.perf_counter()
    dual_reading = await generate_dual_hand_comparison(
        non_dominant_features=nd_features,
        dominant_features=dom_features,
        dominant_hand="right",
        language="en"
    )
    t_dual = (time.perf_counter() - t0) * 1000
    print(f"\n[B] DUAL-HAND EVOLUTION COMPARISON ({t_dual:.1f}ms):")
    print(f"  - Title: {dual_reading.reading_title}")
    print(f"  - Dominant Hand: {dual_reading.dominant_hand.capitalize()} | Non-Dominant: {dual_reading.non_dominant_hand.capitalize()}")
    print(f"  - Calculated Growth Index: {dual_reading.growth_index} / 100")
    for sec in dual_reading.comparative_sections:
        print(f"  - Line: {sec.line_name}")
        print(f"    * Divergence Type: {sec.divergence_type.upper()}")
        print(f"    * Innate Summary: {sec.innate_summary}")
        print(f"    * Manifested Summary: {sec.manifested_summary}")
        print(f"    * Evolution Narrative: {sec.evolution_narrative[:90]}...")
        print(f"    * Growth Recommendation: {sec.growth_recommendation}")

    # TEST C: Consultation Chat Across 4 Scopes
    categories = [
        ("money", "Will I be wealthy or should I invest in business?"),
        ("health", "How is my physical vitality and pacing looking from my life line?"),
        ("career", "I want to transition from corporate to creative entrepreneurship. What does my head and fate line say?"),
        ("dual_evolution", "Why is my right hand so much more disciplined than my left hand?")
    ]
    print("\n[C] GROUNDED CONSULTATION TEST ACROSS 4 USER INTENTS:")
    for cat, question in categories:
        t0 = time.perf_counter()
        consult_req = PalmConsultationRequest(
            category=cat,
            question=question,
            features=dom_features,
            dual_report_context=dual_reading.model_dump(),
            conversation_history=[]
        )
        consult_resp = await answer_consultation_question(consult_req)
        t_c = (time.perf_counter() - t0) * 1000
        print(f"  - Query [{cat.upper()}] ({t_c:.1f}ms): '{question}'")
        print(f"    * Features Referenced: {consult_resp.palm_features_referenced}")
        print(f"    * Key Insights ({len(consult_resp.key_insights)}): {consult_resp.key_insights}")
        print(f"    * Action: {consult_resp.reflective_action}")
        print(f"    * Caution: {consult_resp.cautionary_guidance[:100]}...")
        print(f"    * Followups: {consult_resp.suggested_followups}")
        print(f"    * Answer Excerpt: {consult_resp.answer[:140]}...\n")

if __name__ == "__main__":
    asyncio.run(run_analysis())
