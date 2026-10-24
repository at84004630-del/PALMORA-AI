"""
Evidence-Linked Palmistry Interpretation Library
Connects calibrated computer vision crease measurements to documented historical
traditions (Western classical, Hellenistic chiromancy, Indian Hastarekha / Samudrika Shastra,
and Chinese Shouxiang) with transparent limitations and mindfulness prompts.
"""

from typing import Dict, Any, List
from pydantic import BaseModel, Field

class InterpretationRecord(BaseModel):
    interpretation_id: str = Field(..., description="Stable unique identifier for the interpretation record")
    feature: str = Field(..., description="Anatomical palm feature (e.g. Heart Line)")
    description: str = Field(..., description="Documented traditional belief and cultural symbolism")
    tradition_attribution: str = Field(..., description="Source or cultural tradition attribution")
    applicable_limitations: str = Field(
        default="Symbolic folklore only. Does not predict health, relationship status, lifespan, or financial outcomes.",
        description="Explicit limitation bounds"
    )
    locale: str = Field(default="en-US", description="Language and locale")
    version: str = Field(default="2.0.0", description="Version of the interpretation record")
    reflections: List[str] = Field(default_factory=list, description="Mindfulness and self-inquiry reflection prompts")

# 1. HEART LINE (Distal Transverse Crease - Emotional Expression & Relationships)
HEART_LINE_RECORDS: Dict[str, InterpretationRecord] = {
    "heart_curved_high_jupiter": InterpretationRecord(
        interpretation_id="heart_curved_high_jupiter_v2",
        feature="Heart Line",
        tradition_attribution="Western Classical Chiromancy (Cheiro, 1897; Hellenistic Traditions)",
        description=(
            "An upper transverse crease exhibiting pronounced upward curvature (curvature index > 1.12) "
            "and a continuous transverse length ratio across the upper palm is symbolically associated in classical lore "
            "with emotional idealism, warmth, and generous engagement in close relationships. Historical texts "
            "interpret this upward curvature as reflecting elevated interpersonal standards balanced with "
            "deep loyalty and expressive warmth."
        ),
        applicable_limitations=(
            "Reflective symbolic interpretation based solely on measured upper transverse curvature and length ratio. "
            "Does not assert marital status, romantic longevity, or partner compatibility."
        ),
        reflections=[
            "How do your ideals in relationships balance with acceptance of everyday human vulnerabilities?",
            "In what specific ways do you communicate emotional appreciation to the people closest to you?",
            "Where could you create more room for reciprocal emotional expression without fear of judgment?"
        ]
    ),
    "heart_straight_saturn": InterpretationRecord(
        interpretation_id="heart_straight_saturn_v2",
        feature="Heart Line",
        tradition_attribution="Hellenistic & Medieval European Palmistry (Johannes Hartlieb, 1448)",
        description=(
            "A direct, horizontal upper transverse crease with low curvature (curvature index <= 1.05) and a "
            "steady transverse span across the upper palm is traditionally interpreted as representing emotional "
            "self-reliance, steady composure, and deliberate loyalty over sudden impulse. Symbolically, historical texts "
            "associate this linear horizontal trajectory with structured contemplation and valued personal boundaries."
        ),
        applicable_limitations=(
            "Cultural archetype based on measured low transverse curvature and length ratio. "
            "Does not diagnose emotional detachment or interpersonal difficulties."
        ),
        reflections=[
            "Do you give yourself adequate time and permission to process feelings before reacting to conflicts?",
            "How does maintaining healthy interpersonal boundaries actively support your mental clarity?",
            "What environments help you feel genuinely secure and understood?"
        ]
    ),
    "heart_moderate_gentle": InterpretationRecord(
        interpretation_id="heart_moderate_gentle_v2",
        feature="Heart Line",
        tradition_attribution="Indian Hastarekha Shastra (Samudrika Shastra tradition)",
        description=(
            "An upper transverse crease showing a moderate curvature index (1.05 to 1.12) and balanced length ratio "
            "across the upper palm is traditionally celebrated as the 'Madhyama' path—a harmonious equilibrium "
            "between expressive passion and steady emotional reserve. Folklore regards this balanced curvature as "
            "reflecting empathy combined with practical common sense in companionship."
        ),
        applicable_limitations=(
            "Traditional contemplative folklore based on measured moderate curvature and length ratio. "
            "Does not establish physiological or psychological traits."
        ),
        reflections=[
            "How do you sustain equilibrium between caring for loved ones and replenishing your own energy?",
            "What forms of honest communication bring you the greatest interpersonal harmony?",
            "Which connections in your life currently feel the most nourishing and reciprocal?"
        ]
    ),
    "heart_long_sweeping_percussion": InterpretationRecord(
        interpretation_id="heart_long_sweeping_percussion_v2",
        feature="Heart Line",
        tradition_attribution="Chinese Palmistry (Shouxiang / 手相 tradition)",
        description=(
            "An extended upper transverse crease with a high continuous length ratio (spanning >= 68% of palm width) "
            "is traditionally interpreted in Chinese Shouxiang lore as reflecting emotional devotion, generous "
            "dedication to community, and an expansive capacity to nurture others through steadfast, reliable presence."
        ),
        applicable_limitations=(
            "Cultural folklore based on measured high transverse length ratio. "
            "Does not dictate relationship outcomes or social standing."
        ),
        reflections=[
            "How do you ensure your natural generosity is met with equal respect and care from those around you?",
            "What community or creative circle allows your devotion to flourish most naturally?",
            "How do you practice kindness toward yourself when caring for others feels demanding?"
        ]
    ),
    "heart_straight_low_contour": InterpretationRecord(
        interpretation_id="heart_straight_low_contour_v2",
        feature="Heart Line",
        tradition_attribution="Renaissance Chiromancy (Girolamo Cardano, 1550)",
        description=(
            "A low-curvature upper transverse crease (curvature index <= 1.04) maintaining a direct horizontal trajectory "
            "across the lower section of the upper palm is historically associated with autonomous emotional discernment. "
            "Commentators interpreted this linear trajectory as reflecting individuals who guard their inner tranquility "
            "and prioritize selective, deeply grounded bonds."
        ),
        applicable_limitations=(
            "Symbolic archetype based on measured low curvature index and horizontal trajectory. "
            "Does not measure social capacity or affection depth."
        ),
        reflections=[
            "How does your selective trust protect your creative focus and inner tranquility?",
            "Who are the confidants that have truly earned access to your most vulnerable thoughts?",
            "Where could extending a small gesture of openness bring unexpected warmth to your daily life?"
        ]
    ),
    "heart_delicate_whisper": InterpretationRecord(
        interpretation_id="heart_delicate_whisper_v2",
        feature="Heart Line",
        tradition_attribution="Traditional Folk Chiromancy (Nuanced Reading School)",
        description=(
            "An upper transverse crease characterized by delicate edge contrast and moderate trace depth is traditionally "
            "associated with receptive sensitivity and emotional nuance. Folklore symbolically connects this subtle "
            "line definition with an introspective disposition that values quiet, authentic rapport over dramatic expression."
        ),
        applicable_limitations=(
            "Measured edge prominence was delicate or moderate. Lighting contrast and sensor exposure directly influence crease definition."
        ),
        reflections=[
            "Do you honor your quiet inner world when navigating fast-paced or demanding social spaces?",
            "What low-pressure settings allow your most authentic feelings to emerge naturally?",
            "How might gentle patience with yourself foster deeper, unforced connections with others?"
        ]
    ),
    "heart_uncertain_faint": InterpretationRecord(
        interpretation_id="heart_uncertain_faint_v2",
        feature="Heart Line",
        tradition_attribution="Traditional Folk Chiromancy (Nuanced Reading School)",
        description=(
            "An intermittent or low-contrast crease trace in the upper transverse palm zone indicates subtle, fragmented "
            "line continuity. Historical folklore associates this faint contour with a contemplative nature that benefits "
            "from unhurried interpersonal pacing."
        ),
        applicable_limitations=(
            "Crease trace was faint or discontinuous under current lighting. A retake with clear, directional lighting is recommended."
        ),
        reflections=[
            "What quiet spaces help you reconnect with your genuine feelings?",
            "How do you practice gentle self-care during times of rapid change?"
        ]
    ),
    "heart_not_detected": InterpretationRecord(
        interpretation_id="heart_not_detected_v2",
        feature="Heart Line",
        tradition_attribution="Palmora AI Vision Quality Engine",
        description=(
            "No continuous crease segment was detected in the upper transverse palm zone. Under our data-grounded "
            "analysis policy, no simulated reading is fabricated when a crease is not detected."
        ),
        applicable_limitations="Feature not detected in the upper transverse zone. Please capture a clear photograph under bright, even illumination.",
        reflections=[
            "Take a steady retake with your open palm facing the camera directly to enable crease analysis."
        ]
    )
}

# 2. HEAD LINE (Proximal Transverse Crease - Intellectual Focus & Work Preferences)
HEAD_LINE_RECORDS: Dict[str, InterpretationRecord] = {
    "head_sloping_moon": InterpretationRecord(
        interpretation_id="head_sloping_moon_v2",
        feature="Head Line",
        tradition_attribution="Classical Western Palmistry (Comte de Saint-Germain, 1897)",
        description=(
            "A mid-palm crease with a measured downward slope angle (orientation angle < -12°) and pronounced curvature "
            "descending toward the lower hypothenar sector is traditionally interpreted as a marker of imaginative "
            "synthesis, creative problem-solving, and lateral intuition. Historical texts associate this downward deflection "
            "with conceptual adaptability and non-linear thinking."
        ),
        applicable_limitations=(
            "Symbolic reflection based on measured downward slope angle and curvature. Does not measure cognitive capacity, IQ, or exam outcomes."
        ),
        reflections=[
            "How do you create regular space for creative imagination alongside practical daily routines?",
            "In what areas of your career or studies do your intuitive leaps prove most valuable?",
            "What new intellectual curiosity or creative craft is asking for your focused attention right now?"
        ]
    ),
    "head_straight_horizontal": InterpretationRecord(
        interpretation_id="head_straight_horizontal_v2",
        feature="Head Line",
        tradition_attribution="Traditional British & European Chiromancy (William Benham, 1900)",
        description=(
            "A mid-palm crease exhibiting a direct, near-horizontal orientation angle (approaching 0°) and low curvature "
            "index (<= 1.04) traversing steadily across the palm is traditionally interpreted as a hallmark of pragmatic "
            "intellect, systematic problem-solving, and empirical reasoning. Historical lore connects this linear trajectory "
            "with methodical execution and structured analysis."
        ),
        applicable_limitations=(
            "Reflective typology based on measured near-zero slope angle and low curvature. Does not predict commercial success or business outcomes."
        ),
        reflections=[
            "How does structured thinking help you break complex challenges down into manageable steps?",
            "Where might allowing room for experimental trial-and-error yield unexpected breakthroughs?",
            "What core values provide the steady compass for your long-term vocational goals?"
        ]
    ),
    "head_long_sweeping": InterpretationRecord(
        interpretation_id="head_long_sweeping_v2",
        feature="Head Line",
        tradition_attribution="Chinese Palmistry (Shouxiang / 手相 tradition)",
        description=(
            "A mid-palm crease with an extended continuous length ratio (traversing >= 65% of palm width) reflects "
            "in traditional Chinese Shouxiang lore an expansive breadth of inquiry, sustained attention to detail, and "
            "a preference for understanding foundational principles rather than superficial summaries."
        ),
        applicable_limitations=(
            "Cultural perspective based on measured continuous transverse length ratio. Does not indicate academic rank or vocational certainty."
        ),
        reflections=[
            "What multifaceted subject would you love to immerse yourself in deeply over the coming season?",
            "How can you avoid over-analyzing when simple, timely decisions need to be made?",
            "Which projects best engage your full range of analytical and visionary capabilities?"
        ]
    ),
    "head_dual_creative_fork": InterpretationRecord(
        interpretation_id="head_dual_creative_fork_v2",
        feature="Head Line",
        tradition_attribution="Hellenistic Chiromancy & Medieval Tradition",
        description=(
            "A mid-palm crease demonstrating moderate curvature (curvature index between 1.05 and 1.10) while "
            "maintaining a centered transverse trajectory across the palm is traditionally celebrated as a balanced "
            "intellectual contour—a measured geometry bridging conceptual imagination with structured practical execution."
        ),
        applicable_limitations=(
            "Symbolic vocational archetype based on measured moderate curvature and central trajectory. "
            "Single continuous crease tracked; does not indicate branching, creative career, or technical expertise."
        ),
        reflections=[
            "How do you translate your creative ideas into structured, tangible projects?",
            "What medium or writing style best captures your unique blend of logic and imagination?",
            "Which mentor or collaborator most inspires you to bring your visions into reality?"
        ]
    ),
    "head_compact_focused": InterpretationRecord(
        interpretation_id="head_compact_focused_v2",
        feature="Head Line",
        tradition_attribution="Indian Samudrika Shastra tradition",
        description=(
            "A compact mid-palm crease with a measured length ratio terminating within the central palm column (length ratio < 0.48) "
            "is interpreted in Indian Samudrika Shastra lore as reflecting an agile, decisive focus that prioritizes immediate "
            "utility and uncluttered practical clarity over extended theoretical debate."
        ),
        applicable_limitations=(
            "Cultural perspective based on measured compact length ratio. Does not reflect cognitive capacity or intellectual limits."
        ),
        reflections=[
            "How does your ability to make rapid, decisive assessments give you an edge in complex tasks?",
            "When is it beneficial to pause and invite secondary opinions before finalizing a direction?",
            "What single objective, if focused upon today, would produce the greatest positive momentum?"
        ]
    ),
    "head_delicate_fluid": InterpretationRecord(
        interpretation_id="head_delicate_fluid_v2",
        feature="Head Line",
        tradition_attribution="Nuanced Adaptability School",
        description=(
            "A mid-palm crease exhibiting delicate edge contrast and subtle pixel depth is traditionally viewed "
            "as reflecting mental adaptability, fluidity in perspective, and an openness to diverse viewpoints rather "
            "than rigid intellectual patterns."
        ),
        applicable_limitations=(
            "Measured edge response was delicate. Ambient lighting conditions and camera focus influence visual contrast."
        ),
        reflections=[
            "How does your adaptability help you navigate shifting professional landscapes?",
            "What daily anchors help you regain mental focus when distractions multiply?",
            "How do you distinguish between fleeting impulses and commitments worth sustaining?"
        ]
    ),
    "head_uncertain_faint": InterpretationRecord(
        interpretation_id="head_uncertain_faint_v2",
        feature="Head Line",
        tradition_attribution="Traditional Nuanced Folk Lore",
        description=(
            "An intermittent or low-contrast pixel trace along the mid-palm plane reflects subtle crease definition. "
            "Historical folklore associates this soft contour with cognitive flexibility and intuitive perception."
        ),
        applicable_limitations=(
            "Visual crease detection was uncertain or faint. A retake under even directional lighting is recommended."
        ),
        reflections=[
            "How do you ground your focus when presented with multiple competing priorities?",
            "What quiet moments in your day offer the sharpest mental clarity?"
        ]
    ),
    "head_not_detected": InterpretationRecord(
        interpretation_id="head_not_detected_v2",
        feature="Head Line",
        tradition_attribution="Palmora AI Vision Quality Engine",
        description=(
            "No clear Head Line crease was detected in the mid-palm region. Feature analysis abstains from "
            "generating unmeasured statements."
        ),
        applicable_limitations="Feature not detected. Retake photo with palm held flat under direct, even lighting.",
        reflections=[
            "Ensure the mid-palm is free of heavy glare or shadows before retaking."
        ]
    )
}

# 3. LIFE LINE (Thenar Radial Crease - Vitality, Pacing & Self-Reflection)
LIFE_LINE_RECORDS: Dict[str, InterpretationRecord] = {
    "life_wide_expansive": InterpretationRecord(
        interpretation_id="life_wide_expansive_v2",
        feature="Life Line",
        tradition_attribution="Renaissance & Modern Chiromancy (Girolamo Cardano, 1550; Fred Gettings, 1979)",
        description=(
            "Contrary to popular modern misconception, scholarly traditions historically viewed the radial crease "
            "NOT as an indicator of lifespan or mortality, but as a symbolic representation of daily energy allocation and pacing. "
            "A wide radial arc with a high curvature index (curvature > 1.15) sweeping broadly around the thumb base "
            "traditionally signifies an expansive appetite for sensory engagement and an adventurous approach to daily possibilities."
        ),
        applicable_limitations=(
            "Symbolic pacing folklore based on measured wide radial curvature index. "
            "Explicitly does NOT predict physical health, disease, longevity, or lifespan."
        ),
        reflections=[
            "What activities, movement, and environments most consistently restore your sense of physical vitality?",
            "How do you balance outward adventures with intentional periods of restorative rest?",
            "Where are you currently channeling your energy, and does it align with your authentic values?"
        ]
    ),
    "life_close_radial": InterpretationRecord(
        interpretation_id="life_close_radial_v2",
        feature="Life Line",
        tradition_attribution="Traditional European Folk Chiromancy",
        description=(
            "A radial crease contouring with a narrow sweep radius (low curvature index <= 1.06) close along the base "
            "of the thumb is traditionally associated with deliberate pacing, thoughtful conservation of personal energy, "
            "and deep appreciation for quiet, familiar surroundings. Historical lore connects this tight radial trajectory "
            "with intentional focus and energy containment."
        ),
        applicable_limitations=(
            "Symbolic lifestyle preference based on measured narrow radial curvature. "
            "Does not measure biological stamina or medical vitality."
        ),
        reflections=[
            "How does honoring your need for quiet personal sanctuary strengthen your daily resilience?",
            "Where in your schedule would simplifying commitments bring immediate peace of mind?",
            "What daily grounding rituals provide the comfort and clarity you cherish most?"
        ]
    ),
    "life_distinct_continuous": InterpretationRecord(
        interpretation_id="life_distinct_continuous_v2",
        feature="Life Line",
        tradition_attribution="Indian Samudrika Shastra & Classical Chiromancy",
        description=(
            "A clearly etched, unbroken radial crease contour around the base of the thumb is traditionally viewed "
            "as an emblem of tenacity, grounded resolve, and steady rhythmic pacing through changing life seasons. "
            "Folklore associates this continuous measured trajectory with sustained inner equilibrium and steady momentum."
        ),
        applicable_limitations=(
            "Traditional folklore based on measured unbroken crease continuity and length ratio. "
            "Does not diagnose physical constitution or medical prognosis."
        ),
        reflections=[
            "What past challenges have proven your inner endurance and adaptability?",
            "How do you nurture your physical and mental equilibrium during demanding periods?",
            "What long-term foundation are you building today that brings you deep purpose?"
        ]
    ),
    "life_long_grounded": InterpretationRecord(
        interpretation_id="life_long_grounded_v2",
        feature="Life Line",
        tradition_attribution="Chinese Palmistry (Shouxiang / 手相 tradition)",
        description=(
            "A radial crease with an extended continuous length ratio (length ratio >= 0.70) contouring downward toward "
            "the carpal boundary represents in Chinese Shouxiang lore rooted stability, respect for foundations, and patient "
            "cultivation. Historical texts celebrate this long continuous trajectory as a symbol of patient discipline and enduring focus."
        ),
        applicable_limitations=(
            "Symbolic lifestyle archetype based on measured continuous radial length ratio. "
            "Does not predict longevity or health conditions."
        ),
        reflections=[
            "What enduring commitments are you nurturing that will bear fruit over years rather than days?",
            "How do your personal roots and ancestral background provide strength in uncertain times?",
            "What habits of daily patience bring you the greatest sense of calm accomplishment?"
        ]
    ),
    "life_delicate_receptive": InterpretationRecord(
        interpretation_id="life_delicate_receptive_v2",
        feature="Life Line",
        tradition_attribution="Traditional Nuanced Folk Lore",
        description=(
            "A radial crease presenting delicate edge contrast and moderate depth around the thumb base is traditionally "
            "associated with sensitive somatic receptivity—an intuitive disposition attuned to ambient rhythms that flourishes "
            "through mindful, unhurried pacing."
        ),
        applicable_limitations=(
            "Measured crease edge contrast was delicate. Sensor exposure and lighting conditions directly affect contour prominence."
        ),
        reflections=[
            "How can you listen more attentively to your body's subtle signals when it asks for rest?",
            "What small, nourishing practices help you decompress at the end of each day?",
            "How does pacing yourself gently actually enable you to accomplish more with greater joy?"
        ]
    ),
    "life_uncertain_faint": InterpretationRecord(
        interpretation_id="life_uncertain_faint_v2",
        feature="Life Line",
        tradition_attribution="Traditional Folk Palmistry",
        description=(
            "An intermittent or low-contrast radial contour around the thumb base reflects subtle line definition. "
            "Traditional folklore associates this faint contour with somatic attunement and the value of deliberate, mindful pacing."
        ),
        applicable_limitations=(
            "Radial crease detection was marked uncertain under current illumination. A retake under balanced lighting is recommended."
        ),
        reflections=[
            "What gentle rituals help restore your daily energy?",
            "How can you build moments of stillness into your routine?"
        ]
    ),
    "life_not_detected": InterpretationRecord(
        interpretation_id="life_not_detected_v2",
        feature="Life Line",
        tradition_attribution="Palmora AI Vision Quality Engine",
        description=(
            "No distinct Life Line contour was detected around the thumb base. No synthetic reading is produced."
        ),
        applicable_limitations="Feature not detected. Position hand with palm flat and thumb gently extended under even lighting.",
        reflections=[
            "Keep palm flat with fingers naturally spread when taking another photo."
        ]
    )
}

# 4. FATE LINE (Central Longitudinal Crease - Purpose & Career Rhythm)
FATE_LINE_RECORDS: Dict[str, InterpretationRecord] = {
    "fate_central_vertical": InterpretationRecord(
        interpretation_id="fate_central_vertical_v2",
        feature="Fate Line",
        tradition_attribution="Classical Western Palmistry (Saturn Line)",
        description=(
            "A longitudinal crease ascending steeply along the central vertical axis of the palm (|orientation angle| >= 72°) "
            "with a continuous central length ratio is traditionally known as the Saturn Line. Historical folklore viewed this "
            "upright, centered orientation as representing a strong sense of personal vocation, self-directed discipline, "
            "and commitment to a defined craft."
        ),
        applicable_limitations=(
            "Traditional career symbolism based on measured vertical orientation angle and central length ratio. "
            "Does not predict job promotions, wealth, or economic status."
        ),
        reflections=[
            "What work or creative endeavor gives you the strongest sense of intrinsic purpose?",
            "How do you balance external career ambitions with personal fulfillment?",
            "Where in your path has self-directed initiative created the most meaningful opportunities?"
        ]
    ),
    "fate_origin_moon": InterpretationRecord(
        interpretation_id="fate_origin_moon_v2",
        feature="Fate Line",
        tradition_attribution="Hellenistic Chiromancy & Samudrika Shastra",
        description=(
            "A longitudinal crease ascending diagonally (|orientation angle| < 58°) from the lower hypothenar sector "
            "toward the central palm axis is traditionally regarded as a symbol of vocation shaped through collaboration, "
            "public resonance, and adaptive synergy. Historical folklore associates this diagonal trajectory with work that "
            "thrives through interpersonal rapport and creative partnership."
        ),
        applicable_limitations=(
            "Symbolic archetype based on measured diagonal orientation angle. "
            "Does not promise financial or public acclaim."
        ),
        reflections=[
            "How do creative partnerships and external feedback shape your vocational growth?",
            "What unique perspective do you offer that resonates deeply with others?",
            "Where could collaborating with others unlock opportunities you could not achieve alone?"
        ]
    ),
    "fate_absent_or_subtle": InterpretationRecord(
        interpretation_id="fate_absent_or_subtle_v2",
        feature="Fate Line",
        tradition_attribution="Modern Contemplative Palmistry",
        description=(
            "The absence or minimal length ratio (length ratio < 0.22) of a longitudinal crease along the central palm "
            "column is celebrated in modern contemplative palmistry not as a lack of purpose, but as a symbol of vocational "
            "freedom—an unscripted trajectory where one self-authors their path rather than following rigid external scripts."
        ),
        applicable_limitations=(
            "Normal anatomical variation based on measured absence or short central length ratio. "
            "Absence of a longitudinal crease is common and carries no negative connotation."
        ),
        reflections=[
            "How do you embrace the freedom to redefine your goals as you learn and grow?",
            "What opportunities are you currently designing for yourself from scratch?",
            "How does charting an unconventional path empower your authentic self-expression?"
        ]
    )
}

# Backward compatibility aliases
HEART_LINE_TRADITIONS = {
    k: {"symbolism": v.description, "reflections": v.reflections}
    for k, v in HEART_LINE_RECORDS.items()
}
HEAD_LINE_TRADITIONS = {
    k: {"symbolism": v.description, "reflections": v.reflections}
    for k, v in HEAD_LINE_RECORDS.items()
}
LIFE_LINE_TRADITIONS = {
    k: {"symbolism": v.description, "reflections": v.reflections}
    for k, v in LIFE_LINE_RECORDS.items()
}

