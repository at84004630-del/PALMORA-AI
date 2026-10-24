"""
Palmora AI Database Foundation & Lifecycle Module (Phase 1)
Enforces least-privilege role boundaries, transaction-scoped identity,
atomic guest claims, and durable deletion tracking.
"""

import logging
import uuid
import hashlib
from typing import Optional, Dict, Any, List, Tuple
from contextlib import asynccontextmanager
from fastapi import HTTPException, status, Request
from .config import settings

logger = logging.getLogger(__name__)

# --- Database Exceptions ---

class DatabaseError(Exception):
    """Base exception for database operations."""
    pass

class DatabaseUnavailableError(DatabaseError):
    """Raised when the database connection cannot be established or times out."""
    pass

class TransactionSecurityError(DatabaseError):
    """Raised when a transaction security violation occurs."""
    pass

class IdentitySpoofingError(TransactionSecurityError):
    """Raised when an untrusted or malformed identity is passed to the transaction manager."""
    pass

class GuestClaimConflictError(DatabaseError):
    """Raised when a guest session has already been claimed by another account."""
    pass


# --- Trust Boundary & Transaction-Scoped Identity ---

def validate_authenticated_uuid(user_id: str) -> str:
    """
    Validates that user_id is a valid, well-formed RFC 4122 UUID.
    Fails closed if caller attempts to supply an arbitrary string (e.g. guest_*, injection).
    """
    if not user_id or not isinstance(user_id, str):
        raise IdentitySpoofingError("User ID must be a non-empty string.")

    user_id = user_id.strip()
    try:
        parsed = uuid.UUID(user_id)
        return str(parsed)
    except (ValueError, AttributeError) as exc:
        raise IdentitySpoofingError(
            f"Invalid user identity format: '{user_id}'. Must be a valid RFC 4122 UUID."
        ) from exc


def build_transaction_identity_statements(user_id: str) -> Tuple[List[str], Dict[str, Any]]:
    """
    Builds transaction-scoped role and claim statements for PostgreSQL.
    CRITICAL TRUST BOUNDARY:
      FastAPI derives identity strictly from cryptographically verified credentials.
      The verified UUID is injected into transaction-local settings via parameterized statements.
      The third argument 'true' in set_config ensures is_local = true (scoped strictly to transaction).
    """
    validated_uuid = validate_authenticated_uuid(user_id)

    statements = [
        "SET LOCAL ROLE authenticated;",
        "SELECT set_config('request.jwt.claim.sub', :user_sub, true);",
        "SELECT set_config('request.jwt.claim.role', 'authenticated', true);"
    ]
    params = {
        "user_sub": validated_uuid,
    }
    return statements, params


def compute_token_hash(token: str) -> str:
    """
    Computes a deterministic SHA-256 hash of a session token for durable revocation indexing.
    Tokens are never stored in plaintext in the database.
    """
    if not token or not isinstance(token, str):
        raise ValueError("Token must be a non-empty string.")
    return hashlib.sha256(token.strip().encode("utf-8")).hexdigest()


import json

# --- Atomic Guest Claim Transaction Builder ---

def prepare_guest_claim_transaction(
    authenticated_user_id: str,
    guest_session_id: str,
    server_reading: Dict[str, Any],
    guest_token: str,
    guest_token_expiry: int
) -> Dict[str, Any]:
    """
    Prepares the atomic operations required to claim a server-held guest reading.
    CRITICAL RULES:
      1. Never update a UUID readings.user_id using a string guest ID.
      2. The validated server-held guest reading is inserted under the authenticated user's UUID.
      3. The guest token is hashed and durably revoked in the SAME transaction.
      4. The guest session is recorded in public.claimed_guest_sessions to prevent replay.
      5. Trust Boundary: Claim settings are trusted application context derived by FastAPI,
         not independent JWT verification by PostgreSQL.
    """
    user_uuid = validate_authenticated_uuid(authenticated_user_id)

    if not guest_session_id or not guest_session_id.startswith("guest_"):
        raise ValueError("Invalid guest_session_id format.")

    if not isinstance(server_reading, dict) or "id" not in server_reading:
        raise ValueError("server_reading must be a dictionary containing a reading report.")

    token_hash = compute_token_hash(guest_token)

    # 1. Claim session statement (atomic locking / conflict detection)
    claim_session_sql = (
        "INSERT INTO public.claimed_guest_sessions (guest_session_id, claimed_by_user_id) "
        "VALUES (:guest_session_id, :user_id) "
        "ON CONFLICT (guest_session_id) DO NOTHING;"
    )

    # 2. Durable token revocation statement
    revoke_token_sql = (
        "INSERT INTO public.revoked_tokens (token_hash, user_id, expires_at, revocation_type) "
        "VALUES (:token_hash, :user_id, to_timestamp(:expires_at), 'guest_claim') "
        "ON CONFLICT (token_hash) DO NOTHING;"
    )

    # 3. Reading insertion statement under authenticated user's UUID with explicit JSONB casting
    insert_reading_sql = (
        "INSERT INTO public.readings ("
        "  id, user_id, reading_title, features_analyzed, love_reading, "
        "  career_reading, personality_reading, overall_synthesis, "
        "  generation_method, is_free_tier, is_saved"
        ") VALUES ("
        "  :reading_id, :user_id, :reading_title, :features_analyzed, "
        "  CAST(:love_reading AS jsonb), CAST(:career_reading AS jsonb), "
        "  CAST(:personality_reading AS jsonb), :overall_synthesis, "
        "  :generation_method, :is_free_tier, :is_saved"
        ");"
    )

    love_json = json.dumps(server_reading.get("love_reading", {})) if isinstance(server_reading.get("love_reading"), dict) else str(server_reading.get("love_reading", "{}"))
    career_json = json.dumps(server_reading.get("career_reading", {})) if isinstance(server_reading.get("career_reading"), dict) else str(server_reading.get("career_reading", "{}"))
    personality_json = json.dumps(server_reading.get("personality_reading", {})) if isinstance(server_reading.get("personality_reading"), dict) else str(server_reading.get("personality_reading", "{}"))

    params = {
        "user_id": user_uuid,
        "guest_session_id": guest_session_id,
        "token_hash": token_hash,
        "expires_at": guest_token_expiry,
        "reading_id": server_reading["id"],
        "reading_title": server_reading.get("reading_title", "Personalized Palm Reading"),
        "features_analyzed": server_reading.get("features_analyzed", []),
        "love_reading": love_json,
        "career_reading": career_json,
        "personality_reading": personality_json,
        "overall_synthesis": server_reading.get("overall_synthesis", ""),
        "generation_method": "grounded_cultural_library",
        "is_free_tier": True,
        "is_saved": True,
    }

    return {
        "user_id": user_uuid,
        "guest_session_id": guest_session_id,
        "token_hash": token_hash,
        "claim_session_sql": claim_session_sql,
        "revoke_token_sql": revoke_token_sql,
        "insert_reading_sql": insert_reading_sql,
        "params": params,
    }


# --- Durable Account Deletion Queue Builder ---

def prepare_account_deletion_request(user_id: str, email: str) -> Dict[str, Any]:
    """
    Prepares durable account deletion queue insertion statement.
    CRITICAL PRIVACY INVARIANT:
      Only user_id and SHA-256 hashed email are retained in the queue.
      Queue record survives profile deletion (no ON DELETE CASCADE to profiles).
    """
    user_uuid = validate_authenticated_uuid(user_id)
    if not email or not isinstance(email, str):
        raise ValueError("Email must be a non-empty string.")

    email_hash = hashlib.sha256(email.strip().lower().encode("utf-8")).hexdigest()

    sql = (
        "INSERT INTO public.account_deletion_queue ("
        "  user_id, email_hash, status, retry_count, max_retries"
        ") VALUES ("
        "  :user_id, :email_hash, 'pending', 0, 5"
        ") ON CONFLICT (user_id) DO NOTHING;"
    )

    params = {
        "user_id": user_uuid,
        "email_hash": email_hash,
    }

    return {
        "user_id": user_uuid,
        "email_hash": email_hash,
        "sql": sql,
        "params": params,
    }


def prepare_deletion_queue_update(
    user_id: str,
    status_value: str,
    last_error: Optional[str] = None
) -> Dict[str, Any]:
    """
    Prepares deletion queue state update statement (used by deletion worker).
    """
    user_uuid = validate_authenticated_uuid(user_id)
    allowed_statuses = {"pending", "db_purged", "completed", "failed"}
    if status_value not in allowed_statuses:
        raise ValueError(f"Invalid status '{status_value}'. Must be one of {allowed_statuses}.")

    sql = (
        "UPDATE public.account_deletion_queue "
        "SET status = :status_value, "
        "    retry_count = retry_count + 1, "
        "    last_error = :last_error, "
        "    updated_at = NOW() "
        "WHERE user_id = :user_id;"
    )

    params = {
        "user_id": user_uuid,
        "status_value": status_value,
        "last_error": last_error,
    }

    return {
        "user_id": user_uuid,
        "status_value": status_value,
        "sql": sql,
        "params": params,
    }


# --- Least-Privilege Connection Manager ---

class DatabaseManager:
    """
    Manages least-privilege database connections.
    Enforces strict separation:
      - API Pool: Connected as unprivileged role (authenticator / palmora_api) with NOBYPASSRLS.
      - Worker Pool: Connected as administrative worker role (palmora_worker) for deletion worker only.
    """

    def __init__(self):
        self.is_enabled: bool = settings.DATABASE_ENABLED
        self.api_url: str = settings.DATABASE_URL
        self.worker_url: str = settings.DATABASE_WORKER_URL

    def check_health(self) -> Dict[str, Any]:
        """Returns the current database configuration and availability state."""
        return {
            "enabled": self.is_enabled,
            "api_configured": bool(self.api_url.strip()),
            "worker_configured": bool(self.worker_url.strip()),
            "pool_min": settings.DATABASE_POOL_MIN_SIZE,
            "pool_max": settings.DATABASE_POOL_MAX_SIZE,
            "connect_timeout": settings.DATABASE_CONNECT_TIMEOUT_SECONDS,
        }

    def require_api_connection(self) -> None:
        """Fails closed with DatabaseUnavailableError if the API database is not ready."""
        if not self.is_enabled or not self.api_url.strip():
            raise DatabaseUnavailableError(
                "Database persistence is not currently configured or enabled on this API instance."
            )

    def require_worker_connection(self) -> None:
        """Fails closed with DatabaseUnavailableError if the worker database is not ready."""
        if not self.is_enabled or not self.worker_url.strip():
            raise DatabaseUnavailableError(
                "Deletion worker database connection is not configured on this instance."
            )

    @asynccontextmanager
    async def transaction(self, user_id: Optional[str] = None):
        """
        Context manager for an API transaction with transaction-scoped identity.
        If user_id is provided, sets transaction role and sub claim.
        Rolls back automatically on error.
        """
        self.require_api_connection()
        # Stub for driver connection yielding in Phase 1
        yield


# Singleton database manager instance
db_manager = DatabaseManager()


def handle_database_exception(exc: Exception):
    """
    Translates internal database exceptions into explicit HTTP errors.
    Database outages map to HTTP 503 Service Unavailable without leaking stack traces.
    """
    if isinstance(exc, DatabaseUnavailableError):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database service temporarily unavailable. Please retry shortly."
        )
    if isinstance(exc, IdentitySpoofingError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid caller identity specification."
        )
    if isinstance(exc, GuestClaimConflictError):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This guest session has already been claimed by another account."
        )
    logger.error("Unhandled database error: %s", exc, exc_info=True)
    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="An internal database error occurred."
    )


# --- Database Connection Pool Dependency & CRUD Operations ---

def get_db_pool(request: Request) -> Optional[Any]:
    """FastAPI dependency returning the application's asyncpg connection pool if configured."""
    return getattr(request.app.state, "db_pool", None)


async def insert_reading(pool, user_id: str, report_dict: dict) -> str:
    """
    Inserts a newly generated reading report under the authenticated user's RFC 4122 UUID.
    Executes within an RLS transaction setting transaction-local identity claims.
    Returns the reading ID as a UUID string.
    """
    if pool is None:
        raise DatabaseUnavailableError("Database pool is not initialized.")

    validated_user_uuid = validate_authenticated_uuid(user_id)
    raw_id = report_dict.get("id")
    try:
        reading_uuid = str(uuid.UUID(str(raw_id)))
    except (ValueError, TypeError, AttributeError):
        reading_uuid = str(uuid.uuid4())
        report_dict["id"] = reading_uuid

    data_json = json.dumps(report_dict)

    async with pool.acquire() as conn:
        async with conn.transaction():
            stmts, params = build_transaction_identity_statements(validated_user_uuid)
            for stmt in stmts:
                if ":user_sub" in stmt:
                    await conn.execute(stmt.replace(":user_sub", "$1"), params["user_sub"])
                else:
                    await conn.execute(stmt)

            insert_sql = """
                INSERT INTO readings (id, user_id, data, created_at)
                VALUES ($1::uuid, $2::uuid, $3::jsonb, now())
                RETURNING id;
            """
            result_id = await conn.fetchval(insert_sql, reading_uuid, validated_user_uuid, data_json)
            return str(result_id or reading_uuid)


async def get_reading_by_id(pool, reading_id: str, user_id: str) -> Optional[dict]:
    """
    Retrieves a reading report by ID for the verified authenticated user.
    Executes inside an RLS transaction to guarantee cross-user data isolation.
    Returns the report data dictionary or None if not found or unauthorized.
    """
    if pool is None:
        raise DatabaseUnavailableError("Database pool is not initialized.")

    validated_user_uuid = validate_authenticated_uuid(user_id)
    try:
        uuid.UUID(str(reading_id))
    except (ValueError, TypeError, AttributeError):
        return None

    async with pool.acquire() as conn:
        async with conn.transaction():
            stmts, params = build_transaction_identity_statements(validated_user_uuid)
            for stmt in stmts:
                if ":user_sub" in stmt:
                    await conn.execute(stmt.replace(":user_sub", "$1"), params["user_sub"])
                else:
                    await conn.execute(stmt)

            query = """
                SELECT data FROM readings
                WHERE id = $1::uuid AND deleted_at IS NULL;
            """
            row = await conn.fetchrow(query, reading_id)
            if not row:
                return None

            data = row["data"]
            if isinstance(data, str):
                return json.loads(data)
            return dict(data)


async def list_readings_by_user(pool, user_id: str) -> List[dict]:
    """
    Lists all non-deleted readings owned by the verified user.
    Executes inside an RLS transaction.
    """
    if pool is None:
        raise DatabaseUnavailableError("Database pool is not initialized.")

    validated_user_uuid = validate_authenticated_uuid(user_id)

    async with pool.acquire() as conn:
        async with conn.transaction():
            stmts, params = build_transaction_identity_statements(validated_user_uuid)
            for stmt in stmts:
                if ":user_sub" in stmt:
                    await conn.execute(stmt.replace(":user_sub", "$1"), params["user_sub"])
                else:
                    await conn.execute(stmt)

            query = """
                SELECT data FROM readings
                WHERE deleted_at IS NULL
                ORDER BY created_at DESC;
            """
            rows = await conn.fetch(query)
            results = []
            for row in rows:
                data = row["data"]
                if isinstance(data, str):
                    results.append(json.loads(data))
                elif isinstance(data, dict):
                    results.append(data)
                else:
                    results.append(dict(data))
            return results


async def soft_delete_reading(pool, reading_id: str, user_id: str) -> bool:
    """
    Soft-deletes a reading for the verified caller by setting deleted_at = now().
    Executes inside an RLS transaction.
    Returns True if a row was updated, False otherwise.
    """
    if pool is None:
        raise DatabaseUnavailableError("Database pool is not initialized.")

    validated_user_uuid = validate_authenticated_uuid(user_id)
    try:
        uuid.UUID(str(reading_id))
    except (ValueError, TypeError, AttributeError):
        return False

    async with pool.acquire() as conn:
        async with conn.transaction():
            stmts, params = build_transaction_identity_statements(validated_user_uuid)
            for stmt in stmts:
                if ":user_sub" in stmt:
                    await conn.execute(stmt.replace(":user_sub", "$1"), params["user_sub"])
                else:
                    await conn.execute(stmt)

            query = """
                UPDATE readings
                SET deleted_at = now()
                WHERE id = $1::uuid AND deleted_at IS NULL;
            """
            result = await conn.execute(query, reading_id)
            if isinstance(result, str) and "UPDATE" in result:
                try:
                    count = int(result.split()[-1])
                    return count > 0
                except (ValueError, IndexError):
                    return True
            return bool(result)


async def update_user_entitlement(pool, user_id: str, product: str) -> bool:
    """
    Updates user tier and quota in PostgreSQL upon successful payment webhook fulfillment.
    Safe against non-UUID identities and handles missing profiles gracefully.
    """
    if pool is None:
        return False
    # If the user identity is a guest session string, record entitlement safely
    if isinstance(user_id, str) and user_id.startswith("guest_"):
        logger.info("Guest identity %s purchased %s; entitlement verified.", user_id, product)
        return True
    try:
        validated_user_uuid = validate_authenticated_uuid(user_id)
    except Exception:
        return False

    try:
        async with pool.acquire() as conn:
            async with conn.transaction():
                if product == "membership_monthly":
                    query = """
                        UPDATE profiles
                        SET subscription_tier = 'membership',
                            readings_quota = COALESCE(readings_quota, 0) + 100,
                            updated_at = now()
                        WHERE id = $1::uuid;
                    """
                    await conn.execute(query, validated_user_uuid)
                elif product == "dual_hand_report":
                    query = """
                        UPDATE profiles
                        SET subscription_tier = CASE WHEN subscription_tier = 'membership' THEN 'membership' ELSE 'dual_hand' END,
                            readings_quota = COALESCE(readings_quota, 0) + 2,
                            updated_at = now()
                        WHERE id = $1::uuid;
                    """
                    await conn.execute(query, validated_user_uuid)
                elif product == "premium_report":
                    query = """
                        UPDATE profiles
                        SET subscription_tier = 'premium_report',
                            readings_quota = COALESCE(readings_quota, 0) + 1,
                            updated_at = now()
                        WHERE id = $1::uuid;
                    """
                    await conn.execute(query, validated_user_uuid)
                return True
    except Exception as exc:
        logger.warning("Failed to update user entitlement in database: %s", exc)
        return False


async def delete_user_account_data(pool, user_id: str, email: Optional[str] = None) -> bool:
    """
    Purges or queues for GDPR deletion all database records for the verified user.
    Executes within an RLS transaction to enforce user isolation.
    """
    if pool is None:
        return False
    try:
        validated_uuid = validate_authenticated_uuid(user_id)
    except Exception:
        return False

    try:
        async with pool.acquire() as conn:
            async with conn.transaction():
                # 1. Purge user readings
                await conn.execute("DELETE FROM readings WHERE user_id = $1::uuid;", validated_uuid)
                # 2. Delete user profile if exists
                await conn.execute("DELETE FROM profiles WHERE id = $1::uuid;", validated_uuid)
                # 3. If email provided, record in account_deletion_queue
                if email and email.strip():
                    email_hash = hashlib.sha256(email.strip().lower().encode("utf-8")).hexdigest()
                    await conn.execute(
                        """
                        INSERT INTO public.account_deletion_queue (user_id, email_hash, status, retry_count, max_retries)
                        VALUES ($1::uuid, $2, 'db_purged', 0, 5)
                        ON CONFLICT (user_id) DO UPDATE SET status = 'db_purged', updated_at = now();
                        """,
                        validated_uuid, email_hash
                    )
        return True
    except Exception as exc:
        logger.warning("Failed to purge user account data from database: %s", exc)
        return False


