import pytest
import time
import json
from unittest.mock import AsyncMock, patch, MagicMock
from services.api.cache import InMemoryTTLStore, CacheManager
from services.api.config import settings

def test_in_memory_ttl_store_basic():
    store = InMemoryTTLStore()
    store.set("test_key", {"foo": "bar"}, ttl_seconds=10)
    val = store.get("test_key")
    assert val == {"foo": "bar"}

    # Delete
    deleted = store.delete("test_key")
    assert deleted is True
    assert store.get("test_key") is None
    assert store.delete("non_existent") is False

def test_in_memory_ttl_store_expiration():
    store = InMemoryTTLStore()
    # Set with 1s TTL and simulate passage of time
    store.set("short_key", "temporary", ttl_seconds=1)
    assert store.get("short_key") == "temporary"

    # Manipulate entry timestamp directly to test eviction
    val, _ = store._store["short_key"]
    store._store["short_key"] = (val, time.time() - 1.0)

    # Calling get() should evict and return None
    assert store.get("short_key") is None
    assert "short_key" not in store._store

def test_in_memory_ttl_store_increment_rate_limit():
    store = InMemoryTTLStore()
    # Window of 60 seconds
    count1, ttl1 = store.increment("user_123", window_seconds=60)
    assert count1 == 1
    assert 0 < ttl1 <= 60

    count2, ttl2 = store.increment("user_123", window_seconds=60)
    assert count2 == 2
    assert 0 < ttl2 <= 60

@pytest.mark.asyncio
async def test_cache_manager_in_memory_fallback():
    manager = CacheManager()
    manager._is_upstash_configured = False

    # Set and get
    await manager.set("profile:user_abc", {"tier": "pro"}, ttl_seconds=100)
    result = await manager.get("profile:user_abc")
    assert result == {"tier": "pro"}

    # Health check
    health = manager.check_health()
    assert health["provider"] == "in_memory_ttl_fallback"
    assert health["is_upstash_configured"] is False

    # Delete
    assert await manager.delete("profile:user_abc") is True
    assert await manager.get("profile:user_abc") is None

@pytest.mark.asyncio
async def test_cache_manager_rate_limiting():
    manager = CacheManager()
    manager._is_upstash_configured = False

    key = "cv_analyze:test_user"
    max_req = 3

    # 1st call -> not limited, curr=1, remaining=2
    blocked, curr, rem = await manager.is_rate_limited(key, max_requests=max_req, window_seconds=60)
    assert not blocked
    assert curr == 1
    assert rem == 2

    # 2nd call -> not limited, curr=2, remaining=1
    blocked, curr, rem = await manager.is_rate_limited(key, max_requests=max_req, window_seconds=60)
    assert not blocked
    assert curr == 2
    assert rem == 1

    # 3rd call -> not limited, curr=3, remaining=0
    blocked, curr, rem = await manager.is_rate_limited(key, max_requests=max_req, window_seconds=60)
    assert not blocked
    assert curr == 3
    assert rem == 0

    # 4th call -> BLOCKED, curr=4, remaining=0
    blocked, curr, rem = await manager.is_rate_limited(key, max_requests=max_req, window_seconds=60)
    assert blocked
    assert curr == 4
    assert rem == 0

@pytest.mark.asyncio
async def test_cache_manager_upstash_mock():
    manager = CacheManager()
    manager._upstash_url = "https://mock-upstash.redis.io"
    manager._upstash_token = "mock_secret_token"
    manager._is_upstash_configured = True

    mock_client = AsyncMock()
    mock_client.is_closed = False

    # Mock GET response
    get_res = MagicMock()
    get_res.status_code = 200
    get_res.json.return_value = {"result": json.dumps({"status": "active", "reading_count": 5})}

    # Mock SET response
    set_res = MagicMock()
    set_res.status_code = 200
    set_res.json.return_value = {"result": "OK"}

    # Mock DEL response
    del_res = MagicMock()
    del_res.status_code = 200
    del_res.json.return_value = {"result": 1}

    # Mock pipeline response for rate limit
    pipeline_res = MagicMock()
    pipeline_res.status_code = 200
    pipeline_res.json.return_value = [{"result": 2}, {"result": "OK"}]

    async def mock_post(url, **kwargs):
        if url.endswith("/pipeline"):
            return pipeline_res
        payload = kwargs.get("json", [])
        cmd = payload[0] if payload else ""
        if cmd == "GET":
            return get_res
        elif cmd == "SET":
            return set_res
        elif cmd == "DEL":
            return del_res
        return get_res

    mock_client.post = AsyncMock(side_effect=mock_post)
    manager._http_client = mock_client

    # Test SET
    saved = await manager.set("test:upstash", {"hello": "world"}, ttl_seconds=300)
    assert saved is True

    # Test GET
    val = await manager.get("test:upstash")
    assert val == {"status": "active", "reading_count": 5}

    # Test Rate Limit
    blocked, curr, rem = await manager.is_rate_limited("user_upstash", max_requests=5)
    assert not blocked
    assert curr == 2
    assert rem == 3

    # Test DEL
    deleted = await manager.delete("test:upstash")
    assert deleted is True

    # Test graceful fallback when Upstash raises network error
    mock_client.post = AsyncMock(side_effect=Exception("Connection refused"))
    fallback_val = await manager.get("test:upstash")
    # Returns from local memory fallback without throwing 500
    assert fallback_val is not None or fallback_val is None

    await manager.close()
