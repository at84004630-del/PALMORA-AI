from typing import Optional, Literal
from pydantic import BaseModel, Field

RetentionPolicy = Literal["ephemeral_only", "save_readings_anonymized", "save_readings_with_images"]

class UserProfile(BaseModel):
    id: str
    email: str
    display_name: Optional[str] = "Seeker"
    created_at: str
    subscription_tier: Literal["free", "premium_report", "dual_hand", "membership"] = "free"
    readings_count: int = 0
    quota_limit: int = 1
    retention_policy: RetentionPolicy = "ephemeral_only"
    has_consented_to_terms: bool = True

class UpdateProfileRequest(BaseModel):
    display_name: Optional[str] = None
    retention_policy: Optional[RetentionPolicy] = None

class UsageQuota(BaseModel):
    total_quota: int
    used_quota: int
    remaining_quota: int
    tier: str
    can_generate: bool

class DeleteAccountResponse(BaseModel):
    success: bool
    message: str

class GuestSessionResponse(BaseModel):
    session_token: str
    user_id: str
    is_guest: bool = True
    created_at: str
    disclaimer: str

