export type FeatureStatus = 'detected' | 'uncertain' | 'not_detected' | 'unsupported';

export interface Point2D {
  x: number;
  y: number;
}

export interface ImageQualityMetrics {
  is_usable: boolean;
  hand_detected: boolean;
  palm_visible?: boolean;
  hand_orientation?: string;
  hand_facing?: string;
  occlusion_detected?: boolean;
  cropping_issues?: string[];
  blur_score: number;
  brightness_score: number;
  contrast_score: number;
  width: number;
  height: number;
  issues: string[];
  actionable_guidance?: string[];
}

export interface CreaseFeature {
  name: string;
  status: FeatureStatus;
  path: Point2D[];
  pixel_path?: Point2D[];
  bezier_control_points?: Point2D[] | null;
  measurements: Record<string, any>;
  detector_version?: string;
  quality_score?: number | null;
  confidence: number | null;
  uncertainty_factors?: string[];
  failure_reason?: string | null;
  confidence_explanation: string | null;
}

export interface MountContour {
  name: string;
  relative_elevation: number; // 0.0 - 1.0 from photometric shading
  prominence: 'flat' | 'moderate' | 'developed' | 'prominent' | string;
  symbolic_significance?: string;
  center?: Point2D | null;
  radius?: number | null;
  confidence?: number | null;
}

export interface MountTopography {
  jupiter: MountContour;
  saturn: MountContour;
  apollo: MountContour;
  mercury: MountContour;
  venus: MountContour;
  moon: MountContour;
}

export type ElementalHandType = 'earth' | 'air' | 'fire' | 'water';
export type SkinTextureTier = 'fine' | 'medium' | 'coarse';

export interface ElementalConstitution {
  hand_type: ElementalHandType;
  element_name: string;
  element_symbol: string;
  palm_aspect_ratio: number;
  digit_to_palm_ratio: number;
  skin_texture: SkinTextureTier;
  elemental_description: string;
  archetypal_traits: string[];
  balancing_lifestyle_practices: string[];
}

export interface PalmFeatures {
  heart_line: CreaseFeature;
  head_line: CreaseFeature;
  life_line: CreaseFeature;
  fate_line?: CreaseFeature | null;
  hand_side?: 'left' | 'right' | 'unknown' | string;
  mount_topography?: MountTopography | null;
  elemental_constitution?: ElementalConstitution | null;
  landmarks?: Point2D[] | null;
  landmarks_confidence?: number | null;
  hand_side_confidence?: number | null;
  overall_confidence?: number | null;
}

export interface PalmAnalysisResult {
  analysis_id: string;
  image_quality: ImageQualityMetrics;
  features: PalmFeatures;
  detected_hand_side?: 'left' | 'right' | 'unknown';
  palm_roi_box?: number[] | null;
  analysis_version: string;
  detector_model: string;
  isolated_bokeh_image_base64?: string | null;
  disclaimer: string;
}

export interface ReadingSection {
  title: string;
  feature_name: string;
  feature_status: FeatureStatus;
  interpretation_id?: string;
  tradition_attribution?: string;
  observed_measurements_summary?: string;
  traditional_interpretation: string;
  reflective_prompts: string[];
  confidence_note: string;
  applicable_limitations?: string;
  retake_recommended?: boolean;
}

export interface PalmReadingReport {
  id: string;
  reading_title: string;
  created_at: string;
  features_analyzed: string[];
  love_reading: ReadingSection;
  career_reading: ReadingSection;
  personality_reading: ReadingSection;
  overall_synthesis: string;
  disclaimer: string;
  is_free_tier: boolean;
  generation_method: string;
  language?: string;
  features?: PalmFeatures;
  roi_box?: number[];
  confidence_score?: number;
  primary_tradition?: string;
  tradition_weighting?: Record<string, number>;
  confidence_advisory?: string;
}

export interface GenerateReadingRequest {
  analysis_id?: string;
  features?: PalmFeatures;
  user_notes?: string;
  user_id?: string;
  tier?: string;
  language?: string;
}

export type DivergenceCategory = 'aligned' | 'expanded' | 'recalibrated' | 'transcended' | 'self_directed' | 'emergent';

export interface DualHandComparisonSection {
  line_name: string;
  innate_summary: string;
  manifested_summary: string;
  divergence_type: DivergenceCategory;
  evolution_narrative: string;
  growth_recommendation: string;
}

export interface DualHandReadingReport {
  id: string;
  reading_title: string;
  created_at: string;
  dominant_hand: 'left' | 'right';
  non_dominant_hand: 'left' | 'right';
  innate_reading: PalmReadingReport;
  manifested_reading: PalmReadingReport;
  comparative_sections: DualHandComparisonSection[];
  overall_evolution_synthesis: string;
  growth_index: number;
  disclaimer: string;
  language?: string;
  innate_features?: PalmFeatures;
  manifested_features?: PalmFeatures;
}

export interface CompareReadingsRequest {
  non_dominant_analysis_id?: string;
  dominant_analysis_id?: string;
  non_dominant_features?: PalmFeatures;
  dominant_features?: PalmFeatures;
  dominant_hand?: 'left' | 'right';
  user_notes?: string;
  language?: string;
}

export interface UserProfile {
  id: string;
  email: string;
  display_name: string;
  created_at: string;
  subscription_tier: 'free' | 'premium_report' | 'membership';
  readings_count: number;
  quota_limit: number;
  retention_policy: 'ephemeral_only' | 'save_readings_anonymized' | 'save_readings_with_images' | string;
  has_consented_to_terms?: boolean;
}

export interface UsageQuota {
  total_quota: number;
  used_quota: number;
  remaining_quota: number;
  tier: string;
  can_generate: boolean;
}

export interface GuestSessionResponse {
  session_token: string;
  user_id: string;
  is_guest: boolean;
  created_at: string;
  disclaimer: string;
}

export type PalmConsultationCategory = 'money' | 'health' | 'career' | 'general' | 'dual_evolution';

export interface PalmConsultationRequest {
  reading_id?: string;
  category?: PalmConsultationCategory;
  question: string;
  report_context?: Partial<PalmReadingReport>;
  dual_report_context?: Partial<DualHandReadingReport>;
  features?: PalmFeatures;
  conversation_history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  language?: string;
}

export interface PalmConsultationResponse {
  category: PalmConsultationCategory;
  question: string;
  answer: string;
  palm_features_referenced: string[];
  key_insights: string[];
  reflective_action: string;
  cautionary_guidance: string;
  suggested_followups: string[];
  created_at?: string;
  language?: string;
}

export interface SupportedLanguage {
  code: string;
  name: string;
  native_name: string;
  flag?: string;
  direction?: 'ltr' | 'rtl';
}

export interface TranslateReadingRequest {
  reading_id?: string;
  target_language: string;
  report?: PalmReadingReport;
}

export const SUPPORTED_LANGUAGES: SupportedLanguage[] = [
  { code: 'en', name: 'English', native_name: 'English', flag: '🇬🇧', direction: 'ltr' },
  { code: 'hinglish', name: 'Hinglish', native_name: 'Hinglish (हिन्दी/English)', flag: '🇮🇳', direction: 'ltr' },
  { code: 'hi', name: 'Hindi', native_name: 'हिन्दी', flag: '🇮🇳', direction: 'ltr' },
  { code: 'es', name: 'Spanish', native_name: 'Español', flag: '🇪🇸', direction: 'ltr' },
  { code: 'fr', name: 'French', native_name: 'Français', flag: '🇫🇷', direction: 'ltr' },
  { code: 'de', name: 'German', native_name: 'Deutsch', flag: '🇩🇪', direction: 'ltr' },
  { code: 'it', name: 'Italian', native_name: 'Italiano', flag: '🇮🇹', direction: 'ltr' },
  { code: 'pt', name: 'Portuguese', native_name: 'Português', flag: '🇵🇹', direction: 'ltr' },
  { code: 'ja', name: 'Japanese', native_name: '日本語', flag: '🇯🇵', direction: 'ltr' },
  { code: 'zh', name: 'Chinese', native_name: '简体中文', flag: '🇨🇳', direction: 'ltr' },
  { code: 'ar', name: 'Arabic', native_name: 'العربية', flag: '🇸🇦', direction: 'rtl' },
  { code: 'ru', name: 'Russian', native_name: 'Русский', flag: '🇷🇺', direction: 'ltr' },
  { code: 'ko', name: 'Korean', native_name: '한국어', flag: '🇰🇷', direction: 'ltr' },
  { code: 'bn', name: 'Bengali', native_name: 'বাংলা', flag: '🇧🇩', direction: 'ltr' },
  { code: 'mr', name: 'Marathi', native_name: 'मराठी', flag: '🇮🇳', direction: 'ltr' },
  { code: 'te', name: 'Telugu', native_name: 'తెలుగు', flag: '🇮🇳', direction: 'ltr' },
  { code: 'ta', name: 'Tamil', native_name: 'தமிழ்', flag: '🇮🇳', direction: 'ltr' },
  { code: 'gu', name: 'Gujarati', native_name: 'ગુજરાતી', flag: '🇮🇳', direction: 'ltr' },
  { code: 'tr', name: 'Turkish', native_name: 'Türkçe', flag: '🇹🇷', direction: 'ltr' },
  { code: 'nl', name: 'Dutch', native_name: 'Nederlands', flag: '🇳🇱', direction: 'ltr' },
  { code: 'vi', name: 'Vietnamese', native_name: 'Tiếng Việt', flag: '🇻🇳', direction: 'ltr' },
  { code: 'pl', name: 'Polish', native_name: 'Polski', flag: '🇵🇱', direction: 'ltr' },
  { code: 'id', name: 'Indonesian', native_name: 'Bahasa Indonesia', flag: '🇮🇩', direction: 'ltr' },
];

export type CreaseDriftTrend = 'deepened' | 'faded' | 'stabilized' | 'branching';

export interface CreaseDriftMeasurement {
  line_name: string;
  previous_prominence: number;
  current_prominence: number;
  delta_prominence: number;
  trend: CreaseDriftTrend;
  symbolic_meaning: string;
}

export interface MountDriftMeasurement {
  mount_name: string;
  previous_elevation: number;
  current_elevation: number;
  delta_elevation: number;
  trend: 'elevated' | 'softened' | 'steady';
  symbolic_meaning: string;
}

export interface TemporalDriftReport {
  id: string;
  created_at: string;
  hand_side: string;
  baseline_scan_date?: string;
  current_scan_date?: string;
  elapsed_months_estimate: number;
  crease_drifts: CreaseDriftMeasurement[];
  mount_drifts?: MountDriftMeasurement[];
  stability_score: number; // 0 - 100
  deepened_lines_count: number;
  softened_lines_count: number;
  temporal_synthesis: string;
  mindfulness_reflection: string;
  disclaimer: string;
  baseline_features?: PalmFeatures;
  current_features?: PalmFeatures;
}

export interface TemporalDriftRequest {
  baseline_analysis_id?: string;
  current_analysis_id?: string;
  baseline_features?: PalmFeatures;
  current_features?: PalmFeatures;
  baseline_date?: string;
  current_date?: string;
  hand_side?: 'left' | 'right' | string;
  user_notes?: string;
  language?: string;
}

// Synastry & Relational Palm Match Types
export type RelationshipCategory = 'romantic' | 'business_partners' | 'friendship';

export interface RelationalDimensionComparison {
  dimension_name: string;
  person_a_style: string;
  person_b_style: string;
  synergy_score: number; // 0 - 100
  compatibility_tier: 'harmonious' | 'complementary' | 'dynamic_growth';
  dynamics_narrative: string;
  growth_recommendation: string;
}

export interface RelationalSynastryReport {
  id: string;
  created_at: string;
  person_a_name: string;
  person_b_name: string;
  relationship_type: RelationshipCategory;
  head_communication: RelationalDimensionComparison;
  heart_emotional: RelationalDimensionComparison;
  life_pacing: RelationalDimensionComparison;
  composite_synergy_score: number; // 0 - 100
  archetypal_dynamic: string;
  shared_strengths: string[];
  growth_edges: string[];
  collaborative_prompts: string[];
  disclaimer: string;
  person_a_features?: PalmFeatures;
  person_b_features?: PalmFeatures;
}

export interface RelationalSynastryRequest {
  person_a_features: PalmFeatures;
  person_b_features: PalmFeatures;
  person_a_name?: string;
  person_b_name?: string;
  relationship_type?: RelationshipCategory;
  user_notes?: string;
  language?: string;
}

// Quarterly Crease Journaling & Habit Alignment Types
export type MindfulnessHabit =
  | 'meditation'
  | 'circadian_sleep'
  | 'movement_vitality'
  | 'deep_focus'
  | 'emotional_boundaries';

export interface CreaseJournalEntry {
  id: string;
  date: string;
  reading_id?: string;
  habits_completed: MindfulnessHabit[];
  stress_rating: number; // 1 (peaceful) to 5 (hyper-stressed)
  mindfulness_minutes: number;
  reflection_text: string;
}

export interface HabitAlignmentSummary {
  total_checkins: number;
  current_streak_days: number;
  most_consistent_habit: string;
  correlated_tension_reduction_pct: number;
  habit_alignment_score: number; // 0 - 100
  clinical_mindfulness_insight: string;
}

// Product Growth Telemetry & Conversion Funnel Types
export interface FunnelMetricStage {
  rate_pct: number;
  numerator: number;
  denominator: number;
}

export interface TelemetryData {
  telemetry_summary: {
    total_events_logged: number;
    date_range: string;
    active_referral_campaigns: number;
  };
  raw_counts: Record<string, number>;
  conversion_funnel: {
    visitor_to_scan_started?: FunnelMetricStage;
    scan_started_to_completed?: FunnelMetricStage;
    scan_completed_to_reading?: FunnelMetricStage;
    reading_to_share_card_created?: FunnelMetricStage;
    pricing_to_purchase_verified?: FunnelMetricStage;
    referral_visit_to_completed_reading?: FunnelMetricStage;
    visitor_to_scan?: FunnelMetricStage;
    scan_completion?: FunnelMetricStage;
    reading_generation_success?: FunnelMetricStage;
    share_card_creation?: FunnelMetricStage;
    share_distribution?: FunnelMetricStage;
    referral_to_completed_reading?: FunnelMetricStage;
    paid_checkout_conversion?: FunnelMetricStage;
  };
  referrals: Record<string, any>;
  operational_economics?: {
    estimated_cv_cost_per_reading_usd: number;
    estimated_llm_cost_per_reading_usd: number;
    privacy_guarantee: string;
  };
  audit_policy?: {
    disallowed_keys_stripped: string[];
    privacy_standard: string;
  };
}
