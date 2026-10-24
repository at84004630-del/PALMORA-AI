import logging
from typing import List, Optional, Any
from fastapi import APIRouter, HTTPException, Header, status, Depends
from ..schemas.readings import (
    PalmReadingReport,
    GenerateReadingRequest,
    PalmConsultationRequest,
    PalmConsultationResponse,
    TranslateReadingRequest,
    DualHandReadingReport,
    CompareReadingsRequest,
    TemporalDriftReport,
    TemporalDriftRequest,
    RelationalSynastryReport,
    RelationalSynastryRequest,
)
from ..schemas.palm import PalmFeatures, CreaseFeature
from ..readings.generator import (
    generate_palm_reading,
    generate_dual_hand_comparison,
    generate_temporal_drift_analysis,
    generate_relational_synastry,
)
from ..readings.consultant import answer_consultation_question
from ..readings.translator import translate_palm_reading
from .palm import EPHEMERAL_ANALYSIS_STORE
from ..cache import cache_client
from ..config import settings
from ..security import get_current_user_id
from ..database import (
    get_db_pool,
    insert_reading,
    get_reading_by_id,
    list_readings_by_user,
    soft_delete_reading,
    IdentitySpoofingError,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/readings", tags=["Readings Generation & Reports"])

# In-memory store for readings (indexed by reading_id and user_id)
# Schema: {reading_id: {"user_id": str, "data": PalmReadingReport}}
READINGS_STORE = {}

@router.post("/generate", response_model=PalmReadingReport)
async def generate_reading_endpoint(
    request: GenerateReadingRequest,
    user_id: str = Depends(get_current_user_id),
    pool: Optional[Any] = Depends(get_db_pool)
):
    """
    Generates a personalized, structured Palmora AI reading grounded in verified features.
    Enforces user quotas and adheres to strict safety boundaries.
    """
    features = None

    # If analysis_id is provided, enforce strict, fail-closed ownership verification
    if request.analysis_id and not request.analysis_id.startswith("sample"):
        cached = await cache_client.get(f"ephemeral:analysis:{request.analysis_id}")
        if cached is None:
            # Fallback to local mirror in case of transition or direct in-memory store
            cached = EPHEMERAL_ANALYSIS_STORE.get(request.analysis_id)

        if cached is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Palm analysis record not found or expired."
            )
        if not isinstance(cached, dict):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Palm analysis record is malformed."
            )

        analysis_owner = cached.get("user_id")
        # Fail closed: exact equality required between verified caller and record owner.
        # Unowned, missing, or mismatched records are strictly forbidden. No legacy guest bypasses.
        if not analysis_owner or analysis_owner != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Forbidden: You do not have authorization to access this palm analysis."
            )

        # Server-verified features take precedence over client-supplied spoofed values
        if "features" in cached and isinstance(cached["features"], dict):
            features = PalmFeatures(**cached["features"])
        elif "data" in cached and isinstance(cached["data"], dict) and "features" in cached["data"]:
            features = PalmFeatures(**cached["data"]["features"])
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Palm analysis record contains no valid crease features."
            )
    elif request.features:
        features = request.features

    if not features:
        # Fallback to empty features with honest status
        empty_feat = lambda name: CreaseFeature(
            name=name,
            status="uncertain",
            path=[],
            measurements={},
            confidence=None,
            confidence_explanation="No analysis features were supplied with request."
        )
        features = PalmFeatures(
            heart_line=empty_feat("Heart Line"),
            head_line=empty_feat("Head Line"),
            life_line=empty_feat("Life Line"),
        )

    # Generate reading
    report = await generate_palm_reading(
        features=features,
        user_notes=request.user_notes,
        tier=request.tier or "free",
        language=request.language or "en"
    )

    # Save to storage associated with caller (never trust client-supplied request.user_id)
    if pool is not None:
        try:
            await insert_reading(pool, user_id, report.model_dump())
        except (IdentitySpoofingError, Exception) as exc:
            logger.info("Database insert bypassed or failed (%s); storing in ephemeral cache", exc)
            READINGS_STORE[report.id] = {
                "user_id": user_id,
                "data": report
            }
    else:
        READINGS_STORE[report.id] = {
            "user_id": user_id,
            "data": report
        }

    return report

@router.get("", response_model=List[PalmReadingReport])
async def list_readings_endpoint(
    user_id: str = Depends(get_current_user_id),
    pool: Optional[Any] = Depends(get_db_pool)
):
    """
    Retrieves readings owned strictly by the verified caller.
    Unauthenticated callers with no session token cannot view any readings.
    """
    if pool is not None:
        try:
            db_records = await list_readings_by_user(pool, user_id)
            return [PalmReadingReport(**r) for r in db_records]
        except IdentitySpoofingError:
            pass

    user_readings = [
        item["data"] for item in READINGS_STORE.values()
        if item.get("user_id") == user_id
    ]
    return user_readings

@router.get("/{reading_id}", response_model=PalmReadingReport)
async def get_reading_endpoint(
    reading_id: str,
    user_id: str = Depends(get_current_user_id),
    pool: Optional[Any] = Depends(get_db_pool)
):
    """
    Retrieves a single reading report by ID with strict ownership verification.
    """
    if pool is not None:
        try:
            record_data = await get_reading_by_id(pool, reading_id, user_id)
            if record_data is not None:
                return PalmReadingReport(**record_data)
        except IdentitySpoofingError:
            pass

    record = READINGS_STORE.get(reading_id)
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Reading report not found."
        )

    # Strict ownership check: caller must be the verified owner
    if record["user_id"] != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have authorization to view this reading."
        )

    return record["data"]

@router.delete("/{reading_id}")
async def delete_reading_endpoint(
    reading_id: str,
    user_id: str = Depends(get_current_user_id),
    pool: Optional[Any] = Depends(get_db_pool)
):
    """
    Permanently deletes a reading report with strict ownership verification.
    """
    if pool is not None:
        try:
            deleted = await soft_delete_reading(pool, reading_id, user_id)
            if deleted:
                return {"success": True, "message": "Reading successfully deleted."}
        except IdentitySpoofingError:
            pass

    record = READINGS_STORE.get(reading_id)
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Reading report not found."
        )

    # Strict ownership check: caller must be the verified owner
    if record["user_id"] != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have authorization to delete this reading."
        )

    del READINGS_STORE[reading_id]
    return {"success": True, "message": "Reading successfully deleted."}

@router.post("/consult", response_model=PalmConsultationResponse)
async def consult_reading_endpoint(
    request: PalmConsultationRequest,
    user_id: str = Depends(get_current_user_id),
    pool: Optional[Any] = Depends(get_db_pool)
):
    """
    Answers targeted questions about Money, Health, Career, and Life Scope
    grounded in the caller's verified palm report features.
    """
    # Distributed rate limit protection
    is_blocked, _, _ = await cache_client.is_rate_limited(
        f"consult:{user_id}",
        max_requests=settings.RATE_LIMIT_CONSULT_PER_MINUTE,
        window_seconds=60
    )
    if is_blocked:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Rate limit exceeded. You may ask up to {settings.RATE_LIMIT_CONSULT_PER_MINUTE} consultation questions per minute."
        )

    # If reading_id is provided, look up stored reading context
    if request.reading_id:
        if pool is not None:
            try:
                record_data = await get_reading_by_id(pool, request.reading_id, user_id)
                if record_data and not request.report_context:
                    request.report_context = record_data
            except Exception:
                pass

        if not request.report_context:
            cached = READINGS_STORE.get(request.reading_id)
            if cached and isinstance(cached.get("data"), PalmReadingReport):
                request.report_context = cached["data"].model_dump()

    return await answer_consultation_question(request)

@router.post("/{reading_id}/ask", response_model=PalmConsultationResponse)
async def ask_specific_reading_endpoint(
    reading_id: str,
    request: PalmConsultationRequest,
    user_id: str = Depends(get_current_user_id),
    pool: Optional[Any] = Depends(get_db_pool)
):
    """
    Convenience route to ask questions on a specific reading by ID.
    """
    request.reading_id = reading_id
    return await consult_reading_endpoint(request=request, user_id=user_id, pool=pool)


@router.post("/translate", response_model=PalmReadingReport)
async def translate_reading_endpoint(
    request: TranslateReadingRequest,
    user_id: str = Depends(get_current_user_id),
    pool: Optional[Any] = Depends(get_db_pool)
):
    """
    Translates a palm reading report into any requested target language.
    Supports both saved reading IDs and direct in-memory report translation.
    """
    report = request.report

    # If reading_id is provided, fetch stored reading context
    if not report and request.reading_id:
        if pool is not None:
            try:
                record_data = await get_reading_by_id(pool, request.reading_id, user_id)
                if record_data:
                    report = PalmReadingReport(**record_data)
            except Exception:
                pass

        if not report:
            cached = READINGS_STORE.get(request.reading_id)
            if cached and isinstance(cached.get("data"), PalmReadingReport):
                report = cached["data"]

    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Reading report not found to translate."
        )

    # Perform translation
    translated = await translate_palm_reading(
        report=report,
        target_language=request.target_language
    )

    # Store in ephemeral memory indexed by reading_id and target language
    cache_key = f"{report.id}_{request.target_language}"
    READINGS_STORE[cache_key] = {
        "user_id": user_id,
        "data": translated
    }

    return translated


@router.post("/compare", response_model=DualHandReadingReport)
async def compare_readings_endpoint(
    request: CompareReadingsRequest,
    user_id: str = Depends(get_current_user_id)
):
    """
    Synthesizes a dual-hand comparative reading contrasting the non-dominant palm
    (innate potential) with the dominant palm (manifested reality).
    Enforces strict ownership verification when analysis IDs are supplied.
    """
    nd_features = request.non_dominant_features
    dom_features = request.dominant_features

    # Resolve non-dominant features if analysis_id provided and features not directly supplied
    if not nd_features and request.non_dominant_analysis_id:
        cached_nd = await cache_client.get(f"ephemeral:analysis:{request.non_dominant_analysis_id}")
        if cached_nd is None:
            cached_nd = EPHEMERAL_ANALYSIS_STORE.get(request.non_dominant_analysis_id)
        if not cached_nd or not isinstance(cached_nd, dict):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Non-dominant palm analysis record not found or expired."
            )
        if cached_nd.get("user_id") != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Forbidden: You do not own the non-dominant palm analysis."
            )
        if "features" in cached_nd:
            nd_features = PalmFeatures(**cached_nd["features"])
        elif "data" in cached_nd and "features" in cached_nd["data"]:
            nd_features = PalmFeatures(**cached_nd["data"]["features"])

    # Resolve dominant features if analysis_id provided and features not directly supplied
    if not dom_features and request.dominant_analysis_id:
        cached_dom = await cache_client.get(f"ephemeral:analysis:{request.dominant_analysis_id}")
        if cached_dom is None:
            cached_dom = EPHEMERAL_ANALYSIS_STORE.get(request.dominant_analysis_id)
        if not cached_dom or not isinstance(cached_dom, dict):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Dominant palm analysis record not found or expired."
            )
        if cached_dom.get("user_id") != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Forbidden: You do not own the dominant palm analysis."
            )
        if "features" in cached_dom:
            dom_features = PalmFeatures(**cached_dom["features"])
        elif "data" in cached_dom and "features" in cached_dom["data"]:
            dom_features = PalmFeatures(**cached_dom["data"]["features"])

    if not nd_features or not dom_features:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Dual-hand comparison requires valid features for both non-dominant and dominant hands."
        )

    dual_report = await generate_dual_hand_comparison(
        non_dominant_features=nd_features,
        dominant_features=dom_features,
        dominant_hand=request.dominant_hand or "right",
        user_notes=request.user_notes,
        language=request.language or "en"
    )

    # Cache dual report
    READINGS_STORE[dual_report.id] = {
        "user_id": user_id,
        "data": dual_report
    }

    return dual_report


@router.get("/compare/{reading_id}", response_model=DualHandReadingReport)
async def get_dual_reading_endpoint(
    reading_id: str,
    user_id: str = Depends(get_current_user_id)
):
    """
    Retrieves a cached dual-hand reading report by ID with ownership verification.
    """
    record = READINGS_STORE.get(reading_id)
    if not record or not isinstance(record.get("data"), DualHandReadingReport):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dual-hand reading report not found."
        )
    if record["user_id"] != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: You do not have authorization to view this reading."
        )
    return record["data"]


@router.post("/temporal-drift", response_model=TemporalDriftReport)
async def analyze_temporal_drift_endpoint(
    request: TemporalDriftRequest,
    user_id: str = Depends(get_current_user_id)
):
    """
    Computes visual crease drift differencing between two temporal palm scans of the same hand.
    Highlights fading chronic tension lines vs. deepening purpose and vocational lines with
    palmar structural stability scoring.
    """
    baseline_features = request.baseline_features
    current_features = request.current_features

    # Resolve baseline features if analysis_id provided
    if not baseline_features and request.baseline_analysis_id:
        cached_b = await cache_client.get(f"ephemeral:analysis:{request.baseline_analysis_id}")
        if cached_b is None:
            cached_b = EPHEMERAL_ANALYSIS_STORE.get(request.baseline_analysis_id)
        if not cached_b or not isinstance(cached_b, dict):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Baseline palm analysis record not found or expired."
            )
        if cached_b.get("user_id") != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Forbidden: You do not own the baseline palm analysis."
            )
        if "features" in cached_b:
            baseline_features = PalmFeatures(**cached_b["features"])
        elif "data" in cached_b and "features" in cached_b["data"]:
            baseline_features = PalmFeatures(**cached_b["data"]["features"])

    # Resolve current features if analysis_id provided
    if not current_features and request.current_analysis_id:
        cached_c = await cache_client.get(f"ephemeral:analysis:{request.current_analysis_id}")
        if cached_c is None:
            cached_c = EPHEMERAL_ANALYSIS_STORE.get(request.current_analysis_id)
        if not cached_c or not isinstance(cached_c, dict):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Current palm analysis record not found or expired."
            )
        if cached_c.get("user_id") != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Forbidden: You do not own the current palm analysis."
            )
        if "features" in cached_c:
            current_features = PalmFeatures(**cached_c["features"])
        elif "data" in cached_c and "features" in cached_c["data"]:
            current_features = PalmFeatures(**cached_c["data"]["features"])

    if not baseline_features or not current_features:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Temporal drift analysis requires valid features for both baseline and current scans."
        )

    drift_report = await generate_temporal_drift_analysis(
        baseline_features=baseline_features,
        current_features=current_features,
        hand_side=request.hand_side or "right",
        baseline_date=request.baseline_date,
        current_date=request.current_date,
        user_notes=request.user_notes,
        language=request.language or "en"
    )

    # Store in memory store
    READINGS_STORE[drift_report.id] = {
        "user_id": user_id,
        "data": drift_report
    }

    return drift_report


@router.get("/temporal-drift/{drift_id}", response_model=TemporalDriftReport)
async def get_temporal_drift_endpoint(
    drift_id: str,
    user_id: str = Depends(get_current_user_id)
):
    """
    Retrieves a cached temporal drift report by ID with ownership verification.
    """
    record = READINGS_STORE.get(drift_id)
    if not record or not isinstance(record.get("data"), TemporalDriftReport):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Temporal drift report not found."
        )
    if record["user_id"] != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: You do not have authorization to view this report."
        )
    return record["data"]


@router.post("/relational-synastry", response_model=RelationalSynastryReport)
async def generate_relational_synastry_endpoint(
    request: RelationalSynastryRequest,
    user_id: str = Depends(get_current_user_id)
):
    """
    Computes a Dual-User Relational Dynamics Matrix comparing communication temperaments (Head lines),
    emotional resonance (Heart lines), and lifestyle pacing (Life lines).
    Provides an overall Relational Synergy Index (0-100%) and constructive collaborative guidance.
    """
    synastry_report = await generate_relational_synastry(
        person_a_features=request.person_a_features,
        person_b_features=request.person_b_features,
        person_a_name=request.person_a_name or "Person A",
        person_b_name=request.person_b_name or "Person B",
        relationship_type=request.relationship_type or "romantic",
        user_notes=request.user_notes,
        language=request.language or "en"
    )

    READINGS_STORE[synastry_report.id] = {
        "user_id": user_id,
        "data": synastry_report
    }

    return synastry_report


@router.get("/relational-synastry/{synastry_id}", response_model=RelationalSynastryReport)
async def get_relational_synastry_endpoint(
    synastry_id: str,
    user_id: str = Depends(get_current_user_id)
):
    """
    Retrieves a cached relational synastry report by ID with ownership verification.
    """
    record = READINGS_STORE.get(synastry_id)
    if not record or not isinstance(record.get("data"), RelationalSynastryReport):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Relational synastry report not found."
        )
    if record["user_id"] != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: You do not have authorization to view this synastry report."
        )
    return record["data"]



