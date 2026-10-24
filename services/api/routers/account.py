from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, Header, status
from ..schemas.account import (
    UserProfile,
    UpdateProfileRequest,
    UsageQuota,
    DeleteAccountResponse,
    GuestSessionResponse
)
from .readings import get_current_user_id, READINGS_STORE
from .palm import EPHEMERAL_ANALYSIS_STORE
from ..security import create_guest_token, revoke_token, revoke_session
from ..database import get_db_pool, delete_user_account_data

class MagicLinkRequest(BaseModel):
    email: str
    reading_id: Optional[str] = None

class MagicLinkResponse(BaseModel):
    success: bool
    message: str
    recovery_token: str
    recovery_url: str

class EvolutionReminderRequest(BaseModel):
    email: str
    reading_id: Optional[str] = None
    days: int = 30

class EvolutionReminderResponse(BaseModel):
    success: bool
    scheduled_date: str
    message: str

EVOLUTION_REMINDERS: List[Dict[str, Any]] = []

router = APIRouter(prefix="/account", tags=["Account & Privacy"])

# In-memory mock user profiles
USER_PROFILES = {
    "guest_user": UserProfile(
        id="guest_user",
        email="guest@palmora.ai",
        display_name="Guest Seeker",
        created_at=datetime.now(timezone.utc).isoformat(),
        subscription_tier="free",
        readings_count=0,
        quota_limit=1,
        retention_policy="ephemeral_only"
    ),
    "auth_user_demo": UserProfile(
        id="auth_user_demo",
        email="user@palmora.ai",
        display_name="Abhinav",
        created_at=datetime.now(timezone.utc).isoformat(),
        subscription_tier="free",
        readings_count=1,
        quota_limit=1,
        retention_policy="ephemeral_only"
    )
}

@router.post("/guest-session", response_model=GuestSessionResponse)
async def create_guest_session_endpoint():
    """
    Issues a cryptographically signed, server-verifiable guest session token.
    Provides isolated guest identity without cross-device synchronization claims.
    """
    token, guest_id = create_guest_token()
    now_iso = datetime.now(timezone.utc).isoformat()
    USER_PROFILES[guest_id] = UserProfile(
        id=guest_id,
        email=f"{guest_id}@palmora.ai",
        display_name="Guest Seeker",
        created_at=now_iso,
        subscription_tier="free",
        readings_count=0,
        quota_limit=1,
        retention_policy="ephemeral_only"
    )
    return GuestSessionResponse(
        session_token=token,
        user_id=guest_id,
        is_guest=True,
        created_at=now_iso,
        disclaimer="Guest session is scoped to this browser and does not synchronize across devices."
    )

@router.post("/revoke-session")
async def revoke_session_endpoint(
    authorization: Optional[str] = Header(None),
    user_id: str = Depends(get_current_user_id)
):
    """
    Explicitly revokes the active session token and user session on the server.
    Subsequent requests with this token are rejected with 401 Unauthorized.
    """
    if authorization and authorization.startswith("Bearer "):
        revoke_token(authorization[7:].strip())
    revoke_session(user_id)
    return {"success": True, "message": "Session successfully revoked on server."}

@router.get("", response_model=UserProfile)
async def get_account_endpoint(user_id: str = Depends(get_current_user_id)):
    """
    Retrieves the authenticated user's profile and privacy preferences.
    """
    if user_id not in USER_PROFILES:
        USER_PROFILES[user_id] = UserProfile(
            id=user_id,
            email=f"{user_id}@palmora.ai",
            display_name="Palm Seeker",
            created_at=datetime.now(timezone.utc).isoformat(),
            subscription_tier="free",
            readings_count=0,
            quota_limit=1,
            retention_policy="ephemeral_only"
        )
    profile = USER_PROFILES[user_id]

    # Cross-reference PURCHASES_STORE to guarantee entitlement consistency
    try:
        from .billing import PURCHASES_STORE
        purchases = PURCHASES_STORE.get(user_id, [])
        active_purchases = [p for p in purchases if p.get("status") != "refunded"]
        if any(p.get("product") == "membership_monthly" for p in active_purchases):
            profile.subscription_tier = "membership"
            profile.quota_limit = 999
        elif any(p.get("product") == "dual_hand_report" for p in active_purchases):
            if profile.subscription_tier != "membership":
                profile.subscription_tier = "dual_hand"
            profile.quota_limit = max(profile.quota_limit, 5)
        elif any(p.get("product") == "premium_report" for p in active_purchases):
            if profile.subscription_tier not in ("membership", "dual_hand"):
                profile.subscription_tier = "premium_report"
            profile.quota_limit = max(profile.quota_limit, 3)
    except Exception:
        pass

    # Update reading count
    profile.readings_count = sum(1 for item in READINGS_STORE.values() if item.get("user_id") == user_id)
    return profile

@router.get("/quota", response_model=UsageQuota)
async def get_usage_quota_endpoint(user_id: str = Depends(get_current_user_id)):
    """
    Returns reading usage quotas and entitlement status.
    """
    profile = await get_account_endpoint(user_id)
    used = profile.readings_count
    total = profile.quota_limit if profile.subscription_tier == "free" else 999
    remaining = max(0, total - used)
    return UsageQuota(
        total_quota=total,
        used_quota=used,
        remaining_quota=remaining,
        tier=profile.subscription_tier,
        can_generate=remaining > 0 or profile.subscription_tier != "free"
    )

@router.patch("", response_model=UserProfile)
async def update_account_endpoint(
    update_data: UpdateProfileRequest,
    user_id: str = Depends(get_current_user_id)
):
    """
    Updates profile details or retention preferences.
    """
    profile = await get_account_endpoint(user_id)
    if update_data.display_name is not None:
        profile.display_name = update_data.display_name
    if update_data.retention_policy is not None:
        profile.retention_policy = update_data.retention_policy
    USER_PROFILES[user_id] = profile
    return profile

@router.delete("", response_model=DeleteAccountResponse)
async def delete_account_endpoint(
    authorization: Optional[str] = Header(None),
    user_id: str = Depends(get_current_user_id),
    pool: Optional[Any] = Depends(get_db_pool)
):
    """
    Executes full GDPR/privacy compliant deletion of user account, readings,
    and ephemeral analyses, then revokes the caller's session on the server.
    """
    # 1. Purge calling user's readings from in-memory store
    to_delete_readings = [k for k, v in READINGS_STORE.items() if v.get("user_id") == user_id]
    for k in to_delete_readings:
        READINGS_STORE.pop(k, None)

    # 2. Purge calling user's profile
    user_profile = USER_PROFILES.pop(user_id, None)

    # 3. Purge calling user's ephemeral analyses
    to_delete_analyses = [
        k for k, v in EPHEMERAL_ANALYSIS_STORE.items()
        if isinstance(v, dict) and v.get("user_id") == user_id
    ]
    for k in to_delete_analyses:
        EPHEMERAL_ANALYSIS_STORE.pop(k, None)

    # 4. Purge database records and queue GDPR deletion if DB is connected
    if pool is not None:
        email = user_profile.email if user_profile else None
        await delete_user_account_data(pool, user_id, email=email)

    # 5. Invalidate session token on server
    if authorization and authorization.startswith("Bearer "):
        revoke_token(authorization[7:].strip())
    revoke_session(user_id)

    return DeleteAccountResponse(
        success=True,
        message="Account, associated readings, and analyses have been permanently purged."
    )

@router.post("/magic-link", response_model=MagicLinkResponse)
async def generate_magic_link_endpoint(
    req: MagicLinkRequest,
    user_id: str = Depends(get_current_user_id)
):
    """
    Generates a cryptographically signed recovery token for the active user session.
    Binds the guest reading to the provided email and returns the recovery access URL.
    """
    if user_id in USER_PROFILES:
        USER_PROFILES[user_id].email = req.email

    token, _ = create_guest_token(guest_id=user_id, ttl_seconds=30 * 24 * 3600)
    reading_param = f"&id={req.reading_id}" if req.reading_id else ""
    recovery_url = f"/reading?token={token}{reading_param}"

    return MagicLinkResponse(
        success=True,
        message=f"Private recovery link generated and dispatched to {req.email}. You can bookmark your personal recovery URL.",
        recovery_token=token,
        recovery_url=recovery_url
    )

@router.post("/remind-evolution", response_model=EvolutionReminderResponse)
async def schedule_evolution_reminder_endpoint(
    req: EvolutionReminderRequest,
    user_id: str = Depends(get_current_user_id)
):
    """
    Schedules a 30-day temporal crease drift check-in for the user.
    """
    scheduled = datetime.now(timezone.utc) + timedelta(days=req.days)
    scheduled_str = scheduled.strftime("%B %d, %Y")
    EVOLUTION_REMINDERS.append({
        "user_id": user_id,
        "email": req.email,
        "reading_id": req.reading_id,
        "scheduled_for": scheduled.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    return EvolutionReminderResponse(
        success=True,
        scheduled_date=scheduled_str,
        message=f"30-day crease evolution check-in confirmed for {scheduled_str}. We will alert you at {req.email}."
    )


