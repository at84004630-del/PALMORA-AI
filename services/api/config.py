import os
from typing import List, Set
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import model_validator

KNOWN_INSECURE_SECRETS: Set[str] = {
    "palmora-security-session-signing-secret-v1-production",
    "palmora-secret-key-change-in-production-2026",
    "palmora-dev-session-signing-key-for-local-testing-only-32bytes",
    "secret",
    "secretkey",
    "changeme",
    "development-secret-key",
}

def validate_production_secret_key(secret_key: str, environment: str = "development") -> None:
    """
    Validates that the SECRET_KEY meets cryptographic security standards for production.
    Fails closed if the secret is missing, matches a known default, or is too short.
    """
    env = (environment or "development").strip().lower()
    if env in ("production", "prod"):
        if not secret_key or not secret_key.strip():
            raise ValueError("SECRET_KEY must be configured in production environments.")
        s = secret_key.strip()
        if s in KNOWN_INSECURE_SECRETS or "change-in-production" in s.lower() or "local-testing" in s.lower():
            raise ValueError(
                "Insecure or known-default SECRET_KEY detected in production. "
                "You must configure a strong, unique SECRET_KEY of at least 32 characters."
            )
        if len(s) < 32:
            raise ValueError("SECRET_KEY in production must be at least 32 characters long.")

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    APP_NAME: str = "Palmora AI API"
    APP_VERSION: str = "1.0.0"
    ENVIRONMENT: str = "development"
    DEBUG: bool = False
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "https://palmora.ai",
        "https://*.vercel.app",
    ]

    # LLM Configuration
    GEMINI_API_KEY: str = ""
    OPENAI_API_KEY: str = ""
    LLM_PROVIDER: str = "auto"  # 'gemini', 'openai', 'offline'
    LLM_MODEL_NAME: str = "gemini-2.5-flash"

    # Supabase Configuration
    SUPABASE_URL: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""
    SUPABASE_ANON_KEY: str = ""
    SUPABASE_JWT_SECRET: str = ""

    # Database Configuration (Phase 1 Foundation)
    # DATABASE_URL: Least-privilege API pool connection (authenticator/palmora_api)
    DATABASE_URL: str = ""
    # DATABASE_WORKER_URL: Dedicated administrative connection for deletion worker (palmora_worker)
    DATABASE_WORKER_URL: str = ""
    DATABASE_POOL_MIN_SIZE: int = 1
    DATABASE_POOL_MAX_SIZE: int = 10
    DATABASE_CONNECT_TIMEOUT_SECONDS: float = 5.0
    DATABASE_STATEMENT_TIMEOUT_SECONDS: float = 10.0
    DATABASE_ENABLED: bool = False

    # Security & Privacy Flags
    SECRET_KEY: str = "palmora-dev-session-signing-key-for-local-testing-only-32bytes"
    ENABLE_PERSISTENT_STORAGE: bool = False  # Ephemeral memory by default
    MAX_IMAGE_SIZE_BYTES: int = 10 * 1024 * 1024  # 10 MB limit
    RATE_LIMIT_PER_MINUTE: int = 30
    RATE_LIMIT_CV_PER_MINUTE: int = 10
    RATE_LIMIT_CONSULT_PER_MINUTE: int = 15

    # Redis / Upstash Serverless Cache Configuration
    UPSTASH_REDIS_REST_URL: str = ""
    UPSTASH_REDIS_REST_TOKEN: str = ""
    REDIS_URL: str = ""
    CACHE_DEFAULT_TTL_SECONDS: int = 900  # 15 minutes for ephemeral analyses

    # Configurable Pricing Experiments & Approved Model
    # USD (PayPal / International)
    PRICE_PREMIUM_REPORT_USD: float = 4.99
    PRICE_DUAL_REPORT_USD: float = 6.99
    PRICE_MEMBERSHIP_USD_MONTHLY: float = 7.99
    # INR (Razorpay / UPI / India)
    PRICE_PREMIUM_REPORT_INR: int = 399
    PRICE_DUAL_REPORT_INR: int = 549
    PRICE_MEMBERSHIP_INR_MONTHLY: int = 699
    ENABLE_BILLING_SIMULATION: bool = False  # As instructed: do not fake transactions

    # Razorpay (UPI, Google Pay, PhonePe, Cards, NetBanking) Configuration
    RAZORPAY_KEY_ID: str = ""
    RAZORPAY_KEY_SECRET: str = ""
    RAZORPAY_WEBHOOK_SECRET: str = ""

    # PayPal (International Cards & PayPal Balance) Configuration
    PAYPAL_CLIENT_ID: str = ""
    PAYPAL_CLIENT_SECRET: str = ""
    PAYPAL_WEBHOOK_ID: str = ""
    PAYPAL_MODE: str = "sandbox"  # 'sandbox' or 'live'

    # Sentry Error Monitoring (Optional, fails open if unconfigured)
    SENTRY_DSN: str = ""

    @model_validator(mode="after")
    def validate_security_settings(self) -> "Settings":
        validate_production_secret_key(self.SECRET_KEY, self.ENVIRONMENT)
        return self

settings = Settings()

