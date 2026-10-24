"""
Consultative Palmistry Interpretation Engine for Palmora AI
Handles user inquiries regarding Money, Health, Career, and Life Scope,
grounded strictly in observed computer vision measurements and historical
cultural traditions with responsible safety boundaries.
"""

import json
import logging
from typing import Dict, Any, List, Optional
from ..schemas.readings import PalmConsultationRequest, PalmConsultationResponse
from ..schemas.palm import PalmFeatures, CreaseFeature
from ..config import settings
from .llm_provider import call_llm_for_reading

logger = logging.getLogger(__name__)

CONSULTANT_SYSTEM_PROMPT = """You are Palmora AI's Chief Palmistry Consultant & Contemplative Guide.
Users ask you questions about their life scope, focusing on:
1. Money & Wealth Creation (symbolism of the Apollo/Sun zone, Mercury commercial mount, Fate line, Head line strategy)
2. Health & Vitality (symbolism of the Life line arc, Thenar vitality eminence, daily energetic pacing)
3. Career & Ambition Scope (symbolism of the Head line mental trajectory, Saturn vocational line, Jupiter leadership)
4. General Life Trajectory & Balance (interplay of Heart, Head, and Life lines)

STRICT OPERATING PRINCIPLES:
1. Always frame interpretations as traditional cultural symbolism, folklore, and mindful self-inquiry.
2. Palmistry is an ancient reflective art for mindfulness and personal agency. It is NEVER deterministic future prophecy.
3. NEVER make medical claims, health diagnoses, or predictions about illness, diseases, or lifespan. Always clarify that physical vitality reflections concern lifestyle pacing, stress awareness, and rest rhythms.
4. NEVER give specific financial, legal, or investment advice. Frame wealth reflections around stewardship, discipline, creative initiative, and value creation.
5. Directly reference the specific visual palm measurements provided in the context (e.g. Head line length, curvature, Life line depth, Fate line status).
6. Provide inspiring, actionable reflective exercises.
7. Return strictly valid JSON matching the required schema.
"""

CONSULTANT_SCHEMA_INSTRUCTIONS = """Return JSON with the following structure:
{
  "category": "money" | "health" | "career" | "general" | "dual_evolution",
  "question": "The question asked",
  "answer": "A rich, deeply personalized 2-3 paragraph answer referencing their specific palm lines and historical symbolism",
  "palm_features_referenced": ["Physical feature 1 with measurement", "Physical feature 2 with measurement"],
  "key_insights": ["Takeaway bullet point 1", "Takeaway bullet point 2", "Takeaway bullet point 3"],
  "reflective_action": "A concrete mindfulness or practical reflection exercise for the user",
  "cautionary_guidance": "A short, responsible disclaimer regarding agency and ethical boundaries",
  "suggested_followups": ["Followup question 1", "Followup question 2", "Followup question 3"]
}
"""

async def answer_consultation_question(
    request: PalmConsultationRequest
) -> PalmConsultationResponse:
    """
    Answers a targeted user question regarding Money, Health, Career, or Life Scope.
    Tries the configured LLM provider first; falls back to the deterministic cultural wisdom engine.
    """
    category = (request.category or "general").strip().lower()
    if category not in ["money", "health", "career", "general", "dual_evolution"]:
        category = _infer_category_from_question(request.question)

    features = request.features
    report = request.dual_report_context or request.report_context or {}

    # 1. Attempt LLM invocation if provider credentials exist
    if settings.GEMINI_API_KEY or settings.OPENAI_API_KEY:
        try:
            prompt_context = _format_llm_prompt(request, category, features, report)
            llm_result = await call_llm_for_reading(prompt_context, CONSULTANT_SCHEMA_INSTRUCTIONS)
            if llm_result and isinstance(llm_result, dict) and "answer" in llm_result:
                return PalmConsultationResponse(
                    category=category,
                    question=request.question,
                    answer=str(llm_result.get("answer", "")),
                    palm_features_referenced=llm_result.get("palm_features_referenced", []),
                    key_insights=llm_result.get("key_insights", []),
                    reflective_action=str(llm_result.get("reflective_action", "")),
                    cautionary_guidance=str(llm_result.get(
                        "cautionary_guidance",
                        "Palmora AI reflections are symbolic tools for mindfulness and personal agency, not deterministic predictions or professional counsel."
                    )),
                    suggested_followups=llm_result.get("suggested_followups", []),
                    language=request.language or "en"
                )
        except Exception as e:
            logger.warning("LLM consultation call failed (%s). Utilizing grounded wisdom synthesizer.", e)

    # 2. Deterministic Grounded Wisdom Engine Fallback
    resp = _synthesize_deterministic_consultation(request.question, category, features, report)
    resp.language = request.language or "en"
    return resp


def _infer_category_from_question(question: str) -> str:
    q = question.lower()
    if any(k in q for k in ["dual", "evolution", "innate", "manifested", "left hand", "right hand", "both hands", "divergence", "growth index", "non-dominant", "dominant"]):
        return "dual_evolution"
    if any(k in q for k in ["money", "wealth", "rich", "financial", "finance", "business", "income", "invest", "prosperity", "abundance", "profit"]):
        return "money"
    if any(k in q for k in ["health", "vitality", "energy", "sick", "illness", "stamina", "body", "exhaust", "burnout", "sleep", "recovery", "diet"]):
        return "health"
    if any(k in q for k in ["career", "job", "work", "profession", "calling", "ambition", "promotion", "business", "leadership", "pivot", "success"]):
        return "career"
    return "general"


def _format_llm_prompt(
    request: PalmConsultationRequest,
    category: str,
    features: Optional[PalmFeatures],
    report: Dict[str, Any]
) -> str:
    feat_lines = []
    if features:
        if features.head_line:
            feat_lines.append(f"Head Line: status={features.head_line.status}, measurements={features.head_line.measurements}")
        if features.life_line:
            feat_lines.append(f"Life Line: status={features.life_line.status}, measurements={features.life_line.measurements}")
        if features.heart_line:
            feat_lines.append(f"Heart Line: status={features.heart_line.status}, measurements={features.heart_line.measurements}")
        if features.fate_line:
            feat_lines.append(f"Fate Line: status={features.fate_line.status}, measurements={features.fate_line.measurements}")

    dual_context = ""
    if "overall_evolution_synthesis" in report or "comparative_sections" in report:
        growth_idx = report.get("growth_index", "N/A")
        nd = report.get("non_dominant_hand", "non-dominant")
        dom = report.get("dominant_hand", "dominant")
        evo_synthesis = report.get("overall_evolution_synthesis", "")
        comps = report.get("comparative_sections", [])
        comp_lines = []
        for c in comps:
            if isinstance(c, dict):
                comp_lines.append(f"  - {c.get('line_name')}: {c.get('divergence_type')} (Innate: {c.get('innate_summary')} vs Manifested: {c.get('manifested_summary')})")
        dual_context = f"""
Dual-Hand Evolution Comparative Context:
- Non-Dominant ({nd}) Palm: Inborn constitutional baseline & subconscious traits
- Dominant ({dom}) Palm: Conscious adaptations, active career, and manifested life path
- Conscious Growth Index: {growth_idx}/100
- Comparative Line Evolutions:
{chr(10).join(comp_lines) if comp_lines else "Comparative lines analyzed."}
- Holistic Evolution Narrative:
{evo_synthesis}
"""

    history_str = ""
    if request.conversation_history:
        history_str = "Prior Conversation Turns:\n" + "\n".join(
            f"{turn.get('role', 'user')}: {turn.get('content', '')}"
            for turn in request.conversation_history[-4:]
        )

    synthesis = report.get("overall_synthesis", "")
    target_lang = (request.language or "en").strip()
    target_lang_lower = target_lang.lower()
    if target_lang_lower in ["hinglish", "hi-latn", "hi_latn", "hi-en", "hi_en"]:
        lang_instruction = (
            "\nTARGET LANGUAGE: Hinglish. Please formulate your entire response "
            "(answer, key_insights, reflective_action, cautionary_guidance, suggested_followups) "
            "completely and fluently in natural conversational Hinglish (Hindi written in Roman/Latin script, e.g. "
            "'Aapki palm mein Heart Line darshati hai ki...'). Do NOT use Devanagari script."
        )
    elif target_lang_lower not in ["en", "english"]:
        lang_instruction = (
            f"\nTARGET LANGUAGE: {target_lang}. Please formulate your entire response "
            f"(answer, key_insights, reflective_action, cautionary_guidance, suggested_followups) "
            f"completely and fluently in this language."
        )
    else:
        lang_instruction = ""

    return f"""USER INQUIRY CONTEXT:
Category: {category.upper()}
User Question: "{request.question}"
{lang_instruction}

Observed Palm Vision Features:
{chr(10).join(feat_lines) if feat_lines else "Standard balanced palm features analyzed."}
{dual_context}
Report Synthesis Context:
{synthesis}

{history_str}

Please generate an empowering, culturally rich palmistry reflection directly answering their question, grounded in their specific palm characteristics."""


def _synthesize_deterministic_consultation(
    question: str,
    category: str,
    features: Optional[PalmFeatures],
    report: Dict[str, Any]
) -> PalmConsultationResponse:
    """
    High-fidelity deterministic consultation synthesizer connecting actual crease
    measurements to historical traditions for Money, Health, Career, and Life Scope.
    """
    # Extract measurements safely
    head_curv = 0.15
    head_len = 0.60
    head_status = "detected"
    life_curv = 0.25
    life_len = 0.70
    life_status = "detected"
    fate_status = "uncertain"

    if features:
        if features.head_line:
            head_status = features.head_line.status
            raw_head = float(features.head_line.measurements.get("curvature", features.head_line.measurements.get("curvature_index", 0.15)))
            head_curv = (raw_head - 1.0) if raw_head >= 0.7 else raw_head
            head_len = float(features.head_line.measurements.get("length_ratio", 0.60))
        if features.life_line:
            life_status = features.life_line.status
            raw_life = float(features.life_line.measurements.get("curvature", features.life_line.measurements.get("curvature_index", 0.25)))
            life_curv = (raw_life - 1.0) if raw_life >= 0.7 else raw_life
            life_len = float(features.life_line.measurements.get("length_ratio", 0.70))
        if features.fate_line:
            fate_status = features.fate_line.status

    if category == "dual_evolution":
        return _build_dual_evolution_response(question, report, features)
    elif category == "money":
        return _build_money_response(question, head_curv, head_len, fate_status)
    elif category == "health":
        return _build_health_response(question, life_curv, life_len, life_status)
    elif category == "career":
        return _build_career_response(question, head_curv, head_len, fate_status)
    elif "overall_evolution_synthesis" in report:
        return _build_dual_evolution_response(question, report, features)
    else:
        return _build_general_response(question, head_curv, life_curv, fate_status)


def _build_money_response(question: str, head_curv: float, head_len: float, fate_status: str) -> PalmConsultationResponse:
    is_analytical = head_curv < 0.18
    has_fate = fate_status == "detected"

    features_ref = [
        f"Head Line Strategic Trajectory (Curvature index: {round(head_curv, 2)})",
        f"Transverse Mental Span (Coverage: {round(head_len * 100)}% of mid-palm)",
        f"Fate / Saturn Line (Status: {fate_status})"
    ]

    if is_analytical:
        p1 = (
            "In classical chiromancy and Indian Hastarekha traditions, your straighter, direct Head line "
            "symbolizes disciplined financial stewardship and systematic resource management. Rather than relying "
            "on sudden speculative gambles, your natural cognitive blueprint favors structured value creation, "
            "clear risk-reward calculations, and patient compounding."
        )
        p2 = (
            "Regarding your financial scope: Traditional texts associate this steady mid-palm contour with "
            "wealth built through domain mastery, methodical budgeting, and contractual clarity. When you align your "
            "initiatives with tangible, measurable goals rather than emotional enthusiasm, your financial stability "
            "grows exponentially over multi-year cycles."
        )
    else:
        p1 = (
            "In historical Western chiromancy (Cheiro, 1897) and Chinese Shouxiang, a gently sloping Head line "
            "extending toward the Mount of the Moon represents creative monetization and lateral commercial acumen. "
            "Your palm signifies a mind adept at recognizing non-obvious market opportunities, intellectual property, "
            "and innovative service models."
        )
        p2 = (
            "Regarding wealth scope: Traditional lore suggests your strongest earnings materialize when you merge "
            "imaginative problem-solving with independent initiative. While conventional repetitive tasks may feel "
            "constraining, ventures that reward creative insight, design, or entrepreneurial synthesis provide your "
            "most fertile financial runway."
        )

    fate_note = (
        " The measured presence of a distinct Fate line reinforces self-directed economic autonomy and milestone achievements."
        if has_fate
        else " The adaptive mid-palm structure reflects economic resilience—your prosperity is self-authored through adaptability rather than rigid institutional tracks."
    )
    answer = f"{p1}\n\n{p2}{fate_note}"

    return PalmConsultationResponse(
        category="money",
        question=question,
        answer=answer,
        palm_features_referenced=features_ref,
        key_insights=[
            "Disciplined focus and domain expertise serve as your most reliable wealth multipliers.",
            "Independent value creation yields higher long-term satisfaction than passive conformity.",
            "Long-term compounding outpaces speculative impulse when guided by clear financial boundaries."
        ],
        reflective_action="Conduct a quarterly 'Value Inventory': Identify three personal skills you enjoy using and evaluate how effectively you are packaging and exchanging them in the marketplace.",
        cautionary_guidance="Palmistry provides symbolic cultural reflections on temperament and stewardship. It does not replace professional financial planning, accounting, or investment advice.",
        suggested_followups=[
            "What does my palm indicate about independent business vs salaried employment?",
            "How does my risk tolerance reflect in my crease formations?",
            "What timing and long-term milestones are suggested by my fate line?"
        ]
    )


def _build_health_response(question: str, life_curv: float, life_len: float, life_status: str) -> PalmConsultationResponse:
    wide_arc = life_curv >= 0.22

    features_ref = [
        f"Life Line Thenar Arch (Curvature: {round(life_curv, 2)})",
        f"Vitality Line Span (Coverage: {round(life_len * 100)}% of palm base)",
        "Thenar Mount (Base of Thumb Vitality Eminence)"
    ]

    if wide_arc:
        p1 = (
            "In traditional chiromancy, a sweeping, expansive Life line arch encircling the Thenar mount "
            "(the base of the thumb) symbolically represents a vigorous constitutional reservoir, strong physical "
            "resilience, and an outward-moving life rhythm. Historical texts associate this curvature with high "
            "stamina, an appetite for physical engagement, and the capacity to rebound from demanding periods."
        )
        p2 = (
            "Regarding physical wellbeing and health scope: Because your energetic capacity is naturally robust, "
            "the primary vulnerability highlighted in traditional philosophy is the tendency to over-commit and ignore "
            "subtle fatigue cues. Your vitality thrives when vigorous daily output is matched with deliberate, "
            "non-negotiable windows of deep restoration and restorative sleep."
        )
    else:
        p1 = (
            "In traditional palmistry texts (Johannes Hartlieb, 1448; Cheiro), a more contained Life line arc running "
            "closer to the thumb symbolizes a refined, introspective nervous system. Rather than burning energy through "
            "sheer brute force, your constitutional blueprint functions best on rhythmic consistency, environmental "
            "tranquility, and mindful energy conservation."
        )
        p2 = (
            "Regarding health scope: Traditional wisdom emphasizes pacing. You are built for focused sprints followed by "
            "secluded rejuvenation. High-stress, chaotic environments deplete your reserve faster than physical exertion; "
            "prioritizing quiet sensory boundaries, balanced nutrition, and grounding nature walks preserves your natural vitality."
        )

    answer = f"{p1}\n\n{p2}"

    return PalmConsultationResponse(
        category="health",
        question=question,
        answer=answer,
        palm_features_referenced=features_ref,
        key_insights=[
            "Your constitutional rhythm functions on predictable cycles of exertion and intentional recovery.",
            "Sensory boundaries and restorative environments directly protect your mental and physical vitality.",
            "Consistent daily movement anchors nervous system balance far better than sporadic high-intensity bursts."
        ],
        reflective_action="Establish an 'Energetic Pacing Check-In': Rate your daily energy on a scale of 1-10 at midday. If below 6, schedule a 15-minute screen-free restorative pause before continuing.",
        cautionary_guidance="Ethical Disclaimer: Palmistry reflects symbolic cultural archetypes around lifestyle rhythm and self-care. It NEVER diagnoses medical conditions, predicts diseases, or determines lifespan. Always consult qualified healthcare professionals.",
        suggested_followups=[
            "How does my palm suggest I should manage stress and prevent burnout?",
            "What daily restorative rituals best align with my life line pacing?",
            "How does emotional balance in my heart line interact with my physical stamina?"
        ]
    )


def _build_career_response(question: str, head_curv: float, head_len: float, fate_status: str) -> PalmConsultationResponse:
    is_analytical = head_curv < 0.18
    has_fate = fate_status == "detected"

    features_ref = [
        f"Head Line Mental Orientation (Curvature: {round(head_curv, 2)}, Span: {round(head_len * 100)}%)",
        f"Saturn / Fate Line Trajectory (Status: {fate_status})",
        "Mount of Jupiter (Executive Leadership Zone)"
    ]

    if is_analytical:
        p1 = (
            "In classical chiromancy, a straight, resolute Head line spanning the middle palm denotes exceptional "
            "cognitive focus, strategic coherence, and an aptitude for structured problem-solving. You excel in "
            "environments where clear expectations, measurable milestones, and rigorous standards govern success."
        )
        p2 = (
            "Regarding career scope: Traditional traditions suggest outstanding suitability for roles requiring "
            "executive decision-making, technological systems, architecture, financial strategy, or specialized "
            "technical mastery. You naturally cut through ambiguity and establish reliable operating frameworks that "
            "others rely upon."
        )
    else:
        p1 = (
            "In historical Hellenistic and Indian palmistry traditions, a gracefully curving Head line descending "
            "toward the Mount of the Moon represents an intuitive, multi-dimensional intellect. You synthesize "
            "diverse viewpoints, conceptualize visionary narratives, and solve complex problems through empathy and creative insight."
        )
        p2 = (
            "Regarding career scope: You thrive in dynamic, autonomous roles—such as creative direction, strategic consulting, "
            "product innovation, psychology, writing, or founder-level entrepreneurship. Rigid hierarchical bureaucracies "
            "with repetitive procedural constraints stifle your natural gifts; prioritize roles offering autonomy and mission alignment."
        )

    pivot_note = (
        " Furthermore, your Fate line indicates a strong sense of purpose that solidifies through self-directed initiatives."
        if has_fate
        else " Your palm indicates versatility—you possess the agility to reinvent your professional scope across multi-disciplinary chapters."
    )
    answer = f"{p1}\n\n{p2}{pivot_note}"

    return PalmConsultationResponse(
        category="career",
        question=question,
        answer=answer,
        palm_features_referenced=features_ref,
        key_insights=[
            "Autonomy and intellectual challenge are vital prerequisites for your career satisfaction.",
            "Your decision-making style is a defining asset; lean into your natural mental strengths.",
            "Cross-functional adaptability allows you to bridge specialized technical skills with big-picture leadership."
        ],
        reflective_action="Draft your 'Ideal Work Matrix': Divide a page into 'Energy Multipliers' (tasks that energize you) and 'Energy Drains'. Strive to allocate at least 65% of your workweek to your multipliers.",
        cautionary_guidance="Palmistry reflections explore vocational inclinations and archetypal strengths. Career advancement is driven by deliberate practice, skill acquisition, and real-world execution.",
        suggested_followups=[
            "Does my palm suggest an entrepreneurial path or executive organizational leadership?",
            "What hidden talents or secondary career pivots are indicated in my hand?",
            "How can I improve my focus and decision-making during major career transitions?"
        ]
    )


def _build_general_response(question: str, head_curv: float, life_curv: float, fate_status: str) -> PalmConsultationResponse:
    features_ref = [
        "Triad of Major Creases (Heart Line, Head Line, Life Line)",
        f"Head-Life Confluence (Equilibrium index: {round((head_curv + life_curv) / 2, 2)})",
        f"Vocational Vector (Fate status: {fate_status})"
    ]

    answer = (
        "In classical chiromancy, your overall palm architecture reflects a dynamic interplay between thoughtful contemplation "
        "and active worldly engagement. The connection between your Head line and Life line at their radial inception reveals a "
        "balanced temperament: you weigh decisions carefully before committing, yet act with steadfast conviction once your path is clear.\n\n"
        "Regarding your broader life scope: Traditional texts suggest that your greatest fulfillment occurs when you harmonize "
        "your personal aspirations with authentic community contribution. You possess both the stamina to endure demanding seasons "
        "and the reflective depth to find meaning beyond material markers alone."
    )

    return PalmConsultationResponse(
        category="general",
        question=question,
        answer=answer,
        palm_features_referenced=features_ref,
        key_insights=[
            "Your personal evolution is marked by progressive clarity and self-trust across each decade.",
            "Balancing head (strategy) and heart (empathy) is your core developmental theme.",
            "Your agency and daily choices continually shape your trajectory."
        ],
        reflective_action="Take 10 minutes for 'Whole-Life Contemplation': Write down one area where you are currently overthinking, and identify one simple, concrete action that restores flow.",
        cautionary_guidance="Palmistry readings are contemplative mirrors for self-reflection and entertainment. You hold complete freedom and responsibility for every choice in your life.",
        suggested_followups=[
            "How can I align my money goals with my deeper personal values?",
            "What does my palm reveal about balancing career ambitions with personal peace?",
            "What life themes are strongest in my current season of life?"
        ]
    )


def _build_dual_evolution_response(
    question: str,
    report: Dict[str, Any],
    features: Optional[PalmFeatures]
) -> PalmConsultationResponse:
    growth_idx = report.get("growth_index", 85.0)
    nd_hand = str(report.get("non_dominant_hand", "left")).capitalize()
    dom_hand = str(report.get("dominant_hand", "right")).capitalize()
    sections = report.get("comparative_sections", [])

    q_lower = question.lower()
    focus_section = None
    for s in sections:
        if isinstance(s, dict):
            name = s.get("line_name", "").lower()
            if any(term in q_lower for term in name.split()):
                focus_section = s
                break

    features_ref = [
        f"Non-Dominant ({nd_hand}) Palm: Subconscious Constitutional Blueprint",
        f"Dominant ({dom_hand}) Palm: Active Manifested Life Trajectory",
        f"Conscious Growth Index: {growth_idx}/100"
    ]
    if focus_section:
        features_ref.append(f"{focus_section.get('line_name')}: {str(focus_section.get('divergence_type', '')).capitalize()} Divergence")

    p1 = (
        f"In classical comparative chirology, contrasting your {nd_hand} palm with your {dom_hand} palm "
        "is the most definitive confirmation of conscious personal agency. The non-dominant hand reflects the inborn "
        "temperamental baseline and hereditary predispositions you inherited. Conversely, your dominant hand registers "
        "the neuro-physical contours shaped by conscious choices, intentional discipline, and real-world trials."
    )

    if focus_section:
        div_type = focus_section.get("divergence_type", "expanded")
        narrative = focus_section.get("evolution_narrative", "")
        rec = focus_section.get("growth_recommendation", "")
        p2 = (
            f"Addressing your specific inquiry regarding the {focus_section.get('line_name')}: Your reading identifies an "
            f"'{div_type}' divergence. {narrative} This demonstrates that you have actively cultivated this domain, "
            "transforming latent potential into grounded, daily capability."
        )
        rec_text = rec or "Reflect in your journal on the difference between your initial reaction to adversity and your conscious chosen response."
    else:
        p2 = (
            f"Your Conscious Growth Index of {growth_idx}/100 reveals marked evolutionary divergence—demonstrating that your life "
            "is not passively drifting on hereditary momentum, but is being proactively sculpted by your own decisions. "
            "Where your dominant hand displays deeper clarity or extended focus compared to your baseline, you have consciously forged personal strength."
        )
        rec_text = "Perform an evening alignment review: identify one choice you made today that was driven by habit vs. conscious intention."

    answer = f"{p1}\n\n{p2}"

    insights = [
        f"Your inborn blueprint ({nd_hand} palm) is a baseline foundation, while your lived reality ({dom_hand} palm) is self-authored.",
        f"Conscious Growth Index ({growth_idx}/100) confirms significant adaptive maturation across your life path.",
        "Line divergences reveal exactly where conscious discipline has elevated your original predispositions."
    ]

    return PalmConsultationResponse(
        category="dual_evolution",
        question=question,
        answer=answer,
        palm_features_referenced=features_ref,
        key_insights=insights,
        reflective_action=rec_text,
        cautionary_guidance=(
            "Dual-hand comparative palmistry is an introspective framework celebrating personal agency and self-accountability. "
            "It emphasizes that your ongoing decisions shape the trajectory of your life story."
        ),
        suggested_followups=[
            "Which major line displays the strongest conscious growth between my hands?",
            "How can I channel my inborn blueprint to accelerate my career development?",
            "What daily mindfulness practices best support continued alignment with my higher potential?"
        ]
    )
