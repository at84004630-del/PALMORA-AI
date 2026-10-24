from typing import List, Dict, Any, Optional, Literal
from pydantic import BaseModel, Field

FeatureStatus = Literal["detected", "uncertain", "not_detected", "unsupported"]

class Point2D(BaseModel):
    x: float = Field(..., description="Normalized X coordinate in range [0.0, 1.0]")
    y: float = Field(..., description="Normalized Y coordinate in range [0.0, 1.0]")

class ImageQualityMetrics(BaseModel):
    is_usable: bool = Field(..., description="Whether the photograph meets minimum quality criteria for analysis")
    hand_detected: bool = Field(..., description="Whether a palm/hand contour was segmented")
    palm_visible: bool = Field(default=True, description="Whether palm surface with crease morphology is discernible")
    hand_orientation: str = Field(default="upright", description="Orientation estimate: upright, tilted_left, tilted_right, inverted, or unknown")
    hand_facing: str = Field(default="palm_facing", description="Facing estimate: palm_facing, back_of_hand, or unknown")
    occlusion_detected: bool = Field(default=False, description="Whether fingers or palm are partially obstructed")
    cropping_issues: List[str] = Field(default_factory=list, description="Border clipping warnings (e.g. wrist cropped, fingertips clipped)")
    blur_score: float = Field(..., description="Laplacian variance sharpness measurement")
    brightness_score: float = Field(..., description="Mean pixel luminance across skin region [0-255]")
    contrast_score: float = Field(..., description="Standard deviation of luminance across skin region")
    width: int = Field(..., description="Image width in pixels")
    height: int = Field(..., description="Image height in pixels")
    issues: List[str] = Field(default_factory=list, description="Diagnostic warnings (e.g. low lighting, motion blur)")
    actionable_guidance: List[str] = Field(default_factory=list, description="Clear, practical instructions for retaking the photo")

class FeatureMeasurement(BaseModel):
    length_ratio: Optional[float] = Field(None, description="Crease length relative to palm width")
    curvature_index: Optional[float] = Field(None, description="Degree of deviation from a straight line (0 = linear, higher = curved)")
    continuity_ratio: Optional[float] = Field(None, description="Proportion of uninterrupted ridge pixels")
    relative_depth: Optional[float] = Field(None, description="Relative contrast depth against surrounding skin")
    orientation_angle_deg: Optional[float] = Field(None, description="Dominant angle in degrees relative to horizontal")

class CreaseFeature(BaseModel):
    name: str = Field(..., description="Display name of the feature (e.g. Heart Line)")
    status: FeatureStatus = Field(..., description="Detection certainty: detected, uncertain, not_detected, or unsupported")
    path: List[Point2D] = Field(default_factory=list, description="Normalized coordinates [0.0 - 1.0] along centerline")
    pixel_path: List[Point2D] = Field(default_factory=list, description="Pixel coordinates [x, y] in original image space")
    measurements: Dict[str, Any] = Field(default_factory=dict, description="Observable physical metrics extracted from the image")
    detector_version: str = Field(default="multiscale_crease_extractor_v2.0", description="Algorithm version that extracted the crease")
    quality_score: Optional[float] = Field(None, description="Visual prominence/salience score before thresholding")
    confidence: Optional[float] = Field(None, description="Heuristic score [0.0 - 1.0] representing visual prominence & continuity")
    uncertainty_factors: List[str] = Field(default_factory=list, description="Specific factors contributing to uncertainty")
    failure_reason: Optional[str] = Field(None, description="Explanation if not detected or uncertain")
    confidence_explanation: Optional[str] = Field(None, description="Transparent explanation of how confidence was evaluated")

class MountContour(BaseModel):
    name: str = Field(..., description="Name of the mount (e.g. Mount of Jupiter, Mount of Venus)")
    relative_elevation: float = Field(default=0.5, description="Normalized relative elevation/thickness [0.0 - 1.0] from photometric shading")
    prominence: str = Field(default="moderate", description="Prominence classification: flat, moderate, developed, or prominent")
    symbolic_significance: Optional[str] = Field(None, description="Traditional cultural/archetypal association")

class MountTopography(BaseModel):
    jupiter: MountContour = Field(default_factory=lambda: MountContour(name="Mount of Jupiter", relative_elevation=0.52, prominence="moderate", symbolic_significance="Leadership, ambition, and social expansion"))
    saturn: MountContour = Field(default_factory=lambda: MountContour(name="Mount of Saturn", relative_elevation=0.48, prominence="moderate", symbolic_significance="Discipline, contemplative depth, and ethical grounding"))
    apollo: MountContour = Field(default_factory=lambda: MountContour(name="Mount of Apollo (Sun)", relative_elevation=0.50, prominence="moderate", symbolic_significance="Creativity, aesthetic appreciation, and public charisma"))
    mercury: MountContour = Field(default_factory=lambda: MountContour(name="Mount of Mercury", relative_elevation=0.49, prominence="moderate", symbolic_significance="Commercial discernment, quick intellect, and communication"))
    venus: MountContour = Field(default_factory=lambda: MountContour(name="Mount of Venus (Thenar)", relative_elevation=0.62, prominence="developed", symbolic_significance="Constitutional vitality, warmth, empathy, and sensory zest"))
    moon: MountContour = Field(default_factory=lambda: MountContour(name="Mount of Moon (Hypothenar)", relative_elevation=0.54, prominence="moderate", symbolic_significance="Intuition, imagination, receptive contemplation, and travel"))

ElementalHandType = Literal["earth", "air", "fire", "water"]
SkinTextureTier = Literal["fine", "medium", "coarse"]

class ElementalConstitution(BaseModel):
    hand_type: ElementalHandType = Field(..., description="Elemental hand classification: earth, air, fire, or water")
    element_name: str = Field(..., description="Capitalized name: Earth, Air, Fire, or Water")
    element_symbol: str = Field(..., description="Iconic symbol (e.g. 🌍, 💨, 🔥, 💧)")
    palm_aspect_ratio: float = Field(..., description="Palm length to width ratio (L_palm / W_palm)")
    digit_to_palm_ratio: float = Field(..., description="Ratio of middle finger length to palm length (L_digits / L_palm)")
    skin_texture: SkinTextureTier = Field(default="medium", description="Palmar dermatoglyphic skin texture tier")
    elemental_description: str = Field(..., description="Rich constitutional and temperamental overview")
    archetypal_traits: List[str] = Field(default_factory=list, description="Core behavioral traits")
    balancing_lifestyle_practices: List[str] = Field(default_factory=list, description="Mindfulness and lifestyle grounding recommendations")

class PalmFeatures(BaseModel):
    heart_line: CreaseFeature
    head_line: CreaseFeature
    life_line: CreaseFeature
    fate_line: Optional[CreaseFeature] = None
    hand_side: Optional[str] = Field("unknown", description="Hand side: left, right, or unknown")
    mount_topography: Optional[MountTopography] = Field(default=None, description="Photometric elevation and fleshiness of major palmar mounts")
    elemental_constitution: Optional[ElementalConstitution] = Field(default=None, description="Elemental hand typing and constitution")

class PalmAnalysisResult(BaseModel):
    analysis_id: str
    image_quality: ImageQualityMetrics
    features: PalmFeatures
    detected_hand_side: Optional[str] = Field("unknown", description="Estimated hand: left, right, or unknown")
    palm_roi_box: Optional[List[float]] = Field(None, description="Normalized bounding box [ymin, xmin, ymax, xmax] of palm disk")
    analysis_version: str = "2.0"
    detector_model: str = "multiscale_crease_extractor_v2.0"
    ensemble_timing_ms: Optional[float] = Field(None, description="Test-time ensembling execution time in milliseconds")
    ensemble_runs_count: Optional[int] = Field(5, description="Number of ensembled perturbation passes")
    disclaimer: str = (
        "Palmora AI provides cultural interpretations and traditional symbolic reflections "
        "for self-discovery and entertainment. It does not provide medical, scientific, "
        "personality diagnosis, or predictive assertions."
    )
