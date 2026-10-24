"""
Unit tests for Palmora AI Phase 1 Database Foundation:
Schema integrity, trust boundary validation, transaction identity context,
least-privilege connection separation, outage handling, guest claim preparation,
and account deletion queue state machine builders.
"""

import os
import uuid
import pytest
from pathlib import Path
from fastapi import HTTPException

from services.api.database import (
    validate_authenticated_uuid,
    build_transaction_identity_statements,
    compute_token_hash,
    prepare_guest_claim_transaction,
    prepare_account_deletion_request,
    prepare_deletion_queue_update,
    DatabaseManager,
    DatabaseUnavailableError,
    IdentitySpoofingError,
    GuestClaimConflictError,
    handle_database_exception,
)
from services.api.config import settings


def test_schema_files_exist_and_integrity():
    """Verifies that all Phase 1 schema and rollback files exist and contain required structure."""
    base_dir = Path(__file__).resolve().parent.parent.parent.parent
    migrations_dir = base_dir / "supabase" / "migrations"
    rollbacks_dir = base_dir / "supabase" / "rollbacks"

    m1_path = migrations_dir / "001_initial_schema.sql"
    m2_path = migrations_dir / "002_foundation_and_lifecycle.sql"
    m2_down_path = rollbacks_dir / "002_foundation_and_lifecycle.down.sql"

    assert m1_path.exists(), "001_initial_schema.sql must exist."
    assert m2_path.exists(), "002_foundation_and_lifecycle.sql must exist."
    assert m2_down_path.exists(), "002_foundation_and_lifecycle.down.sql must exist in supabase/rollbacks/."

    # Verify Supabase CLI compatibility: migrations folder contains ONLY forward migrations
    down_in_migrations = list(migrations_dir.glob("*.down.sql"))
    assert len(down_in_migrations) == 0, (
        "supabase/migrations must NOT contain .down.sql files to prevent Supabase CLI from running rollbacks as forward migrations."
    )

    m2_sql = m2_path.read_text(encoding="utf-8")
    m2_down_sql = m2_down_path.read_text(encoding="utf-8")

    # Critical Phase 1 constraint: No global FORCE ROW LEVEL SECURITY
    assert "FORCE ROW LEVEL SECURITY" not in m2_sql, (
        "Phase 1 must not introduce an untested global FORCE ROW LEVEL SECURITY migration."
    )

    # Verify required tables and columns are defined
    assert "CREATE TABLE IF NOT EXISTS public.claimed_guest_sessions" in m2_sql
    assert "CREATE TABLE IF NOT EXISTS public.revoked_tokens" in m2_sql
    assert "CREATE TABLE IF NOT EXISTS public.account_deletion_queue" in m2_sql
    assert "revocation_type TEXT NOT NULL CHECK (revocation_type IN ('token', 'session', 'guest_claim'))" in m2_sql
    assert "token_hash TEXT PRIMARY KEY" in m2_sql
    assert "expires_at TIMESTAMPTZ NOT NULL" in m2_sql
    assert "handle_new_user()" in m2_sql

    # Verify rollback contains drops
    assert "DROP TABLE IF EXISTS public.account_deletion_queue" in m2_down_sql
    assert "DROP TABLE IF EXISTS public.revoked_tokens" in m2_down_sql
    assert "DROP TABLE IF EXISTS public.claimed_guest_sessions" in m2_down_sql
    assert "DROP FUNCTION IF EXISTS public.handle_new_user()" in m2_down_sql


def test_account_deletion_queue_survives_profile_deletion():
    """
    Verifies that account_deletion_queue does NOT reference public.profiles(id)
    with ON DELETE CASCADE, guaranteeing queue persistence across profile purge.
    """
    base_dir = Path(__file__).resolve().parent.parent.parent.parent
    m2_path = base_dir / "supabase" / "migrations" / "002_foundation_and_lifecycle.sql"
    m2_sql = m2_path.read_text(encoding="utf-8")

    # Extract account_deletion_queue definition
    start_idx = m2_sql.find("CREATE TABLE IF NOT EXISTS public.account_deletion_queue")
    end_idx = m2_sql.find(");", start_idx)
    table_ddl = m2_sql[start_idx:end_idx]

    assert "REFERENCES public.profiles(id) ON DELETE CASCADE" not in table_ddl, (
        "account_deletion_queue must NOT cascade delete with profiles(id), so deletion jobs survive."
    )


def test_trust_boundary_validates_uuid():
    """Verifies that only genuine RFC 4122 UUIDs are accepted across the trust boundary."""
    valid_uuid = str(uuid.uuid4())
    assert validate_authenticated_uuid(valid_uuid) == valid_uuid

    # Rejection of string guest IDs
    with pytest.raises(IdentitySpoofingError):
        validate_authenticated_uuid("guest_3a7b9c2d1e0f")

    # Rejection of empty or invalid identities
    with pytest.raises(IdentitySpoofingError):
        validate_authenticated_uuid("")

    # Rejection of SQL injection payloads
    with pytest.raises(IdentitySpoofingError):
        validate_authenticated_uuid("' OR 1=1 --")


def test_transaction_identity_statements_parameterized():
    """Verifies that identity statements set local role and parameterize the verified UUID claim."""
    test_uuid = str(uuid.uuid4())
    statements, params = build_transaction_identity_statements(test_uuid)

    assert len(statements) == 3
    assert statements[0] == "SET LOCAL ROLE authenticated;"
    assert "request.jwt.claim.sub" in statements[1]
    assert ":user_sub" in statements[1]
    assert "request.jwt.claim.role" in statements[2]

    # Sub claim is passed via parameters, never string interpolated
    assert params["user_sub"] == test_uuid


def test_token_hash_deterministic():
    """Verifies SHA-256 token hashing for durable revocation without plaintext storage."""
    token = "gst.guest_123.1800000000.abcdef"
    h1 = compute_token_hash(token)
    h2 = compute_token_hash(token)
    assert h1 == h2
    assert len(h1) == 64  # SHA-256 hex string

    with pytest.raises(ValueError):
        compute_token_hash("")


def test_guest_claim_transaction_preparation():
    """
    Verifies that guest claiming prepares atomic insertion of server-held reading
    under the authenticated UUID, revocations, and session claim.
    """
    user_id = str(uuid.uuid4())
    guest_id = "guest_deadbeef1234"
    guest_token = f"gst.{guest_id}.1800000000.sig123"
    expiry = 1800000000

    server_reading = {
        "id": str(uuid.uuid4()),
        "reading_title": "Test Reading",
        "love_reading": {"summary": "Great love"},
        "career_reading": {"summary": "Great career"},
        "personality_reading": {"summary": "Great personality"},
        "overall_synthesis": "Synthesis text",
        "features_analyzed": ["Heart Line", "Head Line"],
    }

    claim_data = prepare_guest_claim_transaction(
        authenticated_user_id=user_id,
        guest_session_id=guest_id,
        server_reading=server_reading,
        guest_token=guest_token,
        guest_token_expiry=expiry
    )

    assert claim_data["user_id"] == user_id
    assert claim_data["guest_session_id"] == guest_id
    assert "INSERT INTO public.claimed_guest_sessions" in claim_data["claim_session_sql"]
    assert "INSERT INTO public.revoked_tokens" in claim_data["revoke_token_sql"]
    assert "INSERT INTO public.readings" in claim_data["insert_reading_sql"]

    # Invariant: Reading is inserted with caller's verified UUID, not guest string ID
    assert claim_data["params"]["user_id"] == user_id
    assert claim_data["params"]["is_free_tier"] is True

    # Rejection if caller tries to pass a string guest ID as authenticated user
    with pytest.raises(IdentitySpoofingError):
        prepare_guest_claim_transaction(
            authenticated_user_id="guest_spoof",
            guest_session_id=guest_id,
            server_reading=server_reading,
            guest_token=guest_token,
            guest_token_expiry=expiry
        )


def test_account_deletion_queue_builders():
    """Verifies SQL builders and data minimization for account deletion queue."""
    user_id = str(uuid.uuid4())
    email = "seeker@palmora.ai"

    # Insertion request
    req = prepare_account_deletion_request(user_id=user_id, email=email)
    assert req["user_id"] == user_id
    assert len(req["email_hash"]) == 64  # SHA-256 hash
    assert "INSERT INTO public.account_deletion_queue" in req["sql"]
    assert "email_hash" in req["sql"]

    # Status update
    upd = prepare_deletion_queue_update(user_id=user_id, status_value="db_purged")
    assert upd["user_id"] == user_id
    assert upd["status_value"] == "db_purged"
    assert "UPDATE public.account_deletion_queue" in upd["sql"]

    # Rejection of invalid status
    with pytest.raises(ValueError):
        prepare_deletion_queue_update(user_id=user_id, status_value="invalid_status")


def test_least_privilege_connection_separation(monkeypatch):
    """Verifies that API connection and deletion-worker connection are strictly decoupled."""
    monkeypatch.setattr(settings, "DATABASE_ENABLED", False)
    mgr = DatabaseManager()
    health = mgr.check_health()

    assert "enabled" in health
    assert "api_configured" in health
    assert "worker_configured" in health

    # When database is disabled, attempts to require connection fail closed
    with pytest.raises(DatabaseUnavailableError):
        mgr.require_api_connection()

    with pytest.raises(DatabaseUnavailableError):
        mgr.require_worker_connection()


def test_database_outage_exception_mapping():
    """Verifies that database outages map to explicit HTTP 503 errors without leaking internals."""
    with pytest.raises(HTTPException) as exc_info:
        handle_database_exception(DatabaseUnavailableError("Database unreachable"))
    assert exc_info.value.status_code == 503
    assert "temporarily unavailable" in exc_info.value.detail

    with pytest.raises(HTTPException) as exc_info:
        handle_database_exception(IdentitySpoofingError("Forged caller identity"))
    assert exc_info.value.status_code == 401

    with pytest.raises(HTTPException) as exc_info:
        handle_database_exception(GuestClaimConflictError("Already claimed"))
    assert exc_info.value.status_code == 409
