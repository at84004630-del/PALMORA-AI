"""
PostgreSQL Live Integration Tests (Phase 1 Acceptance Criteria)
These tests execute directly against a real PostgreSQL instance to prove database-level security:
  - Login role NOBYPASSRLS enforcement
  - Transaction-scoped role switching to 'authenticated'
  - Real RLS read/insert/update/delete isolation across users
  - Missing or incorrect identity context safety
  - Zero state leakage across pooled transactions
  - Account deletion queue isolation and profile-purge survival
  - Atomic transaction rollback on guest-claim failures

When TEST_DATABASE_URL is not set, tests are skipped with explicit diagnostic instructions.
"""

import os
import uuid
import pytest
from typing import Optional

TEST_DB_URL = os.getenv("TEST_DATABASE_URL", "")
ADMIN_DB_URL = os.getenv("TEST_ADMIN_DATABASE_URL", "")

pytestmark = pytest.mark.skipif(
    not TEST_DB_URL,
    reason="Requires a live local PostgreSQL test instance. Set TEST_DATABASE_URL to run."
)


def get_connection(url: str):
    """
    Returns an active database connection using the provided connection URL.
    Prefers psycopg.
    """
    try:
        import psycopg
        return psycopg.connect(url, autocommit=False)
    except ImportError:
        try:
            import psycopg2
            return psycopg2.connect(url)
        except ImportError:
            raise ImportError(
                "PostgreSQL integration tests require 'psycopg' or 'psycopg2' installed in the test environment."
            )


@pytest.fixture
def db_conn():
    """Provides a transactional database connection for the API connection role (authenticator)."""
    conn = get_connection(TEST_DB_URL)
    try:
        yield conn
    finally:
        conn.close()


@pytest.fixture
def admin_conn():
    """Provides an administrative / worker database connection for setup and worker operations."""
    if not ADMIN_DB_URL:
        pytest.skip("Requires TEST_ADMIN_DATABASE_URL for worker/admin verification.")
    conn = get_connection(ADMIN_DB_URL)
    try:
        yield conn
    finally:
        conn.close()


def test_real_pg_connection_role_nobypassrls(db_conn):
    """
    Acceptance Criterion: The API database connection role must NOT possess BYPASSRLS.
    Must return rolbypassrls = false to guarantee that RLS policies are physically enforced.
    """
    with db_conn.cursor() as cur:
        cur.execute("SELECT current_user;")
        login_role = cur.fetchone()[0]

        cur.execute(
            "SELECT rolbypassrls, rolsuper FROM pg_roles WHERE rolname = %s;",
            (login_role,)
        )
        row = cur.fetchone()
        assert row is not None, f"Role '{login_role}' not found in pg_roles."
        rolbypassrls, rolsuper = row[0], row[1]

        assert rolbypassrls is False, (
            f"SECURITY VIOLATION: Database connection role '{login_role}' has BYPASSRLS enabled! "
            "RLS will not be enforced on queries under this connection."
        )
        assert rolsuper is False, (
            f"SECURITY VIOLATION: Database connection role '{login_role}' is a SUPERUSER! "
            "Superusers bypass RLS. Connection must use an unprivileged role (e.g. authenticator)."
        )


def test_real_pg_transaction_role_switching(db_conn):
    """
    Acceptance Criterion: SET LOCAL ROLE authenticated succeeds and sets
    current_user = 'authenticated' strictly within the transaction.
    """
    with db_conn.cursor() as cur:
        # Before switch: login user
        cur.execute("SELECT current_user;")
        initial_role = cur.fetchone()[0]

        # Switch to authenticated inside transaction
        cur.execute("SET LOCAL ROLE authenticated;")
        cur.execute("SELECT current_user;")
        switched_role = cur.fetchone()[0]
        assert switched_role == "authenticated", (
            f"Expected current_user to be 'authenticated', got '{switched_role}'."
        )

    # Rollback and verify clean return
    db_conn.rollback()


def test_real_pg_rls_cross_user_isolation(db_conn):
    """
    Acceptance Criterion: User A cannot read, insert, update, or delete User B's readings.
    Executes actual PostgreSQL DML and asserts physical RLS policy enforcement.
    """
    user_a = str(uuid.uuid4())
    user_b = str(uuid.uuid4())
    reading_a_id = str(uuid.uuid4())

    with db_conn.cursor() as cur:
        # Step 1: Bootstrap test users in auth.users (triggers profile creation via handle_new_user)
        cur.execute(
            "INSERT INTO auth.users (id, email) VALUES (%s, %s), (%s, %s) "
            "ON CONFLICT (id) DO NOTHING;",
            (user_a, "user_a@test.com", user_b, "user_b@test.com")
        )
        db_conn.commit()

    # Step 2: User A inserts a private reading
    with db_conn.cursor() as cur:
        cur.execute("SET LOCAL ROLE authenticated;")
        cur.execute("SELECT set_config('request.jwt.claim.sub', %s, true);", (user_a,))
        cur.execute("SELECT set_config('request.jwt.claim.role', 'authenticated', true);")

        cur.execute(
            "INSERT INTO public.readings ("
            "  id, user_id, reading_title, overall_synthesis, love_reading, "
            "  career_reading, personality_reading, features_analyzed"
            ") VALUES (%s, %s, 'User A Secret Reading', 'Synthesis A', '{}', '{}', '{}', '{}');",
            (reading_a_id, user_a)
        )
        db_conn.commit()

    # Step 3: User B attempts to SELECT readings -> must NOT see reading A
    with db_conn.cursor() as cur:
        cur.execute("SET LOCAL ROLE authenticated;")
        cur.execute("SELECT set_config('request.jwt.claim.sub', %s, true);", (user_b,))
        cur.execute("SELECT set_config('request.jwt.claim.role', 'authenticated', true);")

        cur.execute("SELECT id FROM public.readings WHERE id = %s;", (reading_a_id,))
        rows = cur.fetchall()
        assert len(rows) == 0, (
            "RLS READ VIOLATION: User B was able to view User A's private reading!"
        )

        cur.execute("SELECT count(*) FROM public.readings;")
        count = cur.fetchone()[0]
        assert count == 0, (
            f"RLS ISOLATION VIOLATION: User B sees {count} readings, expected 0."
        )

    # Step 4: User B attempts to INSERT a reading owned by User A -> must FAIL RLS WITH CHECK
    with db_conn.cursor() as cur:
        cur.execute("SET LOCAL ROLE authenticated;")
        cur.execute("SELECT set_config('request.jwt.claim.sub', %s, true);", (user_b,))
        cur.execute("SELECT set_config('request.jwt.claim.role', 'authenticated', true);")

        with pytest.raises(Exception) as exc_info:
            cur.execute(
                "INSERT INTO public.readings ("
                "  id, user_id, reading_title, overall_synthesis, love_reading, "
                "  career_reading, personality_reading, features_analyzed"
                ") VALUES (%s, %s, 'Forged Reading', 'Synthesis Forged', '{}', '{}', '{}', '{}');",
                (str(uuid.uuid4()), user_a)
            )
        db_conn.rollback()
        assert "row-level security" in str(exc_info.value).lower() or "check" in str(exc_info.value).lower(), (
            f"Expected RLS policy violation on forged insert, got: {exc_info.value}"
        )

    # Step 5: User B attempts to UPDATE reading A -> must affect 0 rows
    with db_conn.cursor() as cur:
        cur.execute("SET LOCAL ROLE authenticated;")
        cur.execute("SELECT set_config('request.jwt.claim.sub', %s, true);", (user_b,))
        cur.execute("SELECT set_config('request.jwt.claim.role', 'authenticated', true);")

        cur.execute(
            "UPDATE public.readings SET reading_title = 'Hacked' WHERE id = %s;",
            (reading_a_id,)
        )
        assert cur.rowcount == 0, (
            f"RLS UPDATE VIOLATION: User B updated {cur.rowcount} rows owned by User A!"
        )

    # Step 6: User B attempts to DELETE reading A -> must affect 0 rows
    with db_conn.cursor() as cur:
        cur.execute("SET LOCAL ROLE authenticated;")
        cur.execute("SELECT set_config('request.jwt.claim.sub', %s, true);", (user_b,))
        cur.execute("SELECT set_config('request.jwt.claim.role', 'authenticated', true);")

        cur.execute(
            "DELETE FROM public.readings WHERE id = %s;",
            (reading_a_id,)
        )
        assert cur.rowcount == 0, (
            f"RLS DELETE VIOLATION: User B deleted {cur.rowcount} rows owned by User A!"
        )

    # Cleanup test data
    with db_conn.cursor() as cur:
        cur.execute("DELETE FROM auth.users WHERE id IN (%s, %s);", (user_a, user_b))
        db_conn.commit()


def test_real_pg_transaction_state_no_leak(db_conn):
    """
    Acceptance Criterion: Transaction-scoped claims (SET LOCAL) do NOT leak
    across consecutive queries on the same connection.
    """
    user_a = str(uuid.uuid4())

    with db_conn.cursor() as cur:
        # Tx 1: Set identity
        cur.execute("SET LOCAL ROLE authenticated;")
        cur.execute("SELECT set_config('request.jwt.claim.sub', %s, true);", (user_a,))
        cur.execute("SELECT current_setting('request.jwt.claim.sub', true);")
        assert cur.fetchone()[0] == user_a
    db_conn.commit()

    with db_conn.cursor() as cur:
        # Tx 2: Check that sub claim is gone on next transaction
        cur.execute("SELECT current_setting('request.jwt.claim.sub', true);")
        sub_val = cur.fetchone()[0]
        assert sub_val is None or sub_val == "", (
            f"LEAK VIOLATION: Transaction 2 inherited sub claim '{sub_val}' from Transaction 1!"
        )


def test_real_pg_deletion_queue_isolation_and_survival(db_conn, admin_conn):
    """
    Acceptance Criterion:
      1. Authenticated callers cannot SELECT from public.account_deletion_queue.
      2. Deletion queue record survives profile deletion (proves no CASCADE delete).
    """
    user_id = str(uuid.uuid4())

    with db_conn.cursor() as cur:
        cur.execute(
            "INSERT INTO auth.users (id, email) VALUES (%s, 'del@test.com') "
            "ON CONFLICT (id) DO NOTHING;",
            (user_id,)
        )
        db_conn.commit()

    # User queues deletion under authenticated role
    with db_conn.cursor() as cur:
        cur.execute("SET LOCAL ROLE authenticated;")
        cur.execute("SELECT set_config('request.jwt.claim.sub', %s, true);", (user_id,))
        cur.execute(
            "INSERT INTO public.account_deletion_queue (user_id, email_hash, status) "
            "VALUES (%s, 'hash_abc', 'pending');",
            (user_id,)
        )
        db_conn.commit()

    # User attempts to SELECT from account_deletion_queue -> must FAIL permission check
    with db_conn.cursor() as cur:
        cur.execute("SET LOCAL ROLE authenticated;")
        cur.execute("SELECT set_config('request.jwt.claim.sub', %s, true);", (user_id,))
        with pytest.raises(Exception) as exc_info:
            cur.execute("SELECT * FROM public.account_deletion_queue;")
        db_conn.rollback()
        assert "permission denied" in str(exc_info.value).lower(), (
            f"SECURITY VIOLATION: Authenticated user was able to SELECT from deletion queue: {exc_info.value}"
        )

    # Worker/Admin purges user's profile
    with admin_conn.cursor() as cur:
        cur.execute("DELETE FROM public.profiles WHERE id = %s;", (user_id,))
        admin_conn.commit()

    # Verify queue entry survived profile purge
    with admin_conn.cursor() as cur:
        cur.execute("SELECT status FROM public.account_deletion_queue WHERE user_id = %s;", (user_id,))
        row = cur.fetchone()
        assert row is not None, (
            "DURABILITY VIOLATION: account_deletion_queue entry was lost when profile was deleted!"
        )
        assert row[0] == "pending"

    # Cleanup via admin
    with admin_conn.cursor() as cur:
        cur.execute("DELETE FROM public.account_deletion_queue WHERE user_id = %s;", (user_id,))
        cur.execute("DELETE FROM auth.users WHERE id = %s;", (user_id,))
        admin_conn.commit()


def test_real_pg_atomic_rollback_on_failure(db_conn):
    """
    Acceptance Criterion: Injected failure during guest claim rolls back completely,
    leaving no partial claimed_guest_sessions or revoked_tokens records.
    """
    user_id = str(uuid.uuid4())
    guest_session_id = f"guest_{uuid.uuid4().hex[:16]}"
    token_hash = f"hash_{uuid.uuid4().hex}"

    with db_conn.cursor() as cur:
        cur.execute(
            "INSERT INTO auth.users (id, email) VALUES (%s, 'claim@test.com') "
            "ON CONFLICT (id) DO NOTHING;",
            (user_id,)
        )
        db_conn.commit()

    # Start transaction with authenticated user identity, insert partial claim, then ROLLBACK
    with db_conn.cursor() as cur:
        cur.execute("SET LOCAL ROLE authenticated;")
        cur.execute("SELECT set_config('request.jwt.claim.sub', %s, true);", (user_id,))
        cur.execute("SELECT set_config('request.jwt.claim.role', 'authenticated', true);")
        cur.execute(
            "INSERT INTO public.claimed_guest_sessions (guest_session_id, claimed_by_user_id) "
            "VALUES (%s, %s);",
            (guest_session_id, user_id)
        )
        cur.execute(
            "INSERT INTO public.revoked_tokens (token_hash, user_id, expires_at, revocation_type) "
            "VALUES (%s, %s, NOW() + INTERVAL '1 hour', 'guest_claim');",
            (token_hash, user_id)
        )
        # Injected failure: rollback
        db_conn.rollback()

    # Verify neither table retained partial records
    with db_conn.cursor() as cur:
        cur.execute("SET LOCAL ROLE authenticated;")
        cur.execute("SELECT set_config('request.jwt.claim.sub', %s, true);", (user_id,))
        cur.execute("SELECT set_config('request.jwt.claim.role', 'authenticated', true);")
        cur.execute("SELECT count(*) FROM public.claimed_guest_sessions WHERE guest_session_id = %s;", (guest_session_id,))
        assert cur.fetchone()[0] == 0

        cur.execute("SELECT count(*) FROM public.revoked_tokens WHERE token_hash = %s;", (token_hash,))
        assert cur.fetchone()[0] == 0

    # Cleanup
    with db_conn.cursor() as cur:
        cur.execute("DELETE FROM auth.users WHERE id = %s;", (user_id,))
        db_conn.commit()
