from datetime import datetime, timezone
from typing import List, Optional, Dict, Any, Literal
from pydantic import BaseModel, Field
from .palm import PalmFeatures

class ReadingSection(BaseModel):
    title: str = Field(..., description="Section title (e.g. 'Heart Line & Emotional Expression')")
    feature_name: str = Field(..., description="Name of the physical feature referenced")
    feature_status: str = Field(..., description="Feature status: detected, uncertain, or not_detected")
    interpretation_id: Optional[str] = Field(None, description="Stable identifier from evidence-linked library")
    tradition_attribution: Optional[str] = Field(None, description="Documented tradition source attribution")
    observed_measurements_summary: Optional[str] = Field(None, description="Physical visual measurements separated from interpretation")
    traditional_interpretation: str = Field(..., description="Historical cultural symbolism associated with observed characteristics")
    reflective_prompts: List[str] = Field(..., description="Thoughtful mindfulness and self-reflection prompts")
    confidence_note: str = Field(..., description="Honest statement on visual visibility and interpretation bounds")
    applicable_limitations: Optional[str] = Field(None, description="Boundary limits for this interpretation")
    retake_recommended: bool = Field(default=False, description="Whether user should consider a retake for this feature")
    confidence: Optional[str] = Field(default="high", description="Archetype classification confidence: high or low")

class PalmReadingReport(BaseModel):
    id: str = Field(..., description="Unique reading identifier")
    reading_title: str = Field(..., description="Poetic title of the reading")
    created_at: str = Field(..., description="ISO 8601 creation timestamp")
    features_analyzed: List[str] = Field(default_factory=list, description="List of observable features incorporated")
    love_reading: ReadingSection = Field(..., description="Interpersonal reflection and heart line symbolism")
    career_reading: ReadingSection = Field(..., description="Work style, focus, and head line symbolism")
    personality_reading: ReadingSection = Field(..., description="Energy pacing, vitality symbolism, and life line interpretation")
    overall_synthesis: str = Field(..., description="Holistic integrative reflection")
    disclaimer: str = Field(
        default=(
            "Palmora AI readings are cultural, symbolic interpretations intended for "
            "contemplation, self-reflection, and entertainment. They are not predictive "
            "guarantees of future events and should not be used in place of professional, "
            "financial, psychological, or medical counsel."
        ),
        description="Mandatory entertainment and cultural framing disclaimer"
    )
    is_free_tier: bool = True
    generation_method: str = Field(
        default="grounded_cultural_library",
        description="'llm_augmented' if configured, or 'grounded_cultural_library' for deterministic verified fallback"
    )
    language: Optional[str] = Field(default="en", description="Report language code (e.g. 'en', 'hi', 'es', 'fr', 'de', 'ja', 'zh', 'ar')")
    features: Optional[PalmFeatures] = Field(default=None, description="Physical detected palm features associated with reading")
    roi_box: Optional[List[float]] = Field(default=None, description="Segmented palmar bounding box [ymin, xmin, ymax, xmax]")
    confidence_score: Optional[float] = Field(default=None, ge=0.0, le=1.0, description="Overall confidence score of crease and mount detection [0.0 - 1.0]")
    primary_tradition: Optional[str] = Field(default="Synthesis", description="Primary philosophical palmistry tradition")
    tradition_weighting: Optional[Dict[str, float]] = Field(
        default=None,
        description="Source tradition balance when primary_tradition is Synthesis (e.g. western_ratio, samudrika_ratio, shouxiang_ratio)"
    )
    confidence_advisory: Optional[str] = Field(
        default=None,
        description="Quality advisory notification if confidence_score is below threshold (under 0.70)"
    )

class GenerateReadingRequest(BaseModel):
    analysis_id: Optional[str] = None
    features: Optional[PalmFeatures] = None
    user_notes: Optional[str] = None
    user_id: Optional[str] = None
    tier: Optional[str] = "free"
    language: Optional[str] = Field(default="en", description="Target language code for reading generation")

class PalmConsultationRequest(BaseModel):
    reading_id: Optional[str] = None
    category: Optional[str] = Field(default="general", description="Category: money, health, career, general, or dual_evolution")
    question: str = Field(..., min_length=2, max_length=600, description="User's inquiry about their money, health, career, or life scope")
    report_context: Optional[Dict[str, Any]] = None
    dual_report_context: Optional[Dict[str, Any]] = None
    features: Optional[PalmFeatures] = None
    conversation_history: List[Dict[str, str]] = Field(default_factory=list, description="Prior conversation turns [{'role': 'user'|'assistant', 'content': str}]")
    language: Optional[str] = Field(default="en", description="Target language code for consultation response")

class PalmConsultationResponse(BaseModel):
    category: str
    question: str
    answer: str
    palm_features_referenced: List[str] = Field(default_factory=list)
    key_insights: List[str] = Field(default_factory=list)
    reflective_action: str
    cautionary_guidance: str
    suggested_followups: List[str] = Field(default_factory=list)
    created_at: Optional[str] = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    language: Optional[str] = Field(default="en", description="Language of this consultation response")

class TranslateReadingRequest(BaseModel):
    reading_id: Optional[str] = None
    target_language: str = Field(..., description="Target language code (e.g. 'hi', 'es', 'fr', 'de', 'ja', 'zh', 'ar') or name")
    report: Optional[PalmReadingReport] = None

class DualHandComparisonSection(BaseModel):
    line_name: str
    innate_summary: str
    manifested_summary: str
    divergence_type: Literal["aligned", "expanded", "recalibrated", "transcended", "self_directed", "emergent"]
    evolution_narrative: str
    growth_recommendation: str

class DualHandReadingReport(BaseModel):
    id: str = Field(..., description="Unique dual-hand report identifier")
    reading_title: str = Field(..., description="Poetic title of the comparative reading")
    created_at: str = Field(..., description="ISO 8601 creation timestamp")
    dominant_hand: Literal["left", "right"] = Field(default="right")
    non_dominant_hand: Literal["left", "right"] = Field(default="left")
    innate_reading: PalmReadingReport = Field(..., description="Subconscious baseline reading from non-dominant palm")
    manifested_reading: PalmReadingReport = Field(..., description="Active conscious life reading from dominant palm")
    comparative_sections: List[DualHandComparisonSection] = Field(default_factory=list, description="Line-by-line comparative analysis")
    overall_evolution_synthesis: str = Field(..., description="Holistic comparison between innate potential and lived reality")
    growth_index: float = Field(default=85.0, description="Calibrated alignment & growth score [0.0 - 100.0]")
    disclaimer: str = Field(
        default=(
            "Dual-hand comparative palmistry is an introspective tradition contrasting innate "
            "constitutional predispositions (non-dominant hand) with manifested conscious adaptations "
            "(dominant hand). This reflection is for personal contemplation and mindful self-discovery."
        )
    )
    language: Optional[str] = Field(default="en")
    innate_features: Optional[PalmFeatures] = None
    manifested_features: Optional[PalmFeatures] = None

class CompareReadingsRequest(BaseModel):
    non_dominant_analysis_id: Optional[str] = None
    dominant_analysis_id: Optional[str] = None
    non_dominant_features: Optional[PalmFeatures] = None
    dominant_features: Optional[PalmFeatures] = None
    dominant_hand: Optional[Literal["left", "right"]] = "right"
    user_notes: Optional[str] = None
    language: Optional[str] = "en"

class CreaseDriftMeasurement(BaseModel):
    line_name: str
    previous_prominence: float
    current_prominence: float
    delta_prominence: float
    trend: Literal["deepened", "faded", "stabilized", "branching"]
    symbolic_meaning: str

class MountDriftMeasurement(BaseModel):
    mount_name: str
    previous_elevation: float
    current_elevation: float
    delta_elevation: float
    trend: Literal["elevated", "softened", "steady"]
    symbolic_meaning: str

class TemporalDriftReport(BaseModel):
    id: str = Field(..., description="Unique temporal drift report identifier")
    created_at: str = Field(..., description="ISO 8601 creation timestamp")
    hand_side: str = Field(default="right")
    baseline_scan_date: Optional[str] = None
    current_scan_date: Optional[str] = None
    elapsed_months_estimate: float = Field(default=4.0, description="Estimated months between scans")
    crease_drifts: List[CreaseDriftMeasurement] = Field(default_factory=list)
    mount_drifts: Optional[List[MountDriftMeasurement]] = Field(default_factory=list)
    stability_score: float = Field(default=85.0, description="Palmar structural stability percentage [0.0 - 100.0]")
    deepened_lines_count: int = Field(default=0)
    softened_lines_count: int = Field(default=0)
    temporal_synthesis: str = Field(..., description="Evolutionary synthesis over time")
    mindfulness_reflection: str = Field(..., description="Reflective practice based on line drift")
    disclaimer: str = Field(
        default=(
            "Temporal palmar differencing tracks physical crease evolution and stress line softening "
            "over months of life experience. In classical palmistry, deepening lines reflect consolidated "
            "focus, while fading lines indicate the release of past emotional or nervous tension. "
            "This analysis is for self-reflective contemplation only."
        )
    )
    baseline_features: Optional[PalmFeatures] = None
    current_features: Optional[PalmFeatures] = None

class TemporalDriftRequest(BaseModel):
    baseline_analysis_id: Optional[str] = None
    current_analysis_id: Optional[str] = None
    baseline_features: Optional[PalmFeatures] = None
    current_features: Optional[PalmFeatures] = None
    baseline_date: Optional[str] = None
    current_date: Optional[str] = None
    hand_side: Optional[str] = "right"
    user_notes: Optional[str] = None
    language: Optional[str] = "en"

RelationshipCategory = Literal["romantic", "business_partners", "friendship"]

class RelationalDimensionComparison(BaseModel):
    dimension_name: str
    person_a_style: str
    person_b_style: str
    synergy_score: float # 0 - 100
    compatibility_tier: Literal["harmonious", "complementary", "dynamic_growth"]
    dynamics_narrative: str
    growth_recommendation: str

class RelationalSynastryReport(BaseModel):
    id: str = Field(..., description="Unique synastry report identifier")
    created_at: str = Field(..., description="ISO 8601 creation timestamp")
    person_a_name: str = Field(default="Person A")
    person_b_name: str = Field(default="Person B")
    relationship_type: RelationshipCategory = Field(default="romantic")
    head_communication: RelationalDimensionComparison
    heart_emotional: RelationalDimensionComparison
    life_pacing: RelationalDimensionComparison
    composite_synergy_score: float = Field(default=85.0, description="Overall synergy score [0.0 - 100.0]")
    archetypal_dynamic: str
    shared_strengths: List[str] = Field(default_factory=list)
    growth_edges: List[str] = Field(default_factory=list)
    collaborative_prompts: List[str] = Field(default_factory=list)
    disclaimer: str = Field(
        default=(
            "Relational palm synastry is an introspective tool exploring interpersonal dynamics, "
            "communication temperaments, emotional expression styles, and lifestyle rhythms. "
            "It is designed to nurture mindful dialogue, empathy, and mutual understanding. "
            "It does not predict relationship longevity or replace honest communication."
        )
    )
    person_a_features: Optional[PalmFeatures] = None
    person_b_features: Optional[PalmFeatures] = None

class RelationalSynastryRequest(BaseModel):
    person_a_features: PalmFeatures
    person_b_features: PalmFeatures
    person_a_name: Optional[str] = "Person A"
    person_b_name: Optional[str] = "Person B"
    relationship_type: Optional[RelationshipCategory] = "romantic"
    user_notes: Optional[str] = None
    language: Optional[str] = "en"

