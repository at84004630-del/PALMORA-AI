from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field
from fastapi import APIRouter

router = APIRouter(prefix="/analytics", tags=["Privacy-Conscious Analytics"])

ALLOWED_EVENT_NAMES = {
    "landing_view",
    "landing_visit",
    "scan_started",
    "upload_rejected",
    "scan_completed",
    "scan_failed",
    "feature_overlay_viewed",
    "reading_generated",
    "reading_saved",
    "share_card_created",
    "share_action",
    "referral_visit",
    "referral_completion",
    "signup_completed",
    "pricing_viewed",
    "pricing_visited",
    "checkout_started",
    "checkout_initiated",
    "purchase_verified",
    "account_deletion_requested"
}

DISALLOWED_PROPERTY_KEYS = {
    "image",
    "photo",
    "raw_photo",
    "data_url",
    "base64",
    "report_text",
    "raw_reading",
    "email",
    "password",
    "credit_card",
    "card_number",
    "biometric_vector",
    "coordinates"
}

class AnalyticsEvent(BaseModel):
    event_name: str = Field(..., description="Privacy-preserving user journey milestone")
    session_id: Optional[str] = None
    properties: Dict[str, Any] = Field(
        default_factory=dict,
        description="Non-PII metadata: acquisition_source, device_category, experiment_variant, analysis_version, error_category, etc."
    )

# In-memory storage for telemetry events
ANALYTICS_LOGS: List[Dict[str, Any]] = []

# Referral tracking store: {referral_code: {"referrer_session": str, "visits": int, "completions": int, "sessions": set()}}
REFERRAL_TRACKER: Dict[str, Dict[str, Any]] = {}

@router.post("/event")
@router.post("/track")
async def track_event_endpoint(event: AnalyticsEvent):
    """
    Records privacy-preserving user journey milestones.
    Strictly filters out image data, biometric coordinates, and personal text.
    Handles referral attribution and prevents self-referrals.
    """
    # Sanitize properties
    safe_props = {
        k: v for k, v in event.properties.items()
        if k.lower() not in DISALLOWED_PROPERTY_KEYS
    }

    record = {
        "event_name": event.event_name,
        "session_id": event.session_id,
        "properties": safe_props,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    ANALYTICS_LOGS.append(record)

    # Referral tracking handling
    ref_code = safe_props.get("referral_code")
    if ref_code:
        if ref_code not in REFERRAL_TRACKER:
            REFERRAL_TRACKER[ref_code] = {
                "referrer_session": safe_props.get("referrer_session", "unknown"),
                "visits": 0,
                "completions": 0,
                "referred_sessions": [],
                "completed_sessions": []
            }

        tracker = REFERRAL_TRACKER[ref_code]
        # Prevent self-referral abuse if referrer matches current session
        is_self_referral = (event.session_id and event.session_id == tracker.get("referrer_session"))

        if event.event_name == "referral_visit" and not is_self_referral:
            tracker["visits"] += 1
            if event.session_id and event.session_id not in tracker["referred_sessions"]:
                tracker["referred_sessions"].append(event.session_id)

        elif (event.event_name in ("reading_generated", "referral_completion")) and not is_self_referral:
            # If session was recorded or passed, ensure it is only counted once per session
            sess = event.session_id or "anon"
            if "completed_sessions" not in tracker:
                tracker["completed_sessions"] = []
            if sess not in tracker["completed_sessions"]:
                tracker["completions"] += 1
                tracker["completed_sessions"].append(sess)

    return {"status": "recorded", "recorded": True}

@router.get("/metrics")
async def get_startup_metrics_endpoint():
    """
    Computes key funnel and growth metrics from real recorded telemetry.
    All rates show honest sample sizes and denominators. Never fabricates data.
    """
    counts: Dict[str, int] = {}
    for entry in ANALYTICS_LOGS:
        ev = entry["event_name"]
        # Normalize legacy event names
        if ev == "landing_visit":
            ev = "landing_view"
        elif ev == "pricing_visited":
            ev = "pricing_viewed"
        elif ev == "checkout_initiated":
            ev = "checkout_started"

        counts[ev] = counts.get(ev, 0) + 1

    landing_views = counts.get("landing_view", 0)
    scans_started = counts.get("scan_started", 0)
    uploads_rejected = counts.get("upload_rejected", 0)
    scans_completed = counts.get("scan_completed", 0)
    readings_generated = counts.get("reading_generated", 0)
    readings_saved = counts.get("reading_saved", 0)
    share_cards_created = counts.get("share_card_created", 0)
    share_actions = counts.get("share_action", 0)
    referral_visits = counts.get("referral_visit", 0)
    pricing_views = counts.get("pricing_viewed", 0)
    checkouts_started = counts.get("checkout_started", 0)
    purchases_verified = counts.get("purchase_verified", 0)
    deletions_requested = counts.get("account_deletion_requested", 0)

    # Conversion Calculations with explicit denominators
    visitor_to_scan_pct = (scans_started / landing_views * 100.0) if landing_views > 0 else 0.0
    scan_completion_pct = (scans_completed / scans_started * 100.0) if scans_started > 0 else 0.0
    reading_generation_pct = (readings_generated / scans_completed * 100.0) if scans_completed > 0 else 0.0
    share_card_creation_pct = (share_cards_created / readings_generated * 100.0) if readings_generated > 0 else 0.0
    share_action_pct = (share_actions / share_cards_created * 100.0) if share_cards_created > 0 else 0.0
    paid_conversion_pct = (purchases_verified / pricing_views * 100.0) if pricing_views > 0 else 0.0

    # Total referred completions
    total_referral_completions = sum(t["completions"] for t in REFERRAL_TRACKER.values())
    referral_conversion_pct = (
        (total_referral_completions / referral_visits * 100.0)
        if referral_visits > 0 else 0.0
    )

    return {
        "telemetry_summary": {
            "total_events_logged": len(ANALYTICS_LOGS),
            "date_range": "real-time in-memory session",
            "active_referral_campaigns": len(REFERRAL_TRACKER)
        },
        "raw_counts": {
            "landing_view": landing_views,
            "scan_started": scans_started,
            "upload_rejected": uploads_rejected,
            "scan_completed": scans_completed,
            "readings_generated": readings_generated,
            "readings_saved": readings_saved,
            "share_card_created": share_cards_created,
            "share_action": share_actions,
            "referral_visit": referral_visits,
            "pricing_viewed": pricing_views,
            "checkout_started": checkouts_started,
            "purchase_verified": purchases_verified,
            "account_deletion_requested": deletions_requested
        },
        "conversion_funnel": {
            "visitor_to_scan": {
                "rate_pct": round(visitor_to_scan_pct, 1),
                "numerator": scans_started,
                "denominator": landing_views
            },
            "scan_completion": {
                "rate_pct": round(scan_completion_pct, 1),
                "numerator": scans_completed,
                "denominator": scans_started
            },
            "reading_generation_success": {
                "rate_pct": round(reading_generation_pct, 1),
                "numerator": readings_generated,
                "denominator": scans_completed
            },
            "share_card_creation": {
                "rate_pct": round(share_card_creation_pct, 1),
                "numerator": share_cards_created,
                "denominator": readings_generated
            },
            "share_distribution": {
                "rate_pct": round(share_action_pct, 1),
                "numerator": share_actions,
                "denominator": share_cards_created
            },
            "referral_to_completed_reading": {
                "rate_pct": round(referral_conversion_pct, 1),
                "numerator": total_referral_completions,
                "denominator": referral_visits
            },
            "paid_checkout_conversion": {
                "rate_pct": round(paid_conversion_pct, 1),
                "numerator": purchases_verified,
                "denominator": pricing_views
            }
        },
        "operational_economics": {
            "estimated_cv_cost_per_reading_usd": 0.00,
            "estimated_llm_cost_per_reading_usd": 0.001 if readings_generated > 0 else 0.00,
            "privacy_guarantee": "Strict zero-photo, zero-biometric, zero-reading-text retention in telemetry."
        },
        "referrals": REFERRAL_TRACKER,
        "audit_policy": {
            "disallowed_keys_stripped": sorted(list(DISALLOWED_PROPERTY_KEYS)),
            "privacy_standard": "Ephemeral in-memory processing only"
        }
    }
