"""
Unit tests for Palmora AI asyncpg database CRUD operations,
transaction-scoped RLS parameterization, and pool dependency.
"""

import uuid
import json
import pytest
from unittest.mock import AsyncMock, MagicMock
from services.api.database import (
    insert_reading,
    get_reading_by_id,
    list_readings_by_user,
    soft_delete_reading,
    IdentitySpoofingError,
    DatabaseUnavailableError,
)


def create_mock_pool():
    """Constructs a mocked asyncpg connection pool with async context managers for acquire and transaction."""
    pool = MagicMock()
    conn = AsyncMock()

    # In asyncpg, conn.transaction() is a synchronous method returning an async context manager
    tx = MagicMock()
    tx.__aenter__ = AsyncMock(return_value=tx)
    tx.__aexit__ = AsyncMock(return_value=None)
    conn.transaction = MagicMock(return_value=tx)

    # In asyncpg, pool.acquire() is a synchronous method returning an async context manager
    acquire_ctx = MagicMock()
    acquire_ctx.__aenter__ = AsyncMock(return_value=conn)
    acquire_ctx.__aexit__ = AsyncMock(return_value=None)
    pool.acquire = MagicMock(return_value=acquire_ctx)

    return pool, conn


@pytest.mark.asyncio
async def test_insert_reading_returns_uuid_string():
    """Verifies that insert_reading executes inside an RLS transaction and returns a valid UUID string."""
    pool, conn = create_mock_pool()
    user_uuid = str(uuid.uuid4())
    reading_uuid = str(uuid.uuid4())

    report_dict = {
        "id": reading_uuid,
        "reading_title": "The Architecture of Intuition & Purpose",
        "love_reading": {"title": "Heart Line"},
        "features_analyzed": ["Heart Line"],
    }
    conn.fetchval.return_value = reading_uuid

    res_id = await insert_reading(pool, user_uuid, report_dict)

    assert res_id == reading_uuid
    assert isinstance(res_id, str)
    # Ensure a valid RFC 4122 UUID was returned
    uuid.UUID(res_id)

    # Verify transaction context was acquired
    conn.transaction.assert_called_once()
    conn.fetchval.assert_called_once()

    # Verify query and parameters
    call_args = conn.fetchval.call_args[0]
    assert "INSERT INTO readings" in call_args[0]
    assert call_args[1] == reading_uuid
    assert call_args[2] == user_uuid


@pytest.mark.asyncio
async def test_get_reading_by_id_returns_none_for_wrong_user_or_missing():
    """Verifies that get_reading_by_id returns None when a record is not found or filtered by RLS, and raises on spoofed identities."""
    pool, conn = create_mock_pool()
    user_uuid = str(uuid.uuid4())
    reading_uuid = str(uuid.uuid4())

    # Case A: Record not found or inaccessible under caller's RLS policy -> returns None
    conn.fetchrow.return_value = None
    res = await get_reading_by_id(pool, reading_uuid, user_uuid)
    assert res is None

    # Case B: When record is found -> returns the deserialized data dictionary
    expected_data = {
        "id": reading_uuid,
        "reading_title": "Authorized Reading",
        "love_reading": {"title": "Heart Line"},
    }
    conn.fetchrow.return_value = {"data": json.dumps(expected_data)}
    found_record = await get_reading_by_id(pool, reading_uuid, user_uuid)
    assert found_record == expected_data

    # Case C: Rejection of malformed or non-UUID caller identity (fails closed)
    with pytest.raises(IdentitySpoofingError):
        await get_reading_by_id(pool, reading_uuid, "guest_unauthorized_token")

    # Case D: Malformed reading ID returns None safely without unhandled error
    assert await get_reading_by_id(pool, "not-a-valid-uuid", user_uuid) is None


@pytest.mark.asyncio
async def test_soft_delete_reading_returns_false_when_not_found():
    """Verifies that soft_delete_reading returns False when 0 rows match (not found or unauthorized) and True on update."""
    pool, conn = create_mock_pool()
    user_uuid = str(uuid.uuid4())
    reading_uuid = str(uuid.uuid4())

    # Case A: Reading not found or unauthorized under RLS (0 rows updated)
    conn.execute.return_value = "UPDATE 0"
    deleted = await soft_delete_reading(pool, reading_uuid, user_uuid)
    assert deleted is False

    # Case B: Reading successfully soft-deleted (1 row updated)
    conn.execute.return_value = "UPDATE 1"
    deleted_success = await soft_delete_reading(pool, reading_uuid, user_uuid)
    assert deleted_success is True

    # Case C: Malformed reading ID returns False safely
    assert await soft_delete_reading(pool, "invalid-uuid", user_uuid) is False

    # Case D: Uninitialized pool raises DatabaseUnavailableError
    with pytest.raises(DatabaseUnavailableError):
        await soft_delete_reading(None, reading_uuid, user_uuid)
